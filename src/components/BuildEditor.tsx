import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { enrichBuild, perkTierForCharacter } from '../lib/api';
import type {
  AppSettings,
  BuildPerk,
  BuildSuggestion,
  DbDCharacter,
  DbDPerk,
  Role,
} from '../types';
import { PerkTile } from './PerkTile';

const SLOT_LABELS = ['Primary', 'Secondary', 'Utility', 'Flex'];

interface BuildEditorProps {
  role: Role;
  character?: DbDCharacter;
  perks: DbDPerk[];
  characters: Record<string, CharacterLoadout>;
  settings: AppSettings;
  initialBuild?: BuildSuggestion;
  onBuildChange?: (build: BuildSuggestion | undefined) => void;
  onSave?: (build: BuildSuggestion) => void;
}

type CharacterLoadout = AppSettings['characters'][string];

function emptyBuild(role: Role, character?: DbDCharacter): BuildSuggestion {
  return {
    id: crypto.randomUUID(),
    role,
    title: character ? `${character.name} custom build` : 'Custom build',
    character: character?.name,
    characterId: character?.id,
    playstyle: 'Custom',
    perks: [],
    explanation: 'Built in the loadout editor.',
  };
}

export function BuildEditor({
  role,
  character,
  perks,
  characters,
  settings,
  initialBuild,
  onBuildChange,
  onSave,
}: BuildEditorProps) {
  const [slots, setSlots] = useState<(BuildPerk | null)[]>(() => {
    const base = initialBuild?.perks ?? [];
    return [0, 1, 2, 3].map((i) => base[i] ?? null);
  });
  const [selectedSlot, setSelectedSlot] = useState(0);
  const [search, setSearch] = useState('');
  const [ownedOnly, setOwnedOnly] = useState(true);
  const [enriched, setEnriched] = useState<BuildSuggestion | undefined>();
  const [enriching, setEnriching] = useState(false);
  const enrichTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const charId = character?.id ?? settings.activeCharacterId;

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
    if (ownedOnly && charId) {
      list = list.filter((p) => perkTierForCharacter(p.id, charId, characters) > 0);
    }
    const usedIds = new Set(slots.filter(Boolean).map((s) => s!.id));
    return list.filter((p) => !usedIds.has(p.id));
  }, [perks, search, ownedOnly, charId, characters, slots]);

  const draftBuild = useMemo((): BuildSuggestion | undefined => {
    const filled = slots.filter(Boolean) as BuildPerk[];
    if (filled.length === 0) return undefined;
    return {
      ...(initialBuild ?? emptyBuild(role, character)),
      role,
      character: character?.name ?? initialBuild?.character,
      characterId: character?.id ?? initialBuild?.characterId,
      perks: filled,
    };
  }, [slots, role, character, initialBuild]);

  useEffect(() => {
    if (enrichTimer.current) clearTimeout(enrichTimer.current);
    if (!draftBuild || draftBuild.perks.length < 4) {
      setEnriched(undefined);
      onBuildChange?.(draftBuild);
      return;
    }
    enrichTimer.current = setTimeout(() => {
      setEnriching(true);
      enrichBuild(draftBuild)
        .then((b) => {
          setEnriched(b);
          onBuildChange?.(b);
        })
        .catch(() => {
          setEnriched(draftBuild);
          onBuildChange?.(draftBuild);
        })
        .finally(() => setEnriching(false));
    }, 400);
    return () => {
      if (enrichTimer.current) clearTimeout(enrichTimer.current);
    };
  }, [draftBuild, onBuildChange]);

  const assignPerk = useCallback(
    (perk: DbDPerk) => {
      const buildPerk: BuildPerk = {
        id: perk.id,
        name: perk.name,
        recommendedTier: 3,
        reason: 'Selected in loadout editor.',
        description: perk.description,
        categories: perk.categories,
      };
      setSlots((prev) => {
        const next = [...prev];
        const target = next.findIndex((s, i) => i === selectedSlot || (!s && i >= selectedSlot));
        const idx = target >= 0 ? target : selectedSlot;
        next[idx] = buildPerk;
        return next;
      });
      setSelectedSlot((s) => Math.min(s + 1, 3));
    },
    [selectedSlot],
  );

  const clearSlot = (index: number) => {
    setSlots((prev) => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
    setSelectedSlot(index);
  };

  const displayBuild = enriched ?? draftBuild;

  return (
    <div className="build-editor">
      <div className="build-editor-slots">
        <h3 className="build-editor-heading">Loadout slots</h3>
        <p className="build-editor-hint">Click a slot, then pick a perk. {character ? `Building for ${character.name}.` : ''}</p>
        <div className="build-editor-slot-grid">
          {SLOT_LABELS.map((label, index) => {
            const perk = slots[index];
            return (
              <div
                key={label}
                className={`build-editor-slot ${selectedSlot === index ? 'selected' : ''} ${perk ? 'filled' : 'empty'}`}
              >
                <button type="button" className="build-editor-slot-btn" onClick={() => setSelectedSlot(index)}>
                  <span className="build-editor-slot-label">{label}</span>
                  {perk ? (
                    <>
                      <strong>{perk.name}</strong>
                      {charId && (
                        <span className="build-editor-slot-tier">
                          T{perkTierForCharacter(perk.id, charId, characters) || '—'}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="build-editor-slot-empty">+ Add perk</span>
                  )}
                </button>
                {perk && (
                  <button type="button" className="build-editor-slot-clear" onClick={() => clearSlot(index)} aria-label={`Clear ${label}`}>
                    ✕
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {enriching && <p className="build-editor-status">Loading synergy notes…</p>}
      </div>

      {displayBuild && displayBuild.perks.length === 4 && (
        <div className="build-editor-synergy">
          <h3 className="build-editor-heading">Synergy notes</h3>
          <div className="perk-loadout">
            {displayBuild.perks.map((perk) => (
              <PerkTile
                key={perk.id}
                perk={perk}
                tier={charId ? perkTierForCharacter(perk.id, charId, characters) : 3}
                reason={perk.reason}
                synergy={perk.synergy}
              />
            ))}
          </div>
          {onSave && (
            <button type="button" className="build-save-btn" onClick={() => onSave(displayBuild)}>
              Save to loadouts
            </button>
          )}
        </div>
      )}

      <div className="build-editor-picker">
        <div className="build-editor-picker-head">
          <h3 className="build-editor-heading">Perk pool</h3>
          <label className="build-editor-owned-toggle">
            <input type="checkbox" checked={ownedOnly} onChange={(e) => setOwnedOnly(e.target.checked)} />
            Owned only
          </label>
        </div>
        <input
          type="search"
          className="perk-search"
          placeholder="Search perks…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="build-editor-perk-list">
          {filteredPerks.slice(0, 80).map((p) => (
            <button key={p.id} type="button" className="build-editor-perk-btn" onClick={() => assignPerk(p)}>
              <span>{p.name}</span>
              {p.characterName && <span className="build-editor-perk-char">{p.characterName}</span>}
            </button>
          ))}
          {filteredPerks.length === 0 && <p className="build-editor-empty">No perks match.</p>}
        </div>
      </div>
    </div>
  );
}
