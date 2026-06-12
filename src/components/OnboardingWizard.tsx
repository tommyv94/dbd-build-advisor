import { useMemo, useState } from 'react';
import { markAllPerks } from '../lib/api';
import { isDesktopApp, isMacDesktop } from '../lib/api-base';
import type { AppSettings, DbDCharacter, DbDPerk, Role } from '../types';
import { EntityMark } from './EntityMark';

const INSTALL_HINTS_KEY = 'dbd-install-hints-seen';

type Step = 'welcome' | 'mains' | 'tiers' | 'api-key';

interface OnboardingWizardProps {
  settings: AppSettings;
  survivorChars: DbDCharacter[];
  killerChars: DbDCharacter[];
  survivorPerks: DbDPerk[];
  killerPerks: DbDPerk[];
  initialStep?: Step;
  onComplete: (settings: AppSettings, firstMainId?: string, firstMainRole?: Role) => void;
  onSkip: () => void;
}

type TierPreset = 'all-t3' | 'fresh' | 'skip';

export function OnboardingWizard({
  settings: initialSettings,
  survivorChars,
  killerChars,
  survivorPerks,
  killerPerks,
  initialStep = 'welcome',
  onComplete,
  onSkip,
}: OnboardingWizardProps) {
  const showInstallHints =
    initialStep === 'welcome' && isDesktopApp() && !localStorage.getItem(INSTALL_HINTS_KEY);
  const [step, setStep] = useState<Step>(showInstallHints ? 'welcome' : initialStep === 'welcome' ? 'mains' : initialStep);
  const [settings] = useState<AppSettings>(initialSettings);
  const [selectedMains, setSelectedMains] = useState<Set<string>>(new Set());
  const [tierPresets, setTierPresets] = useState<Record<string, TierPreset>>({});
  const [apiKey, setApiKey] = useState(initialSettings.openaiApiKey ?? '');

  const allChars = useMemo(
    () => [...survivorChars, ...killerChars].sort((a, b) => a.name.localeCompare(b.name)),
    [survivorChars, killerChars],
  );

  const selectedChars = useMemo(
    () => allChars.filter((c) => selectedMains.has(c.id)),
    [allChars, selectedMains],
  );

  function toggleMain(charId: string) {
    setSelectedMains((prev) => {
      const next = new Set(prev);
      if (next.has(charId)) next.delete(charId);
      else next.add(charId);
      return next;
    });
  }

  function setPreset(charId: string, preset: TierPreset) {
    setTierPresets((prev) => ({ ...prev, [charId]: preset }));
  }

  function finish() {
    let nextSettings: AppSettings = { ...settings, openaiApiKey: apiKey.trim() || undefined };

    for (const char of selectedChars) {
      const preset = tierPresets[char.id] ?? 'all-t3';
      const perks = char.role === 'survivor' ? survivorPerks : killerPerks;
      if (preset === 'all-t3') {
        nextSettings = markAllPerks(nextSettings, char.id, perks, 3);
      } else if (preset === 'fresh') {
        nextSettings = markAllPerks(nextSettings, char.id, perks, 0);
      }
    }

    const firstMain = selectedChars[0];
    onComplete(
      {
        ...nextSettings,
        activeCharacterId: firstMain?.id ?? nextSettings.activeCharacterId,
      },
      firstMain?.id,
      firstMain?.role,
    );
  }

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card">
        <header className="onboarding-header">
          <EntityMark size="sm" />
          <div>
            <p className="onboarding-eyebrow">Getting started</p>
            <h2>Welcome to Build Advisor</h2>
          </div>
        </header>

        <div className="onboarding-steps" aria-hidden>
          {(['welcome', 'mains', 'tiers', 'api-key'] as Step[]).map((s, i) => (
            <span
              key={s}
              className={`onboarding-step-dot ${step === s ? 'active' : ''} ${showInstallHints || initialStep === 'welcome' ? '' : i === 0 ? 'onboarding-step-skipped' : ''}`}
            >
              {showInstallHints || initialStep === 'welcome' ? i + 1 : i}
            </span>
          ))}
        </div>

        {step === 'welcome' && showInstallHints && (
          <section className="onboarding-section">
            <h3>First-time install</h3>
            <p className="onboarding-prose">
              Build Advisor is unsigned (free fan tool). Your OS may warn on first open — that is normal.
            </p>
            {isMacDesktop() ? (
              <ul className="onboarding-hints">
                <li>Open the <strong>.dmg</strong> and drag Build Advisor to Applications.</li>
                <li>First launch: <strong>right-click</strong> the app → <strong>Open</strong>, or allow in System Settings → Privacy &amp; Security.</li>
              </ul>
            ) : (
              <ul className="onboarding-hints">
                <li>Run the installer from GitHub Releases.</li>
                <li>If SmartScreen appears: <strong>More info</strong> → <strong>Run anyway</strong>.</li>
              </ul>
            )}
            <p className="onboarding-prose muted">
              Updates install silently after the first setup — you only see this once.
            </p>
          </section>
        )}

        {step === 'mains' && (
          <section className="onboarding-section">
            <h3>Pick your mains</h3>
            <p className="onboarding-prose">
              Select Survivors and Killers you play most. We will set up perk inventory for them first.
            </p>
            <div className="onboarding-char-grid">
              {allChars.map((char) => (
                <button
                  key={char.id}
                  type="button"
                  className={`onboarding-char-btn role-${char.role} ${selectedMains.has(char.id) ? 'selected' : ''}`}
                  onClick={() => toggleMain(char.id)}
                >
                  <span className="onboarding-char-name">{char.name}</span>
                  <span className="onboarding-char-role">{char.role}</span>
                </button>
              ))}
            </div>
            {selectedMains.size === 0 && (
              <p className="onboarding-hint">Pick at least one, or skip to configure later in Collection.</p>
            )}
          </section>
        )}

        {step === 'tiers' && (
          <section className="onboarding-section">
            <h3>Perk inventory</h3>
            <p className="onboarding-prose">
              Quick setup for each main. You can fine-tune individual perks anytime in Collection.
            </p>
            {selectedChars.length === 0 ? (
              <p className="onboarding-prose muted">No mains selected — you can configure perks later.</p>
            ) : (
              <ul className="onboarding-tier-list">
                {selectedChars.map((char) => (
                  <li key={char.id} className="onboarding-tier-row">
                    <span className={`onboarding-tier-name role-${char.role}`}>{char.name}</span>
                    <div className="onboarding-tier-options">
                      {(
                        [
                          ['all-t3', 'All Tier III'],
                          ['fresh', 'Fresh account'],
                          ['skip', 'Configure later'],
                        ] as const
                      ).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          className={`onboarding-tier-btn ${(tierPresets[char.id] ?? 'all-t3') === value ? 'selected' : ''}`}
                          onClick={() => setPreset(char.id, value)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {step === 'api-key' && (
          <section className="onboarding-section">
            <h3>AI chat (optional)</h3>
            <p className="onboarding-prose">
              Add an OpenAI API key for natural-language build advice. Without one, you still get character guides,
              inventory-aware suggestions, and the build lab.
            </p>
            <label className="onboarding-api-label">
              OpenAI API key
              <input
                type="password"
                value={apiKey}
                placeholder="sk-… (optional)"
                onChange={(e) => setApiKey(e.target.value)}
              />
            </label>
            <p className="onboarding-prose muted">Stored locally on your machine only — never sent to us.</p>
          </section>
        )}

        <footer className="onboarding-footer">
          <button type="button" className="onboarding-skip" onClick={onSkip}>
            Skip setup
          </button>
          <div className="onboarding-nav">
            {step !== 'welcome' && step !== 'mains' && (
              <button
                type="button"
                className="onboarding-back"
                onClick={() => {
                  if (step === 'api-key') setStep('tiers');
                  else if (step === 'tiers') setStep('mains');
                }}
              >
                Back
              </button>
            )}
            {step === 'welcome' && (
              <button
                type="button"
                className="onboarding-next dbd-btn-primary"
                onClick={() => {
                  localStorage.setItem(INSTALL_HINTS_KEY, '1');
                  setStep('mains');
                }}
              >
                Continue
              </button>
            )}
            {step === 'mains' && (
              <button
                type="button"
                className="onboarding-next dbd-btn-primary"
                onClick={() => setStep('tiers')}
              >
                Next
              </button>
            )}
            {step === 'tiers' && (
              <button type="button" className="onboarding-next dbd-btn-primary" onClick={() => setStep('api-key')}>
                Next
              </button>
            )}
            {step === 'api-key' && (
              <button type="button" className="onboarding-next dbd-btn-primary" onClick={finish}>
                Enter the Fog
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
