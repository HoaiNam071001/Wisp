// Cầu nối tối thiểu cho popover Thông tin trang (site-info.html).
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('wsite', {
  get: () => ipcRenderer.invoke('siteinfo:get'),
  setPermission: (key, state) => ipcRenderer.invoke('siteinfo:set', key, state),
  reset: () => ipcRenderer.invoke('siteinfo:reset'),
  toggleBlock: () => ipcRenderer.invoke('siteinfo:block'),
  clear: () => ipcRenderer.invoke('siteinfo:clear'),
  size: (h) => ipcRenderer.send('popover:size', h),
});
