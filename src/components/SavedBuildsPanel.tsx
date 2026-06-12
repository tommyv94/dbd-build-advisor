import { useMemo, useState } from 'react';
import { validateSavedBuilds } from '../lib/build-staleness';
import { getActiveSavedBuilds } from '../lib/profiles';
import type { DbDCharacter, DbDPerk, GameMeta, ProfileStore, Role, SavedBuild } from '../types';
import { AppDialog, type AppDialogConfig } from './AppDialog';

interface SavedBuildsPanelProps {
  store: ProfileStore;
  role: Role;
  activeCharacterId?: string;
  perks: DbDPerk[];
  characters: DbDCharacter[];
  meta: GameMeta | null;
  onLoad: (saved: SavedBuild) => void;
  onDelete: (buildId: string) => void;
  onApplyFix?: (saved: SavedBuild) => void;
}

export function SavedBuildsPanel({
  store,
  role,
  activeCharacterId,
  perks,
  characters,
  meta,
  onLoad,
  onDelete,
  onApplyFix,
}: SavedBuildsPanelProps) {
  const [filterRole, setFilterRole] = useState<'all' | Role>('all');
  const [filterCharacter, setFilterCharacter] = useState<'all' | 'generic' | 'current'>('all');
  const [dialog, setDialog] = useState<AppDialogConfig | null>(null);

  const allBuilds = getActiveSavedBuilds(store);
  const gameVersion = meta?.perkVersion ?? 'unknown';

  const validations = useMemo(
    () => validateSavedBuilds(allBuilds, perks, characters, gameVersion),
    [allBuilds, perks, characters, gameVersion],
  );

  const staleCount = useMemo(
    () => [...validations.values()].filter((v) => v.needsReview).length,
    [validations],
  );

  const characterOptions = useMemo(() => {
    const names = new Map<string, string>();
    for (const b of allBuilds) {
      if (b.characterId && b.characterName) {
        names.set(b.characterId, b.characterName);
      }
    }
    return [...names.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [allBuilds]);

  const filtered = useMemo(() => {
    return allBuilds
      .filter((b) => filterRole === 'all' || b.role === filterRole)
      .filter((b) => {
        if (filterCharacter === 'all') return true;
        if (filterCharacter === 'generic') return !b.characterId;
        if (filterCharacter === 'current') {
          return activeCharacterId ? b.characterId === activeCharacterId : !b.characterId;
        }
        return b.characterId === filterCharacter;
      })
      .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
  }, [allBuilds, filterRole, filterCharacter, activeCharacterId]);

  const activeProfile = store.profiles.find((p) => p.id === store.activeProfileId) ?? store.profiles[0];

  return (
    <div className="saved-builds-panel">
      <header className="saved-builds-header">
        <div>
          <h2>Saved builds</h2>
          <p className="saved-builds-sub">
            Builds saved to <strong>{activeProfile.name}</strong>. Generic builds have no character; character builds
            are tied to who you were playing as when you saved.
            {meta && (
              <>
                {' '}
                Live data: patch <strong>{meta.perkVersion}</strong>.
              </>
            )}
          </p>
          {staleCount > 0 && (
            <p className="saved-builds-stale-banner">
              {staleCount} saved build{staleCount === 1 ? '' : 's'} may need review after recent game data updates.
            </p>
          )}
        </div>
        <div className="saved-builds-filters">
          <label>
            Role
            <select value={filterRole} onChange={(e) => setFilterRole(e.target.value as 'all' | Role)}>
              <option value="all">All roles</option>
              <option value="survivor">Survivor</option>
              <option value="killer">Killer</option>
            </select>
          </label>
          <label>
            Character
            <select
              value={filterCharacter}
              onChange={(e) => setFilterCharacter(e.target.value as typeof filterCharacter)}
            >
              <option value="all">All characters</option>
              <option value="generic">Generic (no character)</option>
              <option value="current">Current character</option>
              {characterOptions.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      {filtered.length === 0 ? (
        <div className="saved-builds-empty">
          <p>No saved builds yet.</p>
          <p className="saved-builds-empty-hint">
            Use <strong>Save build</strong> on a suggested loadout in the Advisor tab, or on the active loadout bar at
            the bottom.
          </p>
        </div>
      ) : (
        <ul className="saved-builds-list">
          {filtered.map((saved) => {
            const validation = validations.get(saved.id);
            const needsReview = validation?.needsReview;
            const patchOnly =
              validation &&
              !needsReview &&
              validation.issues.some((i) => i.type === 'patch_updated');
            const canFix =
              needsReview &&
              onApplyFix &&
              validation?.issues.some((i) =>
                ['perk_removed', 'perk_renamed', 'perk_description_changed'].includes(i.type),
              );

            return (
              <li
                key={saved.id}
                className={`saved-build-item ${needsReview ? 'saved-build-item-stale' : ''}`}
              >
                <div className="saved-build-item-main">
                  <div className="saved-build-item-top">
                    <span className={`role-badge role-${saved.role}`}>{saved.role}</span>
                    <h3>{saved.name}</h3>
                    {needsReview && <span className="saved-build-stale-badge">Needs review</span>}
                    {patchOnly && <span className="saved-build-patch-badge">Older patch</span>}
                  </div>
                  <p className="saved-build-meta">
                    {saved.characterName ? `For ${saved.characterName}` : 'Generic build'}
                    {' · '}
                    {saved.build.perks.map((p) => p.name).join(', ')}
                  </p>
                  {validation && validation.issues.length > 0 && (
                    <ul className="saved-build-issues">
                      {validation.issues.map((issue) => (
                        <li key={`${issue.type}-${issue.perkId ?? issue.detail}`}>{issue.detail}</li>
                      ))}
                    </ul>
                  )}
                  <time className="saved-build-date">
                    Saved {new Date(saved.savedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                    {saved.savedAtGameVersion ? ` · patch ${saved.savedAtGameVersion}` : ''}
                  </time>
                </div>
                <div className="saved-build-item-actions">
                  {canFix && (
                    <button type="button" className="saved-build-fix" onClick={() => onApplyFix(saved)}>
                      Apply fix
                    </button>
                  )}
                  <button type="button" className="saved-build-load" onClick={() => onLoad(saved)}>
                    Load
                  </button>
                  <button
                    type="button"
                    className="saved-build-delete"
                    onClick={() =>
                      setDialog({
                        kind: 'confirm',
                        title: 'Delete saved build',
                        message: `Delete "${saved.name}"?`,
                        confirmLabel: 'Delete',
                        destructive: true,
                        onConfirm: () => onDelete(saved.id),
                      })
                    }
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="saved-builds-count">
        {filtered.length} of {allBuilds.length} saved on this profile
        {filterRole !== role && filterRole !== 'all' ? ` (viewing as ${role})` : ''}
      </p>

      <AppDialog config={dialog} onClose={() => setDialog(null)} />
    </div>
  );
}

