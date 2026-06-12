import { useCallback, useEffect, useState } from 'react';
import { isDesktopApp, type UpdateStatusPayload } from '../lib/api-base';
import { useAppVersion } from '../hooks/useAppVersion';

import { UpdateInstallOverlay } from './UpdateInstallOverlay';

export type UpdateStatus = UpdateStatusPayload;

function parseReleaseNotes(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h4>$1</h4>')
    .replace(/^- /gm, '• ')
    .replace(/\n/g, '<br/>');
}

export function UpdateBanner({ initialStatus }: { initialStatus?: UpdateStatus | null }) {
  const [update, setUpdate] = useState<UpdateStatus | null>(initialStatus ?? null);
  const [installVersion, setInstallVersion] = useState<string | undefined>();
  const [dismissed, setDismissed] = useState<string | null>(null);

  useEffect(() => {
    if (!isDesktopApp() || !window.electronAPI?.onUpdateStatus) return;
    return window.electronAPI.onUpdateStatus((payload) => {
      if (payload.status === 'downloaded') {
        setInstallVersion(payload.version);
      }
      setUpdate(payload);
    });
  }, []);

  const handleDownload = useCallback(async () => {
    await window.electronAPI?.downloadUpdate?.();
  }, []);

  const handleInstall = useCallback(() => {
    window.electronAPI?.installUpdate?.();
  }, []);

  const handleOpenPage = useCallback(() => {
    window.electronAPI?.openReleasePage?.();
  }, []);

  const handleRetryCheck = useCallback(async () => {
    setUpdate({ status: 'checking' });
    await window.electronAPI?.checkForUpdates?.();
  }, []);

  if (!update || update.status === 'idle' || update.status === 'checking') return null;

  if (update.status === 'available' && dismissed === update.version) return null;

  if (update.status === 'available') {
    const rawNotes = update.releaseNotes;
    const notes =
      typeof rawNotes === 'string'
        ? rawNotes.trim()
        : '';
    return (
      <div className="update-banner">
        <div className="update-banner-text">
          <strong>New version available</strong> — v{update.version} is ready to download.
          <p className="update-banner-hint">
            The installer replaces your current copy in place and updates shortcuts automatically. If this keeps
            appearing after restart, the install may have failed — use Download manually once, then in-app updates
            should work.
          </p>
          {notes && (
            <details className="update-banner-notes">
              <summary>What&apos;s new</summary>
              <div
                className="update-banner-notes-body"
                dangerouslySetInnerHTML={{ __html: parseReleaseNotes(notes) }}
              />
            </details>
          )}
        </div>
        <div className="update-banner-actions">
          <button type="button" className="update-banner-primary" onClick={() => void handleDownload()}>
            Download update
          </button>
          <button type="button" className="update-banner-secondary" onClick={handleOpenPage}>
            Open in browser
          </button>
          <button
            type="button"
            className="update-banner-dismiss"
            onClick={() => setDismissed(update.version)}
          >
            Later
          </button>
        </div>
      </div>
    );
  }

  if (update.status === 'downloading') {
    return (
      <div className="update-banner update-banner-progress">
        <span>Downloading update… {Math.round(update.percent)}%</span>
        <div className="update-banner-bar">
          <div className="update-banner-bar-fill" style={{ width: `${update.percent}%` }} />
        </div>
      </div>
    );
  }

  if (update.status === 'downloaded') {
    return (
      <div className="update-banner update-banner-ready">
        <div className="update-banner-text">
          <strong>Update ready</strong> — v{update.version} downloaded. Restart to apply.
        </div>
        <div className="update-banner-actions">
          <button type="button" className="update-banner-primary" onClick={handleInstall}>
            Restart &amp; update
          </button>
          <button type="button" className="update-banner-dismiss" onClick={() => setDismissed(update.version)}>
            Later
          </button>
        </div>
      </div>
    );
  }

  if (update.status === 'installing') {
    return <UpdateInstallOverlay version={installVersion} />;
  }

  if (update.status === 'error') {
    return (
      <div className="update-banner update-banner-error">
        <div className="update-banner-text">
          <strong>Update check failed</strong> — {update.message}
        </div>
        <div className="update-banner-actions">
          <button type="button" className="update-banner-primary" onClick={() => void handleRetryCheck()}>
            Try again
          </button>
          <button type="button" className="update-banner-secondary" onClick={handleOpenPage}>
            Download manually
          </button>
        </div>
      </div>
    );
  }

  return null;
}

/** Manual check from settings */
export function UpdateCheckButton() {
  const appVersion = useAppVersion();
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [installPath, setInstallPath] = useState<string | null>(null);

  useEffect(() => {
    if (!isDesktopApp() || !window.electronAPI?.getInstallPath) return;
    void window.electronAPI.getInstallPath().then((path) => {
      if (path) setInstallPath(path);
    });
  }, []);

  if (!isDesktopApp() || !window.electronAPI?.checkForUpdates) return null;

  return (
    <div className="update-check-row">
      <button
        type="button"
        className="update-check-btn"
        disabled={checking}
        onClick={async () => {
          setChecking(true);
          setMessage(null);
          try {
            const result = await window.electronAPI!.checkForUpdates!();
            if (result.skipped) {
              setMessage('Updates are only checked in the installed app.');
            } else if (!result.ok) {
              setMessage(result.message ?? 'Could not check for updates.');
            } else if (result.updateAvailable && result.latestVersion) {
              setMessage(
                `Update v${result.latestVersion} available (you have v${result.currentVersion ?? '?'}). Use the banner above.`,
              );
            } else {
              setMessage(`You're on the latest version (v${result.currentVersion ?? '?'}).`);
            }
          } finally {
            setChecking(false);
          }
        }}
      >
        {checking ? 'Checking…' : 'Check for updates'}
      </button>
      <button type="button" className="update-check-link" onClick={() => window.electronAPI?.openReleasePage?.()}>
        Download latest installer
      </button>
      {installPath && <p className="update-check-path">Running from: {installPath}</p>}
      {message && <p className="update-check-msg">{message}</p>}
      {!checking && !message && (
        <p className="update-check-msg muted">
          Installed version: v{appVersion} · delta updates on
        </p>
      )}
    </div>
  );
}
