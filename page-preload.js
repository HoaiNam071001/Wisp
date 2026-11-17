// Preload của mọi tab (chạy trong thế giới riêng, trang web không đụng được Node).
// - Trang Lịch sử nội bộ (history.html): mở cầu nối window.wispHistory.
// - Mọi trang web: agent cổng Ghosthand (ghosthand/agent – chỉ nghe IPC, không gắn gì vào trang) ở khung chính và ở
//   frame khác nguồn với khung cha (frame cùng nguồn do agent của khung trên đọc thẳng DOM).
const { contextBridge, ipcRenderer } = require('electron');

const argHistory = process.argv.find(a => a.startsWith('--wisp-history='));
const HISTORY_URL = argHistory ? argHistory.slice('--wisp-history='.length) : '';
const argLauncher = process.argv.find(a => a.startsWith('--wisp-launcher='));
const LAUNCHER_URL = argLauncher ? argLauncher.slice('--wisp-launcher='.length) : '';
const isLauncherPage = !!LAUNCHER_URL && process.isMainFrame && location.href.split(/[?#]/)[0] === LAUNCHER_URL;
const isHistoryPage = !!HISTORY_URL && process.isMainFrame && location.href.split(/[?#]/)[0] === HISTORY_URL;

// Đọc được document của khung cha = cùng nguồn
const crossToParent = () => { try { return !window.parent.document; } catch (e) { return true; } };
if (!isHistoryPage && !isLauncherPage && (process.isMainFrame || crossToParent())) require('./ghosthand/agent').install(!process.isMainFrame);

const argQuality = process.argv.find(a => a.startsWith('--flash-quality='));
if (argQuality && !isHistoryPage) require('./flash/quality-patch').install(argQuality.slice('--flash-quality='.length));

if (isLauncherPage) {
  contextBridge.exposeInMainWorld('wispFlash', { launch: () => ipcRenderer.invoke('flash:launch'), normal: () => ipcRenderer.invoke('flash:normal') });
} else if (isHistoryPage) {
  contextBridge.exposeInMainWorld('wispHistory', {
    list: () => ipcRenderer.invoke('history:list'),
    open: (url, newTab) => ipcRenderer.invoke('history:open', url, !!newTab),
    remove: (ids) => ipcRenderer.invoke('history:remove', ids),
    clear: () => ipcRenderer.invoke('history:clear'),
    onChange: (cb) => ipcRenderer.on('history:changed', () => cb()),
  });
}
