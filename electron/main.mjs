import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setupAutoUpdater } from './updater.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MIN_SPLASH_MS = 1_800;
const SPLASH_WIDTH = 420;
const SPLASH_HEIGHT = 300;

let mainWindow = null;
let splashWindow = null;
let engine = null;
let responseFormatter = null;
let warmupStartedAt = 0;

function appRoot() {
  return path.join(__dirname, '..');
}

function distIndexPath() {
  return path.join(appRoot(), 'dist', 'index.html');
}

function splashPath() {
  return path.join(__dirname, 'splash.html');
}

function enginePath() {
  return path.join(appRoot(), 'dist-server', 'engine.mjs');
}

async function loadEngineModule() {
  return import(pathToFileURL(enginePath()).href);
}

async function startEngine() {
  process.env.DBD_DESKTOP = '1';
  process.env.DBD_DATA_DIR = app.getPath('userData');

  const mod = await loadEngineModule();
  responseFormatter = mod.apiResponseToFetchResult;
  engine = await mod.startAdvisorEngine({ dataDir: app.getPath('userData'), quiet: false });
}

function iconPath() {
  return path.join(appRoot(), 'build', 'icon.png');
}

function sendSplashStatus(message) {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.send('splash-status', message);
  }
}

function closeSplash() {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
    splashWindow = null;
  }
}

function createSplashWindow() {
  if (splashWindow && !splashWindow.isDestroyed()) return;

  splashWindow = new BrowserWindow({
    width: SPLASH_WIDTH,
    height: SPLASH_HEIGHT,
    frame: false,
    transparent: false,
    resizable: false,
    movable: true,
    center: true,
    show: true,
    backgroundColor: '#080808',
    icon: iconPath(),
    alwaysOnTop: true,
    skipTaskbar: false,
    title: 'Build Advisor',
    webPreferences: {
      preload: path.join(__dirname, 'splash-preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  splashWindow.webContents.on('did-fail-load', (_event, code, desc) => {
    console.error('Splash failed to load:', code, desc);
  });

  void splashWindow.loadFile(splashPath()).catch((err) => {
    console.error('Splash loadFile error:', err);
  });

  splashWindow.webContents.once('did-finish-load', () => {
    splashWindow?.webContents.send('splash-init', { version: app.getVersion() });
    sendSplashStatus('Entering the Fog…');
  });

  splashWindow.on('closed', () => {
    splashWindow = null;
  });
}

function createWindow() {
  const isMac = process.platform === 'darwin';

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: 'Build Advisor',
    icon: iconPath(),
    frame: false,
    backgroundColor: '#080808',
    autoHideMenuBar: true,
    show: false,
    ...(isMac
      ? {
          titleBarStyle: 'hidden',
          trafficLightPosition: { x: 12, y: 14 },
        }
      : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile(distIndexPath());

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function revealMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (!mainWindow.isVisible()) mainWindow.show();
  mainWindow.focus();
}

function finishWarmupAndReveal() {
  const elapsed = Date.now() - warmupStartedAt;
  const delay = Math.max(0, MIN_SPLASH_MS - elapsed);

  setTimeout(() => {
    closeSplash();
    revealMainWindow();
  }, delay);
}

async function bootstrap() {
  warmupStartedAt = Date.now();

  createSplashWindow();
  sendSplashStatus('Starting advisor engine…');

  await startEngine();

  sendSplashStatus('Loading interface…');
  createWindow();
  setupAutoUpdater(() => mainWindow);
}

ipcMain.handle('api-fetch', async (_event, apiPath, init = {}) => {
  if (!engine || !responseFormatter) throw new Error('Advisor engine not ready');
  try {
    const result = await engine.handleApiRequest(init.method ?? 'GET', apiPath, init.body);
    return responseFormatter(result);
  } catch (err) {
    console.error('api-fetch error:', apiPath, err);
    throw err;
  }
});

ipcMain.on('warmup-progress', (_event, message) => {
  sendSplashStatus(typeof message === 'string' ? message : 'Loading…');
});

ipcMain.on('warmup-complete', () => {
  finishWarmupAndReveal();
});

ipcMain.handle('export-profiles', async (_event, json, defaultName) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Export profiles',
    defaultPath: defaultName,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (canceled || !filePath) return false;
  const { writeFile } = await import('node:fs/promises');
  await writeFile(filePath, json, 'utf-8');
  return true;
});

ipcMain.handle('import-profiles', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Import profiles',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile'],
  });
  if (canceled || !filePaths[0]) return null;
  const { readFile } = await import('node:fs/promises');
  return readFile(filePaths[0], 'utf-8');
});

ipcMain.handle('window-minimize', () => {
  mainWindow?.minimize();
});

ipcMain.handle('window-maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});

ipcMain.handle('window-close', () => {
  mainWindow?.close();
});

app.whenReady().then(async () => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.fogbuild.dbd-advisor');
  }
  try {
    await bootstrap();
  } catch (err) {
    console.error(err);
    closeSplash();
    app.quit();
  }

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      try {
        await bootstrap();
      } catch (err) {
        console.error(err);
        app.quit();
      }
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
