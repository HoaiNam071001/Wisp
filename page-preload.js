// Preload của mọi tab (chạy trong thế giới riêng, trang web không đụng được Node).
// - Trang Lịch sử / Dấu trang nội bộ (history.html, bookmarks.html): mở cầu nối window.wispHistory / wispBookmarks.
// - Mọi trang web: agent cổng Ghosthand (ghosthand/agent – chỉ nghe IPC, không gắn gì vào trang) ở khung chính và ở
//   frame khác nguồn với khung cha (frame cùng nguồn do agent của khung trên đọc thẳng DOM).
const { contextBridge, ipcRenderer } = require('electron');

const argHistory = process.argv.find(a => a.startsWith('--wisp-history='));
const HISTORY_URL = argHistory ? argHistory.slice('--wisp-history='.length) : '';
const argBookmarks = process.argv.find(a => a.startsWith('--wisp-bookmarks='));
const BOOKMARKS_URL = argBookmarks ? argBookmarks.slice('--wisp-bookmarks='.length) : '';
const isBookmarksPage = !!BOOKMARKS_URL && process.isMainFrame && location.href.split(/[?#]/)[0] === BOOKMARKS_URL;
const argLauncher = process.argv.find(a => a.startsWith('--wisp-launcher='));
const LAUNCHER_URL = argLauncher ? argLauncher.slice('--wisp-launcher='.length) : '';
const isLauncherPage = !!LAUNCHER_URL && process.isMainFrame && location.href.split(/[?#]/)[0] === LAUNCHER_URL;
const isHistoryPage = !!HISTORY_URL && process.isMainFrame && location.href.split(/[?#]/)[0] === HISTORY_URL;

// Đọc được document của khung cha = cùng nguồn
const crossToParent = () => { try { return !window.parent.document; } catch (e) { return true; } };
if (!isHistoryPage && !isBookmarksPage && !isLauncherPage && (process.isMainFrame || crossToParent())) require('./ghosthand/agent').install(!process.isMainFrame);

// Trang có .swf nhúng mà chưa bật Flash → báo vỏ app hiện gợi ý ở thanh địa chỉ (chỉ gửi IPC, không đổi trang)
if (process.isMainFrame && !isHistoryPage && !isBookmarksPage && !isLauncherPage) require('./flash/swf-detect').install(() => ipcRenderer.send('flash:swf'));

const argQuality = process.argv.find(a => a.startsWith('--flash-quality='));
if (argQuality && !isHistoryPage && !isBookmarksPage) require('./flash/quality-patch').install(argQuality.slice('--flash-quality='.length));

if (isLauncherPage) {
  contextBridge.exposeInMainWorld('wispFlash', { launch: () => ipcRenderer.invoke('flash:launch'), normal: () => ipcRenderer.invoke('flash:normal') });
} else if (isBookmarksPage) {
  contextBridge.exposeInMainWorld('wispBookmarks', {
    list: () => ipcRenderer.invoke('bookmarks:list'),
    open: (url, newTab) => ipcRenderer.invoke('bookmarks:open', url, !!newTab),
    remove: (id) => ipcRenderer.invoke('bookmarks:remove', id),
    chromeProfiles: () => ipcRenderer.invoke('bookmarks:chrome-profiles'),
    importChrome: (dir) => ipcRenderer.invoke('bookmarks:import-chrome', dir),
    importHtml: () => ipcRenderer.invoke('bookmarks:import-html'),
    onChange: (cb) => ipcRenderer.on('bookmarks:changed', () => cb()),
  });
} else if (isHistoryPage) {
  contextBridge.exposeInMainWorld('wispHistory', {
    list: () => ipcRenderer.invoke('history:list'),
    open: (url, newTab) => ipcRenderer.invoke('history:open', url, !!newTab),
    remove: (ids) => ipcRenderer.invoke('history:remove', ids),
    clear: () => ipcRenderer.invoke('history:clear'),
    onChange: (cb) => ipcRenderer.on('history:changed', () => cb()),
  });
}
