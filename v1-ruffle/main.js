// Flash Browser — app Electron đơn giản mở trang web có nội dung Flash (SWF)
// Flash được chạy bằng Ruffle (trình giả lập Flash viết bằng Rust/WebAssembly).
const { app, BaseWindow, WebContentsView, protocol, net, session, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

// ====== ĐỔI ĐỊA CHỈ TRANG MẶC ĐỊNH Ở ĐÂY (hoặc sửa config.json) ======
const DEFAULT_URL = 'https://www.example.com';
// =====================================================================

const RUFFLE_DIR = path.dirname(require.resolve('@ruffle-rs/ruffle/ruffle.js'));
const TOOLBAR_HEIGHT = 44;

function configPath() {
  return path.join(app.getPath('userData'), 'config.json');
}
function loadConfig() {
  try { return JSON.parse(fs.readFileSync(configPath(), 'utf8')); } catch { return {}; }
}
function saveConfig(cfg) {
  try { fs.mkdirSync(path.dirname(configPath()), { recursive: true }); fs.writeFileSync(configPath(), JSON.stringify(cfg, null, 2)); } catch {}
}

// Giao thức riêng ruffle:// để trang web nào cũng tải được file Ruffle đóng gói sẵn
protocol.registerSchemesAsPrivileged([
  { scheme: 'ruffle', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, bypassCSP: true } },
]);

// Đoạn mã chèn vào mỗi trang: bật Ruffle để thay thế <embed>/<object> Flash
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
})();
`;

function normalizeUrl(input) {
  let u = String(input || '').trim();
  if (!u) return null;
  // đường dẫn file trên máy, vd. /Users/ban/Downloads/game.swf hoặc ~/Desktop/game.swf
  if (u.startsWith('~/')) u = path.join(app.getPath('home'), u.slice(2));
  if (u.startsWith('/') && fs.existsSync(u)) return pathToFileURL(u).href;
  if (!/^[a-z]+:\/\//i.test(u)) u = 'http://' + u;
  return u;
}

function createWindow() {
  const cfg = loadConfig();
  const startUrl = process.env.FLASH_URL || (pendingFile && pathToFileURL(pendingFile).href) || normalizeUrl(process.argv.slice(1).find(a => /^https?:|\.swf$/i.test(a))) || cfg.url || DEFAULT_URL;

  const win = new BaseWindow({ width: 1200, height: 800, title: 'Flash Browser' });

  const toolbar = new WebContentsView({
    webPreferences: { preload: path.join(__dirname, 'toolbar-preload.js') },
  });
  const page = new WebContentsView({
    webPreferences: { contextIsolation: true, sandbox: false, plugins: false },
  });
  win.contentView.addChildView(toolbar);
  win.contentView.addChildView(page);

  const layout = () => {
    const { width, height } = win.getContentBounds();
    toolbar.setBounds({ x: 0, y: 0, width, height: TOOLBAR_HEIGHT });
    page.setBounds({ x: 0, y: TOOLBAR_HEIGHT, width, height: height - TOOLBAR_HEIGHT });
  };
  layout();
  win.on('resize', layout);

  toolbar.webContents.loadFile(path.join(__dirname, 'toolbar.html'));

  const wc = page.webContents;
  const inject = () => wc.executeJavaScript(INJECT).catch(() => {});
  wc.on('dom-ready', inject);
  wc.on('did-frame-finish-load', (_e, isMain, pid, rid) => {
    // chèn cả vào iframe (nhiều trang game đặt Flash trong iframe)
    if (!isMain) {
      const f = wc.mainFrame.framesInSubtree.find(fr => fr.processId === pid && fr.routingId === rid);
      if (f) f.executeJavaScript(INJECT).catch(() => {});
    }
  });

  // Mở link popup ngay trong cửa sổ
  wc.setWindowOpenHandler(({ url }) => { wc.loadURL(url); return { action: 'deny' }; });

  const sendState = () => {
    if (toolbar.webContents.isDestroyed()) return;
    toolbar.webContents.send('state', {
      url: wc.getURL(),
      canBack: wc.navigationHistory.canGoBack(),
      canForward: wc.navigationHistory.canGoForward(),
      loading: wc.isLoading(),
    });
  };
  ['did-navigate', 'did-navigate-in-page', 'did-start-loading', 'did-stop-loading'].forEach(ev => wc.on(ev, sendState));
  wc.on('page-title-updated', (_e, t) => win.setTitle(t + ' — Flash Browser'));

  ipcMain.on('nav', (_e, action, arg) => {
    if (action === 'go') {
      const u = normalizeUrl(arg);
      if (u) wc.loadURL(u);
    } else if (action === 'back') wc.navigationHistory.goBack();
    else if (action === 'forward') wc.navigationHistory.goForward();
    else if (action === 'reload') wc.isLoading() ? wc.stop() : wc.reload();
    else if (action === 'home') {
      const u = loadConfig().url || DEFAULT_URL;
      wc.loadURL(u);
    } else if (action === 'sethome') {
      saveConfig({ ...loadConfig(), url: wc.getURL() });
    }
  });
  ipcMain.on('ready', sendState);

  const menu = Menu.buildFromTemplate([
    { label: app.name, submenu: [
      { role: 'about', label: 'Giới thiệu Flash Browser' },
      { type: 'separator' },
      { role: 'hide', label: 'Ẩn Flash Browser' },
      { role: 'hideOthers', label: 'Ẩn ứng dụng khác' },
      { type: 'separator' },
      { role: 'quit', label: 'Thoát Flash Browser' },
    ]},
    { label: 'Sửa', submenu: [
      { role: 'undo', label: 'Hoàn tác' }, { role: 'redo', label: 'Làm lại' }, { type: 'separator' },
      { role: 'cut', label: 'Cắt' }, { role: 'copy', label: 'Sao chép' }, { role: 'paste', label: 'Dán' },
      { role: 'selectAll', label: 'Chọn tất cả' },
    ]},
    { label: 'Trang', submenu: [
      { label: 'Mở địa chỉ…', accelerator: 'Cmd+L', click: () => { toolbar.webContents.focus(); toolbar.webContents.executeJavaScript("document.getElementById('url').select()"); } },
      { label: 'Quay lại', accelerator: 'Cmd+[', click: () => wc.navigationHistory.goBack() },
      { label: 'Tiến tới', accelerator: 'Cmd+]', click: () => wc.navigationHistory.goForward() },
      { label: 'Tải lại', accelerator: 'Cmd+R', click: () => wc.reload() },
      { label: 'Toàn màn hình', accelerator: 'Ctrl+Cmd+F', click: () => win.setFullScreen(!win.isFullScreen()) },
      { label: 'Phóng to', accelerator: 'Cmd+=', click: () => wc.setZoomLevel(wc.getZoomLevel() + 0.5) },
      { label: 'Thu nhỏ', accelerator: 'Cmd+-', click: () => wc.setZoomLevel(wc.getZoomLevel() - 0.5) },
      { label: 'Cỡ gốc', accelerator: 'Cmd+0', click: () => wc.setZoomLevel(0) },
      { type: 'separator' },
      { label: 'Công cụ nhà phát triển', accelerator: 'Alt+Cmd+I', click: () => wc.toggleDevTools() },
    ]},
    { role: 'windowMenu', label: 'Cửa sổ' },
  ]);
  Menu.setApplicationMenu(menu);

  wc.loadURL(startUrl);
}

app.whenReady().then(() => {
  // Phục vụ file Ruffle qua ruffle://local/...
  protocol.handle('ruffle', (req) => {
    const name = path.basename(new URL(req.url).pathname);
    const file = path.join(RUFFLE_DIR, name);
    if (!file.startsWith(RUFFLE_DIR) || !fs.existsSync(file)) return new Response('not found', { status: 404 });
    return net.fetch(pathToFileURL(file).href);
  });

  // Gỡ Content-Security-Policy để script Ruffle chạy được trên mọi trang
  session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
    const h = { ...details.responseHeaders };
    for (const k of Object.keys(h)) {
      if (/^content-security-policy/i.test(k)) delete h[k];
    }
    cb({ responseHeaders: h });
  });

  createWindow();
});

// Mở file .swf bằng cách kéo thả vào icon app trên Dock / "Open With"
let pendingFile = null;
app.on('open-file', (e, file) => {
  e.preventDefault();
  if (app.isReady()) {
    const { webContents } = require('electron');
    const pages = webContents.getAllWebContents().filter(w => !w.getURL().endsWith('toolbar.html'));
    if (pages[0]) pages[0].loadURL(pathToFileURL(file).href);
  } else pendingFile = file;
});

app.on('window-all-closed', () => app.quit());
