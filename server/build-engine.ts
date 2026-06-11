import type {
  BuildPerk,
  BuildSuggestion,
  DbDPerk,
  PerkAdjustment,
  PerkInventory,
  PerkTier,
  Role,
} from '../src/types.js';
import {
  findPerkByName,
  formatDescriptionWithTier,
  getAllPerks,
  getCharacter,
  getPerk,
  perkToClient,
  resolvePerkRef,
} from './dbd-api.js';
import {
  buildGenericLoadout,
  buildKillerLoadout,
  buildSurvivorLoadout,
  findReplacementForKiller,
} from './build-intelligence.js';
import type { KillerProfile } from './killer-synergy.js';
import {
  detectKillerFromMessage,
  detectSurvivorFromMessage,
  isPerkAvoidedForKiller,
  killerPerkReason,
  resolveKillerProfile,
  resolveSurvivorProfile,
  scoreKillerPerk as scoreHandProfilePerk,
} from './killer-synergy.js';

const SURVIVOR_ARCHETYPES: Record<
  string,
  { perks: string[]; description: string; strategy: string }
> = {
  'gen-rush': {
    description: 'Gen efficiency & objective pressure',
    strategy:
      'Finish generators quickly while staying self-sufficient. Prove Thyself and Resilience reward staying on objective under pressure, while an exhaustion perk helps you reset if the Killer finds you.',
    perks: ['Prove Thyself', 'Resilience', 'Spine Chill', 'Self-Care', 'Dead Hard', 'Sprint Burst'],
  },
  looping: {
    description: 'Chase extension & exhaustion cycling',
    strategy:
      'Win or extend chases with exhaustion perks, then use map knowledge to reach the next safe loop. Only one exhaustion perk should be active — the rest of the build supports rotation and information.',
    perks: ['Dead Hard', 'Sprint Burst', 'Balanced Landing', 'Lithe', 'Windows of Opportunity', 'Quick & Quiet'],
  },
  stealth: {
    description: 'Stealth & immersion',
    strategy:
      'Avoid the Killer entirely by breaking line-of-sight, hiding efficiently, and healing quietly. Best when the Killer is strong in chase or your team prefers objective-focused play.',
    perks: ['Urban Evasion', 'Iron Will', 'Self-Care', 'Fixated', 'Spine Chill', 'Lightweight'],
  },
  altruism: {
    description: 'Saves, heals & protection',
    strategy:
      'Get teammates off hooks safely and win the unhook game. Borrowed Time and save-speed perks let you make risky plays that would otherwise trade one hook state for another.',
    perks: ['Borrowed Time', "We'll Make It", 'Deliverance', "We're Gonna Live Forever", 'Aftercare', 'Bond'],
  },
  'anti-tunnel': {
    description: 'Anti-tunnel & focus resistance',
    strategy:
      'Punish the Killer for re-hooking the same Survivor. Off-the-record style effects and post-hook protection let you survive a tunnel strategy long enough for your team to finish gens.',
    perks: ['Decisive Strike', 'Unbreakable', 'Off the Record', 'Borrowed Time', 'Dead Hard', 'Iron Will'],
  },
  info: {
    description: 'Aura info & team coordination',
    strategy:
      'Know where everyone is and make smarter decisions about when to commit to saves vs. gens. Strong in solo queue where communication is limited.',
    perks: ['Kindred', 'Bond', 'Alert', 'Windows of Opportunity', 'Reassurance', 'Aftercare'],
  },
  endgame: {
    description: 'Endgame & gate escape',
    strategy:
      'Survive the final generator and gate crunch. These perks spike in value when gates are powered and the Killer has limited time to down everyone.',
    perks: ['Adrenaline', 'Hope', 'Decisive Strike', 'Sprint Burst', 'Borrowed Time', 'No One Left Behind'],
  },
};

const KILLER_ARCHETYPES: Record<
  string,
  { perks: string[]; description: string; strategy: string }
> = {
  slowdown: {
    description: 'Generator regression & zone control',
    strategy:
      'Keep generators from rushing while you get kills. Regression perks force Survivors back to touched gens, buying time for your power and chase strengths to matter.',
    perks: ['Hex: Ruin', 'Corrupt Intervention', 'Pop Goes the Weasel', 'Thwart Their Design', 'Overcharge', 'Deadlock'],
  },
  chase: {
    description: 'Chase acceleration',
    strategy:
      'End loops faster and convert hits into downs. Pair chase perks with a Killer who already has strong chase so you snowball before gens finish.',
    perks: ['Bamboozle', 'Enduring Pain', 'Spirit Fury', 'Hex: Hunt Them Down', 'Save the Best for Last', 'Starstruck'],
  },
  info: {
    description: 'Tracking & locating Survivors',
    strategy:
      'Reduce time wandering and start chases sooner. Information perks scale with map size and Survivors who try to hide rather than loop.',
    perks: ['Whispers', 'Barbecue & Chilli', 'Hex: Hunt Them Down', 'Tinkerer', 'Discordance', 'Surveillance'],
  },
  endgame: {
    description: 'Endgame lockdown',
    strategy:
      'Close out games at 1–2 generators by making the final stretch lethal. High risk if gens finish early — best paired with enough mid-game pressure.',
    perks: ['Hex: No One Escapes Death', 'Bloodwarden', 'Remember Me', 'Make Your Choice', 'Pop Goes the Weasel', "Franklin's Demise"],
  },
  slug: {
    description: 'Downed pressure & slugging',
    strategy:
      'Prevent safe recoveries and punish grouped saves. Strong when you can down Survivors quickly and control the area around a slug.',
    perks: ['Coulrophobia', 'Sloppy Butcher', 'Starstruck', 'Agitation', 'Madgrit', 'Knock Out'],
  },
  general: {
    description: 'Flexible all-rounder',
    strategy:
      'A balanced toolkit that works on most Killers: some regression, some chase help, and information to find the next target after a hook.',
    perks: ['Hex: Ruin', 'Pop Goes the Weasel', 'Bamboozle', 'Whispers', 'Save the Best for Last', 'Hex: Hunt Them Down'],
  },
};

function uid(): string {
  return crypto.randomUUID();
}

const PERK_SYNERGY: Record<string, string> = {
  deadhard: 'Active dodge during a chase — pairs with strong loops; only one exhaustion perk per build.',
  sprintburst: 'Instant burst at chase start — excellent for reaching pallets/windows before the Killer closes distance.',
  balancedlanding: 'Rewards risky drops with exhaustion burst — great on maps with verticality.',
  lithe: 'Vault-triggered speed — strongest on maps with frequent short loops.',
  decisivestrike: 'Punishes tunneling after unhook — core anti-focus tool until all gens are done.',
  unbreakable: 'Guarantees recovery from dying state once — hard counters slugging and soft tunnel.',
  offtheRecord: 'Post-hook damage immunity — use after unhook to safely re-engage or leave the area.',
  borrowedtime: 'Extends unhook safety window — crucial for face-camping Killers or risky saves.',
  proveThyself: 'Stacked repair speed near teammates — core gen-rush perk with coordination.',
  resilience: 'Repair speed while injured — keeps objective pressure even after a bad chase.',
  selfcare: 'Heal without a teammate — essential for solo queue self-reliance.',
  ironwill: 'Silences pain sounds — pairs with stealth and self-heal strategies.',
  urbanEvasion: 'Faster crouching and Killer proximity warning — core stealth perk.',
  hexruin: 'Passive gen regression — forces Survivors to commit to a gen or lose progress.',
  popgoestheweasel: 'Manual regression on nearby gens after hooks — high-skill slowdown with huge payoff.',
  corruptintervention: 'Blocks distant gens early — strong opener that forces Survivors toward you.',
  saveTheBestForLast: 'Stacking chase speed on hit — snowballs as you protect your remaining hooks.',
  whispers: 'Reveals Survivors outside terror radius — great for finding the first target.',
  barbecueandchilli: 'Aura read after hook at distance — locates spread-out Survivors on large maps.',
};

function perkReason(perk: DbDPerk, slotRole: string): string {
  return PERK_SYNERGY[perk.id] ?? `Supports ${slotRole} via ${perk.categories.join(', ') || 'utility'}.`;
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
    synergy: PERK_SYNERGY[perk.id],
  };
}

function pickSynergyPerks(
  candidates: string[],
  inventory: PerkInventory,
  role: Role,
  count = 4,
  killerProfile?: KillerProfile,
): BuildPerk[] {
  const result: BuildPerk[] = [];
  const used = new Set<string>();

  const tryAdd = (ref: string, reasonFn: (p: DbDPerk) => string) => {
    if (result.length >= count) return;
    const perk = resolvePerkRef(ref);
    if (!perk || used.has(perk.id)) return;
    const tier = inventory[perk.id] ?? 3;
    if (tier === 0) return;
    if (killerProfile && isPerkAvoidedForKiller(perk.id, killerProfile)) return;
    used.add(perk.id);
    result.push(enrichBuildPerk(perk, reasonFn(perk), Math.min(tier, 3) as 1 | 2 | 3));
  };

  for (const ref of candidates) {
    tryAdd(ref, (p) =>
      killerProfile ? killerPerkReason(p.id, killerProfile) : perkReason(p, 'this build'),
    );
  }

  if (result.length < count && killerProfile) {
    const scored = getAllPerks('killer')
      .filter((p) => !used.has(p.id))
      .map((p) => ({
        perk: p,
        score: scoreHandProfilePerk(p.id, killerProfile, inventory[p.id] ?? 3),
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);

    for (const { perk } of scored) {
      tryAdd(perk.name, (p) => killerPerkReason(p.id, killerProfile));
      if (result.length >= count) break;
    }
  }

  if (result.length < count) {
    for (const perk of getAllPerks(role)) {
      if (result.length >= count) break;
      if (used.has(perk.id)) continue;
      const tier = inventory[perk.id] ?? 3;
      if (tier === 0) continue;
      if (killerProfile && isPerkAvoidedForKiller(perk.id, killerProfile)) continue;
      used.add(perk.id);
      result.push(enrichBuildPerk(perk, perkReason(perk, 'general utility'), 3));
    }
  }

  return result.slice(0, count);
}

function detectArchetype(message: string, role: Role): string {
  const m = message.toLowerCase();
  if (role === 'survivor') {
    if (/gen|objective|rush|repair/.test(m)) return 'gen-rush';
    if (/loop|chase|exhaustion|dh|dead hard|sprint/.test(m)) return 'looping';
    if (/stealth|hide|quiet|immersion/.test(m)) return 'stealth';
    if (/save|heal|altru|hook|unhook/.test(m)) return 'altruism';
    if (/tunnel|focus|ds|decisive|unbreakable|otr/.test(m)) return 'anti-tunnel';
    if (/info|aura|coordination|team/.test(m)) return 'info';
    if (/endgame|gate|adrenaline|2 gen|one gen/.test(m)) return 'endgame';
    return 'looping';
  }

  if (/slow|gen|regression|ruin|pop/.test(m)) return 'slowdown';
  if (/chase|loop|stbfl|enduring|spirit fury/.test(m)) return 'chase';
  if (/find|locate|info|bbq|whispers|aura/.test(m)) return 'info';
  if (/endgame|noed|bloodwarden|gate/.test(m)) return 'endgame';
  if (/slug|down|recover|coulro/.test(m)) return 'slug';
  return 'general';
}

export function suggestBuild(
  message: string,
  role: Role,
  inventory: PerkInventory,
  contextCharId?: string,
): BuildSuggestion {
  let characterName: string | undefined;
  let characterId: string | undefined;
  let playstyle = '';
  let title = '';
  let strategy = '';
  let powerSummary: string | undefined;
  let mechanicsSummary: string | undefined;
  let killerProfile: KillerProfile | undefined;
  let buildPerks: BuildPerk[] = [];

  const contextChar = contextCharId ? getCharacter(contextCharId) : undefined;

  if (role === 'killer') {
    const detected = contextChar ?? detectKillerFromMessage(message);
    if (detected) {
      characterId = detected.id;
      characterName = detected.name;
      killerProfile = resolveKillerProfile(detected, message);
      powerSummary = detected.powerName
        ? `${detected.powerName}${detected.powerDescription ? ` — ${detected.powerDescription.slice(0, 200)}…` : ''}`
        : undefined;
      mechanicsSummary = detected.killerMechanics?.summary;

      if (killerProfile) {
        playstyle = killerProfile.playstyle;
        strategy = killerProfile.strategy;
      } else if (detected.killerMechanics) {
        const m = detected.killerMechanics;
        playstyle = `${m.loopType.replace(/-/g, ' ')} / ${m.chaseType.replace(/-/g, ' ')}`;
        strategy = m.summary;
      } else {
        playstyle = `Build for ${detected.name}`;
        strategy = 'Perks scored against this Killer\'s available pool and common synergies.';
      }
      title = `${detected.name} Build`;
      buildPerks = buildKillerLoadout(detected, inventory, message);
    }
  } else {
    const detected = contextChar ?? detectSurvivorFromMessage(message);
    if (detected) {
      characterId = detected.id;
      characterName = detected.name;
      const survProfile = resolveSurvivorProfile(detected, message);
      mechanicsSummary = detected.survivorMechanics?.summary;

      if (survProfile) {
        strategy = survProfile.strategy;
        playstyle = `${detected.survivorMechanics?.archetype ?? 'general'} — ${detected.name}`;
      } else if (detected.survivorMechanics) {
        playstyle = `${detected.survivorMechanics.archetype} survivor`;
        strategy = detected.survivorMechanics.summary;
      } else {
        playstyle = `Build for ${detected.name}`;
      }
      title = `${detected.name} Build`;
      buildPerks = buildSurvivorLoadout(detected, inventory);
    }
  }

  if (!buildPerks.length) {
    const archetype = detectArchetype(message, role);
    const table = role === 'survivor' ? SURVIVOR_ARCHETYPES : KILLER_ARCHETYPES;
    const arch = table[archetype] ?? table[role === 'survivor' ? 'looping' : 'general'];
    playstyle = arch.description;
    strategy = arch.strategy;
    title = role === 'survivor' ? 'Survivor Build' : 'Killer Build';
    buildPerks = buildGenericLoadout(role, inventory, arch.perks);
  }

  const char = characterId ? getCharacter(characterId) : undefined;
  const charLabel = characterName ? ` while playing **${characterName}**` : '';
  const powerNote = char?.killerMechanics
    ? ' scored against live power mechanics and hand-tuned profiles where available'
    : killerProfile
      ? ' matched to this Killer\'s power'
      : ' chosen for build synergy';

  return {
    id: uid(),
    role,
    title,
    character: characterName,
    characterId,
    playstyle,
    strategy,
    powerSummary,
    mechanicsSummary,
    perks: buildPerks,
    explanation: `Loadout tuned for **${playstyle.toLowerCase()}**${charLabel}. Perks were filtered against your available pool and${powerNote}.`,
  };
}

/** Collection guide builds — survivors use global archetypes; killers mix power-sync + distinct archetypes. */
export function suggestGuideBuild(
  role: Role,
  archetypeKey: string,
  inventory: PerkInventory,
  killerCharId?: string,
): BuildSuggestion {
  if (role === 'survivor') {
    const arch = SURVIVOR_ARCHETYPES[archetypeKey] ?? SURVIVOR_ARCHETYPES.looping;
    return {
      id: uid(),
      role: 'survivor',
      title: arch.description,
      playstyle: arch.description,
      strategy: arch.strategy,
      perks: buildGenericLoadout('survivor', inventory, arch.perks),
      explanation:
        'Universal survivor loadout — any Survivor can run these perks; character choice does not change perk slots.',
    };
  }

  const char = killerCharId ? getCharacter(killerCharId) : undefined;

  if (archetypeKey === 'power-sync' && char) {
    return suggestBuild(`${char.name} power synergy build`, 'killer', inventory, char.id);
  }

  const arch = KILLER_ARCHETYPES[archetypeKey] ?? KILLER_ARCHETYPES.general;
  const profile = char ? resolveKillerProfile(char, archetypeKey) : undefined;

  let pool = arch.perks.filter((ref) => {
    if (!profile) return true;
    const perk = resolvePerkRef(ref);
    return perk && !isPerkAvoidedForKiller(perk.id, profile);
  });
  if (pool.length < 3) pool = arch.perks;

  let buildPerks = pickSynergyPerks(pool, inventory, 'killer', 4, profile);
  if (buildPerks.length < 4) {
    buildPerks = buildGenericLoadout('killer', inventory, pool);
  }

  return {
    id: uid(),
    role: 'killer',
    title: char ? `${char.name} — ${arch.description}` : arch.description,
    character: char?.name,
    characterId: char?.id,
    playstyle: profile?.playstyle ?? arch.description,
    strategy: arch.strategy,
    powerSummary: char?.powerName ? char.powerName : undefined,
    mechanicsSummary: char?.killerMechanics?.summary,
    perks: buildPerks,
    explanation: char
      ? `${arch.description} for ${char.name}, filtered against perks that clash with this power.`
      : arch.strategy,
  };
}

function tierViability(perk: DbDPerk, userTier: PerkTier, recommended: 1 | 2 | 3): {
  viable: boolean;
  reason: string;
} {
  if (userTier === 0) {
    return { viable: false, reason: 'You do not own this perk.' };
  }
  if (userTier >= recommended) {
    return { viable: true, reason: 'Your tier meets or exceeds the recommendation.' };
  }

  const tunableKeys = Object.keys(perk.tunables);
  if (tunableKeys.length === 0) {
    return {
      viable: true,
      reason: 'This perk has no tier-scaled values — any tier works the same.',
    };
  }

  let worstRatio = 1;
  for (const key of tunableKeys) {
    const values = perk.tunables[key];
    if (values.length < 3) continue;
    const t1 = values[0];
    const t3 = values[2];
    if (t3 === 0) continue;
    const ratio = t1 / t3;
    if (key.includes('duration') || key.includes('cooldown') || key.includes('exhaustion')) {
      worstRatio = Math.min(worstRatio, t3 / t1);
    } else {
      worstRatio = Math.min(worstRatio, ratio);
    }
  }

  if (userTier === 2 && worstRatio >= 0.75) {
    return { viable: true, reason: 'Tier II is close enough — the build still works.' };
  }
  if (userTier === 1 && worstRatio >= 0.85) {
    return { viable: true, reason: 'Tier I is weaker but still functional for this role in the build.' };
  }
  if (userTier === 2) {
    return {
      viable: true,
      reason: 'Tier II is usable. Upgrade when you can, but no urgent swap needed.',
    };
  }

  return {
    viable: false,
    reason: `Tier ${userTier} is too weak for this perk's core role in the build (scaled values drop significantly).`,
  };
}

function findReplacement(
  missing: DbDPerk,
  build: BuildSuggestion,
  inventory: PerkInventory,
  excludeIds: Set<string> = new Set(),
  message = '',
): BuildPerk | undefined {
  const usedIds = new Set([...build.perks.map((p) => p.id), ...excludeIds]);

  if (build.role === 'killer' && build.characterId) {
    const char = getCharacter(build.characterId);
    if (char) {
      const replacement = findReplacementForKiller(missing, char, inventory, usedIds, message);
      if (replacement) return replacement;
    }
  }

  const killerProfile =
    build.role === 'killer' && build.characterId
      ? resolveKillerProfile(getCharacter(build.characterId), message)
      : undefined;

  const owned = getAllPerks(missing.role).filter((p) => {
    const tier = inventory[p.id] ?? 3;
    if (tier === 0 || usedIds.has(p.id)) return false;
    if (killerProfile && isPerkAvoidedForKiller(p.id, killerProfile)) return false;
    return true;
  });

  const scored = owned
    .map((p) => {
      let score = 0;
      if (killerProfile) {
        score = scoreHandProfilePerk(p.id, killerProfile, inventory[p.id] ?? 3);
      } else {
        const categorySet = new Set(missing.categories);
        for (const c of p.categories) {
          if (categorySet.has(c)) score += 3;
        }
        for (const bp of build.perks) {
          const existing = getPerk(bp.id);
          if (!existing) continue;
          for (const c of existing.categories) {
            if (p.categories.includes(c)) score += 1;
          }
        }
        score += inventory[p.id] ?? 3;
      }
      return { perk: p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  const best = scored[0]?.perk;
  if (!best) return undefined;
  const reason = killerProfile
    ? `Replaces ${missing.name} — ${killerPerkReason(best.id, killerProfile)}`
    : `Replaces ${missing.name} — similar ${best.categories.join(', ') || 'utility'}`;
  return enrichBuildPerk(best, reason, 3);
}

export function adjustBuildForInventory(
  build: BuildSuggestion,
  inventory: PerkInventory,
  reportedIssues?: Array<{ perkName: string; tier: PerkTier }>,
): { build: BuildSuggestion; adjustments: PerkAdjustment[] } {
  const adjustments: PerkAdjustment[] = [];
  const newPerks: BuildPerk[] = [...build.perks];
  const issues = reportedIssues ?? build.perks.map((p) => {
    const tier = inventory[p.id] ?? 3;
    return { perkName: p.name, tier };
  }).filter((i) => i.tier < 3);

  for (const issue of issues) {
    const perk = findPerkByName(issue.perkName);
    if (!perk) continue;

    const buildPerk = build.perks.find(
      (p) => p.id === perk.id || p.name.toLowerCase() === perk.name.toLowerCase(),
    );
    if (!buildPerk) continue;

    const recommended = buildPerk.recommendedTier;
    const viability = tierViability(perk, issue.tier, recommended);
    const usedIds = new Set(newPerks.map((p) => p.id));

    if (issue.tier === 0) {
      const replacement = findReplacement(perk, build, inventory, usedIds);
      if (replacement) {
        adjustments.push({
          perkId: perk.id,
          perkName: perk.name,
          action: 'replace_perk',
          userTier: 0,
          recommendedTier: recommended,
          reasoning: 'You do not own this perk. Swapping for the closest owned alternative.',
          replacement,
        });
        const idx = newPerks.findIndex((p) => p.id === perk.id);
        if (idx >= 0) newPerks[idx] = replacement;
      } else {
        adjustments.push({
          perkId: perk.id,
          perkName: perk.name,
          action: 'remove_perk',
          userTier: 0,
          recommendedTier: recommended,
          reasoning: 'You do not own this perk and no good replacement was found — removing it.',
        });
        const idx = newPerks.findIndex((p) => p.id === perk.id);
        if (idx >= 0) newPerks.splice(idx, 1);
      }
    } else if (viability.viable) {
      adjustments.push({
        perkId: perk.id,
        perkName: perk.name,
        action: 'keep_lower_tier',
        userTier: issue.tier,
        recommendedTier: recommended,
        reasoning: viability.reason,
      });
    } else {
      const replacement = findReplacement(perk, build, inventory, usedIds);
      if (replacement) {
        adjustments.push({
          perkId: perk.id,
          perkName: perk.name,
          action: 'replace_perk',
          userTier: issue.tier,
          recommendedTier: recommended,
          reasoning: `${viability.reason} Replacing with a perk you own at full power.`,
          replacement,
        });
        const idx = newPerks.findIndex((p) => p.id === perk.id);
        if (idx >= 0) newPerks[idx] = replacement;
      } else {
        adjustments.push({
          perkId: perk.id,
          perkName: perk.name,
          action: 'remove_perk',
          userTier: issue.tier,
          recommendedTier: recommended,
          reasoning: `${viability.reason} Removing from build since no replacement is available.`,
        });
        const idx = newPerks.findIndex((p) => p.id === perk.id);
        if (idx >= 0) newPerks.splice(idx, 1);
      }
    }
  }

  while (newPerks.length < 4) {
    const killerProfile =
      build.role === 'killer' && build.characterId
        ? resolveKillerProfile(getCharacter(build.characterId), '')
        : undefined;
    const filler = pickSynergyPerks([], inventory, build.role, 4, killerProfile).find(
      (p) => !newPerks.some((np) => np.id === p.id),
    );
    if (!filler) break;
    newPerks.push(filler);
  }

  return {
    build: {
      ...build,
      id: uid(),
      perks: newPerks.slice(0, 4),
      explanation: build.explanation + ' Adjusted for your perk inventory.',
    },
    adjustments,
  };
}

export function parseInventoryIssues(message: string): Array<{ perkName: string; tier: PerkTier }> {
  const issues: Array<{ perkName: string; tier: PerkTier }> = [];
  const lower = message.toLowerCase();
  const seen = new Set<string>();

  function addIssue(perk: DbDPerk, tier: PerkTier) {
    if (seen.has(perk.id)) return;
    seen.add(perk.id);
    issues.push({ perkName: perk.name, tier });
  }

  for (const perk of getAllPerks()) {
    const nameLower = perk.name.toLowerCase();
    if (!lower.includes(nameLower)) continue;

    const dontHaveThis = new RegExp(
      `(?:don'?t|do not|dont|never)\\s+(?:have|own|unlocked)\\s+(?:the\\s+perk\\s+)?${nameLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b|missing\\s+(?:the\\s+perk\\s+)?${nameLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
      'i',
    ).test(message);

    const tierBefore = message.match(
      new RegExp(
        `(?:tier\\s*([123])|t\\s*([123])|level\\s*([123]))\\s+[^.]{0,40}?${nameLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
        'i',
      ),
    );
    const tierAfter = message.match(
      new RegExp(
        `${nameLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^.]{0,40}?(?:tier\\s*([123])|t\\s*([123])|level\\s*([123]))\\b`,
        'i',
      ),
    );
    const tierMatch = tierBefore ?? tierAfter;
    const onlyLowerForPerk = new RegExp(
      `(?:only\\s+(?:have|got)|lower\\s+tier|not\\s+maxed)[^.]*?${nameLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|${nameLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^.]*?(?:only\\s+(?:have|got)|lower\\s+tier|tier\\s*[12]\\b)`,
      'i',
    ).test(message);

    if (dontHaveThis) {
      addIssue(perk, 0);
    } else if (tierMatch) {
      const t = Number(tierMatch[1] ?? tierMatch[2] ?? tierMatch[3]) as PerkTier;
      if (t >= 1 && t <= 3) addIssue(perk, t);
    } else if (onlyLowerForPerk) {
      addIssue(perk, 1);
    }
  }

  return issues;
}

export function isBuildRequest(message: string): boolean {
  return /build|loadout|perks?|suggest|recommend|what should i run|help me|setup|set up/i.test(message);
}

export function isInventoryReport(message: string): boolean {
  return /don'?t have|do not have|missing|unowned|only have|tier [123]|t[123]|lower tier|not unlocked|never unlocked/i.test(
    message,
  );
}

export function formatBuildSummary(build: BuildSuggestion): string {
  const perkList = build.perks.map((p) => `• **${p.name}** — ${p.reason}`).join('\n');
  const strategy = build.strategy ? `\n\n**Strategy:** ${build.strategy}` : '';
  const power = build.powerSummary ? `\n\n**Power:** ${build.powerSummary}` : '';
  const mechanics = build.mechanicsSummary ? `\n\n**Mechanics:** ${build.mechanicsSummary}` : '';
  return `**${build.title}** — ${build.playstyle}${power}${mechanics}${strategy}\n\n${perkList}\n\n${build.explanation}`;
}

export function enrichBuildFromDb(build: BuildSuggestion): BuildSuggestion {
  return {
    ...build,
    perks: build.perks.map((bp) => {
      const perk = getPerk(bp.id) ?? findPerkByName(bp.name);
      if (!perk) return bp;
      return enrichBuildPerk(perk, bp.reason || perkReason(perk, build.playstyle), bp.recommendedTier ?? 3);
    }),
  };
}

export function formatAdjustments(adjustments: PerkAdjustment[]): string {
  return adjustments
    .map((a) => {
      const actionLabel = {
        keep_lower_tier: `Keep at Tier ${a.userTier}`,
        replace_perk: `Replace → ${a.replacement?.name ?? 'alternative'}`,
        remove_perk: 'Remove from build',
        new_build: 'Suggest new build',
      }[a.action];
      return `• **${a.perkName}**: ${actionLabel} — ${a.reasoning}`;
    })
    .join('\n');
}
