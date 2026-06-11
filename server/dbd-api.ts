import type { DbDCharacter, DbDPerk, Role } from '../src/types.js';
import { analyzeKillerMechanics, analyzeSurvivorMechanics, parsePowerFromApi, parsePowerFromBio } from './mechanics-analyzer.js';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const API_BASE = 'https://dbd.tricky.lol/api';

interface RawPerk {
  name: string;
  description: string;
  role: Role;
  categories: string[];
  character?: number;
  teachable?: number;
  tunables?: Record<string, number[]>;
  image?: string;
}

interface RawCharacter {
  id?: string;
  name: string;
  role: Role;
  perks?: string[];
  bio?: string;
  difficulty?: string;
  item?: string;
  tunables?: Record<string, number>;
}

let cache: {
  perks: Map<string, DbDPerk>;
  characters: Map<string, DbDCharacter>;
  characterByIndex: Map<number, DbDCharacter>;
  version: string;
  syncedAt: string;
} | null = null;

const CACHE_TTL_MS = 60 * 60 * 1000;

function getDataDir(): string {
  return process.env.DBD_DATA_DIR ?? join(process.cwd(), '.data');
}

const POWER_CACHE_FILE = join(getDataDir(), 'killer-powers.json');

type PowerCache = Record<string, { name: string; description: string; fetchedAt: string }>;

async function loadPowerCache(): Promise<PowerCache> {
  try {
    const raw = await readFile(POWER_CACHE_FILE, 'utf-8');
    return JSON.parse(raw) as PowerCache;
  } catch {
    return {};
  }
}

async function savePowerCache(cache: PowerCache): Promise<void> {
  await mkdir(getDataDir(), { recursive: true });
  await writeFile(POWER_CACHE_FILE, JSON.stringify(cache, null, 2));
}

async function fetchWithRetry(path: string, retries = 3): Promise<string> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(`${API_BASE}${path}`);
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      continue;
    }
    if (!res.ok) throw new Error(`DbD API error: ${res.status} ${path}`);
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      if (typeof json === 'string') return json;
    } catch {
      /* plain text */
    }
    return text;
  }
  throw new Error(`DbD API rate limited: ${path}`);
}

function cleanPerkDescription(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\{Keyword\.([^}]+)\}/g, (_, k) => k.replace(/([a-z])([A-Z])/g, '$1 $2'))
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatDescriptionWithTier(perk: DbDPerk, tier: 1 | 2 | 3 = 3): string {
  let text = perk.description;
  const idx = tier - 1;
  const tunableEntries = Object.entries(perk.tunables);

  text = text.replace(/\{Tunable\.[^.]+\.([^}]+)\}/gi, (_, tunableKey: string) => {
    const needle = tunableKey.replace(/%/g, '').toLowerCase();
    const entry =
      tunableEntries.find(([k]) => k.replace(/%/g, '').toLowerCase() === needle) ??
      tunableEntries.find(([k]) => k.replace(/%/g, '').toLowerCase().includes(needle)) ??
      tunableEntries.find(([k]) => needle.includes(k.replace(/%/g, '').toLowerCase()));
    if (!entry) return '—';
    const values = entry[1];
    return String(values[idx] ?? values[values.length - 1] ?? '—');
  });

  return text.replace(/\s+/g, ' ').trim();
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\{Keyword\.[^}]+\}/g, '')
    .replace(/\{Tunable\.[^}]+\}/g, '')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function normalizePerkId(key: string): string {
  return key.replace(/_/g, '').replace(/\s+/g, '').toLowerCase();
}

function normalizeId(id: string): string {
  return id.toLowerCase().replace(/\s+/g, '');
}

function normalizeCharacters(raw: RawCharacter[] | Record<string, RawCharacter>): RawCharacter[] {
  if (Array.isArray(raw)) return raw;
  return Object.values(raw);
}

async function fetchText(path: string): Promise<string> {
  return fetchWithRetry(path);
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`DbD API error: ${res.status} ${path}`);
  return res.json() as Promise<T>;
}

async function fetchPowerInfo(itemId: string): Promise<{ name: string; description: string } | null> {
  try {
    const raw = await fetchText(`/iteminfo?item=${encodeURIComponent(itemId)}&pretty`);
    return parsePowerFromApi(raw);
  } catch {
    return null;
  }
}

async function enrichKillerPowers(characters: Map<string, DbDCharacter>, fetchMissing = false): Promise<void> {
  const killers = [...characters.values()].filter((c) => c.role === 'killer');
  const powerCache = await loadPowerCache();
  let cacheDirty = false;

  for (const char of killers) {
    const fromBio = parsePowerFromBio(char);
    if (fromBio) {
      char.powerName = fromBio.name;
      char.powerDescription = fromBio.description;
    }

    const cached = char.powerItemId ? powerCache[char.powerItemId] : undefined;
    if (cached) {
      char.powerName = cached.name;
      char.powerDescription = cached.description;
    }

    char.killerMechanics = analyzeKillerMechanics(char);
  }

  if (!fetchMissing) return;

  const needFetch = killers.filter((c) => c.powerItemId && !powerCache[c.powerItemId!]);
  for (const char of needFetch) {
    if (!char.powerItemId) continue;
    try {
      const power = await fetchPowerInfo(char.powerItemId);
      if (power) {
        char.powerName = power.name;
        char.powerDescription = power.description;
        char.killerMechanics = analyzeKillerMechanics(char);
        powerCache[char.powerItemId] = { ...power, fetchedAt: new Date().toISOString() };
        cacheDirty = true;
      }
    } catch {
      /* bio fallback already applied */
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  if (cacheDirty) await savePowerCache(powerCache);
}

async function enrichKillerPowersInBackground(characters: Map<string, DbDCharacter>): Promise<void> {
  enrichKillerPowers(characters, true).catch((err) => console.warn('Background power sync:', err));
}

export async function syncGameData(force = false): Promise<void> {
  if (!force && cache && Date.now() - new Date(cache.syncedAt).getTime() < CACHE_TTL_MS) {
    return;
  }

  const [survivorPerks, killerPerks, survivors, killers, versions] = await Promise.all([
    fetchJson<Record<string, RawPerk>>('/perks?role=survivor'),
    fetchJson<Record<string, RawPerk>>('/perks?role=killer'),
    fetchJson<RawCharacter[] | Record<string, RawCharacter>>('/characters?role=survivor'),
    fetchJson<RawCharacter[] | Record<string, RawCharacter>>('/characters?role=killer'),
    fetchJson<{ perks?: { version: string } }>('/versions'),
  ]);

  const characters = new Map<string, DbDCharacter>();

  for (const raw of [...normalizeCharacters(survivors), ...normalizeCharacters(killers)]) {
    const id = normalizeId(raw.id ?? raw.name);
    const char: DbDCharacter = {
      id,
      name: raw.name,
      role: raw.role,
      perks: (raw.perks ?? []).map(normalizePerkId),
      bio: raw.bio ? stripHtml(raw.bio) : undefined,
      difficulty: raw.difficulty,
      powerItemId: raw.item,
      tunables: raw.tunables,
    };
    if (char.role === 'survivor') {
      char.survivorMechanics = analyzeSurvivorMechanics(char);
    }
    characters.set(id, char);
  }

  const perks = new Map<string, DbDPerk>();
  for (const [key, raw] of Object.entries({ ...survivorPerks, ...killerPerks })) {
    const id = normalizePerkId(key);
    perks.set(id, {
      id,
      name: raw.name,
      description: cleanPerkDescription(raw.description),
      role: raw.role,
      categories: raw.categories ?? [],
      characterIndex: raw.character,
      teachable: raw.teachable,
      tunables: raw.tunables ?? {},
    });
  }

  for (const char of characters.values()) {
    for (const perkId of char.perks) {
      const perk = perks.get(perkId);
      if (perk) {
        perk.characterId = char.id;
        perk.characterName = char.name;
      }
    }
  }

  cache = {
    perks,
    characters,
    characterByIndex: new Map(),
    version: versions.perks?.version ?? 'unknown',
    syncedAt: new Date().toISOString(),
  };

  console.log('Analyzing killer mechanics from bio + cached power data...');
  await enrichKillerPowers(characters, false);
  console.log(`Mechanics profiles ready for ${[...characters.values()].filter((c) => c.killerMechanics).length} killers`);
  enrichKillerPowersInBackground(characters);
}

export function getCache() {
  if (!cache) throw new Error('Game data not synced yet');
  return cache;
}

export function getAllPerks(role?: Role): DbDPerk[] {
  const { perks } = getCache();
  return [...perks.values()].filter((p) => !role || p.role === role);
}

export function getPerk(id: string): DbDPerk | undefined {
  return getCache().perks.get(normalizePerkId(id));
}

export function findPerkByName(name: string): DbDPerk | undefined {
  const normalized = name.toLowerCase().trim();
  for (const perk of getCache().perks.values()) {
    if (perk.name.toLowerCase() === normalized) return perk;
  }
  for (const perk of getCache().perks.values()) {
    if (perk.name.toLowerCase().includes(normalized)) return perk;
  }
  const compact = normalized.replace(/[^a-z0-9]/g, '');
  for (const perk of getCache().perks.values()) {
    const perkCompact = perk.id.replace(/[^a-z0-9]/g, '');
    if (perkCompact === compact || perkCompact.includes(compact)) return perk;
  }
  return undefined;
}

export function resolvePerkRef(ref: string): DbDPerk | undefined {
  return getPerk(ref) ?? findPerkByName(ref);
}

export function getCharacters(role?: Role): DbDCharacter[] {
  const { characters } = getCache();
  return [...characters.values()]
    .filter((c) => !role || c.role === role)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getCharacter(id: string): DbDCharacter | undefined {
  return getCache().characters.get(normalizeId(id));
}

export function findCharacter(name: string): DbDCharacter | undefined {
  const normalized = name.toLowerCase().trim();
  const compact = normalized.replace(/\s+/g, '');
  const stripped = normalized.replace(/^the\s+/, '');

  for (const char of getCache().characters.values()) {
    const charName = char.name.toLowerCase();
    const charStripped = charName.replace(/^the\s+/, '');
    if (
      charName === normalized ||
      charStripped === stripped ||
      char.id === compact ||
      char.id.includes(compact) ||
      charName.includes(normalized) ||
      charStripped.includes(stripped) ||
      killerNameTokens(char.name).some((t) => t.length >= 4 && stripped.includes(t))
    ) {
      return char;
    }
  }
  return undefined;
}

function killerNameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/^the\s+/, '')
    .split(/\s+/)
    .filter(Boolean);
}

export function getMeta() {
  const { perks, characters, version, syncedAt } = getCache();
  const survivorPerks = [...perks.values()].filter((p) => p.role === 'survivor');
  const killerPerks = [...perks.values()].filter((p) => p.role === 'killer');
  const killersWithPower = [...characters.values()].filter((c) => c.powerName).length;
  return {
    perkVersion: version,
    survivorPerkCount: survivorPerks.length,
    killerPerkCount: killerPerks.length,
    survivorCount: [...characters.values()].filter((c) => c.role === 'survivor').length,
    killerCount: [...characters.values()].filter((c) => c.role === 'killer').length,
    killersWithPowerData: killersWithPower,
    lastSync: syncedAt,
  };
}

export function perkToClient(perk: DbDPerk): DbDPerk {
  return perk;
}

export function characterToClient(char: DbDCharacter): DbDCharacter {
  return char;
}

export function getCharacterPerks(charId: string): DbDPerk[] {
  const char = getCharacter(charId);
  if (!char) return [];
  return char.perks.map((id) => getPerk(id)).filter((p): p is DbDPerk => !!p);
}
