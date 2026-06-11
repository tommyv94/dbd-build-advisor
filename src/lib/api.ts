import type {
  AppSettings,
  CharacterGuide,
  CharacterLoadout,
  ChatMessage,
  ChatRequest,
  ChatResponse,
  DbDCharacter,
  DbDPerk,
  GameMeta,
  PerkInventory,
  PerkTier,
  Role,
} from '../types';
import { apiFetch } from './api-base';

export async function fetchMeta(): Promise<GameMeta> {
  const res = await apiFetch('/meta');
  if (!res.ok) throw new Error('Failed to fetch meta');
  return res.json();
}

export async function fetchPerks(role: Role): Promise<DbDPerk[]> {
  const res = await apiFetch(`/perks?role=${role}`);
  if (!res.ok) throw new Error('Failed to fetch perks');
  return res.json();
}

export async function fetchCharacters(role: Role): Promise<DbDCharacter[]> {
  const res = await apiFetch(`/characters?role=${role}`);
  if (!res.ok) throw new Error('Failed to fetch characters');
  return res.json();
}

export async function fetchCharacterGuide(
  characterId: string,
  characters: Record<string, CharacterLoadout>,
  clientGameVersion?: string,
): Promise<CharacterGuide> {
  const res = await apiFetch(`/characters/${characterId}/guide`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ characters, clientGameVersion }),
  });
  if (!res.ok) throw new Error('Failed to load character guide');
  return res.json();
}

export async function sendChat(req: ChatRequest): Promise<ChatResponse> {
  const res = await apiFetch('/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Chat request failed');
  }
  return res.json();
}

function migrateLoadout(raw: unknown): CharacterLoadout {
  if (!raw || typeof raw !== 'object') return { perkAccess: {}, configured: false };
  const v = raw as Record<string, unknown>;
  if ('perkAccess' in v) {
    return {
      perkAccess: (v.perkAccess as PerkInventory) ?? {},
      configured: Boolean(v.configured),
    };
  }
  if ('owned' in v || 'perkTiers' in v) {
    const legacy = v as { owned?: boolean; perkTiers?: PerkInventory };
    return {
      perkAccess: legacy.owned ? (legacy.perkTiers ?? {}) : {},
      configured: Boolean(legacy.owned),
    };
  }
  return { perkAccess: {}, configured: false };
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem('dbd-advisor-settings');
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const characters: Record<string, CharacterLoadout> = {};
      if (parsed.characters && typeof parsed.characters === 'object') {
        for (const [id, val] of Object.entries(parsed.characters as Record<string, unknown>)) {
          characters[id] = migrateLoadout(val);
        }
      }
      return {
        characters,
        activeCharacterId: parsed.activeCharacterId as string | undefined,
        openaiApiKey: parsed.openaiApiKey as string | undefined,
      };
    }
  } catch {
    /* ignore */
  }
  return { characters: {} };
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem('dbd-advisor-settings', JSON.stringify(settings));
}

export function createMessage(
  role: 'user' | 'assistant',
  content: string,
  extra?: Partial<ChatMessage>,
): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    timestamp: new Date().toISOString(),
    ...extra,
  };
}

export function starterMessage(): ChatMessage {
  return createMessage(
    'assistant',
    `**Fog Build Advisor** — browse **Collection** to set your perks and learn each character, or pick someone here and ask for a build.\n\nUse **Ask Advisor** on any character to jump here locked to them. Killer builds respect **power synergy**, not generic meta.`,
  );
}

export function parseMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^• /gm, '<span class="bullet">•</span> ')
    .replace(/\n/g, '<br/>');
}

export function tierLabel(tier: number): string {
  if (tier === 0) return 'Locked';
  return `Tier ${tier}`;
}

export function tierClass(tier: number): string {
  if (tier === 0) return 'tier-none';
  if (tier === 3) return 'tier-max';
  if (tier === 2) return 'tier-mid';
  return 'tier-low';
}

export function categoryLabel(cat: string): string {
  return cat.replace(/([a-z])([A-Z])/g, '$1 $2');
}

export const QUICK_PROMPTS: Record<Role, string[]> = {
  survivor: [
    'Meg looping build',
    'Anti-tunnel build',
    'Stealth build',
    'Gen rush solo queue',
    'Save build',
  ],
  killer: [
    'Nurse build',
    'Blight build',
    'Spirit build',
    'General slowdown',
    'Trapper build',
  ],
};

export function defaultLoadout(): CharacterLoadout {
  return { perkAccess: {}, configured: false };
}

export function getLoadout(
  characters: Record<string, CharacterLoadout>,
  charId: string,
): CharacterLoadout {
  return characters[charId] ?? defaultLoadout();
}

/** Tier for a perk when playing as charId. Unconfigured char = all T3. */
export function perkTierForCharacter(
  perkId: string,
  charId: string | undefined,
  characters: Record<string, CharacterLoadout>,
): PerkTier {
  if (!charId) return 3;
  const loadout = getLoadout(characters, charId);
  if (!loadout.configured) return 3;
  return loadout.perkAccess[perkId] ?? 0;
}

export function countAvailableForCharacter(
  charId: string,
  perks: DbDPerk[],
  characters: Record<string, CharacterLoadout>,
): number {
  return perks.filter((p) => perkTierForCharacter(p.id, charId, characters) > 0).length;
}

export function setPerkTier(
  settings: AppSettings,
  charId: string,
  perkId: string,
  tier: PerkTier,
): AppSettings {
  const current = getLoadout(settings.characters, charId);
  return {
    ...settings,
    characters: {
      ...settings.characters,
      [charId]: {
        configured: true,
        perkAccess: { ...current.perkAccess, [perkId]: tier },
      },
    },
  };
}

export function markAllPerks(
  settings: AppSettings,
  charId: string,
  perks: DbDPerk[],
  tier: PerkTier,
): AppSettings {
  const access: PerkInventory = {};
  for (const p of perks) access[p.id] = tier;
  return {
    ...settings,
    characters: {
      ...settings.characters,
      [charId]: { configured: true, perkAccess: access },
    },
  };
}

export function clearLoadout(settings: AppSettings, charId: string): AppSettings {
  const next = { ...settings.characters };
  delete next[charId];
  return { ...settings, characters: next };
}
