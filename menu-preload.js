const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('wmenu', {
  state: () => ipcRenderer.invoke('menu:state'),
  run: (action, arg) => ipcRenderer.invoke('menu:do', action, arg),
  size: (h) => ipcRenderer.send('menu:size', h),
  close: () => ipcRenderer.send('menu:close'),
});
