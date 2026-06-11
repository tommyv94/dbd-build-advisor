import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AppSettings, BuildSuggestion, CharacterLoadout, PerkInventory, PlayerProfile, ProfileStore, Role, SavedBuild } from '../src/types.js';

export function getDataDir(): string {
  return process.env.DBD_DATA_DIR ?? join(process.cwd(), '.data');
}

function profilesPath(): string {
  return join(getDataDir(), 'profiles.json');
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
  return { perkAccess: {}, configured: false };
}

function settingsFromRaw(raw: unknown): AppSettings {
  if (!raw || typeof raw !== 'object') return { characters: {} };
  const v = raw as Record<string, unknown>;
  const characters: Record<string, CharacterLoadout> = {};
  if (v.characters && typeof v.characters === 'object') {
    for (const [id, val] of Object.entries(v.characters as Record<string, unknown>)) {
      characters[id] = migrateLoadout(val);
    }
  }
  return {
    characters,
    activeCharacterId: v.activeCharacterId as string | undefined,
    openaiApiKey: v.openaiApiKey as string | undefined,
  };
}

function defaultProfile(name = 'Default'): PlayerProfile {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name,
    createdAt: now,
    updatedAt: now,
    settings: { characters: {} },
    savedBuilds: [],
  };
}

function migrateProfile(profile: PlayerProfile): PlayerProfile {
  return {
    ...profile,
    savedBuilds: profile.savedBuilds ?? [],
  };
}

function defaultStore(): ProfileStore {
  const profile = defaultProfile();
  return { activeProfileId: profile.id, profiles: [profile] };
}

export async function loadProfileStore(): Promise<ProfileStore> {
  try {
    await mkdir(getDataDir(), { recursive: true });
    const raw = await readFile(profilesPath(), 'utf-8');
    const parsed = JSON.parse(raw) as ProfileStore;
    if (!parsed.profiles?.length) return defaultStore();
    if (!parsed.activeProfileId || !parsed.profiles.some((p) => p.id === parsed.activeProfileId)) {
      parsed.activeProfileId = parsed.profiles[0].id;
    }
    parsed.profiles = parsed.profiles.map(migrateProfile);
    return parsed;
  } catch {
    return defaultStore();
  }
}

export async function saveProfileStore(store: ProfileStore): Promise<void> {
  await mkdir(getDataDir(), { recursive: true });
  await writeFile(profilesPath(), JSON.stringify(store, null, 2), 'utf-8');
}

export function getActiveProfile(store: ProfileStore): PlayerProfile {
  return store.profiles.find((p) => p.id === store.activeProfileId) ?? store.profiles[0];
}

export function profileToSettings(profile: PlayerProfile): AppSettings {
  return {
    characters: profile.settings.characters ?? {},
    activeCharacterId: profile.settings.activeCharacterId,
    openaiApiKey: profile.openaiApiKey,
  };
}

export function settingsToProfileSettings(
  settings: AppSettings,
  role?: Role,
): PlayerProfile['settings'] {
  return {
    characters: settings.characters,
    activeCharacterId: settings.activeCharacterId,
    activeRole: role,
  };
}

export function createProfile(store: ProfileStore, name: string): ProfileStore {
  const profile = defaultProfile(name.trim() || 'New profile');
  return {
    activeProfileId: profile.id,
    profiles: [...store.profiles, profile],
  };
}

export function updateProfile(
  store: ProfileStore,
  profileId: string,
  patch: Partial<Pick<PlayerProfile, 'name' | 'settings' | 'openaiApiKey' | 'savedBuilds'>>,
): ProfileStore {
  return {
    ...store,
    profiles: store.profiles.map((p) =>
      p.id === profileId
        ? {
            ...p,
            ...patch,
            settings: patch.settings ? { ...p.settings, ...patch.settings } : p.settings,
            updatedAt: new Date().toISOString(),
          }
        : p,
    ),
  };
}

export function deleteProfile(store: ProfileStore, profileId: string): ProfileStore {
  if (store.profiles.length <= 1) {
    throw new Error('Cannot delete the last profile');
  }
  const profiles = store.profiles.filter((p) => p.id !== profileId);
  const activeProfileId =
    store.activeProfileId === profileId ? profiles[0].id : store.activeProfileId;
  return { activeProfileId, profiles };
}

export function duplicateProfile(store: ProfileStore, profileId: string): ProfileStore {
  const source = store.profiles.find((p) => p.id === profileId);
  if (!source) throw new Error('Profile not found');
  const now = new Date().toISOString();
  const copy: PlayerProfile = {
    ...structuredClone(source),
    id: crypto.randomUUID(),
    name: `${source.name} (copy)`,
    createdAt: now,
    updatedAt: now,
  };
  return {
    activeProfileId: copy.id,
    profiles: [...store.profiles, copy],
  };
}

export function importProfileStore(store: ProfileStore, imported: ProfileStore): ProfileStore {
  const merged = [...store.profiles];
  for (const p of imported.profiles) {
    const exists = merged.some((x) => x.id === p.id);
    merged.push(
      exists
        ? { ...p, id: crypto.randomUUID(), name: `${p.name} (imported)`, updatedAt: new Date().toISOString() }
        : p,
    );
  }
  return {
    activeProfileId: imported.activeProfileId ?? merged[merged.length - 1].id,
    profiles: merged,
  };
}

export async function migrateFromLegacySettings(legacy: AppSettings): Promise<ProfileStore> {
  const store = defaultStore();
  store.profiles[0] = {
    ...store.profiles[0],
    settings: settingsToProfileSettings(legacy),
    openaiApiKey: legacy.openaiApiKey,
    savedBuilds: [],
    updatedAt: new Date().toISOString(),
  };
  await saveProfileStore(store);
  return store;
}

export function addSavedBuild(
  store: ProfileStore,
  profileId: string,
  name: string,
  build: BuildSuggestion,
  gameVersion?: string,
): ProfileStore {
  const profile = store.profiles.find((p) => p.id === profileId);
  if (!profile) throw new Error('Profile not found');

  const saved: SavedBuild = {
    id: crypto.randomUUID(),
    name: name.trim() || build.title,
    role: build.role,
    characterId: build.characterId,
    characterName: build.character,
    build: { ...build, id: build.id || crypto.randomUUID() },
    savedAt: new Date().toISOString(),
    savedAtGameVersion: gameVersion,
  };

  return updateProfile(store, profileId, {
    savedBuilds: [...(profile.savedBuilds ?? []), saved],
  });
}

export function deleteSavedBuild(
  store: ProfileStore,
  profileId: string,
  buildId: string,
): ProfileStore {
  const profile = store.profiles.find((p) => p.id === profileId);
  if (!profile) throw new Error('Profile not found');

  return updateProfile(store, profileId, {
    savedBuilds: (profile.savedBuilds ?? []).filter((b) => b.id !== buildId),
  });
}

export function getSavedBuilds(store: ProfileStore, profileId?: string): SavedBuild[] {
  const id = profileId ?? store.activeProfileId;
  const profile = store.profiles.find((p) => p.id === id);
  return profile?.savedBuilds ?? [];
}
