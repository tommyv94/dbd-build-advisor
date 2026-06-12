'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('splashAPI', {
  onInit: (callback) => {
    ipcRenderer.on('splash-init', (_event, payload) => callback(payload));
  },
  onStatus: (callback) => {
    ipcRenderer.on('splash-status', (_event, message) => callback(message));
  },
});
