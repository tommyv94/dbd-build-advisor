import type { CharacterLoadout, PerkInventory, PerkTier, Role } from '../src/types.js';
import { getAllPerks, getCharacter } from './dbd-api.js';

export function defaultLoadout(): CharacterLoadout {
  return { perkAccess: {}, configured: false };
}

export function getLoadout(
  characters: Record<string, CharacterLoadout>,
  charId: string,
): CharacterLoadout {
  return characters[charId] ?? defaultLoadout();
}

/** Perks available when playing as this specific character. Unset = Tier III. */
export function getPerkAccessForCharacter(
  charId: string | undefined,
  role: Role,
  characters: Record<string, CharacterLoadout>,
): PerkInventory {
  const pool = getAllPerks(role);
  const inv: PerkInventory = {};

  for (const p of pool) {
    inv[p.id] = 3;
  }

  if (!charId) return inv;

  const loadout = characters[charId];
  if (!loadout?.configured) return inv;

  for (const p of pool) {
    inv[p.id] = loadout.perkAccess[p.id] ?? 0;
  }

  return inv;
}

export function resolveContextCharacter(
  role: Role,
  message: string,
  activeCharacterId: string | undefined,
  detectFromMessage: (msg: string) => { id: string } | undefined,
): string | undefined {
  if (activeCharacterId && getCharacter(activeCharacterId)?.role === role) {
    return activeCharacterId;
  }
  return detectFromMessage(message)?.id;
}

export function countAvailablePerks(
  charId: string,
  role: Role,
  characters: Record<string, CharacterLoadout>,
): number {
  const inv = getPerkAccessForCharacter(charId, role, characters);
  return Object.values(inv).filter((t) => t > 0).length;
}

export function migrateCharacterSettings(
  raw: Record<string, unknown> | undefined,
): Record<string, CharacterLoadout> {
  if (!raw) return {};
  const out: Record<string, CharacterLoadout> = {};

  for (const [id, val] of Object.entries(raw)) {
    const v = val as Record<string, unknown>;
    if ('perkAccess' in v && typeof v.perkAccess === 'object') {
      out[id] = {
        perkAccess: (v.perkAccess as PerkInventory) ?? {},
        configured: Boolean(v.configured),
      };
    } else if ('owned' in v || 'perkTiers' in v) {
      const legacy = v as { owned?: boolean; perkTiers?: PerkInventory };
      out[id] = {
        perkAccess: legacy.owned ? (legacy.perkTiers ?? {}) : {},
        configured: legacy.owned ?? false,
      };
    }
  }
  return out;
}

export function setPerkAccess(
  characters: Record<string, CharacterLoadout>,
  charId: string,
  perkId: string,
  tier: PerkTier,
): Record<string, CharacterLoadout> {
  const current = getLoadout(characters, charId);
  return {
    ...characters,
    [charId]: {
      configured: true,
      perkAccess: { ...current.perkAccess, [perkId]: tier },
    },
  };
}

export function markAllPerksForCharacter(
  characters: Record<string, CharacterLoadout>,
  charId: string,
  role: Role,
  tier: PerkTier,
): Record<string, CharacterLoadout> {
  const access: PerkInventory = {};
  for (const p of getAllPerks(role)) {
    access[p.id] = tier;
  }
  return {
    ...characters,
    [charId]: { configured: true, perkAccess: access },
  };
}

export function clearCharacterLoadout(
  characters: Record<string, CharacterLoadout>,
  charId: string,
): Record<string, CharacterLoadout> {
  return {
    ...characters,
    [charId]: defaultLoadout(),
  };
}
