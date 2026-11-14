const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nav', {
  go: (url) => ipcRenderer.send('nav', 'go', url),
  back: () => ipcRenderer.send('nav', 'back'),
  forward: () => ipcRenderer.send('nav', 'forward'),
  reload: () => ipcRenderer.send('nav', 'reload'),
  home: () => ipcRenderer.send('nav', 'home'),
  setHome: () => ipcRenderer.send('nav', 'sethome'),
  inspect: () => ipcRenderer.send('nav', 'inspect'),
  history: () => ipcRenderer.send('nav', 'history'),
  newTab: () => ipcRenderer.send('tab', 'new'),
  closeTab: (id) => ipcRenderer.send('tab', 'close', id),
  switchTab: (id) => ipcRenderer.send('tab', 'switch', id),
  tabMenu: (id) => ipcRenderer.send('tab', 'menu', id),
  onState: (cb) => ipcRenderer.on('state', (_e, s) => cb(s)),
  onTabs: (cb) => ipcRenderer.on('tabs', (_e, t) => cb(t)),
  ready: () => ipcRenderer.send('ready'),
});
