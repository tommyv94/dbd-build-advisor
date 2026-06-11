import OpenAI from 'openai';
import type { BuildSuggestion, ChatRequest, ChatResponse, DbDCharacter, DbDPerk, Role } from '../src/types.js';
import { getCharacterKnowledge } from './build-intelligence.js';
import {
  adjustBuildForInventory,
  enrichBuildFromDb,
  formatAdjustments,
  formatBuildSummary,
  isBuildRequest,
  isInventoryReport,
  parseInventoryIssues,
  suggestBuild,
} from './build-engine.js';
import { findCharacter, getAllPerks, getCharacter, getMeta } from './dbd-api.js';
import { detectKillerFromMessage, detectSurvivorFromMessage } from './killer-synergy.js';
import { getPerkAccessForCharacter, resolveContextCharacter } from './inventory.js';

function perkContext(perks: DbDPerk[], limit = 80): string {
  return perks
    .slice(0, limit)
    .map((p) => {
      const tiers = Object.entries(p.tunables)
        .slice(0, 2)
        .map(([k, v]) => `${k}: T1=${v[0]} T2=${v[1]} T3=${v[2]}`)
        .join('; ');
      return `- ${p.name} (${p.id}) [${p.categories.join(', ')}]${tiers ? ` | ${tiers}` : ''}`;
    })
    .join('\n');
}

function resolveContextChar(req: ChatRequest): DbDCharacter | undefined {
  const detect =
    req.role === 'killer'
      ? (msg: string) => detectKillerFromMessage(msg)
      : (msg: string) => detectSurvivorFromMessage(msg);

  const charId = resolveContextCharacter(req.role, req.message, req.activeCharacterId, detect);
  if (charId) return getCharacter(charId);
  return findCharacter(req.message);
}

function buildSystemPrompt(role: string, meta: ReturnType<typeof getMeta>, contextChar?: DbDCharacter): string {
  const perks = getAllPerks(role as Role);
  const charKnowledge = contextChar ? getCharacterKnowledge(contextChar) : '';

  return `You are an expert Dead by Daylight build advisor (patch ${meta.perkVersion}).
${meta.killerCount ?? 0} killers loaded with live power data (${meta.killersWithPowerData ?? 0} with synced power descriptions).

CRITICAL RULES FOR KILLER BUILDS:
- Every perk must synergize with that Killer's POWER, not just generic meta.
- Loop-break perks (Bamboozle, Enduring, Spirit Fury, STBFL) are BAD on blink/warp/teleport Killers (Nurse, Blight, Spirit, etc.) because they skip loops.
- STBFL is BAD on instant-down Killers (Hillbilly, Leatherface chainsaw, etc.).
- Zone-control Killers (Hag, Trapper, Knight) want regression + hook pressure, not chase snowball perks.
- Ranged Killers (Huntress, Trickster, Deathslinger) want info between shots, not pallet breakers.
- Stealth Killers (Ghost Face, Myers, Wraith) want detection/stealth-counter perks.

When suggesting builds, respond with JSON in this exact shape inside a \`\`\`json code block:
{
  "reply": "conversational explanation with strategy",
  "build": {
    "title": "Build name",
    "character": "killer or survivor name",
    "characterId": "api character id if known",
    "playstyle": "short label",
    "strategy": "2-3 sentences",
    "powerSummary": "killer power name and brief mechanics if killer",
    "mechanicsSummary": "loop/chase/pressure profile",
    "explanation": "why this works",
    "perks": [
      { "id": "perkId", "name": "Perk Name", "recommendedTier": 3, "reason": "why for THIS killer/survivor" }
    ]
  }
}

Rules:
- Exactly 4 perks. Respect user's per-character perk availability.
- Killer builds MUST mesh with the named Killer's power mechanics below.

${charKnowledge ? `=== TARGET CHARACTER KNOWLEDGE ===\n${charKnowledge}\n=== END CHARACTER KNOWLEDGE ===` : ''}

Available ${role} perks (sample):
${perkContext(perks)}`;
}

function resolveInventory(req: ChatRequest) {
  const detect =
    req.role === 'killer'
      ? (msg: string) => detectKillerFromMessage(msg)
      : (msg: string) => detectSurvivorFromMessage(msg);

  const charId = resolveContextCharacter(req.role, req.message, req.activeCharacterId, detect);
  const inventory = getPerkAccessForCharacter(charId, req.role, req.characters);
  return { charId, inventory };
}

async function chatWithOpenAI(req: ChatRequest): Promise<ChatResponse | null> {
  if (!req.openaiApiKey) return null;

  const meta = getMeta();
  const contextChar = resolveContextChar(req);
  const client = new OpenAI({ apiKey: req.openaiApiKey });
  const { inventory } = resolveInventory(req);

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: buildSystemPrompt(req.role, meta, contextChar) },
  ];

  for (const msg of req.history.slice(-10)) {
    messages.push({
      role: msg.role,
      content: msg.build
        ? `${msg.content}\n\nPrevious build: ${JSON.stringify(msg.build)}`
        : msg.content,
    });
  }

  const locked = Object.fromEntries(Object.entries(inventory).filter(([, t]) => t < 3));
  const charNote = contextChar ? `\n\nCharacter context:\n${getCharacterKnowledge(contextChar)}` : '';
  messages.push({
    role: 'user',
    content: `${req.message}${charNote}\n\nPerk availability for this character (0=locked): ${JSON.stringify(locked)}${req.currentBuild ? `\n\nCurrent build: ${JSON.stringify(req.currentBuild)}` : ''}`,
  });

  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.7,
      max_tokens: 2000,
    });

    const text = completion.choices[0]?.message?.content ?? '';
    const jsonMatch = text.match(/```json\s*([\s\S]*?)```/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1]) as ChatResponse & {
        build?: BuildSuggestion & { perks: Array<{ id?: string; name: string }> };
      };
      if (parsed.build) {
        parsed.build = enrichBuildFromDb(parsed.build);
        if (contextChar && !parsed.build.powerSummary && contextChar.powerName) {
          parsed.build.powerSummary = contextChar.powerName;
        }
        if (contextChar && !parsed.build.mechanicsSummary) {
          parsed.build.mechanicsSummary =
            contextChar.killerMechanics?.summary ?? contextChar.survivorMechanics?.summary;
        }
      }
      return parsed;
    }

    return { reply: text };
  } catch {
    return null;
  }
}

function localChat(req: ChatRequest): ChatResponse {
  const { message, role, currentBuild } = req;
  const { charId, inventory } = resolveInventory(req);

  if (currentBuild && isInventoryReport(message)) {
    const issues = parseInventoryIssues(message);
    const { build, adjustments } = adjustBuildForInventory(currentBuild, inventory, issues);

    if (!adjustments.length) {
      return {
        reply:
          'I couldn\'t identify which perk you mean. Try: "I don\'t have Hex: Ruin" or "Only Tier 1 Dead Hard".',
        build: currentBuild,
      };
    }

    return {
      reply: `Adjusted for your available perks:\n\n${formatAdjustments(adjustments)}`,
      build,
      adjustments,
    };
  }

  if (isBuildRequest(message) || !currentBuild) {
    let build = suggestBuild(message, role, inventory, charId);

    const unowned = build.perks.filter((p) => (inventory[p.id] ?? 3) === 0);
    if (unowned.length) {
      const { build: adjusted, adjustments } = adjustBuildForInventory(build, inventory);
      build = adjusted;
      return {
        reply: `Here's a build using perks you have available${build.character ? ` for **${build.character}**` : ''}. Swapped ${unowned.length} locked perk(s):\n\n${formatAdjustments(adjustments)}`,
        build,
        adjustments,
      };
    }

    return {
      reply: formatBuildSummary(build),
      build,
    };
  }

  if (isInventoryReport(message) && currentBuild) {
    const issues = parseInventoryIssues(message);
    const { build, adjustments } = adjustBuildForInventory(currentBuild, inventory, issues);
    return {
      reply: `Here's what I'd do:\n\n${formatAdjustments(adjustments)}`,
      build,
      adjustments,
    };
  }

  return {
    reply: `Ask for a **${role}** build — e.g. "Nurse build" or "Looping build for Meg".

Set perk availability in **Collection**: pick a character, then mark which perks from the full pool you have when playing them.

Patch **${getMeta().perkVersion}** — ${getMeta().killersWithPowerData ?? 0} killers with live power data.`,
  };
}

export async function handleChat(req: ChatRequest): Promise<ChatResponse> {
  const ai = await chatWithOpenAI(req);
  if (ai?.build) {
    ai.build = enrichBuildFromDb(ai.build);
  }
  if (ai?.build || (ai?.reply && ai.reply.length > 50)) return ai;
  return localChat(req);
}
