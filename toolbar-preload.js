const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nav', {
  go: (url) => ipcRenderer.send('nav', 'go', url),
  back: () => ipcRenderer.send('nav', 'back'),
  forward: () => ipcRenderer.send('nav', 'forward'),
  reload: () => ipcRenderer.send('nav', 'reload'),
  home: () => ipcRenderer.send('nav', 'home'),
  setHome: () => ipcRenderer.send('nav', 'sethome'),
  inspect: () => ipcRenderer.send('nav', 'inspect'),
  onState: (cb) => ipcRenderer.on('state', (_e, s) => cb(s)),
  ready: () => ipcRenderer.send('ready'),
});
