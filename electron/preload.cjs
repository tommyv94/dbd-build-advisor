'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,
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
  checkForUpdates: () => ipcRenderer.invoke('update-check'),
  downloadUpdate: () => ipcRenderer.invoke('update-download'),
  installUpdate: () => ipcRenderer.invoke('update-install'),
  openReleasePage: () => ipcRenderer.invoke('update-open-page'),
});
