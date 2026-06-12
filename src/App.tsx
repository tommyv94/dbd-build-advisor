import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CharacterCollection } from './components/CharacterCollection';
import { ChatPanel } from './components/ChatPanel';
import { ProfileManager } from './components/ProfileManager';
import { SavedBuildsPanel } from './components/SavedBuildsPanel';
import { AppDialog, type AppDialogConfig } from './components/AppDialog';
import { EntityMark } from './components/EntityMark';
import { FogAtmosphere } from './components/FogAtmosphere';
import { AmbientMuteButton } from './components/AmbientMuteButton';
import { LandingPage } from './components/LandingPage';
import { TitleBar } from './components/TitleBar';
import { UpdateBanner, UpdateCheckButton } from './components/UpdateBanner';
import { APP_VERSION } from './lib/app-version';
import { useAmbientAudio } from './hooks/useAmbientAudio';
import { playEnterFogStinger } from './lib/ui-sounds';
import { summarizeBuildIssues, validateSavedBuild } from './lib/build-staleness';
import { isDesktopApp } from './lib/api-base';
import {
  createMessage,
  fetchCharacters,
  fetchMeta,
  fetchPerks,
  loadSettings,
  QUICK_PROMPTS,
  sendChat,
  starterMessage,
} from './lib/api';
import {
  activateProfile,
  activeRoleFromStore,
  deleteSavedBuildFromProfile,
  fetchProfiles,
  getActiveSavedBuilds,
  migrateLegacySettings,
  profileStoreToSettings,
  saveActiveProfileSettings,
  saveBuildToProfile,
} from './lib/profiles';
import type {
  AppSettings,
  BuildSuggestion,
  ChatMessage,
  DbDCharacter,
  DbDPerk,
  GameMeta,
  ProfileStore,
  Role,
  SavedBuild,
} from './types';
import './App.css';

type Tab = 'collection' | 'advisor' | 'saved';

function App() {
  const [profileStore, setProfileStore] = useState<ProfileStore | null>(null);
  const [settings, setSettings] = useState<AppSettings>({ characters: {} });
  const [collectionRole, setCollectionRoleState] = useState<Role>(() => {
    const saved = sessionStorage.getItem('dbd-collection-role');
    return saved === 'killer' || saved === 'survivor' ? saved : 'survivor';
  });
  const setCollectionRole = useCallback((role: Role) => {
    setCollectionRoleState(role);
    sessionStorage.setItem('dbd-collection-role', role);
  }, []);
  const [advisorRole, setAdvisorRole] = useState<Role>('survivor');
  const [advisorCharacterLocked, setAdvisorCharacterLocked] = useState(false);
  const [tab, setTab] = useState<Tab>('collection');
  const [meta, setMeta] = useState<GameMeta | null>(null);
  const [survivorChars, setSurvivorChars] = useState<DbDCharacter[]>([]);
  const [killerChars, setKillerChars] = useState<DbDCharacter[]>([]);
  const [survivorPerks, setSurvivorPerks] = useState<DbDPerk[]>([]);
  const [killerPerks, setKillerPerks] = useState<DbDPerk[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([starterMessage()]);
  const [currentBuild, setCurrentBuild] = useState<BuildSuggestion | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [profilesReady, setProfilesReady] = useState(false);
  const [dialog, setDialog] = useState<AppDialogConfig | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showLanding, setShowLanding] = useState(true);
  const [shellExit, setShellExit] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { muted: ambientMuted, toggleMute: toggleAmbientMute, primeOnInteraction } = useAmbientAudio();

  const advisorCharacters = useMemo(
    () => (advisorRole === 'survivor' ? survivorChars : killerChars),
    [advisorRole, survivorChars, killerChars],
  );

  const collectionCharacters = useMemo(
    () => (collectionRole === 'survivor' ? survivorChars : killerChars),
    [collectionRole, survivorChars, killerChars],
  );

  const collectionPerks = collectionRole === 'survivor' ? survivorPerks : killerPerks;
  const allPerks = useMemo(() => [...survivorPerks, ...killerPerks], [survivorPerks, killerPerks]);
  const allCharacters = useMemo(() => [...survivorChars, ...killerChars], [survivorChars, killerChars]);

  const advisorChar = advisorCharacters.find((c) => c.id === settings.activeCharacterId);

  const syncProfileStore = useCallback((store: ProfileStore, opts?: { resetAdvisorRole?: boolean }) => {
    setProfileStore(store);
    setSettings(profileStoreToSettings(store));
    if (opts?.resetAdvisorRole) {
      const savedRole = activeRoleFromStore(store);
      if (savedRole) setAdvisorRole(savedRole);
    }
  }, []);

  useEffect(() => {
    async function initProfiles() {
      try {
        let store = await fetchProfiles();
        const legacy = loadSettings();
        const hasLegacy = Object.values(legacy.characters).some((c) => c.configured);
        if (hasLegacy || legacy.openaiApiKey) {
          store = await migrateLegacySettings(legacy);
          localStorage.removeItem('dbd-advisor-settings');
        }
        syncProfileStore(store, { resetAdvisorRole: true });
      } catch (e) {
        setError(String(e));
      } finally {
        setProfilesReady(true);
      }
    }
    void initProfiles();
  }, [syncProfileStore]);

  useEffect(() => {
    if (!profilesReady || !profileStore) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveActiveProfileSettings(settings, advisorRole)
        .then((store) => syncProfileStore(store))
        .catch((e) => setError(String(e)));
    }, 600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [settings, advisorRole, profilesReady, profileStore?.activeProfileId]);

  useEffect(() => {
    function refreshMeta() {
      fetchMeta()
        .then(setMeta)
        .catch((e) => setError(String(e)));
    }
    refreshMeta();
    const onFocus = () => refreshMeta();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  useEffect(() => {
    Promise.all([
      fetchPerks('survivor'),
      fetchPerks('killer'),
      fetchCharacters('survivor'),
      fetchCharacters('killer'),
    ])
      .then(([sp, kp, sc, kc]) => {
        setSurvivorPerks(sp);
        setKillerPerks(kp);
        setSurvivorChars(sc);
        setKillerChars(kc);
      })
      .catch((e) => setError(String(e)));
  }, [meta?.perkVersion]);

  useEffect(() => {
    setMessages([starterMessage()]);
    setCurrentBuild(undefined);
    setAdvisorCharacterLocked(false);
  }, [advisorRole, profileStore?.activeProfileId]);

  useEffect(() => {
    const active = settings.activeCharacterId;
    const valid = advisorCharacters.some((c) => c.id === active);
    if (!valid && advisorCharacters[0]) {
      setSettings((s) => ({ ...s, activeCharacterId: advisorCharacters[0].id }));
    }
  }, [advisorCharacters, settings.activeCharacterId]);

  const handleSend = useCallback(
    async (text: string) => {
      const userMsg = createMessage('user', text);
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);
      setError(null);

      try {
        const response = await sendChat({
          message: text,
          role: advisorRole,
          history: messages,
          currentBuild,
          characters: settings.characters,
          activeCharacterId: settings.activeCharacterId,
          openaiApiKey: settings.openaiApiKey,
        });

        const assistantMsg = createMessage('assistant', response.reply, {
          build: response.build,
          adjustments: response.adjustments,
        });
        setMessages((prev) => [...prev, assistantMsg]);
        if (response.build) setCurrentBuild(response.build);
      } catch (e) {
        setError(String(e));
        setMessages((prev) => [
          ...prev,
          createMessage('assistant', `Something went wrong: ${e}. Try restarting the app.`),
        ]);
      } finally {
        setLoading(false);
      }
    },
    [advisorRole, messages, currentBuild, settings],
  );

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 3500);
  }, []);

  const handleSaveBuild = useCallback(
    (build: BuildSuggestion) => {
      setDialog({
        kind: 'prompt',
        title: 'Save build',
        label: 'Build name',
        defaultValue: build.title || 'Saved build',
        submitLabel: 'Save',
        onSubmit: async (name) => {
          try {
            const store = await saveBuildToProfile(name, build, meta?.perkVersion);
            syncProfileStore(store);
            showNotice(`Saved "${name}" to your profile`);
          } catch (e) {
            setError(String(e));
          }
        },
      });
    },
    [syncProfileStore, showNotice, meta?.perkVersion],
  );

  const handleLoadSavedBuild = useCallback(
    (saved: SavedBuild) => {
      const validation = validateSavedBuild(
        saved,
        allPerks,
        allCharacters,
        meta?.perkVersion ?? 'unknown',
      );
      setAdvisorRole(saved.role);
      if (saved.characterId) {
        setSettings((s) => ({ ...s, activeCharacterId: saved.characterId }));
        setAdvisorCharacterLocked(true);
      }
      setCurrentBuild(saved.build);
      setTab('advisor');
      const staleNote =
        validation.needsReview && validation.issues.length > 0
          ? `\n\n⚠ ${summarizeBuildIssues(validation)}`
          : '';
      setMessages((prev) => [
        ...prev,
        createMessage(
          'assistant',
          `Loaded saved build **${saved.name}**${saved.characterName ? ` for ${saved.characterName}` : ''}.${staleNote}`,
          { build: saved.build },
        ),
      ]);
      if (validation.needsReview) {
        showNotice('This saved build may be outdated — check perk changes in Saved Loadouts.');
      }
    },
    [allPerks, allCharacters, meta?.perkVersion, showNotice],
  );

  const handleDeleteSavedBuild = useCallback(
    async (buildId: string) => {
      try {
        const store = await deleteSavedBuildFromProfile(buildId);
        syncProfileStore(store);
      } catch (e) {
        setError(String(e));
      }
    },
    [syncProfileStore],
  );

  const resetChat = useCallback(() => {
    setMessages([starterMessage()]);
    setCurrentBuild(undefined);
  }, []);

  const handleNewChat = useCallback(() => {
    const hasHistory = messages.some((m) => m.role === 'user');
    if (hasHistory || currentBuild) {
      setDialog({
        kind: 'confirm',
        title: 'New chat',
        message: 'Clear this conversation and start fresh? Saved builds on your profile are not affected.',
        confirmLabel: 'New chat',
        onConfirm: resetChat,
      });
      return;
    }
    resetChat();
  }, [messages, currentBuild, resetChat]);

  const handleOpenAdvisor = useCallback(
    (character: DbDCharacter) => {
      setAdvisorRole(character.role);
      setSettings((s) => ({ ...s, activeCharacterId: character.id }));
      setAdvisorCharacterLocked(true);
      setTab('advisor');
      resetChat();
      setMessages([
        createMessage(
          'assistant',
          `Advising on **${character.name}** (${character.role}). Ask for builds, perk swaps, or strategy — I'll use your perk collection for this character.`,
        ),
      ]);
    },
    [resetChat],
  );

  const handleAdvisorRoleChange = useCallback(
    (role: Role) => {
      setAdvisorRole(role);
      setAdvisorCharacterLocked(false);
      const chars = role === 'survivor' ? survivorChars : killerChars;
      if (chars[0]) {
        setSettings((s) => ({ ...s, activeCharacterId: chars[0].id }));
      }
    },
    [survivorChars, killerChars],
  );

  const savedBuildCount = profileStore ? getActiveSavedBuilds(profileStore).length : 0;

  const enterMainApp = useCallback(() => {
    primeOnInteraction();
    void playEnterFogStinger();
    setShellExit(true);
    window.setTimeout(() => setShowLanding(false), 480);
  }, [primeOnInteraction]);

  if (showLanding) {
    return (
      <div className={`app-shell ${shellExit ? 'app-shell-exit' : ''}`}>
        <FogAtmosphere />
        <TitleBar subtle ambientMuted={ambientMuted} onToggleAmbient={toggleAmbientMute} />
        <LandingPage
          onEnter={enterMainApp}
          ready={profilesReady}
          ambientMuted={ambientMuted}
          onToggleAmbient={toggleAmbientMute}
        />
      </div>
    );
  }

  if (!profilesReady) {
    return (
      <div className="app-shell">
        <FogAtmosphere />
        <TitleBar ambientMuted={ambientMuted} onToggleAmbient={toggleAmbientMute} />
        <div className="app-body app-loading">
          <p>Entering the Fog…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <FogAtmosphere />
      <TitleBar ambientMuted={ambientMuted} onToggleAmbient={toggleAmbientMute} />
      <div className="app-body">
        <div className="app">
          <header className="header header-dbd">
            <div className="header-brand">
              <EntityMark size="md" />
              <div className="header-titles">
                <p className="header-dbd-title">Dead by Daylight</p>
                <h1 className="header-advisor-title">Build Advisor</h1>
                <p className="header-sub">
                  {meta ? `Patch ${meta.perkVersion}` : 'Syncing…'}
                  {isDesktopApp() ? ` · v${APP_VERSION}` : ''}
                </p>
              </div>
            </div>

            <div className="header-controls">
          {profileStore && (
            <label className="char-select-wrap profile-header-select">
              <span>Profile</span>
              <select
                value={profileStore.activeProfileId}
                onChange={(e) => {
                  activateProfile(e.target.value)
                    .then((store) => syncProfileStore(store, { resetAdvisorRole: true }))
                    .catch((err) => setError(String(err)));
                }}
              >
                {profileStore.profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
            </div>

            <div className="header-actions">
              {!isDesktopApp() && (
                <AmbientMuteButton muted={ambientMuted} onToggle={toggleAmbientMute} />
              )}
              <button
                type="button"
                className="settings-btn"
                onClick={() => setShowSettings((s) => !s)}
                aria-label="Settings"
              >
                ⚙
              </button>
            </div>
          </header>

      {showSettings && profileStore && (
        <div className="settings-bar">
          <ProfileManager
            store={profileStore}
            onChange={(store) => syncProfileStore(store, { resetAdvisorRole: true })}
          />
          <label>
            OpenAI API Key <span className="optional">(optional)</span>
            <input
              type="password"
              value={settings.openaiApiKey ?? ''}
              placeholder="sk-..."
              onChange={(e) =>
                setSettings((s) => ({ ...s, openaiApiKey: e.target.value || undefined }))
              }
            />
          </label>
          <UpdateCheckButton />
          <p className="app-version">Build Advisor v{APP_VERSION}</p>
        </div>
      )}

      {error && <div className="error-banner">{error}</div>}
      {notice && <div className="notice-banner">{notice}</div>}
      <UpdateBanner />

      <nav className="tab-nav dbd-tabs">
        <button
          type="button"
          className={tab === 'collection' ? 'active' : ''}
          onClick={() => setTab('collection')}
        >
          Characters
        </button>
        <button type="button" className={tab === 'advisor' ? 'active' : ''} onClick={() => setTab('advisor')}>
          Build Advisor
        </button>
        <button type="button" className={tab === 'saved' ? 'active' : ''} onClick={() => setTab('saved')}>
          Saved Loadouts{savedBuildCount > 0 ? ` (${savedBuildCount})` : ''}
        </button>
      </nav>

      <main className="main">
        {tab === 'collection' ? (
          <CharacterCollection
            collectionRole={collectionRole}
            onCollectionRoleChange={setCollectionRole}
            characters={collectionCharacters}
            perks={collectionPerks}
            settings={settings}
            onChange={setSettings}
            onOpenAdvisor={handleOpenAdvisor}
            gameVersion={meta?.perkVersion}
          />
        ) : tab === 'advisor' ? (
          <div className="advisor-shell">
            <div className="advisor-toolbar">
              <div className="advisor-role-tabs">
                <button
                  type="button"
                  className={advisorRole === 'survivor' ? 'active survivor' : ''}
                  onClick={() => handleAdvisorRoleChange('survivor')}
                >
                  Survivors
                </button>
                <button
                  type="button"
                  className={advisorRole === 'killer' ? 'active killer' : ''}
                  onClick={() => handleAdvisorRoleChange('killer')}
                >
                  Killers
                </button>
              </div>

              <div className="advisor-target">
                {advisorCharacterLocked && advisorChar ? (
                  <>
                    <span className="advisor-target-label">Locked to</span>
                    <span className={`advisor-target-name role-${advisorRole}`}>{advisorChar.name}</span>
                    <button
                      type="button"
                      className="advisor-unlock"
                      onClick={() => setAdvisorCharacterLocked(false)}
                    >
                      Change
                    </button>
                  </>
                ) : (
                  <label className="advisor-char-select">
                    <span>Advising for</span>
                    <select
                      value={settings.activeCharacterId ?? ''}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, activeCharacterId: e.target.value || undefined }))
                      }
                    >
                      {advisorCharacters.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            </div>

            <ChatPanel
              messages={messages}
              characters={settings.characters}
              loading={loading}
              onSend={handleSend}
              quickPrompts={QUICK_PROMPTS[advisorRole]}
              onSaveBuild={handleSaveBuild}
              onNewChat={handleNewChat}
            />
          </div>
        ) : (
          profileStore && (
            <SavedBuildsPanel
              store={profileStore}
              role={advisorRole}
              activeCharacterId={settings.activeCharacterId}
              perks={allPerks}
              characters={allCharacters}
              meta={meta}
              onLoad={handleLoadSavedBuild}
              onDelete={handleDeleteSavedBuild}
            />
          )
        )}
      </main>

      {currentBuild && tab === 'advisor' && (
        <aside className="current-build-bar">
          <span className="current-build-label">Active loadout</span>
          <span className="current-build-names">
            {currentBuild.perks.map((p) => p.name).join(' · ')}
          </span>
          {advisorChar && <span className="current-build-char">as {advisorChar.name}</span>}
          <button type="button" className="current-build-save" onClick={() => handleSaveBuild(currentBuild)}>
            Save build
          </button>
        </aside>
      )}

      <AppDialog config={dialog} onClose={() => setDialog(null)} />
        </div>
      </div>
    </div>
  );
}

export default App;
