// Cầu nối tối thiểu cho thanh công cụ của cửa sổ engine Flash (Electron 11).
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('wbar', {
  send: (action) => ipcRenderer.send('bar', action),
  onHost: (fn) => ipcRenderer.on('bar:host', (_e, h) => fn(h)),
});
