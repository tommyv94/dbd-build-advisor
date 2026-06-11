import { useCallback, useRef, useState } from 'react';
import {
  activateProfile,
  createProfile,
  deleteProfile,
  downloadProfileExport,
  duplicateProfile,
  exportProfilesDesktop,
  importProfiles,
  importProfilesDesktop,
  parseProfileImportFile,
  renameProfile,
} from '../lib/profiles';
import type { ProfileStore } from '../types';
import { AppDialog, type AppDialogConfig } from './AppDialog';
interface ProfileManagerProps {
  store: ProfileStore;
  onChange: (store: ProfileStore) => void;
}

export function ProfileManager({ store, onChange }: ProfileManagerProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<AppDialogConfig | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const active = store.profiles.find((p) => p.id === store.activeProfileId) ?? store.profiles[0];

  const run = useCallback(
    async (fn: () => Promise<ProfileStore>) => {
      setBusy(true);
      setError(null);
      try {
        onChange(await fn());
      } catch (e) {
        setError(String(e));
      } finally {
        setBusy(false);
      }
    },
    [onChange],
  );

  async function handleExport() {
    setBusy(true);
    setError(null);
    try {
      const ok = await exportProfilesDesktop(store);
      if (!ok) downloadProfileExport(store);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleImportFile(file: File) {
    await run(async () => {
      const parsed = await parseProfileImportFile(file);
      return importProfiles(parsed);
    });
  }

  async function handleImportDesktop() {
    setBusy(true);
    setError(null);
    try {
      const parsed = await importProfilesDesktop();
      if (parsed) onChange(await importProfiles(parsed));
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="profile-manager">
      <label className="profile-select-wrap">
        <span>Profile</span>
        <select
          value={store.activeProfileId}
          disabled={busy}
          onChange={(e) => run(() => activateProfile(e.target.value))}
        >
          {store.profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      <div className="profile-actions">
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            setDialog({
              kind: 'prompt',
              title: 'New profile',
              label: 'Profile name',
              defaultValue: 'New profile',
              submitLabel: 'Create',
              onSubmit: (name) => run(() => createProfile(name)),
            })
          }
        >
          New
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            setDialog({
              kind: 'prompt',
              title: 'Rename profile',
              label: 'Profile name',
              defaultValue: active.name,
              submitLabel: 'Rename',
              onSubmit: (name) => run(() => renameProfile(active.id, name)),
            })
          }
        >
          Rename
        </button>        <button type="button" disabled={busy} onClick={() => run(() => duplicateProfile(active.id))}>
          Duplicate
        </button>
        <button
          type="button"
          disabled={busy || store.profiles.length <= 1}
          onClick={() =>
            setDialog({
              kind: 'confirm',
              title: 'Delete profile',
              message: `Delete profile "${active.name}"? This cannot be undone.`,
              confirmLabel: 'Delete',
              destructive: true,
              onConfirm: () => run(() => deleteProfile(active.id)),
            })
          }        >
          Delete
        </button>
        <button type="button" disabled={busy} onClick={handleExport}>
          Export
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (window.electronAPI) void handleImportDesktop();
            else fileRef.current?.click();
          }}
        >
          Import
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleImportFile(file);
            e.target.value = '';
          }}
        />
      </div>

      {error && <p className="profile-error">{error}</p>}
      <p className="profile-hint">
        Profiles save your perk collection, saved builds, and settings to disk automatically.
      </p>

      <AppDialog config={dialog} onClose={() => setDialog(null)} />
    </div>  );
}
