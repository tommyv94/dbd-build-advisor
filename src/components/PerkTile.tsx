import { categoryLabel, tierClass, tierLabel } from '../lib/api';
import type { BuildPerk, DbDPerk, PerkTier } from '../types';

interface PerkTileProps {
  perk: BuildPerk | DbDPerk;
  tier?: PerkTier;
  reason?: string;
  synergy?: string;
  adjusted?: boolean;
  adjustmentLabel?: string;
  compact?: boolean;
  onTierChange?: (tier: PerkTier) => void;
}

export function PerkTile({
  perk,
  tier = 3,
  reason,
  synergy,
  adjusted,
  adjustmentLabel,
  compact,
  onTierChange,
}: PerkTileProps) {
  const description = 'description' in perk ? perk.description : undefined;
  const categories = 'categories' in perk ? perk.categories : [];
  const displayReason = reason ?? ('reason' in perk ? perk.reason : undefined);

  return (
    <article className={`perk-tile ${adjusted ? 'perk-tile-adjusted' : ''} ${compact ? 'perk-tile-compact' : ''}`}>
      <div className="perk-tile-body">
        <header className="perk-tile-header">
          <div className="perk-tile-title-row">
            <h4>{perk.name}</h4>
            <span className={`tier-pill ${tierClass(tier)}`}>
              {tier === 0 ? 'Locked' : `Tier ${tier}`}
            </span>
          </div>
          {categories && categories.length > 0 && (
            <div className="perk-tile-tags">
              {categories.slice(0, 3).map((c) => (
                <span key={c} className="perk-tag">
                  {categoryLabel(c)}
                </span>
              ))}
            </div>
          )}
        </header>

        {!compact && description && <p className="perk-tile-desc">{description}</p>}
        {displayReason && <p className="perk-tile-why">{displayReason}</p>}
        {synergy && !compact && <p className="perk-tile-synergy">{synergy}</p>}
        {adjustmentLabel && <p className="perk-tile-adjust">{adjustmentLabel}</p>}

        {onTierChange && (
          <div className="perk-tile-tier-row">
            {([0, 1, 2, 3] as PerkTier[]).map((t) => (
              <button
                key={t}
                type="button"
                className={`tier-btn ${tierClass(t)} ${tier === t ? 'selected' : ''}`}
                onClick={() => onTierChange(t)}
                title={tierLabel(t)}
              >
                {t === 0 ? '✕' : t}
              </button>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
