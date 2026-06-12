import { useEffect, useMemo, useRef, useState } from 'react';
import {
  clearLoadout,
  countAvailableForCharacter,
  fetchCharacterGuide,
  markAllPerks,
  perkTierForCharacter,
  setPerkTier,
} from '../lib/api';
import type {
  AppSettings,
  CharacterGuide,
  DbDCharacter,
  DbDPerk,
  PerkTier,
  Role,
} from '../types';
import { PerkTile } from './PerkTile';
import { SuggestionBuildCard } from './SuggestionBuildCard';

interface CharacterCollectionProps {
  collectionRole: Role;
  onCollectionRoleChange: (role: Role) => void;
  characters: DbDCharacter[];
  perks: DbDPerk[];
  settings: AppSettings;
  onChange: (settings: AppSettings) => void;
  onOpenAdvisor: (character: DbDCharacter) => void;
  onSaveSuggestion?: (build: import('../types').BuildSuggestion, defaultName: string) => void;
  gameVersion?: string;
}

function loadoutFingerprint(loadout: AppSettings['characters'][string] | undefined): string {
  if (!loadout?.configured) return 'default';
  const keys = Object.keys(loadout.perkAccess ?? {}).sort();
  return keys.map((k) => `${k}:${loadout.perkAccess[k]}`).join('|');
}

export function CharacterCollection({
  collectionRole,
  onCollectionRoleChange,
  characters,
  perks,
  settings,
  onChange,
  onOpenAdvisor,
  onSaveSuggestion,
  gameVersion,
}: CharacterCollectionProps) {
  const roleChars = useMemo(
    () => characters.filter((c) => c.role === collectionRole).sort((a, b) => a.name.localeCompare(b.name)),
    [characters, collectionRole],
  );

  const [selectedId, setSelectedId] = useState<string>(() => roleChars[0]?.id ?? '');
  const [search, setSearch] = useState('');
  const [guide, setGuide] = useState<CharacterGuide | null>(null);
  const [guideLoading, setGuideLoading] = useState(false);
  const [guideError, setGuideError] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'overview' | 'perks'>('overview');
  const guideRequestRef = useRef(0);

  const selected = roleChars.find((c) => c.id === selectedId) ?? roleChars[0];
  const effectiveId = selected?.id;

  const inventoryKey = useMemo(
    () => (effectiveId ? loadoutFingerprint(settings.characters[effectiveId]) : ''),
    [effectiveId, settings.characters],
  );

  useEffect(() => {
    const first = roleChars[0]?.id;
    if (first && !roleChars.some((c) => c.id === selectedId)) {
      setSelectedId(first);
    }
  }, [collectionRole, roleChars, selectedId]);

  useEffect(() => {
    if (!effectiveId) {
      setGuide(null);
      return;
    }

    const requestId = ++guideRequestRef.current;
    const isNewCharacter = guide?.character.id !== effectiveId;
    if (isNewCharacter) setGuideLoading(true);

    fetchCharacterGuide(effectiveId, settings.characters, gameVersion)
      .then((g) => {
        if (requestId !== guideRequestRef.current) return;
        setGuide(g);
        setGuideError(null);
      })
      .catch((e) => {
        if (requestId !== guideRequestRef.current) return;
        setGuideError(String(e));
      })
      .finally(() => {
        if (requestId === guideRequestRef.current) setGuideLoading(false);
      });
  }, [effectiveId, inventoryKey, gameVersion]);

  const filteredPerks = useMemo(() => {
    let list = [...perks].sort((a, b) => a.name.localeCompare(b.name));
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.categories.some((c) => c.toLowerCase().includes(q)) ||
          p.characterName?.toLowerCase().includes(q),
      );
    }
    return list;
  }, [perks, search]);

  const availableCount = effectiveId
    ? countAvailableForCharacter(effectiveId, perks, settings.characters)
    : 0;

  function handleTier(perkId: string, tier: PerkTier) {
    if (!effectiveId) return;
    onChange(setPerkTier(settings, effectiveId, perkId, tier));
  }

  return (
    <div className="collection-hub">
      <aside className={`collection-roster collection-roster-${collectionRole}`}>
        <div className="roster-header">
          <p className="roster-eyebrow">Select {collectionRole === 'survivor' ? 'Survivor' : 'Killer'}</p>
          <div className="entity-role-switch">
            <button
              type="button"
              className={collectionRole === 'survivor' ? 'active survivor' : ''}
              onClick={() => onCollectionRoleChange('survivor')}
            >
              Survivors
            </button>
            <button
              type="button"
              className={collectionRole === 'killer' ? 'active killer' : ''}
              onClick={() => onCollectionRoleChange('killer')}
            >
              Killers
            </button>
          </div>
        </div>

        <ul className="roster-list">
          {roleChars.map((char) => {
            const count = countAvailableForCharacter(char.id, perks, settings.characters);
            const configured = settings.characters[char.id]?.configured;
            return (
              <li key={char.id}>
                <button
                  type="button"
                  className={`roster-item ${char.id === effectiveId ? 'active' : ''}`}
                  onClick={() => setSelectedId(char.id)}
                >
                  <span className="roster-portrait" aria-hidden>
                    {char.name.charAt(0)}
                  </span>
                  <span className="roster-item-text">
                    <span className="roster-item-name">{char.name}</span>
                    <span className="roster-item-meta">
                      {configured ? `${count} perks owned` : 'All perks (default)'}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <section className="collection-detail">
        {!selected ? (
          <p className="empty-note">No characters loaded.</p>
        ) : (
          <>
            <header className={`character-hero character-hero-${selected.role}`}>
              <div className="character-hero-main">
                <span className={`role-badge role-${selected.role}`}>
                  {selected.role === 'survivor' ? 'Survivor' : 'Killer'}
                </span>
                <h2>{selected.name}</h2>
                {selected.difficulty && selected.role === 'killer' && (
                  <span className="character-difficulty">Difficulty · {selected.difficulty}</span>
                )}
                {selected.role === 'killer' && selected.killerMechanics && (
                  <p className="character-archetype">
                    {selected.killerMechanics.loopType.replace(/-/g, ' ')} ·{' '}
                    {selected.killerMechanics.chaseType.replace(/-/g, ' ')}
                  </p>
                )}
              </div>
              <div className="character-hero-actions">
                <button type="button" className="btn-advisor" onClick={() => onOpenAdvisor(selected)}>
                  Build Advisor
                </button>
                <p className="character-hero-hint">
                  {selected.role === 'killer'
                    ? 'Advisor will use this Killer’s power for perk picks.'
                    : 'Advisor uses playstyle — Survivor identity does not change builds.'}
                </p>
              </div>
            </header>

            <div className="collection-detail-tabs">
              <button
                type="button"
                className={detailTab === 'overview' ? 'active' : ''}
                onClick={() => setDetailTab('overview')}
              >
                Overview
              </button>
              <button
                type="button"
                className={detailTab === 'perks' ? 'active' : ''}
                onClick={() => setDetailTab('perks')}
              >
                Perks
              </button>
            </div>

            {detailTab === 'overview' ? (
              <div className="character-overview">
                <article className="entity-panel">
                  <h3>Background</h3>
                  <p className="character-bio">{guide?.bioText ?? selected.bio ?? 'Loading…'}</p>
                </article>

                {selected.role === 'survivor' && guide?.survivorBuildNote && (
                  <article className="entity-panel entity-panel-info">
                    <h3>About builds</h3>
                    <p className="character-guide-text">{guide.survivorBuildNote}</p>
                  </article>
                )}

                {selected.role === 'killer' && (guide?.powerGuide || selected.powerName) && (
                  <article className="entity-panel entity-panel-power">
                    <h3>{selected.powerName ?? 'Power'}</h3>
                    <p className="character-guide-text">
                      {guide?.powerGuide ?? selected.powerDescription ?? 'Power data syncing…'}
                    </p>
                  </article>
                )}

                {selected.role === 'killer' && selected.killerMechanics && (
                  <article className="entity-panel">
                    <h3>Power profile</h3>
                    <p className="character-guide-text">{selected.killerMechanics.summary}</p>
                  </article>
                )}

                <article className="entity-panel">
                  <div className="suggestion-panel-head">
                    <h3>
                      {selected.role === 'killer' ? 'Build ideas for this Killer' : 'Universal build ideas'}
                    </h3>
                    {guide?.gameVersion && (
                      <span className="suggestion-patch-badge">Patch {guide.gameVersion}</span>
                    )}
                  </div>
                  <p className="suggestion-panel-note">
                    Suggestions refresh when game data or your owned perks change.
                  </p>
                  {guideLoading && !guide && (
                    <p className="guide-loading">Loading builds from your perk pool…</p>
                  )}
                  {guideError && <p className="guide-error">{guideError}</p>}
                  {guide?.suggestions.length ? (
                    <ul className="suggestion-list">
                      {guide.suggestions.map((s) => (
                        <SuggestionBuildCard
                          key={`${s.label}-${s.build.perks.map((p) => p.id).join('-')}`}
                          suggestion={s}
                          onSave={onSaveSuggestion}
                        />
                      ))}
                    </ul>
                  ) : null}
                  {!guideLoading && !guide?.suggestions.length && !guideError && (
                    <p className="guide-empty">Mark owned perks on the Perks tab to refine suggestions.</p>
                  )}
                </article>
              </div>
            ) : (
              <div className="character-perks-section">
                <div className="perk-access-header">
                  <div>
                    <h3>Perk inventory</h3>
                    <p>
                      {settings.characters[selected.id]?.configured
                        ? `${availableCount} of ${perks.length} perks marked for ${selected.name}`
                        : `Default — all ${collectionRole} perks at Tier III until you configure.`}
                    </p>
                  </div>
                  <div className="perk-access-actions">
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => onChange(markAllPerks(settings, selected.id, perks, 3))}
                    >
                      All Tier III
                    </button>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => onChange(markAllPerks(settings, selected.id, perks, 0))}
                    >
                      Lock all
                    </button>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => onChange(clearLoadout(settings, selected.id))}
                    >
                      Reset
                    </button>
                  </div>
                </div>

                <input
                  type="search"
                  className="perk-search"
                  placeholder="Filter perks..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />

                <div className="perk-access-list">
                  {filteredPerks.map((p) => (
                    <PerkTile
                      key={p.id}
                      perk={p}
                      tier={perkTierForCharacter(p.id, effectiveId, settings.characters)}
                      compact
                      onTierChange={(t) => handleTier(p.id, t)}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
