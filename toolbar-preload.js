const { contextBridge, ipcRenderer } = require('electron');
require('./platform-ui');

contextBridge.exposeInMainWorld('nav', {
  go: (url) => ipcRenderer.send('nav', 'go', url),
  back: () => ipcRenderer.send('nav', 'back'),
  forward: () => ipcRenderer.send('nav', 'forward'),
  reload: () => ipcRenderer.send('nav', 'reload'),
  home: () => ipcRenderer.send('nav', 'home'),
  setHome: () => ipcRenderer.send('nav', 'sethome'),
  menu: (x, y) => ipcRenderer.send('menu', x, y),
  muteTab: (id) => ipcRenderer.send('tab', 'mute', id),
  onToast: (cb) => ipcRenderer.on('toast', (_e, t) => cb(t)),
  onMenuClosed: (cb) => ipcRenderer.on('menu-closed', () => cb()),
  history: () => ipcRenderer.send('nav', 'history'),
  update: () => ipcRenderer.send('nav', 'update'),
  onTasks: (cb) => ipcRenderer.on('tasks', (_e, s) => cb(s)),
  onUpdate: (cb) => ipcRenderer.on('update', (_e, s) => cb(s)),
  newTab: () => ipcRenderer.send('tab', 'new'),
  closeTab: (id) => ipcRenderer.send('tab', 'close', id),
  switchTab: (id) => ipcRenderer.send('tab', 'switch', id),
  tabMenu: (id) => ipcRenderer.send('tab', 'menu', id),
  onState: (cb) => ipcRenderer.on('state', (_e, s) => cb(s)),
  onTabs: (cb) => ipcRenderer.on('tabs', (_e, t) => cb(t)),
  onGhosthand: (cb) => ipcRenderer.on('ghosthand', (_e, s) => cb(s)),
  ghosthandDisconnect: () => ipcRenderer.send('ghosthand-disconnect'),
  ready: () => ipcRenderer.send('ready'),
});
