// Cầu nối tối thiểu cho cửa sổ Cài đặt Flash (flash-settings.html).
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('wfs', {
  get: () => ipcRenderer.invoke('fset:get'),
  set: (domain, engine) => ipcRenderer.invoke('fset:set', { domain, engine }),
  debug: (on) => ipcRenderer.invoke('fset:debug', on),
  do: (action) => ipcRenderer.invoke('fset:do', action),
});
