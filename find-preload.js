const { contextBridge, ipcRenderer } = require('electron');
require('./platform-ui');

contextBridge.exposeInMainWorld('wfind', {
  query: (text, forward, next) => ipcRenderer.send('find:query', text, forward, next),
  close: () => ipcRenderer.send('find:close'),
  onResult: (cb) => ipcRenderer.on('find:result', (_e, r) => cb(r)),
  onFocus: (cb) => ipcRenderer.on('find:focus', () => cb()),
});
