import { app, ipcMain, shell } from 'electron';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { autoUpdater } = require('electron-updater');
const semver = require('semver');

const RELEASE_PAGE = 'https://github.com/tommyv94/dbd-build-advisor/releases/latest';
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

function sendStatus(win, payload) {
  if (win && !win.isDestroyed()) {
    win.webContents.send('update-status', payload);
  }
}

export function setupAutoUpdater(getMainWindow) {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowDowngrade = false;
  // Full installer downloads are more reliable across large version jumps (e.g. 1.0.3 → 1.0.11).
  autoUpdater.disableDifferentialDownload = true;

  autoUpdater.on('checking-for-update', () => {
    sendStatus(getMainWindow(), { status: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    sendStatus(getMainWindow(), {
      status: 'available',
      version: info.version,
      releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined,
    });
  });

  autoUpdater.on('update-not-available', () => {
    sendStatus(getMainWindow(), { status: 'idle' });
  });

  autoUpdater.on('download-progress', (progress) => {
    sendStatus(getMainWindow(), {
      status: 'downloading',
      percent: progress.percent,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    sendStatus(getMainWindow(), {
      status: 'downloaded',
      version: info.version,
    });
  });

  autoUpdater.on('error', (err) => {
    console.warn('Auto-update error:', err.message);
    sendStatus(getMainWindow(), {
      status: 'error',
      message: err.message,
    });
  });

  ipcMain.handle('app-version', () => app.getVersion());

  ipcMain.handle('install-path', () => app.getPath('exe'));

  ipcMain.handle('update-check', async () => {
    if (!app.isPackaged) return { skipped: true, reason: 'dev' };
    const currentVersion = app.getVersion();
    try {
      const result = await autoUpdater.checkForUpdates();
      const latestVersion = result?.updateInfo?.version ?? currentVersion;
      const updateAvailable =
        semver.valid(latestVersion) && semver.valid(currentVersion)
          ? semver.gt(latestVersion, currentVersion)
          : latestVersion !== currentVersion;
      return {
        ok: true,
        currentVersion,
        latestVersion,
        updateAvailable,
        version: updateAvailable ? latestVersion : null,
      };
    } catch (err) {
      return { ok: false, currentVersion, message: err?.message ?? String(err) };
    }
  });

  ipcMain.handle('update-download', async () => {
    if (!app.isPackaged) return { skipped: true };
    await autoUpdater.downloadUpdate();
    return { ok: true };
  });

  ipcMain.handle('update-install', () => {
    sendStatus(getMainWindow(), { status: 'installing' });
    // Brief pause so the in-app "installing" UI renders before the app quits.
    setTimeout(() => {
      // Non-silent NSIS is more reliable when upgrading from very old installs.
      autoUpdater.quitAndInstall(false, true);
    }, 800);
  });

  ipcMain.handle('update-open-page', () => {
    void shell.openExternal(RELEASE_PAGE);
  });

  const runCheck = () => {
    void autoUpdater.checkForUpdates().catch((err) => {
      console.warn('Update check failed:', err.message);
    });
  };

  if (!app.isPackaged) {
    return { runCheck, scheduleLaunchCheck: () => {} };
  }

  setInterval(runCheck, CHECK_INTERVAL_MS);

  return { runCheck, scheduleLaunchCheck: runCheck };
}
