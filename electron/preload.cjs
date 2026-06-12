'use strict';

const path = require('path');
const { contextBridge, ipcRenderer } = require('electron');

const pkg = require(path.join(__dirname, '..', 'package.json'));

contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,
  platform: process.platform,
  /** Installed app version — read synchronously from packaged package.json */
  appVersion: pkg.version,
  fetchApi: (path, init) => ipcRenderer.invoke('api-fetch', path, init),
  exportProfiles: (json, defaultName) => ipcRenderer.invoke('export-profiles', json, defaultName),
  importProfiles: () => ipcRenderer.invoke('import-profiles'),
  windowControls: {
    minimize: () => ipcRenderer.invoke('window-minimize'),
    maximize: () => ipcRenderer.invoke('window-maximize'),
    close: () => ipcRenderer.invoke('window-close'),
  },
  onUpdateStatus: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('update-status', handler);
    return () => ipcRenderer.removeListener('update-status', handler);
  },
  getAppVersion: () => ipcRenderer.invoke('app-version'),
  getInstallPath: () => ipcRenderer.invoke('install-path'),
  checkForUpdates: () => ipcRenderer.invoke('update-check'),
  downloadUpdate: () => ipcRenderer.invoke('update-download'),
  installUpdate: () => ipcRenderer.invoke('update-install'),
  openReleasePage: () => ipcRenderer.invoke('update-open-page'),
  reportWarmupProgress: (message) => ipcRenderer.send('warmup-progress', message),
  warmupComplete: () => ipcRenderer.send('warmup-complete'),
});
