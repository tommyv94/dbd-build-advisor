import { useEffect, useMemo, useState } from 'react';
import { fetchCharacters, markAllPerks } from '../lib/api';
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

function initialWizardStep(requested: Step): Step {
  if (requested !== 'welcome') return requested;
  if (isDesktopApp() && !localStorage.getItem(INSTALL_HINTS_KEY)) return 'welcome';
  return 'mains';
}

export function OnboardingWizard({
  settings: initialSettings,
  survivorChars: initialSurvivorChars,
  killerChars: initialKillerChars,
  survivorPerks,
  killerPerks,
  initialStep = 'welcome',
  onComplete,
  onSkip,
}: OnboardingWizardProps) {
  const showInstallHints = isDesktopApp() && !localStorage.getItem(INSTALL_HINTS_KEY);
  const [step, setStep] = useState<Step>(() => initialWizardStep(initialStep));
  const [settings] = useState<AppSettings>(initialSettings);
  const [selectedMains, setSelectedMains] = useState<Set<string>>(new Set());
  const [tierPresets, setTierPresets] = useState<Record<string, TierPreset>>({});
  const [apiKey, setApiKey] = useState(initialSettings.openaiApiKey ?? '');
  const [survivorChars, setSurvivorChars] = useState(initialSurvivorChars);
  const [killerChars, setKillerChars] = useState(initialKillerChars);
  const [rosterLoading, setRosterLoading] = useState(
    initialSurvivorChars.length === 0 && initialKillerChars.length === 0,
  );
  const [rosterError, setRosterError] = useState<string | null>(null);

  useEffect(() => {
    if (survivorChars.length > 0 || killerChars.length > 0) {
      setRosterLoading(false);
      return;
    }

    let cancelled = false;
    setRosterLoading(true);
    setRosterError(null);

    Promise.all([fetchCharacters('survivor'), fetchCharacters('killer')])
      .then(([sc, kc]) => {
        if (cancelled) return;
        setSurvivorChars(sc);
        setKillerChars(kc);
        if (sc.length === 0 && kc.length === 0) {
          setRosterError('Could not load characters. Check your connection and try again.');
        }
      })
      .catch((err) => {
        if (!cancelled) setRosterError(String(err));
      })
      .finally(() => {
        if (!cancelled) setRosterLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [survivorChars.length, killerChars.length]);

  const allChars = useMemo(
    () => [...survivorChars, ...killerChars].sort((a, b) => a.name.localeCompare(b.name)),
    [survivorChars, killerChars],
  );

  const selectedChars = useMemo(
    () => allChars.filter((c) => selectedMains.has(c.id)),
    [allChars, selectedMains],
  );

  const visibleSteps = useMemo(
    () => (showInstallHints ? (['welcome', 'mains', 'tiers', 'api-key'] as Step[]) : (['mains', 'tiers', 'api-key'] as Step[])),
    [showInstallHints],
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

  function goBack() {
    const index = visibleSteps.indexOf(step);
    if (index > 0) setStep(visibleSteps[index - 1]!);
  }

  function goNext() {
    const index = visibleSteps.indexOf(step);
    if (index >= 0 && index < visibleSteps.length - 1) {
      setStep(visibleSteps[index + 1]!);
    }
  }

  return (
    <div className="app-body onboarding-body">
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
            {visibleSteps.map((s, i) => (
              <span key={s} className={`onboarding-step-dot ${step === s ? 'active' : ''}`}>
                {i + 1}
              </span>
            ))}
          </div>

          <div className="onboarding-panel">
            {step === 'welcome' && (
              <section className="onboarding-section">
                <h3>{showInstallHints ? 'First-time install' : 'Quick setup'}</h3>
                {showInstallHints ? (
                  <>
                    <p className="onboarding-prose">
                      Build Advisor is unsigned (free fan tool). Your OS may warn on first open — that is normal.
                    </p>
                    {isMacDesktop() ? (
                      <ul className="onboarding-hints">
                        <li>Open the <strong>.dmg</strong> and drag Build Advisor to Applications.</li>
                        <li>
                          First launch: <strong>right-click</strong> the app → <strong>Open</strong>, or allow in System
                          Settings → Privacy &amp; Security.
                        </li>
                      </ul>
                    ) : (
                      <ul className="onboarding-hints">
                        <li>Run the installer from GitHub Releases.</li>
                        <li>
                          If SmartScreen appears: <strong>More info</strong> → <strong>Run anyway</strong>.
                        </li>
                      </ul>
                    )}
                    <p className="onboarding-prose muted">
                      Updates install silently after the first setup — you only see this once.
                    </p>
                  </>
                ) : (
                  <p className="onboarding-prose">
                    We will pick your mains, set perk inventory presets, and optionally connect an OpenAI key for chat.
                    You can change everything later in Collection and Settings.
                  </p>
                )}
              </section>
            )}

            {step === 'mains' && (
              <section className="onboarding-section">
                <h3>Pick your mains</h3>
                <p className="onboarding-prose">
                  Select Survivors and Killers you play most. We will set up perk inventory for them first.
                </p>
                {rosterLoading ? (
                  <p className="onboarding-prose muted">Loading character roster…</p>
                ) : rosterError ? (
                  <p className="onboarding-prose onboarding-error">{rosterError}</p>
                ) : allChars.length === 0 ? (
                  <p className="onboarding-prose muted">No characters available yet. Skip setup and try again after restarting.</p>
                ) : (
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
                )}
                {selectedMains.size === 0 && !rosterLoading && allChars.length > 0 && (
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
          </div>

          <footer className="onboarding-footer">
            <button type="button" className="onboarding-skip" onClick={onSkip}>
              Skip setup
            </button>
            <div className="onboarding-nav">
              {visibleSteps.indexOf(step) > 0 && (
                <button type="button" className="onboarding-back" onClick={goBack}>
                  Back
                </button>
              )}
              {step !== visibleSteps[visibleSteps.length - 1] ? (
                <button
                  type="button"
                  className="onboarding-next dbd-btn-primary"
                  disabled={step === 'mains' && rosterLoading}
                  onClick={() => {
                    if (step === 'welcome' && showInstallHints) {
                      localStorage.setItem(INSTALL_HINTS_KEY, '1');
                    }
                    goNext();
                  }}
                >
                  {step === 'welcome' ? 'Continue' : 'Next'}
                </button>
              ) : (
                <button type="button" className="onboarding-next dbd-btn-primary" onClick={finish}>
                  Enter the Fog
                </button>
              )}
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
