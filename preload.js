const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    appVersion: process.versions.electron
});