const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('insp', {
  snapshot: () => ipcRenderer.invoke('inspect:snapshot'),
  clear: (kind) => ipcRenderer.invoke('inspect:clear', kind),
  info: () => ipcRenderer.invoke('inspect:info'),
  probe: (host, port, policy) => ipcRenderer.invoke('inspect:probe', host, port, policy),
  devtools: () => ipcRenderer.invoke('inspect:devtools'),
  copy: (text) => ipcRenderer.invoke('inspect:copy', text),
  reveal: (p) => ipcRenderer.invoke('inspect:reveal', p),
  netlog: (on) => ipcRenderer.invoke('inspect:netlog', on),
  report: () => ipcRenderer.invoke('inspect:report'),
  perf: () => ipcRenderer.invoke('inspect:perf'),
  shots: () => ipcRenderer.invoke('inspect:shots'),
  onUpdate: (cb) => ipcRenderer.on('inspect:update', (_e, batch) => cb(batch)),
  onPerf: (cb) => ipcRenderer.on('inspect:perf', (_e, d) => cb(d)),
  onTab: (cb) => ipcRenderer.on('inspect:tab', (_e, tab) => cb(tab)),
});
