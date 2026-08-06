const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('voxelAPI', {
  // Window controls
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),

  // File system
  saveFile: (opts) => ipcRenderer.invoke('dialog:save-file', opts),
  writeFile: (opts) => ipcRenderer.invoke('fs:write-file', opts),

  // Shell
  openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),
  getPath: (name) => ipcRenderer.invoke('app:get-path', name),

  // Check if running in Electron
  isElectron: true
});
