const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('omni', {
  onItems: (cb) => ipcRenderer.on('omni:items', (_e, s) => cb(s)),
  pick: (i) => ipcRenderer.send('omni:pick', i),
});
