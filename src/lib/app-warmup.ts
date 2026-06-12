import type { UpdateStatusPayload } from './api-base';
import { isDesktopApp } from './api-base';
import {
  fetchCharacters,
  fetchMeta,
  fetchPerks,
  loadSettings,
} from './api';
import {
  activeRoleFromStore,
  fetchProfiles,
  migrateLegacySettings,
  profileStoreToSettings,
} from './profiles';
import type {
  AppSettings,
  DbDCharacter,
  DbDPerk,
  GameMeta,
  ProfileStore,
  Role,
} from '../types';

export interface AppWarmupResult {
  profileStore: ProfileStore;
  settings: AppSettings;
  advisorRole: Role;
  meta: GameMeta;
  survivorPerks: DbDPerk[];
  killerPerks: DbDPerk[];
  survivorChars: DbDCharacter[];
  killerChars: DbDCharacter[];
  initialUpdateStatus: UpdateStatusPayload | null;
}

const UPDATE_CHECK_TIMEOUT_MS = 12_000;

function reportProgress(onProgress: ((message: string) => void) | undefined, message: string) {
  onProgress?.(message);
  window.electronAPI?.reportWarmupProgress?.(message);
}

async function loadProfiles(onProgress?: (message: string) => void): Promise<{
  store: ProfileStore;
  settings: AppSettings;
  advisorRole: Role;
}> {
  reportProgress(onProgress, 'Loading profiles…');
  let store = await fetchProfiles();
  const legacy = loadSettings();
  const hasLegacy = Object.values(legacy.characters).some((c) => c.configured);
  if (hasLegacy || legacy.openaiApiKey) {
    store = await migrateLegacySettings(legacy);
    localStorage.removeItem('dbd-advisor-settings');
  }
  const settings = profileStoreToSettings(store);
  const advisorRole = activeRoleFromStore(store) ?? 'survivor';
  return { store, settings, advisorRole };
}

async function checkUpdatesDuringWarmup(
  onProgress?: (message: string) => void,
): Promise<UpdateStatusPayload | null> {
  if (!isDesktopApp() || !window.electronAPI?.checkForUpdates) return null;

  reportProgress(onProgress, 'Checking for updates…');

  const state: { latest: UpdateStatusPayload | null } = { latest: null };
  const unsub = window.electronAPI.onUpdateStatus?.((payload: UpdateStatusPayload) => {
    state.latest = payload;
  });

  try {
    const result = await Promise.race([
      window.electronAPI.checkForUpdates(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), UPDATE_CHECK_TIMEOUT_MS)),
    ]);

    const latest = state.latest;

    if (result && typeof result === 'object' && 'updateAvailable' in result && result.updateAvailable && result.latestVersion) {
      if (latest?.status === 'available') {
        return latest;
      }
      return { status: 'available', version: result.latestVersion };
    }

    if (latest && latest.status !== 'idle' && latest.status !== 'checking') {
      return latest;
    }
  } finally {
    unsub?.();
  }

  return null;
}

export async function runAppWarmup(
  onProgress?: (message: string) => void,
): Promise<AppWarmupResult> {
  reportProgress(onProgress, 'Syncing game data…');
  const meta = await fetchMeta();

  reportProgress(onProgress, 'Loading perk roster…');
  const [survivorPerks, killerPerks, survivorChars, killerChars] = await Promise.all([
    fetchPerks('survivor'),
    fetchPerks('killer'),
    fetchCharacters('survivor'),
    fetchCharacters('killer'),
  ]);

  const { store, settings, advisorRole } = await loadProfiles(onProgress);

  const initialUpdateStatus = await checkUpdatesDuringWarmup(onProgress);

  reportProgress(onProgress, 'Ready');

  return {
    profileStore: store,
    settings,
    advisorRole,
    meta,
    survivorPerks,
    killerPerks,
    survivorChars,
    killerChars,
    initialUpdateStatus,
  };
}
