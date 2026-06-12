export type Role = 'survivor' | 'killer';
export type PerkTier = 0 | 1 | 2 | 3;

export interface DbDPerk {
  id: string;
  name: string;
  description: string;
  role: Role;
  categories: string[];
  characterIndex?: number;
  characterId?: string;
  characterName?: string;
  teachable?: number;
  tunables: Record<string, number[]>;
}

export interface KillerMechanicsProfile {
  loopType: 'skips-loops' | 'strong-loops' | 'ranged' | 'zone-control' | 'stealth' | 'standard';
  chaseType: 'insta-down' | 'high-mobility' | 'standard';
  pressureFocus: 'slowdown' | 'chase' | 'hybrid';
  wantsTracking: boolean;
  wantsAntiHeal: boolean;
  wantsStealthCounter: boolean;
  wantsHookPressure: boolean;
  avoidPerkTags: string[];
  priorityPerkTags: string[];
  summary: string;
}

export interface SurvivorMechanicsProfile {
  archetype: 'looper' | 'healer' | 'gen-focused' | 'stealth' | 'support' | 'general';
  priorityPerkTags: string[];
  summary: string;
}

export interface DbDCharacter {
  id: string;
  name: string;
  role: Role;
  perks: string[];
  bio?: string;
  difficulty?: string;
  powerItemId?: string;
  powerName?: string;
  powerDescription?: string;
  tunables?: Record<string, number>;
  killerMechanics?: KillerMechanicsProfile;
  survivorMechanics?: SurvivorMechanicsProfile;
}

export interface BuildPerk {
  id: string;
  name: string;
  recommendedTier: 1 | 2 | 3;
  reason: string;
  description?: string;
  categories?: string[];
  synergy?: string;
}

export interface BuildSuggestion {
  id: string;
  role: Role;
  title: string;
  character?: string;
  characterId?: string;
  playstyle: string;
  perks: BuildPerk[];
  explanation: string;
  strategy?: string;
  powerSummary?: string;
  mechanicsSummary?: string;
}

export type AdjustmentAction =
  | 'keep_lower_tier'
  | 'replace_perk'
  | 'remove_perk'
  | 'new_build';

export interface PerkAdjustment {
  perkId: string;
  perkName: string;
  action: AdjustmentAction;
  userTier: PerkTier;
  recommendedTier: 1 | 2 | 3;
  reasoning: string;
  replacement?: BuildPerk;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  build?: BuildSuggestion;
  adjustments?: PerkAdjustment[];
  timestamp: string;
}

export interface PerkInventory {
  [perkId: string]: PerkTier;
}

/** Which perks from the full role pool are available when playing this character */
export interface CharacterLoadout {
  perkAccess: PerkInventory;
  /** Once true, unlisted perks count as locked (0) */
  configured: boolean;
}

export interface AppSettings {
  openaiApiKey?: string;
  activeCharacterId?: string;
  characters: Record<string, CharacterLoadout>;
}

export interface PlayerProfile {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  settings: {
    characters: Record<string, CharacterLoadout>;
    activeCharacterId?: string;
    activeRole?: Role;
  };
  openaiApiKey?: string;
  savedBuilds?: SavedBuild[];
  /** Set after first-run onboarding wizard completes */
  onboardingComplete?: boolean;
}

export interface SavedBuild {
  id: string;
  name: string;
  role: Role;
  characterId?: string;
  characterName?: string;
  build: BuildSuggestion;
  savedAt: string;
  savedAtGameVersion?: string;
}

export interface ProfileStore {
  activeProfileId: string;
  profiles: PlayerProfile[];
}

export interface ChatRequest {
  message: string;
  role: Role;
  history: ChatMessage[];
  currentBuild?: BuildSuggestion;
  characters: Record<string, CharacterLoadout>;
  activeCharacterId?: string;
  openaiApiKey?: string;
}

export interface ChatResponse {
  reply: string;
  build?: BuildSuggestion;
  adjustments?: PerkAdjustment[];
}

export interface GameMeta {
  perkVersion: string;
  survivorPerkCount: number;
  killerPerkCount: number;
  survivorCount: number;
  killerCount: number;
  killersWithPowerData?: number;
  lastSync: string;
}

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
  gameVersion: string;
}
