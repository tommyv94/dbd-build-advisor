import type { AppSettings, BuildSuggestion, ProfileStore, Role, SavedBuild } from '../types';
import { apiFetch } from './api-base';

export { isDesktopApp } from './api-base';

export async function fetchProfiles(): Promise<ProfileStore> {
  const res = await apiFetch('/profiles');
  if (!res.ok) throw new Error('Failed to load profiles');
  return res.json();
}

export async function saveProfiles(store: ProfileStore): Promise<ProfileStore> {
  const res = await apiFetch('/profiles', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(store),
  });
  if (!res.ok) throw new Error('Failed to save profiles');
  return res.json();
}

export async function createProfile(name: string): Promise<ProfileStore> {
  const res = await apiFetch('/profiles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error('Failed to create profile');
  return res.json();
}

export async function activateProfile(profileId: string): Promise<ProfileStore> {
  const res = await apiFetch(`/profiles/${profileId}/activate`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to activate profile');
  return res.json();
}

export async function duplicateProfile(profileId: string): Promise<ProfileStore> {
  const res = await apiFetch(`/profiles/${profileId}/duplicate`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to duplicate profile');
  return res.json();
}

export async function deleteProfile(profileId: string): Promise<ProfileStore> {
  const res = await apiFetch(`/profiles/${profileId}`, { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Failed to delete profile');
  }
  return res.json();
}

export async function renameProfile(profileId: string, name: string): Promise<ProfileStore> {
  const res = await apiFetch(`/profiles/${profileId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error('Failed to rename profile');
  return res.json();
}

export async function importProfiles(store: ProfileStore): Promise<ProfileStore> {
  const res = await apiFetch('/profiles/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(store),
  });
  if (!res.ok) throw new Error('Failed to import profiles');
  return res.json();
}

export async function migrateLegacySettings(legacy: AppSettings): Promise<ProfileStore> {
  const res = await apiFetch('/profiles/migrate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(legacy),
  });
  if (!res.ok) throw new Error('Failed to migrate settings');
  return res.json();
}

export async function saveActiveProfileSettings(
  settings: AppSettings,
  activeRole?: Role,
): Promise<ProfileStore> {
  const res = await apiFetch('/profiles/active/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...settings, activeRole }),
  });
  if (!res.ok) throw new Error('Failed to save profile settings');
  return res.json();
}

export function getActiveSavedBuilds(store: ProfileStore): SavedBuild[] {
  const active = store.profiles.find((p) => p.id === store.activeProfileId) ?? store.profiles[0];
  return active.savedBuilds ?? [];
}

export async function saveBuildToProfile(
  name: string,
  build: BuildSuggestion,
  gameVersion?: string,
): Promise<ProfileStore> {
  const res = await apiFetch('/profiles/active/builds', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, build, gameVersion }),
  });
  if (!res.ok) throw new Error('Failed to save build');
  return res.json();
}

export async function deleteSavedBuildFromProfile(buildId: string): Promise<ProfileStore> {
  const res = await apiFetch(`/profiles/active/builds/${buildId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete saved build');
  return res.json();
}

export function profileNeedsOnboarding(store: ProfileStore): boolean {
  const active = store.profiles.find((p) => p.id === store.activeProfileId) ?? store.profiles[0];
  return active.onboardingComplete !== true;
}

export async function resetActiveProfileOnboarding(): Promise<ProfileStore> {
  const res = await apiFetch('/profiles/active/onboarding-reset', { method: 'POST' });
  if (!res.ok) throw new Error('Failed to reset onboarding');
  return res.json();
}

export async function completeOnboarding(
  settings: AppSettings,
  activeRole?: Role,
): Promise<ProfileStore> {
  const res = await apiFetch('/profiles/active/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...settings, activeRole, onboardingComplete: true }),
  });
  if (!res.ok) throw new Error('Failed to complete onboarding');
  return res.json();
}

export function profileStoreToSettings(store: ProfileStore): AppSettings {
  const active = store.profiles.find((p) => p.id === store.activeProfileId) ?? store.profiles[0];
  return {
    characters: active.settings.characters ?? {},
    activeCharacterId: active.settings.activeCharacterId,
    openaiApiKey: active.openaiApiKey,
  };
}

export function activeRoleFromStore(store: ProfileStore): Role | undefined {
  const active = store.profiles.find((p) => p.id === store.activeProfileId) ?? store.profiles[0];
  return active.settings.activeRole;
}

export function downloadProfileExport(store: ProfileStore, filename?: string): void {
  const blob = new Blob([JSON.stringify(store, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename ?? `dbd-advisor-profiles-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function parseProfileImportFile(file: File): Promise<ProfileStore> {
  const text = await file.text();
  const parsed = JSON.parse(text) as ProfileStore;
  if (!parsed.profiles?.length) throw new Error('Invalid profile file');
  return parsed;
}

export async function exportProfilesDesktop(store: ProfileStore): Promise<boolean> {
  if (!window.electronAPI) return false;
  const name = `dbd-advisor-profiles-${new Date().toISOString().slice(0, 10)}.json`;
  return window.electronAPI.exportProfiles(JSON.stringify(store, null, 2), name);
}

export async function importProfilesDesktop(): Promise<ProfileStore | null> {
  if (!window.electronAPI) return null;
  const text = await window.electronAPI.importProfiles();
  if (!text) return null;
  const parsed = JSON.parse(text) as ProfileStore;
  if (!parsed.profiles?.length) throw new Error('Invalid profile file');
  return parsed;
}
