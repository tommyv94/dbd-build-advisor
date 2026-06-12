import { useCallback, useEffect, useState } from 'react';
import { isDesktopApp, type UpdateStatusPayload } from '../lib/api-base';

export type UpdateStatus = UpdateStatusPayload;

export function UpdateBanner() {
  const [update, setUpdate] = useState<UpdateStatus | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);

  useEffect(() => {
    if (!isDesktopApp() || !window.electronAPI?.onUpdateStatus) return;
    return window.electronAPI.onUpdateStatus((payload) => {
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

  if (!update || update.status === 'idle' || update.status === 'checking') return null;

  if (update.status === 'available' && dismissed === update.version) return null;

  if (update.status === 'available') {
    return (
      <div className="update-banner">
        <div className="update-banner-text">
          <strong>Update available</strong> — v{update.version} is ready to download.
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
          <strong>Update ready</strong> — v{update.version} downloaded. Restart to install.
        </div>
        <div className="update-banner-actions">
          <button type="button" className="update-banner-primary" onClick={handleInstall}>
            Restart &amp; install
          </button>
          <button type="button" className="update-banner-dismiss" onClick={() => setDismissed(update.version)}>
            Later
          </button>
        </div>
      </div>
    );
  }

  return null;
}

/** Manual check from settings */
export function UpdateCheckButton() {
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
            } else if (result.ok && result.version) {
              setMessage(`Update v${result.version} found — look for the banner above.`);
            } else if (result.ok) {
              setMessage('You’re on the latest version.');
            } else {
              setMessage('Could not check for updates. Try “Download latest” below.');
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
      {message && <p className="update-check-msg">{message}</p>}
    </div>
  );
}
