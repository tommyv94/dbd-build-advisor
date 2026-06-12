import { handleChat } from './chat-handler.js';
import { enrichBuildFromDb, reconcileSavedBuild } from './build-engine.js';
import { getCharacterGuide } from './character-guide.js';
import {
  characterToClient,
  findPerkByName,
  getAllPerks,
  getCharacter,
  getCharacterPerks,
  getCharacters,
  getMeta,
  getPerk,
  perkToClient,
  syncGameData,
} from './dbd-api.js';
import { formatMechanicsForPrompt } from './mechanics-analyzer.js';
import {
  addSavedBuild,
  createProfile,
  deleteProfile,
  deleteSavedBuild,
  duplicateProfile,
  getActiveProfile,
  getSavedBuilds,
  importProfileStore,
  loadProfileStore,
  migrateFromLegacySettings,
  profileToSettings,
  saveProfileStore,
  settingsToProfileSettings,
  updateProfile,
} from './profiles.js';
import type { AppSettings, BuildSuggestion, ProfileStore, Role } from '../src/types.js';

export interface ApiResponse {
  status: number;
  body: unknown;
}

function json(data: unknown, status = 200): ApiResponse {
  return { status, body: data };
}

function error(message: string, status = 500): ApiResponse {
  return { status, body: { error: message } };
}

function parseQuery(search: string): Record<string, string> {
  const params = new URLSearchParams(search);
  const out: Record<string, string> = {};
  for (const [k, v] of params) out[k] = v;
  return out;
}

function splitPath(path: string): { segments: string[]; query: Record<string, string> } {
  const [pathname, search = ''] = path.split('?');
  const cleaned = pathname.replace(/^\/+/, '').replace(/^api\/+/i, '');
  return {
    segments: cleaned ? cleaned.split('/').filter(Boolean) : [],
    query: parseQuery(search.startsWith('?') ? search.slice(1) : search),
  };
}

export async function handleApiRequest(
  method: string,
  path: string,
  rawBody?: string,
): Promise<ApiResponse> {
  const m = method.toUpperCase();
  const { segments, query } = splitPath(path);
  let body: unknown;
  if (rawBody) {
    try {
      body = JSON.parse(rawBody);
    } catch {
      body = rawBody;
    }
  }

  try {
    if (segments[0] === 'health' && m === 'GET') {
      return json({ ok: true, desktop: Boolean(process.env.DBD_DESKTOP) });
    }

    const needsSync = segments[0] !== 'profiles' && segments[0] !== 'health';
    if (needsSync) await syncGameData();

    if (segments[0] === 'meta' && m === 'GET') return json(getMeta());

    if (segments[0] === 'perks') {
      if (segments[1] === 'search' && m === 'GET') {
        const perk = findPerkByName(query.q ?? '');
        return json(perk ? perkToClient(perk) : null);
      }
      if (segments.length === 1 && m === 'GET') {
        return json(getAllPerks(query.role as Role | undefined).map(perkToClient));
      }
      if (segments.length === 2 && m === 'GET') {
        const perk = getPerk(segments[1]);
        return json(perk ? perkToClient(perk) : null);
      }
    }

    if (segments[0] === 'characters') {
      if (segments.length === 1 && m === 'GET') {
        return json(getCharacters(query.role as Role | undefined).map(characterToClient));
      }
      if (segments.length === 3 && segments[2] === 'perks' && m === 'GET') {
        return json(getCharacterPerks(segments[1]).map(perkToClient));
      }
      if (segments.length === 3 && segments[2] === 'knowledge' && m === 'GET') {
        const char = getCharacter(segments[1]);
        if (!char) return error('Character not found', 404);
        return json({ character: characterToClient(char), knowledge: formatMechanicsForPrompt(char) });
      }
      if (segments.length === 3 && segments[2] === 'guide' && m === 'POST') {
        const payload = body as {
          characters?: import('../src/types.js').AppSettings['characters'];
          clientGameVersion?: string;
        };
        await syncGameData();
        const currentVersion = getMeta().perkVersion;
        if (payload?.clientGameVersion && payload.clientGameVersion !== currentVersion) {
          await syncGameData(true);
        }
        const char = getCharacter(segments[1]);
        if (!char) return error('Character not found', 404);
        const loadouts = payload?.characters ?? {};
        const guide = getCharacterGuide(segments[1], loadouts);
        if (!guide) return error('Character not found', 404);
        return json(guide);
      }
    }

    if (segments[0] === 'chat' && m === 'POST') {
      return json(await handleChat(body as Parameters<typeof handleChat>[0]));
    }

    if (segments[0] === 'builds') {
      if (segments[1] === 'enrich' && m === 'POST') {
        const payload = body as { build: BuildSuggestion };
        if (!payload?.build) return error('Build is required', 400);
        return json(enrichBuildFromDb(payload.build));
      }
      if (segments[1] === 'reconcile' && m === 'POST') {
        const payload = body as {
          build: BuildSuggestion;
          characters?: import('../src/types.js').AppSettings['characters'];
        };
        if (!payload?.build) return error('Build is required', 400);
        const characters = payload.characters ?? {};
        return json(reconcileSavedBuild(payload.build, characters));
      }
    }

    if (segments[0] === 'profiles') {
      if (segments.length === 1 && m === 'GET') return json(await loadProfileStore());
      if (segments.length === 1 && m === 'PUT') {
        await saveProfileStore(body as ProfileStore);
        return json(body);
      }
      if (segments.length === 1 && m === 'POST') {
        let store = await loadProfileStore();
        store = createProfile(store, String((body as { name?: string })?.name ?? 'New profile'));
        await saveProfileStore(store);
        return json(store);
      }
      if (segments[1] === 'import' && m === 'POST') {
        let store = await loadProfileStore();
        store = importProfileStore(store, body as ProfileStore);
        await saveProfileStore(store);
        return json(store);
      }
      if (segments[1] === 'migrate' && m === 'POST') {
        const existing = await loadProfileStore();
        const hasData = existing.profiles.some((p) =>
          Object.values(p.settings.characters ?? {}).some((c) => c.configured),
        );
        if (hasData) return json(existing);
        const store = await migrateFromLegacySettings(body as AppSettings);
        return json(store);
      }
      if (segments[1] === 'active' && segments[2] === 'builds') {
        if (segments.length === 3 && m === 'GET') {
          const store = await loadProfileStore();
          return json(getSavedBuilds(store));
        }
        if (segments.length === 3 && m === 'POST') {
          const payload = body as { name?: string; build: BuildSuggestion; gameVersion?: string };
          if (!payload?.build) return error('Build is required', 400);
          let store = await loadProfileStore();
          const active = getActiveProfile(store);
          store = addSavedBuild(
            store,
            active.id,
            payload.name ?? payload.build.title,
            payload.build,
            payload.gameVersion,
          );
          await saveProfileStore(store);
          return json(store);
        }
        if (segments.length === 4 && m === 'DELETE') {
          let store = await loadProfileStore();
          const active = getActiveProfile(store);
          store = deleteSavedBuild(store, active.id, segments[3]);
          await saveProfileStore(store);
          return json(store);
        }
      }
      if (segments[1] === 'active' && segments[2] === 'onboarding-reset' && m === 'POST') {
        let store = await loadProfileStore();
        const active = getActiveProfile(store);
        store = updateProfile(store, active.id, { onboardingComplete: false });
        await saveProfileStore(store);
        return json(store);
      }
      if (segments[1] === 'active' && segments[2] === 'settings') {
        if (m === 'GET') {
          const store = await loadProfileStore();
          return json(profileToSettings(getActiveProfile(store)));
        }
        if (m === 'PUT') {
          const settings = body as AppSettings & { activeRole?: Role; onboardingComplete?: boolean };
          let store = await loadProfileStore();
          const active = getActiveProfile(store);
          store = updateProfile(store, active.id, {
            settings: settingsToProfileSettings(settings, settings.activeRole),
            openaiApiKey: settings.openaiApiKey,
            ...(settings.onboardingComplete !== undefined
              ? { onboardingComplete: settings.onboardingComplete }
              : {}),
          });
          await saveProfileStore(store);
          return json(store);
        }
      }
      if (segments.length === 3 && segments[2] === 'duplicate' && m === 'POST') {
        let store = await loadProfileStore();
        store = duplicateProfile(store, segments[1]);
        await saveProfileStore(store);
        return json(store);
      }
      if (segments.length === 3 && segments[2] === 'activate' && m === 'POST') {
        const store = await loadProfileStore();
        if (!store.profiles.some((p) => p.id === segments[1])) {
          return error('Profile not found', 404);
        }
        const next = { ...store, activeProfileId: segments[1] };
        await saveProfileStore(next);
        return json(next);
      }
      if (segments.length === 2 && m === 'PATCH') {
        let store = await loadProfileStore();
        store = updateProfile(store, segments[1], (body as Record<string, unknown>) ?? {});
        await saveProfileStore(store);
        return json(store);
      }
      if (segments.length === 2 && m === 'DELETE') {
        let store = await loadProfileStore();
        store = deleteProfile(store, segments[1]);
        await saveProfileStore(store);
        return json(store);
      }
    }

    return error('Not found', 404);
  } catch (err) {
    const status = String(err).includes('Cannot delete') ? 400 : 500;
    return error(String(err), status);
  }
}

export async function startAdvisorEngine(options?: {
  dataDir?: string;
  quiet?: boolean;
}): Promise<{ handleApiRequest: typeof handleApiRequest }> {
  if (options?.dataDir) process.env.DBD_DATA_DIR = options.dataDir;
  process.env.DBD_DESKTOP = '1';

  if (!options?.quiet) console.log('Loading Dead by Daylight data...');
  await syncGameData(true);
  const meta = getMeta();
  if (!options?.quiet) {
    console.log(
      `Ready — patch ${meta.perkVersion}, ${meta.killerCount} killers, ${meta.survivorCount} survivors`,
    );
  }

  return { handleApiRequest };
}

export function apiResponseToFetchResult(res: ApiResponse): {
  ok: boolean;
  status: number;
  statusText: string;
  body: string;
  headers: Record<string, string>;
} {
  const body = typeof res.body === 'string' ? res.body : JSON.stringify(res.body);
  return {
    ok: res.status >= 200 && res.status < 300,
    status: res.status,
    statusText: res.status >= 200 && res.status < 300 ? 'OK' : 'Error',
    body,
    headers: { 'Content-Type': 'application/json' },
  };
}
