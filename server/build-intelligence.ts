import type { BuildPerk, DbDCharacter, DbDPerk, PerkInventory } from '../src/types.js';
import { formatDescriptionWithTier, getAllPerks, getPerk, perkToClient, resolvePerkRef } from './dbd-api.js';
import { KILLER_PROFILES, resolveKillerProfile, type KillerProfile } from './killer-synergy.js';
import { formatMechanicsForPrompt } from './mechanics-analyzer.js';
import { formatPerkTags, getPerkTags, scorePerkTagMatch } from './perk-taxonomy.js';

function uid(): string {
  return crypto.randomUUID();
}

function enrichBuildPerk(perk: DbDPerk, reason: string, tier: 1 | 2 | 3 = 3): BuildPerk {
  const client = perkToClient(perk);
  return {
    id: client.id,
    name: client.name,
    recommendedTier: tier,
    reason,
    description: formatDescriptionWithTier(perk, tier),
    categories: client.categories,
    synergy: reason,
  };
}

function handProfileBonus(perk: DbDPerk, hand?: KillerProfile): number {
  if (!hand) return 0;
  const coreIdx = hand.core.findIndex((ref) => resolvePerkRef(ref)?.id === perk.id);
  if (coreIdx >= 0) return 120 - coreIdx * 8;
  if (hand.good.some((ref) => resolvePerkRef(ref)?.id === perk.id)) return 50;
  if (hand.avoid.some((ref) => resolvePerkRef(ref)?.id === perk.id)) return -500;
  return 0;
}

export function scoreKillerPerk(
  perk: DbDPerk,
  char: DbDCharacter,
  inventory: PerkInventory,
  hand?: KillerProfile,
): number {
  const tier = inventory[perk.id] ?? 3;
  if (tier === 0) return -10000;

  const mechanics = char.killerMechanics;
  if (!mechanics) return tier + handProfileBonus(perk, hand);

  let score = tier + handProfileBonus(perk, hand);
  score += scorePerkTagMatch(perk, mechanics.priorityPerkTags, mechanics.avoidPerkTags);

  if (mechanics.wantsTracking && getPerkTags(perk).includes('tracking')) score += 20;
  if (mechanics.wantsAntiHeal && getPerkTags(perk).includes('anti-heal')) score += 20;
  if (mechanics.wantsStealthCounter && getPerkTags(perk).includes('stealth-counter')) score += 15;
  if (mechanics.wantsHookPressure && getPerkTags(perk).includes('hook-pressure')) score += 15;

  if (mechanics.loopType === 'skips-loops' && getPerkTags(perk).some((t) => ['loop-break', 'chase-end'].includes(t))) {
    score -= 80;
  }
  if (mechanics.chaseType === 'insta-down' && getPerkTags(perk).includes('loop-break')) score -= 60;

  if (mechanics.pressureFocus === 'slowdown' && getPerkTags(perk).includes('slowdown')) score += 25;
  if (mechanics.pressureFocus === 'chase' && getPerkTags(perk).includes('chase-end')) score += 20;

  return score;
}

export function scoreSurvivorPerk(
  perk: DbDPerk,
  char: DbDCharacter,
  inventory: PerkInventory,
): number {
  const tier = inventory[perk.id] ?? 3;
  if (tier === 0) return -10000;

  const profile = char.survivorMechanics;
  if (!profile) return tier;

  let score = tier + scorePerkTagMatch(perk, profile.priorityPerkTags, []);

  if (char.perks.includes(perk.id)) score += 30;

  return score;
}

function perkReasonForKiller(perk: DbDPerk, char: DbDCharacter, hand?: KillerProfile): string {
  const tags = formatPerkTags(perk);
  const m = char.killerMechanics;

  if (hand?.core.some((ref) => resolvePerkRef(ref)?.id === perk.id)) {
    return `Meta pick for ${char.name} — ${tags}. ${m?.summary.split('.')[0] ?? ''}`.trim();
  }

  if (m) {
    const matched = m.priorityPerkTags.filter((t) => getPerkTags(perk).includes(t as never));
    if (matched.length) {
      return `Supports ${char.powerName ?? char.name}'s ${m.loopType.replace(/-/g, ' ')} play (${matched.join(', ')}).`;
    }
  }

  return `Fits ${char.name}'s kit via ${tags}.`;
}

function perkReasonForSurvivor(perk: DbDPerk, char: DbDCharacter): string {
  const arch = char.survivorMechanics?.archetype ?? 'general';
  if (char.perks.includes(perk.id)) {
    return `${char.name}'s teachable — core to their ${arch} playstyle.`;
  }
  return `Supports ${arch} play as ${char.name} (${formatPerkTags(perk)}).`;
}

export function buildKillerLoadout(
  char: DbDCharacter,
  inventory: PerkInventory,
  message: string,
): BuildPerk[] {
  const hand = resolveKillerProfile(char, message);
  const candidates = getAllPerks('killer');

  const scored = candidates
    .map((p) => ({ perk: p, score: scoreKillerPerk(p, char, inventory, hand) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  const picked: BuildPerk[] = [];
  const usedTags = new Set<string>();

  for (const { perk } of scored) {
    if (picked.length >= 4) break;
    const tags = getPerkTags(perk);
    const isSlowdown = tags.includes('slowdown');
    const slowdownCount = picked.filter((p) => getPerkTags(getPerk(p.id)!).includes('slowdown')).length;

    if (isSlowdown && slowdownCount >= 2 && picked.length >= 2) continue;

    picked.push(enrichBuildPerk(perk, perkReasonForKiller(perk, char, hand), 3));
    tags.forEach((t) => usedTags.add(t));
  }

  return picked;
}

export function buildSurvivorLoadout(char: DbDCharacter, inventory: PerkInventory): BuildPerk[] {
  const candidates = getAllPerks('survivor');
  const arch = char.survivorMechanics?.archetype;

  const scored = candidates
    .map((p) => ({ perk: p, score: scoreSurvivorPerk(p, char, inventory) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  const picked: BuildPerk[] = [];
  let exhaustionCount = 0;

  for (const { perk } of scored) {
    if (picked.length >= 4) break;
    const isExhaustion = ['deadhard', 'sprintburst', 'balancedlanding', 'lithe', 'adrenaline'].includes(perk.id);
    if (isExhaustion && exhaustionCount >= 1) continue;
    if (isExhaustion) exhaustionCount++;

    picked.push(enrichBuildPerk(perk, perkReasonForSurvivor(perk, char), 3));
  }

  if (arch === 'looper' && exhaustionCount === 0) {
    for (const ref of ['Dead Hard', 'Sprint Burst', 'Balanced Landing', 'Lithe']) {
      const p = resolvePerkRef(ref);
      if (p && (inventory[p.id] ?? 3) > 0 && !picked.some((x) => x.id === p.id)) {
        picked.unshift(enrichBuildPerk(p, perkReasonForSurvivor(p, char), 3));
        break;
      }
    }
  }

  return picked.slice(0, 4);
}

export function buildGenericLoadout(
  role: 'survivor' | 'killer',
  inventory: PerkInventory,
  perkPool: string[],
): BuildPerk[] {
  const picked: BuildPerk[] = [];
  const used = new Set<string>();

  for (const ref of perkPool) {
    if (picked.length >= 4) break;
    const perk = resolvePerkRef(ref);
    if (!perk || used.has(perk.id) || (inventory[perk.id] ?? 3) === 0) continue;
    used.add(perk.id);
    picked.push(enrichBuildPerk(perk, `Strong ${formatPerkTags(perk)} pick for this playstyle.`, 3));
  }

  if (picked.length < 4) {
    for (const perk of getAllPerks(role)) {
      if (picked.length >= 4) break;
      if (used.has(perk.id) || (inventory[perk.id] ?? 3) === 0) continue;
      used.add(perk.id);
      picked.push(enrichBuildPerk(perk, `Available ${formatPerkTags(perk)} option.`, 3));
    }
  }

  return picked.slice(0, 4);
}

export function getCharacterKnowledge(char: DbDCharacter): string {
  return formatMechanicsForPrompt(char);
}

export function getGlobalKillerKnowledge(): string {
  return KILLER_PROFILES.length + ' hand-tuned killer profiles plus live power data for all killers.';
}

export function findReplacementForKiller(
  missing: DbDPerk,
  char: DbDCharacter,
  inventory: PerkInventory,
  excludeIds: Set<string>,
  message: string,
): BuildPerk | undefined {
  const hand = resolveKillerProfile(char, message);
  const best = getAllPerks('killer')
    .filter((p) => !excludeIds.has(p.id) && (inventory[p.id] ?? 3) > 0)
    .map((p) => ({ perk: p, score: scoreKillerPerk(p, char, inventory, hand) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.perk;

  if (!best) return undefined;
  return enrichBuildPerk(best, `Replaces ${missing.name} — ${perkReasonForKiller(best, char, hand)}`, 3);
}

export { uid as generateBuildId };
