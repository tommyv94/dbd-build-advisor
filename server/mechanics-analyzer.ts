import type { DbDCharacter, KillerMechanicsProfile, SurvivorMechanicsProfile } from '../src/types.js';

function cleanText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function parsePowerInfo(raw: string): { name: string; description: string } {
  const cleaned = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const dash = cleaned.indexOf(' - ');
  if (dash > 0) {
    return {
      name: cleaned.slice(0, dash).trim(),
      description: cleaned.slice(dash + 3).trim(),
    };
  }
  return { name: cleaned.split(' ')[0] ?? 'Power', description: cleaned };
}

export function parsePowerFromApi(raw: string): { name: string; description: string } {
  return parsePowerInfo(raw);
}

export function parsePowerFromBio(char: DbDCharacter): { name: string; description: string } | null {
  const bio = char.bio ?? '';
  const htmlMatch =
    bio.match(/power,?\s*<b>([^<]+)<\/b>/i) ?? bio.match(/using (?:his|her|their) <b>([^<]+)<\/b>/i);
  const plainMatch =
    bio.match(/power,?\s*([^.]+?)(?:\.|$)/i) ??
    bio.match(/using (?:his|her|their)\s+([^.]+?)(?:\.|$)/i) ??
    bio.match(/(?:able to|by)\s+([^.]{8,80}?)(?:\.|$)/i);

  const name = (htmlMatch?.[1] ?? plainMatch?.[1])?.trim();
  if (!name) return null;

  const plainBio = bio
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return { name, description: plainBio };
}

export function analyzeKillerMechanics(char: DbDCharacter): KillerMechanicsProfile {
  const bio = cleanText(char.bio ?? '');
  const power = cleanText(char.powerDescription ?? '');
  const combined = `${bio} ${power} ${char.powerName ?? ''}`;

  let loopType: KillerMechanicsProfile['loopType'] = 'standard';
  let chaseType: KillerMechanicsProfile['chaseType'] = 'standard';
  let pressureFocus: KillerMechanicsProfile['pressureFocus'] = 'hybrid';
  let wantsTracking = false;
  let wantsAntiHeal = false;
  let wantsStealthCounter = false;
  let wantsHookPressure = false;

  const avoidPerkTags: string[] = [];
  const priorityPerkTags: string[] = ['slowdown', 'regression'];

  if (/blink|warp|teleport|phase|haunt|of the abyss|virulent bound|vampiric shift|kagune|corporeal|shift between|spencer|fatigue|blight rush|after blinking/i.test(combined)) {
    loopType = 'skips-loops';
    avoidPerkTags.push('loop-break', 'chase-end');
    priorityPerkTags.push('tracking', 'anti-heal', 'aura-reading');
    wantsTracking = true;
    wantsAntiHeal = true;
    pressureFocus = 'hybrid';
  }

  if (/chainsaw|insta|instantly|special attack|down survivors|0\.5 seconds/i.test(combined)) {
    chaseType = 'insta-down';
    loopType = loopType === 'standard' ? 'strong-loops' : loopType;
    avoidPerkTags.push('chase-end');
    priorityPerkTags.push('information', 'slowdown');
    pressureFocus = 'hybrid';
  }

  if (/rush|blight|frenzy|feral|bound|haste|sprint|leap|dash|mobility|cross the map/i.test(combined)) {
    chaseType = 'high-mobility';
    priorityPerkTags.push('chase-end', 'information');
    pressureFocus = 'chase';
  }

  if (/guard|knight|command|order|skull merchant|uav|eyes in the sky|drone|camera|static blast|terminal/i.test(combined)) {
    loopType = 'zone-control';
    priorityPerkTags.push('zone-control', 'information', 'slowdown');
    wantsHookPressure = true;
    pressureFocus = 'slowdown';
  }

  if (/krasue|head detach|floating head|spirit head/i.test(combined)) {
    loopType = loopType === 'standard' ? 'stealth' : loopType;
    wantsStealthCounter = true;
    priorityPerkTags.push('stealth-counter', 'tracking');
  }

  if (/singularity|biopod|overclock|hud|scan|remote/i.test(combined)) {
    loopType = 'zone-control';
    priorityPerkTags.push('information', 'slowdown', 'tracking');
    wantsTracking = true;
  }

  if (/chucky|hidey|good guy|slice|possess|voodoo|puppet/i.test(combined)) {
    loopType = 'stealth';
    priorityPerkTags.push('stealth-counter', 'hook-pressure');
    pressureFocus = 'hybrid';
  }

  if (/alien|tail|turret|egg|hatch|nest|xenomorph/i.test(combined)) {
    loopType = 'zone-control';
    priorityPerkTags.push('zone-control', 'information', 'slowdown');
    pressureFocus = 'slowdown';
  }

  if (/hunt|predator|cloak|thermal|target|missile|bear trap|mud/i.test(combined)) {
    wantsTracking = true;
    priorityPerkTags.push('tracking', 'information');
  }

  if (/trap|zone|territory|phantom|baptism|reverse bear|torment trail|map control/i.test(combined)) {
    loopType = 'zone-control';
    priorityPerkTags.push('zone-control', 'hook-pressure', 'save-counter');
    wantsHookPressure = true;
    pressureFocus = 'slowdown';
  }

  if (/hatchet|throw|knife|harpoon|rifle|spear|projectile|blade throw|birds|swarm|vomit|gas|bomb|tonic/i.test(combined)) {
    loopType = 'ranged';
    priorityPerkTags.push('information', 'chase-end');
    pressureFocus = 'hybrid';
  }

  if (/stalk|stealth|night shroud|evil within|cloak|undetectable|hidden|invisibility/i.test(combined)) {
    loopType = 'stealth';
    wantsStealthCounter = true;
    priorityPerkTags.push('stealth-counter', 'information');
    pressureFocus = 'slowdown';
  }

  if (/infect|plague|vile|sickness|t-virus|injur.*spread|spread.*injur/i.test(combined)) {
    wantsAntiHeal = true;
    priorityPerkTags.push('anti-heal', 'slowdown');
  }

  if (/sleep|dream|nightmare|micro/i.test(combined)) {
    wantsAntiHeal = true;
    priorityPerkTags.push('slowdown', 'stealth-counter');
    pressureFocus = 'slowdown';
  }

  if (/injured|bleed|grunts|track|aura|locate|find survivors/i.test(combined)) {
    wantsTracking = true;
    priorityPerkTags.push('tracking');
  }

  if (loopType === 'standard' && chaseType === 'standard') {
    priorityPerkTags.push('loop-break', 'chase-end');
  }

  if (loopType === 'skips-loops') {
    avoidPerkTags.push('loop-break');
    if (!avoidPerkTags.includes('chase-end')) avoidPerkTags.push('chase-end');
  }

  if (chaseType === 'insta-down') {
    avoidPerkTags.push('loop-break', 'chase-end');
  }

  if (loopType === 'strong-loops' || /pallet|break.*wall|vault/i.test(combined)) {
    priorityPerkTags.push('loop-break');
  }

  if (wantsHookPressure || loopType === 'zone-control') {
    priorityPerkTags.push('hook-pressure');
  }

  const uniquePriority = [...new Set(priorityPerkTags)];
  const uniqueAvoid = [...new Set(avoidPerkTags)];

  const summary = buildKillerSummary(char, loopType, chaseType, pressureFocus);

  return {
    loopType,
    chaseType,
    pressureFocus,
    wantsTracking,
    wantsAntiHeal,
    wantsStealthCounter,
    wantsHookPressure,
    avoidPerkTags: uniqueAvoid,
    priorityPerkTags: uniquePriority,
    summary,
  };
}

function buildKillerSummary(
  char: DbDCharacter,
  loopType: KillerMechanicsProfile['loopType'],
  chaseType: KillerMechanicsProfile['chaseType'],
  pressureFocus: KillerMechanicsProfile['pressureFocus'],
): string {
  const parts: string[] = [];
  if (char.powerName) parts.push(`Power: ${char.powerName}`);
  if (loopType === 'skips-loops') parts.push('Skips traditional looping — avoid loop-break perks');
  if (loopType === 'ranged') parts.push('Ranged power — info and regression matter between shots');
  if (loopType === 'zone-control') parts.push('Map control — hook pressure and slowdown');
  if (loopType === 'stealth') parts.push('Stealth/mindgame — detection perks help');
  if (chaseType === 'insta-down') parts.push('Insta-down threat — regression and locate targets early');
  if (chaseType === 'high-mobility') parts.push('High mobility — STBFL-style snowball between downs');
  if (pressureFocus === 'slowdown') parts.push('Needs gen regression to buy time for power');
  if (char.bio) parts.push(char.bio.split('\n')[0] ?? '');
  return parts.filter(Boolean).join('. ');
}

export function analyzeSurvivorMechanics(char: DbDCharacter): SurvivorMechanicsProfile {
  const bio = cleanText(char.bio ?? '');
  let archetype: SurvivorMechanicsProfile['archetype'] = 'general';
  const priorityPerkTags: string[] = [];

  if (/outrun|chase|exhaustion|sprint|loop|athlete/i.test(bio)) {
    archetype = 'looper';
    priorityPerkTags.push('looping', 'exhaustion-counter', 'self-reliance');
  } else if (/heal|botany|empathy|altru|save|unhook/i.test(bio)) {
    archetype = 'healer';
    priorityPerkTags.push('healing', 'protection', 'information');
  } else if (/gen|repair|leader|prove|objective|efficiency/i.test(bio)) {
    archetype = 'gen-focused';
    priorityPerkTags.push('gen-efficiency', 'information', 'self-reliance');
  } else if (/stealth|hide|quiet|immersion|urban/i.test(bio)) {
    archetype = 'stealth';
    priorityPerkTags.push('stealth', 'self-reliance');
  } else if (/locate|ally|team|bond|coordination/i.test(bio)) {
    archetype = 'support';
    priorityPerkTags.push('information', 'healing', 'protection');
  } else {
    priorityPerkTags.push('looping', 'gen-efficiency', 'self-reliance');
  }

  return {
    archetype,
    priorityPerkTags: [...new Set(priorityPerkTags)],
    summary: char.bio?.split('\n')[0] ?? `${char.name} survivor build`,
  };
}

export function formatMechanicsForPrompt(char: DbDCharacter): string {
  if (char.role === 'killer' && char.killerMechanics) {
    const m = char.killerMechanics;
    return [
      `Killer: ${char.name} (${char.difficulty ?? 'unknown'} difficulty)`,
      char.powerName ? `Power: ${char.powerName}` : '',
      char.powerDescription ? `Power mechanics: ${char.powerDescription.slice(0, 800)}` : '',
      char.bio ? `Bio: ${char.bio}` : '',
      `Loop profile: ${m.loopType}`,
      `Chase profile: ${m.chaseType}`,
      `Pressure: ${m.pressureFocus}`,
      `Priority perk types: ${m.priorityPerkTags.join(', ')}`,
      `AVOID perk types: ${m.avoidPerkTags.join(', ')}`,
      m.summary,
    ]
      .filter(Boolean)
      .join('\n');
  }

  if (char.survivorMechanics) {
    const s = char.survivorMechanics;
    return [
      `Survivor: ${char.name}`,
      char.bio ?? '',
      `Archetype: ${s.archetype}`,
      `Priority perks: ${s.priorityPerkTags.join(', ')}`,
    ].join('\n');
  }

  return `${char.name}: ${char.bio ?? 'No bio'}`;
}
