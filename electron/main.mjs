import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setupAutoUpdater } from './updater.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow = null;
let engine = null;
let responseFormatter = null;
let scheduleUpdateCheck = () => {};

function appRoot() {
  return path.join(__dirname, '..');
}

function distIndexPath() {
  return path.join(appRoot(), 'dist', 'index.html');
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

function createWindow() {
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
    scheduleUpdateCheck();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
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
    await startEngine();
    createWindow();
    const updater = setupAutoUpdater(() => mainWindow);
    scheduleUpdateCheck = updater.scheduleLaunchCheck;
  } catch (err) {
    console.error(err);
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
