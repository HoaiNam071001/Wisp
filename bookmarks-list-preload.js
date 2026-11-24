// Cầu nối tối thiểu cho dropdown dấu trang (bookmarks-list.html).
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('wlist', {
  get: () => ipcRenderer.invoke('bmlist:get'),
  open: (id, newTab) => ipcRenderer.send('bmlist:open', id, !!newTab),
  manage: () => ipcRenderer.send('bmlist:manage'),
  size: (h) => ipcRenderer.send('popover:size', h),
});
