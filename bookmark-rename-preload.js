// Cầu nối tối thiểu cho popover sửa tên dấu trang.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('wrename', {
  get: () => ipcRenderer.invoke('bmrename:get'),
  save: (title) => ipcRenderer.send('bmrename:save', String(title)),
  size: (h) => ipcRenderer.send('popover:size', h),
});
