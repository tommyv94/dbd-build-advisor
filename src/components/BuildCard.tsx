import { perkTierForCharacter } from '../lib/api';
import type {
  BuildSuggestion,
  CharacterLoadout,
  PerkAdjustment,
} from '../types';
import { PerkTile } from './PerkTile';

const ACTION_LABELS: Record<PerkAdjustment['action'], string> = {
  keep_lower_tier: 'Keeping lower tier',
  replace_perk: 'Replaced',
  remove_perk: 'Removed',
  new_build: 'New build',
};

interface BuildCardProps {
  build: BuildSuggestion;
  characters: Record<string, CharacterLoadout>;
  adjustments?: PerkAdjustment[];
  onSave?: (build: BuildSuggestion) => void;
}

export function BuildCard({ build, characters, adjustments, onSave }: BuildCardProps) {
  const adjustedIds = new Set(adjustments?.map((a) => a.perkId));
  const charId = build.characterId;

  return (
    <div className="build-card">
      <div className="build-card-header">
        <span className={`role-badge role-${build.role}`}>{build.role}</span>
        <h3>{build.title}</h3>
        {onSave && (
          <button type="button" className="build-save-btn" onClick={() => onSave(build)}>
            Save build
          </button>
        )}
        <p className="build-playstyle">{build.playstyle}</p>
        {build.character && <span className="build-character">Playing as {build.character}</span>}
      </div>

      {build.strategy && (
        <div className="build-strategy">
          <span className="build-strategy-label">Game plan</span>
          <p>{build.strategy}</p>
        </div>
      )}

      {build.powerSummary && (
        <div className="build-power">
          <span className="build-strategy-label">Power</span>
          <p>{build.powerSummary}</p>
        </div>
      )}

      {build.mechanicsSummary && (
        <div className="build-mechanics">
          <span className="build-strategy-label">Mechanics profile</span>
          <p>{build.mechanicsSummary}</p>
        </div>
      )}

      <div className="perk-loadout">
        {build.perks.map((perk) => {
          const userTier = perkTierForCharacter(perk.id, charId, characters);
          const adjustment = adjustments?.find((a) => a.perkId === perk.id);
          const adjustmentLabel = adjustment
            ? `${ACTION_LABELS[adjustment.action]}${adjustment.replacement ? ` → ${adjustment.replacement.name}` : ''} — ${adjustment.reasoning}`
            : undefined;

          return (
            <PerkTile
              key={perk.id}
              perk={perk}
              tier={userTier}
              reason={perk.reason}
              synergy={perk.synergy}
              adjusted={adjustedIds.has(perk.id)}
              adjustmentLabel={adjustmentLabel}
            />
          );
        })}
      </div>

      {build.explanation && (
        <p className="build-explanation">{build.explanation.replace(/\*\*/g, '')}</p>
      )}
    </div>
  );
}
