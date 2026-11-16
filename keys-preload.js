// Cầu nối tối thiểu cho cửa sổ Đổi phím (keys.html).
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('wkeys', {
  get: () => ipcRenderer.invoke('keys:get'),
  set: (cfg) => ipcRenderer.invoke('keys:set', cfg),
});
