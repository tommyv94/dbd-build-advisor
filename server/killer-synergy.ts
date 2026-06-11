import type { DbDCharacter } from '../src/types.js';
import { findCharacter, getCharacters, resolvePerkRef } from './dbd-api.js';

export interface KillerProfile {
  /** Match against character id (lowercase) or aliases in user message */
  ids: string[];
  aliases: string[];
  playstyle: string;
  strategy: string;
  /** Ordered best picks — engine tries these first */
  core: string[];
  /** Solid alternatives if core unavailable */
  good: string[];
  /** Perks that clash with this power — never suggest */
  avoid: string[];
}

export const KILLER_PROFILES: KillerProfile[] = [
  {
    ids: ['nurse'],
    aliases: ['nurse'],
    playstyle: 'Blink pressure & fatigue tracking',
    strategy:
      'Short blinks mean you skip loops — lean into tracking injured Survivors and punishing healing. Slowdown keeps gens in check while you chain pressure with blink hits.',
    core: ['A Nurse\'s Calling', 'Stridor', 'Thanatophobia', 'Hex: Ruin', 'Pop Goes the Weasel', 'Surveillance'],
    good: ['Corrupt Intervention', 'Pain Resonance', 'Deadlock', 'Hex: Hunt Them Down', 'Whispers'],
    avoid: ['Save the Best for Last', 'Enduring Pain', 'Spirit Fury', 'Bamboozle', 'Monitor & Abuse'],
  },
  {
    ids: ['k21', 'blight'],
    aliases: ['blight', 'alchemy'],
    playstyle: 'Speed blight rush & cutoffs',
    strategy:
      'You win by ending chases fast and using rush to traverse the map. Regression plus chase perks that help between rushes — not STBFL since you don\'t loop.',
    core: ['Hex: Ruin', 'Pop Goes the Weasel', 'Hex: Hunt Them Down', 'Save the Best for Last', 'Corrupt Intervention', 'Bamboozle'],
    good: ['Deadlock', 'Pain Resonance', 'Tinkerer', 'Whispers', 'Brutal Strength'],
    avoid: ['Enduring Pain', 'Spirit Fury', 'Monitor & Abuse', 'Make Your Choice'],
  },
  {
    ids: ['spirit'],
    aliases: ['spirit', 'rin'],
    playstyle: 'Spirit fury & passive phasing reads',
    strategy:
      'Spirit dominates at loops with phasing — Stridor and Surveillance help follow during and after power. Pop or Ruin for gen pressure while you snowball from one good read.',
    core: ['Hex: Ruin', 'Pop Goes the Weasel', 'Stridor', 'Surveillance', 'Hex: Hunt Them Down', 'Save the Best for Last'],
    good: ['Thanatophobia', 'Pain Resonance', 'Deadlock', 'Whispers', 'Corrupt Intervention'],
    avoid: ['Enduring Pain', 'Spirit Fury', 'Bamboozle', 'Starstruck'],
  },
  {
    ids: ['hillbilly', 'hillbilly'],
    aliases: ['billy', 'hillbilly'],
    playstyle: 'Cross-map chainsaw & curve pressure',
    strategy:
      'Insta-down chainsaw is your win condition — find Survivors early and cross the map for multi-downs. Info and regression so gens don\'t rush while you hunt.',
    core: ['Hex: Ruin', 'Pop Goes the Weasel', 'Tinkerer', 'Whispers', 'Hex: Hunt Them Down', 'Corrupt Intervention'],
    good: ['Surveillance', 'Deadlock', 'Pain Resonance', 'Brutal Strength', 'Barbecue & Chilli'],
    avoid: ['Save the Best for Last', 'Enduring Pain', 'Spirit Fury', 'Bamboozle'],
  },
  {
    ids: ['bear', 'huntress'],
    aliases: ['huntress', 'bear'],
    playstyle: 'Ranged hatchets & short-loop control',
    strategy:
      'Hatchets shred at loops without tiles — regression and detection perks help between chases. Iron Grasp and Brutal Strength secure hook trades.',
    core: ['Hex: Ruin', 'Whispers', 'Brutal Strength', 'Iron Grasp', 'Surveillance', 'Pop Goes the Weasel'],
    good: ['Hex: Hunt Them Down', 'Deadlock', 'Corrupt Intervention', 'Pain Resonance', 'Agitation'],
    avoid: ['Save the Best for Last', 'Enduring Pain', 'Spirit Fury', 'Starstruck'],
  },
  {
    ids: ['shape', 'myers'],
    aliases: ['myers', 'shape', 'stalker'],
    playstyle: 'Stalk & tier III burst',
    strategy:
      'You need time to stalk and a strong tier III pop — slowdown and stealth info so you can build evil without gens finishing. Monitor helps find targets to stalk.',
    core: ['Hex: Ruin', 'Pop Goes the Weasel', 'Monitor & Abuse', 'Whispers', 'Corrupt Intervention', 'Hex: No One Escapes Death'],
    good: ['Play with Your Food', 'Save the Best for Last', 'Deadlock', 'Pain Resonance', 'Infectious Fright'],
    avoid: ['Enduring Pain', 'Spirit Fury', 'Bamboozle', 'Starstruck'],
  },
  {
    ids: ['witch', 'hag'],
    aliases: ['hag', 'witch'],
    playstyle: 'Trap teleport & territory control',
    strategy:
      'Traps define your territory — regression and lockdown perks that punish leaving hooks. Avoid chase perks that assume you win long loops.',
    core: ['Hex: Ruin', 'Pop Goes the Weasel', 'Make Your Choice', 'Hex: Devour Hope', 'Monitor & Abuse', 'Deadlock'],
    good: ['Corrupt Intervention', 'Pain Resonance', 'Thanatophobia', 'Coulrophobia', 'Scourge Hook: Pain Relief'],
    avoid: ['Save the Best for Last', 'Enduring Pain', 'Spirit Fury', 'Starstruck', 'Bamboozle'],
  },
  {
    ids: ['chuckles', 'trapper'],
    aliases: ['trapper', 'chuckles'],
    playstyle: 'Trap zone control & area denial',
    strategy:
      'Traps slow the match and define strong zones — gen regression plus perks that help patrol trapped areas. Brutal Strength and Agitation for hook game.',
    core: ['Hex: Ruin', 'Pop Goes the Weasel', 'Corrupt Intervention', 'Whispers', 'Brutal Strength', 'Agitation'],
    good: ['Deadlock', 'Pain Resonance', 'Surveillance', 'Hex: Hunt Them Down', 'Iron Grasp'],
    avoid: ['Save the Best for Last', 'Enduring Pain', 'Spirit Fury', 'Starstruck'],
  },
  {
    ids: ['bob', 'wraith'],
    aliases: ['wraith', 'bob'],
    playstyle: 'Hit-and-run uncloak pressure',
    strategy:
      'Repeated surprise hits and gen kick pressure — Pop/Ruin and info perks to find the next target after unhook pressure. STBFL works on aggressive hit-and-run.',
    core: ['Hex: Ruin', 'Pop Goes the Weasel', 'Save the Best for Last', 'Hex: Hunt Them Down', 'Surveillance', 'Corrupt Intervention'],
    good: ['Whispers', 'Deadlock', 'Pain Resonance', 'Bamboozle', 'Brutal Strength'],
    avoid: ['Enduring Pain', 'Spirit Fury', 'Make Your Choice'],
  },
  {
    ids: ['killer07', 'doctor'],
    aliases: ['doctor', 'doc', 'killer07'],
    playstyle: 'Madness zone control & shock therapy',
    strategy:
      'Area denial with shock and madness — slowdown plus perks that help find spread-out Survivors. Overwhelming Presence extends your terror/control.',
    core: ['Hex: Ruin', 'Pop Goes the Weasel', 'Overwhelming Presence', 'Monitor & Abuse', 'Corrupt Intervention', 'Whispers'],
    good: ['Pain Resonance', 'Deadlock', 'Surveillance', 'Thanatophobia', 'Infectious Fright'],
    avoid: ['Save the Best for Last', 'Enduring Pain', 'Spirit Fury', 'Bamboozle'],
  },
  {
    ids: ['cannibal', 'bubba'],
    aliases: ['cannibal', 'bubba', 'leatherface'],
    playstyle: 'Chainsaw sweep at loops',
    strategy:
      'Insta-down at pallets — Bamboozle and Enduring help break loop meta. Regression so you can rev chainsaw without losing the game.',
    core: ['Hex: Ruin', 'Pop Goes the Weasel', 'Bamboozle', 'Enduring Pain', 'Corrupt Intervention', 'Brutal Strength'],
    good: ['Save the Best for Last', 'Hex: Hunt Them Down', 'Deadlock', 'Pain Resonance', 'Iron Grasp'],
    avoid: ['Spirit Fury', 'Starstruck', 'Make Your Choice'],
  },
  {
    ids: ['pig'],
    aliases: ['pig', 'amanda'],
    playstyle: 'Ambush & head trap pressure',
    strategy:
      'Stealth ambush and RBT endgame pressure — slowdown and perks that help patrol trapped Survivors. Make Your Choice punishes immediate saves.',
    core: ['Hex: Ruin', 'Pop Goes the Weasel', 'Make Your Choice', 'Monitor & Abuse', 'Corrupt Intervention', 'Whispers'],
    good: ['Save the Best for Last', 'Hex: Hunt Them Down', 'Deadlock', 'Pain Resonance', 'Scourge Hook: Pain Relief'],
    avoid: ['Enduring Pain', 'Spirit Fury', 'Starstruck', 'Bamboozle'],
  },
  {
    ids: ['legion'],
    aliases: ['legion', 'frank'],
    playstyle: 'Multi-hit frenzy & spread injury',
    strategy:
      'Frenzy spreads injury — Thanatophobia and regression keep healing expensive. Surveillance or Discordance to chain hits across the map.',
    core: ['Hex: Ruin', 'Pop Goes the Weasel', 'Thanatophobia', 'Surveillance', 'Corrupt Intervention', 'Discordance'],
    good: ['Deadlock', 'Pain Resonance', 'Hex: Hunt Them Down', 'Sloppy Butcher', 'Infectious Fright'],
    avoid: ['Save the Best for Last', 'Enduring Pain', 'Spirit Fury', 'Bamboozle'],
  },
  {
    ids: ['plague'],
    aliases: ['plague', 'adin'],
    playstyle: 'Vomit infection & fountain control',
    strategy:
      'Infection forces healing interactions — Corrupt and regression buy time to spread sickness. Monitor helps find grouped Survivors.',
    core: ['Hex: Ruin', 'Pop Goes the Weasel', 'Corrupt Intervention', 'Monitor & Abuse', 'Thanatophobia', 'Deadlock'],
    good: ['Pain Resonance', 'Surveillance', 'Whispers', 'Infectious Fright', 'Barbecue & Chilli'],
    avoid: ['Save the Best for Last', 'Enduring Pain', 'Spirit Fury', 'Bamboozle'],
  },
  {
    ids: ['ghostface'],
    aliases: ['ghostface', 'ghost face', 'danny'],
    playstyle: 'Stealth expose & mark pressure',
    strategy:
      'Exposed strikes from stealth — perks that help stalk and relocate. Regression mandatory since you need time to mark.',
    core: ['Hex: Ruin', 'Pop Goes the Weasel', 'Corrupt Intervention', 'Hex: Hunt Them Down', 'Save the Best for Last', 'Whispers'],
    good: ['Deadlock', 'Pain Resonance', 'Monitor & Abuse', 'Play with Your Food', 'Infectious Fright'],
    avoid: ['Enduring Pain', 'Spirit Fury', 'Bamboozle', 'Starstruck'],
  },
  {
    ids: ['oni'],
    aliases: ['oni', 'kazan'],
    playstyle: 'Demon dash & blood orb economy',
    strategy:
      'Collect orbs then dash for rapid downs — STBFL snowballs after first hook. Regression and info between demon mode spikes.',
    core: ['Hex: Ruin', 'Pop Goes the Weasel', 'Save the Best for Last', 'Hex: Hunt Them Down', 'Corrupt Intervention', 'Whispers'],
    good: ['Deadlock', 'Pain Resonance', 'Surveillance', 'Infectious Fright', 'Brutal Strength'],
    avoid: ['Enduring Pain', 'Spirit Fury', 'Bamboozle', 'Make Your Choice'],
  },
  {
    ids: ['k23', 'trickster'],
    aliases: ['trickster', 'ji-woon'],
    playstyle: 'Ranged knife barrage',
    strategy:
      'Ranged pressure at loops — regression and chase perks that don\'t assume pallet breaks. Starstruck synergizes with ranged hits on carries.',
    core: ['Hex: Ruin', 'Pop Goes the Weasel', 'Hex: Hunt Them Down', 'Save the Best for Last', 'Starstruck', 'Corrupt Intervention'],
    good: ['Deadlock', 'Pain Resonance', 'Whispers', 'No Way Out', 'Infectious Fright'],
    avoid: ['Enduring Pain', 'Spirit Fury', 'Bamboozle', 'Make Your Choice'],
  },
  {
    ids: ['k29', 'wesker', 'mastermind'],
    aliases: ['wesker', 'mastermind', 'albert'],
    playstyle: 'Power punch & map traversal',
    strategy:
      'Punch and vault mobility — Overwhelming Presence and regression. STBFL rewards aggressive multi-target pressure.',
    core: ['Hex: Ruin', 'Pop Goes the Weasel', 'Hex: Hunt Them Down', 'Save the Best for Last', 'Overwhelming Presence', 'Corrupt Intervention'],
    good: ['Deadlock', 'Pain Resonance', 'Starstruck', 'Whispers', 'Infectious Fright'],
    avoid: ['Enduring Pain', 'Spirit Fury', 'Bamboozle', 'Make Your Choice'],
  },
  {
    ids: ['k20', 'executioner', 'pyramid head'],
    aliases: ['executioner', 'pyramid head', 'ph'],
    playstyle: 'Torment trail & cage punishment',
    strategy:
      'Trails control space and cages bypass hooks — regression and area perks. Monitor helps patrol torment zones.',
    core: ['Hex: Ruin', 'Pop Goes the Weasel', 'Monitor & Abuse', 'Corrupt Intervention', 'Deadlock', 'Pain Resonance'],
    good: ['Whispers', 'Surveillance', 'Thanatophobia', 'Infectious Fright', 'Scourge Hook: Pain Relief'],
    avoid: ['Save the Best for Last', 'Enduring Pain', 'Spirit Fury', 'Starstruck'],
  },
  {
    ids: ['nightmare', 'freddy'],
    aliases: ['freddy', 'nightmare', 'krueger'],
    playstyle: 'Dream teleport & sleep slowdown',
    strategy:
      'Teleports and sleep slow the game — heavy regression and gen kick. Pop is especially strong with teleport kick-backs.',
    core: ['Hex: Ruin', 'Pop Goes the Weasel', 'Corrupt Intervention', 'Deadlock', 'Pain Resonance', 'Infectious Fright'],
    good: ['Monitor & Abuse', 'Whispers', 'Thanatophobia', 'Surveillance', 'Barbecue & Chilli'],
    avoid: ['Save the Best for Last', 'Enduring Pain', 'Spirit Fury', 'Bamboozle'],
  },
  {
    ids: ['clown'],
    aliases: ['clown', 'kenneth'],
    playstyle: 'Bottle loops & exhaustion pressure',
    strategy:
      'Bottles end loops quickly — regression plus Bamboozle for vault denial. Pop after hook while Survivors are spread.',
    core: ['Hex: Ruin', 'Pop Goes the Weasel', 'Bamboozle', 'Corrupt Intervention', 'Hex: Hunt Them Down', 'Save the Best for Last'],
    good: ['Deadlock', 'Pain Resonance', 'Whispers', 'Brutal Strength', 'Infectious Fright'],
    avoid: ['Enduring Pain', 'Spirit Fury', 'Make Your Choice'],
  },
  {
    ids: ['gunslinger', 'deathslinger'],
    aliases: ['deathslinger', 'gunslinger', 'caleb'],
    playstyle: 'Spear rifle & reel control',
    strategy:
      'Rifle controls space at range — regression and info between shots. STBFL optional for trade-heavy play.',
    core: ['Hex: Ruin', 'Pop Goes the Weasel', 'Hex: Hunt Them Down', 'Corrupt Intervention', 'Whispers', 'Deadlock'],
    good: ['Save the Best for Last', 'Pain Resonance', 'Surveillance', 'Infectious Fright', 'No Way Out'],
    avoid: ['Enduring Pain', 'Spirit Fury', 'Bamboozle', 'Starstruck'],
  },
];

const SURVIVOR_PROFILES: Array<{
  ids: string[];
  aliases: string[];
  core: string[];
  good: string[];
  strategy: string;
}> = [
  {
    ids: ['meg'],
    aliases: ['meg'],
    core: ['Sprint Burst', 'Adrenaline', 'Quick & Quiet', 'Borrowed Time', 'Dead Hard', 'Windows of Opportunity'],
    good: ['Iron Will', 'Self-Care', 'Prove Thyself', 'Bond'],
    strategy: 'Lean into exhaustion perks and chase resets — Meg\'s teachables define a classic looper.',
  },
  {
    ids: ['dwight'],
    aliases: ['dwight'],
    core: ['Prove Thyself', 'Leader', 'Bond', 'Borrowed Time', 'Kindred', 'Resilience'],
    good: ['Dead Hard', 'Sprint Burst', 'Self-Care', "We'll Make It"],
    strategy: 'Team-oriented gen efficiency and aura info — best when coordinating with others.',
  },
  {
    ids: ['claudette'],
    aliases: ['claudette'],
    core: ['Self-Care', 'Botany Knowledge', 'Empathy', 'Iron Will', 'Spine Chill', 'Prove Thyself'],
    good: ['Dead Hard', 'Borrowed Time', 'Urban Evasion', 'Kindred'],
    strategy: 'Self-heal and botany builds — stay injured quietly and off the radar.',
  },
  {
    ids: ['david', 'davidking'],
    aliases: ['david', 'king'],
    core: ['Dead Hard', 'No Mither', 'We\'re Gonna Live Forever', 'Borrowed Time', 'Unbreakable', 'Sprint Burst'],
    good: ['Iron Will', 'Resilience', 'Off the Record', 'Adrenaline'],
    strategy: 'Dead Hard looping with optional oneshot build paths — classic aggressive looper.',
  },
];

function normalizeId(id: string): string {
  return id.toLowerCase().replace(/\s+/g, '');
}

export function resolveKillerProfile(char: DbDCharacter | undefined, message: string): KillerProfile | undefined {
  if (char) {
    const cid = normalizeId(char.id);
    const byId = KILLER_PROFILES.find((p) => p.ids.some((id) => normalizeId(id) === cid));
    if (byId) return byId;
  }
  const m = message.toLowerCase();
  for (const profile of KILLER_PROFILES) {
    if (profile.aliases.some((a) => m.includes(a))) return profile;
    if (profile.ids.some((id) => m.includes(normalizeId(id)))) return profile;
  }
  return undefined;
}

export function resolveSurvivorProfile(char: DbDCharacter | undefined, message: string) {
  if (char) {
    const cid = normalizeId(char.id);
    const byId = SURVIVOR_PROFILES.find((p) => p.ids.some((id) => normalizeId(id) === cid));
    if (byId) return byId;
  }
  const m = message.toLowerCase();
  return SURVIVOR_PROFILES.find(
    (p) => p.aliases.some((a) => m.includes(a)) || p.ids.some((id) => m.includes(normalizeId(id))),
  );
}

export function isPerkAvoidedForKiller(perkId: string, profile: KillerProfile): boolean {
  const perk = resolvePerkRef(perkId);
  if (!perk) return false;
  return profile.avoid.some((ref) => {
    const p = resolvePerkRef(ref);
    return p?.id === perk.id;
  });
}

export function killerPerkReason(perkId: string, profile: KillerProfile): string {
  const perk = resolvePerkRef(perkId);
  if (!perk) return 'Synergy pick for this Killer.';
  const inCore = profile.core.some((ref) => resolvePerkRef(ref)?.id === perk.id);
  if (inCore) {
    return `Core ${profile.playstyle.toLowerCase()} pick — meshes directly with this Killer's power.`;
  }
  return `Strong support pick that doesn't clash with ${profile.playstyle.toLowerCase()}.`;
}

export function scoreKillerPerk(perkId: string, profile: KillerProfile, inventoryTier: number): number {
  if (inventoryTier === 0) return -1000;
  const perk = resolvePerkRef(perkId);
  if (!perk) return -1000;
  if (isPerkAvoidedForKiller(perk.id, profile)) return -1000;

  let score = inventoryTier;
  const coreIdx = profile.core.findIndex((ref) => resolvePerkRef(ref)?.id === perk.id);
  if (coreIdx >= 0) score += 100 - coreIdx * 5;
  else if (profile.good.some((ref) => resolvePerkRef(ref)?.id === perk.id)) score += 40;

  return score;
}

export function buildKillerPerkPool(profile: KillerProfile): string[] {
  return [...profile.core, ...profile.good];
}

function killerNameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/^the\s+/, '')
    .split(/\s+/)
    .filter(Boolean);
}

export function detectKillerFromMessage(message: string): DbDCharacter | undefined {
  const m = message.toLowerCase();
  for (const profile of KILLER_PROFILES) {
    for (const alias of profile.aliases) {
      if (m.includes(alias)) {
        const char = findCharacter(alias);
        if (char) return char;
      }
    }
  }
  for (const char of getCharacters('killer')) {
    const tokens = killerNameTokens(char.name);
    if (tokens.some((t) => t.length >= 4 && m.includes(t))) return char;
    if (m.includes(char.id.toLowerCase())) return char;
  }
  return findCharacter(message);
}

export function detectSurvivorFromMessage(message: string): DbDCharacter | undefined {
  for (const profile of SURVIVOR_PROFILES) {
    for (const alias of profile.aliases) {
      if (message.toLowerCase().includes(alias)) {
        const char = findCharacter(alias);
        if (char) return char;
      }
    }
  }
  return undefined;
}
