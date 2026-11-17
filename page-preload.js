// Preload của mọi tab (chạy trong thế giới riêng, trang web không đụng được Node).
// - Trang cấu hình Ruffle: chạy trong mọi frame (kể cả iframe) và chèn Ruffle vào trang.
// - Trang Lịch sử nội bộ (history.html): mở cầu nối window.wispHistory.
// - Mọi trang web: agent cổng Ghosthand (ghosthand/agent – chỉ nghe IPC, không gắn gì vào trang) ở khung chính và ở
//   frame khác nguồn với khung cha (frame cùng nguồn do agent của khung trên đọc thẳng DOM).
const { webFrame, contextBridge, ipcRenderer } = require('electron');

const argHistory = process.argv.find(a => a.startsWith('--wisp-history='));
const HISTORY_URL = argHistory ? argHistory.slice('--wisp-history='.length) : '';
const isHistoryPage = !!HISTORY_URL && process.isMainFrame && location.href.split(/[?#]/)[0] === HISTORY_URL;

// Đọc được document của khung cha = cùng nguồn
const crossToParent = () => { try { return !window.parent.document; } catch (e) { return true; } };
if (!isHistoryPage && (process.isMainFrame || crossToParent())) require('./ghosthand/agent').install(!process.isMainFrame);

// Trang cấu hình Ruffle? Hỏi theo host khung trên cùng (iframe game khác domain vẫn theo trang bọc nó)
function isRuffleSite() {
  try {
    const top = location.ancestorOrigins && location.ancestorOrigins.length ? new URL(location.ancestorOrigins[location.ancestorOrigins.length - 1]).hostname : location.hostname;
    return /^https?:$/.test(location.protocol) && ipcRenderer.sendSync('flash:is-ruffle', top);
  } catch { return false; }
}

const argQuality = process.argv.find(a => a.startsWith('--flash-quality='));
if (argQuality && !isHistoryPage) require('./flash/quality-patch').install(argQuality.slice('--flash-quality='.length));

if (isHistoryPage) {
  contextBridge.exposeInMainWorld('wispHistory', {
    list: () => ipcRenderer.invoke('history:list'),
    open: (url, newTab) => ipcRenderer.invoke('history:open', url, !!newTab),
    remove: (ids) => ipcRenderer.invoke('history:remove', ids),
    clear: () => ipcRenderer.invoke('history:clear'),
    onChange: (cb) => ipcRenderer.on('history:changed', () => cb()),
  });
} else if (isRuffleSite()) {
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
