import type { DbDCharacter, DbDPerk, KillerMechanicsProfile } from '../src/types.js';

export type PerkTag =
  | 'slowdown'
  | 'regression'
  | 'tracking'
  | 'aura-reading'
  | 'loop-break'
  | 'chase-end'
  | 'hook-pressure'
  | 'anti-heal'
  | 'stealth-counter'
  | 'endgame'
  | 'information'
  | 'zone-control'
  | 'mobility-counter'
  | 'exhaustion-counter'
  | 'save-counter'
  | 'gen-efficiency'
  | 'self-reliance'
  | 'healing'
  | 'stealth'
  | 'looping'
  | 'protection';

const PERK_TAG_MAP: Record<string, PerkTag[]> = {
  hexruin: ['slowdown', 'regression'],
  popgoestheweasel: ['slowdown', 'regression'],
  corruptintervention: ['slowdown', 'zone-control'],
  deadlock: ['slowdown', 'regression'],
  thanatophobia: ['anti-heal', 'slowdown'],
  stridor: ['tracking', 'anti-heal'],
  anursescalling: ['tracking', 'aura-reading'],
  nursesCalling: ['tracking', 'aura-reading'],
  hexdevourhope: ['hook-pressure', 'chase-end'],
  hexretribution: ['information', 'tracking'],
  hexplaything: ['stealth-counter', 'information'],
  hexundying: ['slowdown', 'regression'],
  hexbloodfavour: ['chase-end', 'stealth-counter'],
  hexcrowdcontrol: ['zone-control', 'slowdown'],
  hexpentafoil: ['slowdown', 'regression'],
  scourgehookpainrelief: ['hook-pressure', 'anti-heal'],
  scourgehookgiftofpain: ['hook-pressure', 'anti-heal'],
  scourgehookhangmansTrick: ['hook-pressure', 'save-counter'],
  nowayout: ['hook-pressure', 'endgame'],
  trailoftorment: ['stealth-counter', 'information'],
  lethalpursuer: ['tracking', 'information'],
  darkdevotion: ['stealth-counter', 'information'],
  infectiousfright: ['information', 'tracking'],
  jolted: ['information', 'tracking'],
  surge: ['slowdown', 'information'],
  trailofbroken: ['tracking', 'information'],
  allseeing: ['stealth-counter', 'information'],
  bitterMurder: ['tracking', 'information'],
  unbound: ['chase-end'],
  rapidbrutality: ['chase-end', 'loop-break'],
  ultimateweapon: ['stealth-counter', 'information'],
  darknessrevealed: ['stealth-counter', 'information'],
  grimEmbrace: ['hook-pressure', 'endgame'],
  callofbrine: ['slowdown', 'regression'],
  scourgehookMonitorsAndSurveillance: ['tracking', 'information'],
  machineLearning: ['information', 'tracking'],
  fogwise: ['information', 'tracking'],
  overcharge: ['slowdown', 'regression'],
  thwarttheirdesign: ['slowdown', 'regression'],
  grimpenalty: ['hook-pressure', 'slowdown'],
  forcedpenance: ['anti-heal', 'hook-pressure'],
  knockOut: ['anti-heal', 'hook-pressure'],
  madgrit: ['hook-pressure', 'anti-heal'],
  insidious: ['stealth-counter'],
  shadowborn: ['stealth-counter'],
  playwithyourfood: ['chase-end', 'stealth-counter'],
  nemesis: ['stealth-counter', 'information'],
  objectofobsession: ['information', 'stealth-counter'],
  darkSense: ['information', 'tracking'],
  alert: ['information', 'tracking'],
  visionary: ['information', 'tracking'],
  repressedalliance: ['gen-efficiency', 'protection'],
  aftercare: ['information', 'healing'],
  reassurance: ['information', 'protection'],
  windowsOfOpportunity: ['looping', 'information'],
  spinechill: ['information', 'stealth'],
  darkTheory: ['looping', 'exhaustion-counter'],
  headOn: ['protection', 'stealth'],
  deception: ['stealth', 'looping'],
  quickAndQuiet: ['stealth', 'gen-efficiency'],
  fixated: ['stealth', 'looping'],
  lightweight: ['stealth', 'looping'],
  calmSpirit: ['stealth', 'self-reliance'],
  noMither: ['looping', 'self-reliance'],
  adrenaline: ['looping', 'endgame'],
  hope: ['endgame', 'looping'],
  noOneLeftBehind: ['endgame', 'healing'],
  wellmakeit: ['healing', 'protection'],
  deliverance: ['protection', 'healing'],
  weregonnaliveforever: ['protection', 'healing'],
  botanyKnowledge: ['healing', 'gen-efficiency'],
  empathy: ['healing', 'information'],
  leader: ['gen-efficiency', 'information'],
  surveillance: ['tracking', 'information'],
  whispers: ['tracking', 'information'],
  barbecueandchilli: ['aura-reading', 'information'],
  hexhuntThemDown: ['tracking', 'aura-reading'],
  tinkerer: ['stealth-counter', 'information'],
  discordance: ['information', 'tracking'],
  bamboozle: ['loop-break', 'chase-end'],
  enduringpain: ['loop-break', 'chase-end'],
  spiritfury: ['loop-break', 'chase-end'],
  savethebestforlast: ['chase-end'],
  monitorandabuse: ['stealth-counter', 'information'],
  makeyourchoice: ['hook-pressure', 'save-counter'],
  coulrophobia: ['anti-heal', 'hook-pressure'],
  sloppybutcher: ['anti-heal', 'hook-pressure'],
  agitation: ['hook-pressure', 'mobility-counter'],
  irongrasp: ['hook-pressure'],
  brutalstrength: ['loop-break', 'chase-end'],
  starstruck: ['chase-end', 'hook-pressure'],
  hexnooneescapesdeath: ['endgame'],
  bloodwarden: ['endgame'],
  franklinsdemise: ['anti-heal', 'endgame'],
  painresonance: ['slowdown', 'information'],
  deadhard: ['looping', 'exhaustion-counter'],
  sprintburst: ['looping', 'exhaustion-counter'],
  balancedlanding: ['looping', 'exhaustion-counter'],
  lithe: ['looping', 'exhaustion-counter'],
  decisivestrike: ['protection', 'save-counter'],
  offtheRecord: ['protection'],
  unbreakable: ['protection', 'self-reliance'],
  borrowedtime: ['protection', 'healing'],
  selfcare: ['self-reliance', 'healing'],
  proveThyself: ['gen-efficiency'],
  resilience: ['gen-efficiency', 'self-reliance'],
  ironwill: ['stealth', 'self-reliance'],
  urbanEvasion: ['stealth'],
  bond: ['information', 'healing'],
  kindred: ['information'],
};

const CATEGORY_TAGS: Record<string, PerkTag[]> = {
  perception: ['information', 'tracking'],
  navigation: ['mobility-counter'],
  adaptation: ['self-reliance'],
  safeguard: ['protection', 'healing'],
  concealment: ['stealth'],
  support: ['healing', 'gen-efficiency'],
  chase: ['chase-end'],
  hinderance: ['slowdown'],
  curse: ['slowdown', 'regression'],
  precision: ['chase-end'],
  tracking: ['tracking'],
};

export function getPerkTags(perk: DbDPerk): PerkTag[] {
  const tags = new Set<PerkTag>();
  for (const t of PERK_TAG_MAP[perk.id] ?? []) tags.add(t);
  for (const cat of perk.categories) {
    for (const t of CATEGORY_TAGS[cat.toLowerCase()] ?? []) tags.add(t);
  }
  if (perk.name.startsWith('Hex:')) {
    tags.add('slowdown');
    tags.add('regression');
  }
  if (/exhaustion/i.test(perk.description)) tags.add('exhaustion-counter');
  return [...tags];
}

export function perkHasTag(perk: DbDPerk, tag: string): boolean {
  return getPerkTags(perk).includes(tag as PerkTag);
}

export function scorePerkTagMatch(
  perk: DbDPerk,
  wanted: string[],
  avoid: string[],
): number {
  const tags = getPerkTags(perk);
  let score = 0;
  for (const w of wanted) {
    if (tags.includes(w as PerkTag)) score += 15;
  }
  for (const a of avoid) {
    if (tags.includes(a as PerkTag)) score -= 100;
  }
  return score;
}

export function formatPerkTags(perk: DbDPerk): string {
  return getPerkTags(perk).join(', ') || 'utility';
}

export function getKillerPriorityTags(profile: KillerMechanicsProfile): string[] {
  return profile.priorityPerkTags;
}

export function getKillerAvoidTags(profile: KillerMechanicsProfile): string[] {
  return profile.avoidPerkTags;
}
