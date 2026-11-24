// Cầu nối tối thiểu cho cửa sổ Tài khoản (account.html).
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('wacc', {
  get: () => ipcRenderer.invoke('account:get'),
  login: () => ipcRenderer.invoke('account:login'),
  logout: () => ipcRenderer.invoke('account:logout'),
  sync: () => ipcRenderer.invoke('account:sync'),
  wipe: () => ipcRenderer.invoke('account:wipe'),
  onChanged: (cb) => ipcRenderer.on('account:changed', (_e, v) => cb(v)),
});
