// Menu ⋮: bảng xổ xuống tự vẽ (menu.html trong cửa sổ con không viền).
// Menu hệ thống của macOS không tô màu / đặt công tắc được, nên dùng cửa sổ HTML riêng.
// Cửa sổ được tạo sẵn một lần rồi chỉ ẩn / hiện: tạo cửa sổ mới mỗi lần bấm mất vài giây.
const { BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const updater = require('./updater');
const tabs = require('./tabs');
const history = require('./history');
const keyremap = require('./keyremap-main');
const flashSettings = require('./flash/settings-window');
const page = require('./page-actions');
const browsingData = require('./browsing-data');
const flash = require('./flash/actions');
const { askForFlashPlugin } = require('./flash/install');
const { FLASH_PATH, FLASH_VERSION } = require('./flash/mode');
const { loadConfig, homeUrl } = require('./config');
const { pingSummary } = require('./ping');
const { openInspector } = require('./inspect/window');
const appMenu = require('./app-menu');
const ghosthand = require('./ghosthand/server');

const MENU_W = 340;
let menuWin = null;
let menuClosedAt = 0;
let menuWanted = false; // đã bấm ⋮, chờ menu vẽ xong nội dung mới hiện

function menuAlive() { return menuWin && !menuWin.isDestroyed(); }
function menuOpen() { return menuAlive() && (menuWin.isVisible() || menuWanted); }
function closeMenuPopup() {
  if (!menuOpen()) return;
  menuWanted = false;
  menuWin.hide();
  menuClosedAt = Date.now();
  const win = tabs.getWin();
  if (win) win.webContents.send('menu-closed');
}
tabs.events.on('window-closed', closeMenuPopup);

function ensureMenuWin() {
  const win = tabs.getWin();
  if (menuAlive() || !win) return;
  menuWin = new BrowserWindow({
    parent: win, width: MENU_W, height: 120,
    frame: false, transparent: true, resizable: false, movable: false, minimizable: false, maximizable: false,
    fullscreenable: false, skipTaskbar: true, hasShadow: false, show: false, backgroundColor: '#00000000',
    webPreferences: { preload: path.join(__dirname, 'menu-preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false,
                      backgroundThrottling: false },
  });
  menuWin.loadFile(path.join(__dirname, 'menu.html'));
  menuWin.on('blur', closeMenuPopup);
  menuWin.on('closed', () => { menuWin = null; menuWanted = false; });
}

function showMainMenu(x, y) {
  const win = tabs.getWin();
  if (!win) return;
  if (menuOpen()) { closeMenuPopup(); return; }
  // bấm ⋮ lúc menu đang mở: menu tự đóng vì mất focus ngay trước cú bấm → đừng mở lại
  if (Date.now() - menuClosedAt < 250) return;
  const fresh = !menuAlive();
  ensureMenuWin();
  const cb = win.getContentBounds();
  menuWin.setBounds({ x: Math.round(cb.x + x - MENU_W), y: Math.round(cb.y + y), width: MENU_W, height: menuWin.getBounds().height });
  menuWanted = true;
  // cửa sổ mới tự lấy trạng thái khi tải xong; cửa sổ có sẵn thì báo vẽ lại → menu:size sẽ hiện nó
  if (!fresh) menuWin.webContents.send('menu:open');
}

function hostOf(url) { try { return new URL(url).host || 'file'; } catch { return ''; } }

function menuState() {
  const t = tabs.activeTab();
  const cfg = loadConfig();
  const win = tabs.getWin();
  return {
    hasTab: !!tabs.wc(), zoom: page.zoomPercent(), muted: !!(t && t.muted), canReopen: tabs.canReopen(),
    fullScreen: !!win && win.isFullScreen(),
    recent: history.recentHistory(4).map(h => ({ title: h.title || h.url, url: h.url, host: hostOf(h.url) })),
    ping: pingSummary(),
    hasPlugin: !!FLASH_PATH, version: FLASH_VERSION,
    options: { restoreTabs: cfg.restoreTabs !== false, preventAppNap: cfg.preventAppNap !== false, pingGame: cfg.pingGame !== false,
               ghosthandPort: cfg.ghosthandPort !== false },
    ghosthand: ghosthand.state(),
    update: updater.state(),
  };
}

// Thao tác đóng menu rồi mới chạy
function menuActions(arg) {
  const w = tabs.wc();
  return {
    newTab: tabs.newTab, reopen: tabs.reopenClosedTab, mute: () => tabs.activeTab() && tabs.toggleMute(tabs.getActiveId()),
    screenshot: page.screenshotTab, fullscreen: page.toggleFullScreen, shots: page.openShotsDir,
    history: history.openHistory, clearHistory: history.clearHistoryDialog, recent: () => tabs.openUrl(String(arg || '')),
    home: () => w && tabs.load(w, homeUrl()), setHome: page.setHomeHere,
    inspector: () => openInspector(arg ? String(arg) : undefined), devtools: () => w && w.toggleDevTools(),
    hardReload: page.hardReload, external: page.openInSystemBrowser, clearCache: page.clearCacheReload, clearData: browsingData.clearBrowsingDataDialog,
    checkFlash: flash.checkFlash, allowSite: flash.allowCurrentSite, plugin: askForFlashPlugin,
    flashMore: flashSettings.openSettings,
    openSwf: page.openSwfFile,
    keys: keyremap.openKeysWindow,
    update: appMenu.checkUpdate,
  };
}

function fromMenu(e) { return menuAlive() && e.sender === menuWin.webContents; }
ipcMain.handle('menu:state', (e) => fromMenu(e) ? menuState() : null);
ipcMain.on('menu:size', (e, h) => {
  if (!fromMenu(e) || !tabs.winOk()) return;
  const { screen } = require('electron'); // screen chỉ dùng được sau app ready → lấy lúc cần
  const b = menuWin.getBounds();
  const area = screen.getDisplayMatching(b).workArea;
  const height = Math.max(80, Math.min(Math.ceil(h), area.y + area.height - b.y - 8));
  menuWin.setBounds({ x: b.x, y: b.y, width: MENU_W, height });
  if (menuWanted && !menuWin.isVisible()) { menuWanted = false; menuWin.show(); menuWin.focus(); }
});
ipcMain.on('menu:close', (e) => { if (fromMenu(e)) closeMenuPopup(); });
ipcMain.handle('menu:do', (e, action, arg) => {
  if (!fromMenu(e)) return null;
  // các thao tác giữ menu mở, trả lại trạng thái mới
  const stay = {
    zoomIn: () => page.zoomBy(0.5), zoomOut: () => page.zoomBy(-0.5), zoomReset: () => page.zoomBy(0),
    option: () => {
      const key = String(arg);
      if (!appMenu.OPTION_KEYS.includes(key)) return;
      appMenu.setOption(key, loadConfig()[key] === false); // đang tắt → bật
      appMenu.scheduleMenu();
    },
  };
  if (stay[action]) { stay[action](); return menuState(); }

  closeMenuPopup();
  const run = menuActions(arg)[action];
  if (run) setTimeout(run, 0);
  return null;
});

module.exports = { ensureMenuWin, showMainMenu };
