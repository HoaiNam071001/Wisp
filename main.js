// Wisp — trình duyệt Electron mới; trang cấu hình Flash mở bằng engine Flash (Electron 11 + Pepper Flash, flash-engine/).
// Electron 12+ đã bỏ Pepper Flash nên engine Flash ở Electron 11.x (x64).
// File này chỉ lo khởi động; từng việc nằm ở module riêng (xem docs/plan/03-tach-main-js.md).
const { app, BrowserWindow, session } = require('electron');
const path = require('path');
// Hiệu năng game: Chromium 87 hay chặn GPU trên máy cũ / Rosetta → Flash vẽ bằng CPU. Bật GPU raster, không hãm tiến trình nền.
// WISP_NO_PERF_FLAGS=1 để tắt khi cần so sánh FPS.
if (!process.env.WISP_NO_PERF_FLAGS) {
  for (const sw of ['ignore-gpu-blocklist', 'enable-gpu-rasterization', 'enable-zero-copy',
    'disable-renderer-backgrounding', 'disable-background-timer-throttling']) app.commandLine.appendSwitch(sw);
}
// Chromium mới bỏ rơi sự kiện chuột giả (sendInputEvent) khi cửa sổ bị che / ở nền → cổng Ghosthand không bấm được lúc người dùng làm việc khác
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');

// Thứ tự quan trọng: thư mục dữ liệu → khoá một bản → chọn chế độ Flash (gắn switch trước app ready)
require('./user-data').setupUserData();
// Chỉ chạy một Wisp cho mỗi thư mục dữ liệu (khoá theo userData, nên bản dev có WISP_USER_DATA riêng vẫn chạy song song)
const SECOND_INSTANCE = !app.requestSingleInstanceLock();
if (SECOND_INSTANCE) app.quit();
const { FLASH_PATH } = require('./flash/mode');
const flashRouter = require('./flash-engine/router');
const { chromeUserAgent } = require('./ua');
const siteMenu = require('./flash/site-menu');
require('./flash/launcher');
require('./flash/swf-hint');
require('./page-menu');

const updater = require('./updater');
const tabs = require('./tabs');
const { saveHistoryNow } = require('./history');
const { loadConfig, saveConfig, homeUrl } = require('./config');
const { normalizeUrl } = require('./app-urls');
const { addLog } = require('./inspect/store');
const { installRequestLog } = require('./inspect/request-log');
const { startSocketWatch } = require('./inspect/sockets');
const { openInspector } = require('./inspect/window');
const { startPerf, applyAppNap } = require('./perf');
const { askForFlashPlugin } = require('./flash/install');
const { buildMenu, scheduleMenu } = require('./app-menu');
const { ensureMenuWin } = require('./menu-popup');
const ghosthand = require('./ghosthand/server');
require('./toolbar-ipc');

const IS_MAC = process.platform === 'darwin';
let pendingFile = null; // file .swf mở trước khi app sẵn sàng (macOS "Open With")


function createWindow() {
  const argUrl = process.argv.slice(1).find(a => /^https?:|\.swf$/i.test(a));
  const startUrl = normalizeUrl(process.env.FLASH_URL || pendingFile || argUrl) || homeUrl();
  const explicit = !!(process.env.FLASH_URL || argUrl || pendingFile);
  pendingFile = null;

  // Cửa sổ chính chứa thanh tab + thanh công cụ; trang web nằm trong BrowserView bên dưới
  const win = new BrowserWindow({
    width: 1280, height: 820, title: 'Wisp', backgroundColor: '#2b2d31', autoHideMenuBar: !IS_MAC,
    webPreferences: { preload: path.join(__dirname, 'toolbar-preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false },
  });
  win.loadFile(path.join(__dirname, 'toolbar.html'));
  // tạo sẵn cửa sổ menu ⋮ (ẩn) để bấm là hiện ngay
  win.webContents.once('did-finish-load', () => setTimeout(ensureMenuWin, 300));
  tabs.attachWindow(win);

  buildMenu();
  tabs.openStartTabs(startUrl, explicit);
  startPerf();
  startSocketWatch();

  if (!FLASH_PATH) setTimeout(askForFlashPlugin, 800);
}

app.whenReady().then(() => {
  // Chạy dev: Dock hiện icon app thay vì icon Electron (bản đóng gói đã có icon riêng)
  if (IS_MAC && !app.isPackaged) {
    try { app.dock.setIcon(path.join(__dirname, 'build', 'icon.png')); } catch (_) {}
  }
  if (SECOND_INSTANCE) return;
  // Một số trang chặn UA có chữ "Electron" / lệch UA Chrome thật → chỉnh cho giống Chrome thường (ua.js)
  app.userAgentFallback = chromeUserAgent(app.userAgentFallback);

  installRequestLog(session.defaultSession);
  require('./permissions').install(session.defaultSession);
  require('./downloads').install(session.defaultSession);

  applyAppNap();
  // Trang Flash đi ra ngoài trang đã cấu hình → mở ở cửa sổ chính
  flashRouter.events.on('leave', (url) => tabs.openNextToActive(url));
  createWindow();
  // Cổng cho Ghosthand (config ghosthandPort: false = tắt; mặc định bật)
  if (loadConfig().ghosthandPort !== false) ghosthand.start();
  updater.init({
    getWin: tabs.getWin, toast: tabs.toast, addLog, loadConfig, saveConfig,
    notify: (st) => { const win = tabs.getWin(); if (win) win.webContents.send('update', st); scheduleMenu(); },
  });
  if (process.env.WISP_INSPECT) openInspector();
});

// Windows / Linux: mở file .swf (hoặc chạy lại app) khi Wisp đang mở → Windows chạy tiến trình mới
// với đường dẫn trong argv → tiến trình đó thoát (SECOND_INSTANCE), cửa sổ cũ mở file thành tab mới.
app.on('second-instance', (_e, argv) => {
  const win = tabs.getWin();
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
  const arg = argv.slice(1).find(a => /^https?:|\.swf$/i.test(a));
  if (arg) tabs.openNextToActive(normalizeUrl(arg));
});

// Mở file .swf bằng cách kéo thả vào icon app trên Dock / "Open With"
app.on('open-file', (e, file) => {
  e.preventDefault();
  if (app.isReady() && tabs.winOk()) tabs.openNextToActive(normalizeUrl(file));
  else pendingFile = file;
});

app.on('before-quit', () => { flashRouter.stop(); ghosthand.stop(); saveHistoryNow(); if (loadConfig().restoreTabs !== false) tabs.saveSession(); });
app.on('window-all-closed', () => app.quit());
