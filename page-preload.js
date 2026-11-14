// Preload của mọi tab (chạy trong thế giới riêng, trang web không đụng được Node).
// - Chế độ Ruffle: chạy trong mọi frame (kể cả iframe) và chèn Ruffle vào trang.
//   Electron 11 chưa có webFrameMain nên dùng preload + nodeIntegrationInSubFrames thay cho bản 1.
// - Trang Lịch sử nội bộ (history.html): mở cầu nối window.wispHistory.
const { webFrame, contextBridge, ipcRenderer } = require('electron');

const argHistory = process.argv.find(a => a.startsWith('--wisp-history='));
const HISTORY_URL = argHistory ? argHistory.slice('--wisp-history='.length) : '';
const isHistoryPage = !!HISTORY_URL && process.isMainFrame && location.href.split(/[?#]/)[0] === HISTORY_URL;

if (isHistoryPage) {
  contextBridge.exposeInMainWorld('wispHistory', {
    list: () => ipcRenderer.invoke('history:list'),
    open: (url, newTab) => ipcRenderer.invoke('history:open', url, !!newTab),
    remove: (ids) => ipcRenderer.invoke('history:remove', ids),
    clear: () => ipcRenderer.invoke('history:clear'),
    onChange: (cb) => ipcRenderer.on('history:changed', () => cb()),
  });
} else if (process.argv.includes('--flash-mode=ruffle')) {
  const INJECT = `
  (() => {
    if (window.__ruffleInjected) return;
    window.__ruffleInjected = true;
    window.RufflePlayer = window.RufflePlayer || {};
    window.RufflePlayer.config = Object.assign({
      publicPath: 'ruffle://local/',
      polyfills: true,
      autoplay: 'auto',
      unmuteOverlay: 'hidden',
      letterbox: 'on',
      warnOnUnsupportedContent: false,
      openUrlMode: 'allow',
      allowNetworking: 'all',
    }, window.RufflePlayer.config || {});
    const s = document.createElement('script');
    s.src = 'ruffle://local/ruffle.js';
    (document.head || document.documentElement).appendChild(s);
  })();`;
  const inject = () => webFrame.executeJavaScript(INJECT).catch(() => {});
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', inject, { once: true });
  else inject();
}
