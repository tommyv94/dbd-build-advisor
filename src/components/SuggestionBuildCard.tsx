import type { CharacterGuideSuggestion } from '../types';

interface SuggestionBuildCardProps {
  suggestion: CharacterGuideSuggestion;
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function SuggestionBuildCard({ suggestion }: SuggestionBuildCardProps) {
  const { label, gamePlan, synergySummary, build } = suggestion;
  const planParagraphs = splitParagraphs(gamePlan);
  const synergyParagraphs = splitParagraphs(synergySummary);

  return (
    <li className="suggestion-card suggestion-card-detailed">
      <header className="suggestion-card-head">
        <h4>{label}</h4>
        <span className="suggestion-playstyle">{build.playstyle}</span>
      </header>

      <section className="suggestion-section">
        <h5>Game plan</h5>
        {planParagraphs.map((p) => (
          <p key={p.slice(0, 40)} className="suggestion-prose">
            {p}
          </p>
        ))}
      </section>

      <section className="suggestion-section">
        <h5>Perk breakdown</h5>
        <ul className="suggestion-perk-breakdown">
          {build.perks.map((perk, index) => (
            <li key={perk.id} className="suggestion-perk-row">
              <div className="suggestion-perk-top">
                <span className="suggestion-perk-slot">{['Primary', 'Secondary', 'Utility', 'Flex'][index] ?? 'Flex'}</span>
                <strong>{perk.name}</strong>
                {perk.categories && perk.categories.length > 0 && (
                  <span className="suggestion-perk-tag">{perk.categories[0]}</span>
                )}
              </div>
              <p className="suggestion-perk-why">{perk.reason}</p>
              {perk.description && (
                <p className="suggestion-perk-effect">{perk.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}</p>
              )}
              {perk.synergy && <p className="suggestion-perk-synergy">{perk.synergy}</p>}
            </li>
          ))}
        </ul>
      </section>

      {synergyParagraphs.length > 0 && (
        <section className="suggestion-section suggestion-section-together">
          <h5>How it works together</h5>
          {synergyParagraphs.map((p) => (
            <p key={p.slice(0, 40)} className="suggestion-prose">
              {p}
            </p>
          ))}
        </section>
      )}
    </li>
  );
}
