import type { BuildSuggestion, CharacterLoadout, DbDCharacter } from '../src/types.js';
import { suggestGuideBuild } from './build-engine.js';
import { getCharacter, getMeta } from './dbd-api.js';
import { getPerkAccessForCharacter } from './inventory.js';
import { formatMechanicsForPrompt } from './mechanics-analyzer.js';
import { resolveKillerProfile } from './killer-synergy.js';

export interface CharacterGuideSuggestion {
  label: string;
  why: string;
  gamePlan: string;
  synergySummary: string;
  build: BuildSuggestion;
}

export interface CharacterGuide {
  character: DbDCharacter;
  bioText: string;
  knowledge: string;
  powerGuide?: string;
  playGuide?: string;
  survivorBuildNote?: string;
  suggestions: CharacterGuideSuggestion[];
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function killerPowerGuide(char: DbDCharacter): string | undefined {
  const parts: string[] = [];
  if (char.powerName) parts.push(char.powerName);
  if (char.powerDescription) parts.push(stripHtml(char.powerDescription));

  const profile = resolveKillerProfile(char, `${char.name} build`);
  if (profile?.strategy) {
    parts.push(profile.strategy);
  } else if (char.killerMechanics) {
    const m = char.killerMechanics;
    parts.push(
      `${m.loopType.replace(/-/g, ' ')} · ${m.chaseType.replace(/-/g, ' ')} · ${m.pressureFocus}. ${m.summary}`,
    );
  }

  return parts.length ? parts.join('\n\n') : undefined;
}

function killerVariantKeys(char: DbDCharacter): Array<{ key: string; label: string; why: string }> {
  const profile = resolveKillerProfile(char, `${char.name} build`);
  const m = char.killerMechanics;

  const variants: Array<{ key: string; label: string; why: string }> = [
    {
      key: 'power-sync',
      label: 'Power sync',
      why: profile?.strategy ?? 'Core perks that work with this Killer’s power, not generic chase perks.',
    },
    {
      key: 'slowdown',
      label: 'Regression & slowdown',
      why: 'Ruin/Pop-style pressure so gens don’t rush while you play around your power.',
    },
  ];

  if (m?.wantsTracking || m?.loopType === 'skips-loops' || m?.loopType === 'stealth') {
    variants.push({
      key: 'info',
      label: 'Tracking & locate',
      why: 'Find Survivors faster — important when you don’t win long loops.',
    });
  } else if (m?.chaseType === 'insta-down' || m?.chaseType === 'high-mobility') {
    variants.push({
      key: 'chase',
      label: 'Chase snowball',
      why: 'Convert hits into faster downs and snowball before gens finish.',
    });
  } else if (m?.wantsHookPressure || m?.loopType === 'zone-control') {
    variants.push({
      key: 'slug',
      label: 'Hook pressure',
      why: 'Control the hook game and punish grouped saves.',
    });
  } else {
    variants.push({
      key: 'info',
      label: 'Patrol & information',
      why: 'Cut down on random wandering between chases.',
    });
  }

  return variants;
}

function survivorVariants(): Array<{ key: string; label: string; why: string }> {
  return [
    {
      key: 'looping',
      label: 'Looping & exhaustion',
      why: 'Extend chases with one exhaustion perk — works on every Survivor.',
    },
    {
      key: 'gen-rush',
      label: 'Generator efficiency',
      why: 'Objective-focused perks; character identity does not change gen speed.',
    },
    {
      key: 'anti-tunnel',
      label: 'Anti-tunnel & focus',
      why: 'Survive being targeted after hook — universal defensive toolkit.',
    },
  ];
}

function stripPerkText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function composeGamePlan(build: BuildSuggestion, char: DbDCharacter, why: string): string {
  const parts: string[] = [why];
  if (build.strategy) parts.push(build.strategy);
  if (char.role === 'killer' && char.powerName) {
    parts.push(
      `Your power (${char.powerName}) is the main threat — these perks support what the power cannot do alone (gen pressure, locating Survivors, or closing chases).`,
    );
  }
  return parts.join('\n\n');
}

function composeSynergySummary(build: BuildSuggestion, char: DbDCharacter): string {
  if (!build.perks.length) return '';

  const lines: string[] = [
    `Goal: ${build.playstyle}. Each perk covers a different job in the rotation:`,
  ];

  const slotLabels = ['Primary', 'Secondary', 'Utility', 'Flex'];

  build.perks.forEach((perk, index) => {
    const label = slotLabels[index] ?? 'Flex';
    const effect = perk.description ? stripPerkText(perk.description) : '';
    const effectSnippet =
      effect.length > 160 ? `${effect.slice(0, 157).trim()}…` : effect;
    const pickReason = perk.reason || 'Fits this playstyle from your available pool.';
    const synergyNote = perk.synergy ? ` ${perk.synergy}` : '';

    lines.push(
      `${label} — ${perk.name}: ${pickReason}${synergyNote}${effectSnippet ? ` In practice: ${effectSnippet}` : ''}`,
    );
  });

  if (char.role === 'killer') {
    const profile = resolveKillerProfile(char, build.title);
    lines.push(
      profile
        ? `In match: ${profile.playstyle}. Open with your power, use regression perks to punish gen rushes, and lean on info/chase picks between power cooldowns.`
        : `In match: pressure with your power first; perks fill slowdown and chase gaps while Survivors try to finish gens.`,
    );
  } else {
    const hasExhaustion = build.perks.some((p) =>
      ['deadhard', 'sprintburst', 'balancedlanding', 'lithe', 'adrenaline'].includes(p.id),
    );
    lines.push(
      hasExhaustion
        ? `In match: do gens when safe, then use your exhaustion perk to extend one chase per cooldown — only one exhaustion perk is active at a time.`
        : `In match: stay on objective until the Killer commits, then use your defensive tools to reset and rejoin gens.`,
    );
  }

  return lines.join('\n\n');
}

function wrapSuggestion(
  label: string,
  why: string,
  build: BuildSuggestion,
  char: DbDCharacter,
): CharacterGuideSuggestion {
  return {
    label,
    why,
    gamePlan: composeGamePlan(build, char, why),
    synergySummary: composeSynergySummary(build, char),
    build,
  };
}

function dedupeSuggestions(items: CharacterGuideSuggestion[]): CharacterGuideSuggestion[] {
  const seen = new Set<string>();
  const out: CharacterGuideSuggestion[] = [];
  for (const item of items) {
    const key = item.build.perks
      .map((p) => p.id)
      .sort()
      .join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function getCharacterGuide(
  charId: string,
  characters: Record<string, CharacterLoadout>,
): CharacterGuide | null {
  const char = getCharacter(charId);
  if (!char) return null;

  const inventory = getPerkAccessForCharacter(charId, char.role, characters);

  const variantDefs = char.role === 'killer' ? killerVariantKeys(char) : survivorVariants();

  let suggestions: CharacterGuideSuggestion[] = variantDefs.map((v) =>
    wrapSuggestion(
      v.label,
      v.why,
      suggestGuideBuild(
        char.role,
        v.key,
        inventory,
        char.role === 'killer' ? char.id : undefined,
      ),
      char,
    ),
  );

  suggestions = dedupeSuggestions(suggestions);

  if (char.role === 'killer' && suggestions.length < 3) {
    const fallbackKeys = ['endgame', 'general', 'chase'].filter(
      (k) => !variantDefs.some((v) => v.key === k),
    );
    for (const key of fallbackKeys) {
      if (suggestions.length >= 3) break;
      const extra = suggestGuideBuild('killer', key, inventory, char.id);
      suggestions = dedupeSuggestions([
        ...suggestions,
        wrapSuggestion(KILLER_LABELS[key] ?? key, 'Alternate playstyle from your available perk pool.', extra, char),
      ]);
    }
  }

  return {
    character: char,
    bioText: char.bio ? stripHtml(char.bio) : `${char.name}`,
    knowledge: char.role === 'killer' ? formatMechanicsForPrompt(char) : '',
    powerGuide: char.role === 'killer' ? killerPowerGuide(char) : undefined,
    survivorBuildNote:
      char.role === 'survivor'
        ? 'Survivors have no unique powers — perk builds are playstyle-based and work on any Survivor. Use this page for lore and to mark which perks you own.'
        : undefined,
    suggestions: suggestions.slice(0, 3),
    gameVersion: getMeta().perkVersion,
  };
}

const KILLER_LABELS: Record<string, string> = {
  endgame: 'Endgame lockdown',
  general: 'All-rounder',
  chase: 'Chase acceleration',
};
