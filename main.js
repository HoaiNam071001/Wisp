// Wisp — trình duyệt chạy Electron 11 + Flash Player thật (Pepper Flash / PPAPI).
// Chế độ dự phòng: Ruffle (giả lập Flash bằng WebAssembly), giống bản 1.
// Electron 12 trở lên đã bỏ Pepper Flash, nên app phải ở Electron 11.x (x64).
const { app, BrowserWindow, BrowserView, protocol, session, ipcMain, Menu, dialog, shell, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const net = require('net');
const { execFile, execFileSync, spawnSync } = require('child_process');
const { pathToFileURL } = require('url');

// ====== ĐỔI ĐỊA CHỈ TRANG MẶC ĐỊNH Ở ĐÂY (hoặc bấm "★ Đặt làm trang chủ") ======
const DEFAULT_URL = 'https://bangbang.cmn.vn/';
// Domain được phép chạy Flash thật (ghi vào mms.cfg). Thêm domain của game ở đây
// hoặc dùng menu Flash → "Cho phép Flash trên trang này".
const DEFAULT_ALLOW = ['cmn.vn', 'cf4vn.bar'];
// =================================================================================

const TOOLBAR_HEIGHT = 80; // thanh tab (36) + thanh địa chỉ (44)
const PLUGIN_NAME = 'PepperFlashPlayer.plugin';

// ---------- thư mục dữ liệu: ~/Library/Application Support/Wisp ----------
// Lần đầu chạy bản Wisp: chuyển nguyên thư mục cũ "Flash Browser 2" sang (giữ cookie, đăng nhập).
// Không có thì chép config.json của bản 1 ("Flash Browser"). Bản 1 (Electron 45) để lại cookie
// định dạng mới mà Chromium 87 không đọc được, nên chỉ chép config.json.
{
  const appData = app.getPath('appData');
  // WISP_USER_DATA: chạy thử bản dev với thư mục dữ liệu riêng, không đụng bản đang dùng
  const newDir = process.env.WISP_USER_DATA || path.join(appData, 'Wisp');
  app.setPath('userData', newDir);
  if (!process.env.WISP_USER_DATA) try {
    const v2Dir = path.join(appData, 'Flash Browser 2');
    const v1Cfg = path.join(appData, 'Flash Browser', 'config.json');
    // Electron có thể đã tự tạo thư mục Wisp (rỗng) trước khi code này chạy,
    // nên xét "chưa có config.json" thay vì "chưa có thư mục".
    const fresh = !fs.existsSync(path.join(newDir, 'config.json'));
    if (fresh && fs.existsSync(v2Dir)) {
      if (fs.existsSync(newDir)) fs.rmdirSync(newDir, { recursive: true });
      fs.renameSync(v2Dir, newDir);
    } else if (fresh && fs.existsSync(v1Cfg)) {
      fs.mkdirSync(newDir, { recursive: true });
      fs.copyFileSync(v1Cfg, path.join(newDir, 'config.json'));
    }
  } catch {}
}

// ---------- cấu hình người dùng (userData/config.json) ----------
function configPath() { return path.join(app.getPath('userData'), 'config.json'); }
function loadConfig() {
  try { return JSON.parse(fs.readFileSync(configPath(), 'utf8')); } catch { return {}; }
}
function saveConfig(patch) {
  const cfg = { ...loadConfig(), ...patch };
  try {
    fs.mkdirSync(path.dirname(configPath()), { recursive: true });
    fs.writeFileSync(configPath(), JSON.stringify(cfg, null, 2));
  } catch (e) { console.error('Không lưu được config:', e); }
  return cfg;
}
function allowDomains() {
  // Luôn gồm DEFAULT_ALLOW, cộng thêm domain người dùng tự thêm trong config.json
  const list = loadConfig().allowDomains;
  return [...new Set([...DEFAULT_ALLOW, ...(Array.isArray(list) ? list : [])])];
}

// ---------- tìm plugin Flash ----------
// Plugin nằm ngoài app, ở userData/plugins, để cập nhật (thay cả Wisp.app) không làm mất plugin
// và bản phát hành công khai không phải kèm phần mềm của Adobe.
const ADOBE_TEAM_ID = 'JQ525L2MZD'; // "Developer ID Application: Adobe Inc."
function userPluginPath() { return path.join(app.getPath('userData'), 'plugins', PLUGIN_NAME); }
// Plugin đóng gói sẵn trong app (bản build cá nhân: npm run dist:personal) hoặc thư mục plugins/ khi chạy dev
function bundledPluginPath() {
  return app.isPackaged ? path.join(process.resourcesPath, 'plugins', PLUGIN_NAME) : path.join(__dirname, 'plugins', PLUGIN_NAME);
}

function findFlashPlugin() {
  const candidates = [
    userPluginPath(),
    bundledPluginPath(),
    path.join('/Library/Internet Plug-Ins/PepperFlashPlayer', PLUGIN_NAME),
    path.join(app.getPath('home'), 'Library/Internet Plug-Ins/PepperFlashPlayer', PLUGIN_NAME),
  ];
  return candidates.find(p => fs.existsSync(p)) || null;
}

// Kiểm tra plugin là bản thật của Adobe: chữ ký hợp lệ + đúng Team ID của Adobe + có bản x86_64
function verifyFlashPlugin(p) {
  if (path.basename(p) !== PLUGIN_NAME) return `Tên phải là ${PLUGIN_NAME}`;
  const bin = path.join(p, 'Contents', 'MacOS', 'PepperFlashPlayer');
  if (!fs.existsSync(bin)) return 'Không phải plugin Pepper Flash (thiếu Contents/MacOS/PepperFlashPlayer)';
  try { execFileSync('/usr/bin/codesign', ['--verify', '--deep', '--strict', p], { stdio: 'pipe' }); }
  catch (e) { return 'Chữ ký không hợp lệ (file đã bị sửa hoặc không phải bản của Adobe):\n' + String(e.stderr || e.message).trim(); }
  const r = spawnSync('/usr/bin/codesign', ['-dv', p], { encoding: 'utf8' });
  if (!new RegExp(`TeamIdentifier=${ADOBE_TEAM_ID}\\b`).test(r.stderr || '')) return 'Plugin không do Adobe ký';
  const arch = spawnSync('/usr/bin/lipo', ['-archs', bin], { encoding: 'utf8' }).stdout || '';
  if (!/x86_64/.test(arch)) return `Plugin không có bản x86_64 (đang là: ${arch.trim() || 'không rõ'})`;
  return null;
}

// Chép plugin vào userData/plugins (ditto giữ nguyên symlink + chữ ký); chép ra chỗ tạm rồi đổi tên
function installFlashPlugin(src) {
  const dest = userPluginPath();
  const tmp = dest + '.tmp';
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (fs.existsSync(tmp)) fs.rmdirSync(tmp, { recursive: true });
  execFileSync('/usr/bin/ditto', [src, tmp]);
  if (fs.existsSync(dest)) fs.rmdirSync(dest, { recursive: true });
  fs.renameSync(tmp, dest);
  return dest;
}

// Lần đầu chạy: plugin đang nằm trong app mà chưa có ở userData → chép ra
if (!fs.existsSync(userPluginPath()) && fs.existsSync(bundledPluginPath())) {
  try { installFlashPlugin(bundledPluginPath()); } catch (e) { console.error('Không chép được plugin Flash:', e); }
}

// Đọc version của plugin (manifest.json hoặc Info.plist) để truyền cho ppapi-flash-version
function readFlashVersion(pluginPath) {
  try {
    const m = JSON.parse(fs.readFileSync(path.join(pluginPath, 'Contents/Resources/manifest.json'), 'utf8'));
    if (m.version) return m.version;
  } catch {}
  try {
    const plist = fs.readFileSync(path.join(pluginPath, 'Contents/Info.plist'), 'utf8');
    const v = plist.match(/<key>CFBundleVersion<\/key>\s*<string>([^<]+)<\/string>/)
           || plist.match(/<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/);
    if (v) return v[1].trim();
  } catch {}
  return '32.0.0.465';
}

// ---------- chọn chế độ lúc khởi động (switch phải gắn trước app ready) ----------
const startCfg = loadConfig();
const FLASH_PATH = findFlashPlugin();
const FLASH_VERSION = FLASH_PATH ? readFlashVersion(FLASH_PATH) : null;
// mode: 'flash' (Flash thật) | 'ruffle'. Không có plugin thì tự rơi về Ruffle.
const wantedMode = startCfg.mode === 'ruffle' ? 'ruffle' : 'flash';
const MODE = wantedMode === 'flash' && FLASH_PATH ? 'flash' : 'ruffle';

if (MODE === 'flash') {
  app.commandLine.appendSwitch('ppapi-flash-path', FLASH_PATH);
  app.commandLine.appendSwitch('ppapi-flash-version', FLASH_VERSION);
}

// ---------- mms.cfg: tắt kill switch của Flash 32 cho các domain trong allowlist ----------
function mmsCfgContent() {
  const lines = [
    'EOLUninstallDisable=1',
    'AutoUpdateDisable=1',
    'SilentAutoUpdateEnable=0',
    'EnableAllowList=1',
  ];
  for (const d of allowDomains()) {
    lines.push(`AllowListUrlPattern=*://${d}/`);
    lines.push(`AllowListUrlPattern=*://*.${d}/`);
  }
  lines.push('AllowListUrlPattern=file:*');
  if (loadConfig().flashDebug) lines.push('AllowListPreview=1', 'TraceOutputEcho=1');
  return lines.join('\n') + '\n';
}
function mmsCfgPath() {
  return path.join(app.getPath('userData'), 'Pepper Data', 'Shockwave Flash', 'System', 'mms.cfg');
}
function writeMmsCfg() {
  try {
    fs.mkdirSync(path.dirname(mmsCfgPath()), { recursive: true });
    fs.writeFileSync(mmsCfgPath(), mmsCfgContent());
  } catch (e) { console.error('Không ghi được mms.cfg:', e); }
}

// Lấy "domain gốc" để đưa vào allowlist, vd. static.game.cmn.vn → cmn.vn
const TWO_PART_TLD = /\.(com|net|org|edu|gov|info|biz|name|pro|int|ac|co)\.[a-z]{2}$/i;
function baseDomain(host) {
  const parts = String(host || '').toLowerCase().split('.').filter(Boolean);
  if (parts.length <= 2 || /^\d+$/.test(parts[parts.length - 1])) return parts.join('.');
  return parts.slice(TWO_PART_TLD.test(host) ? -3 : -2).join('.');
}

// Ruffle: giao thức riêng ruffle:// để trang nào cũng tải được file Ruffle đóng gói sẵn
protocol.registerSchemesAsPrivileged([
  { scheme: 'ruffle', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, bypassCSP: true } },
]);

const PLAYER_PATH = '/__flash_player__.html';
// Trang Lịch sử nội bộ; thanh địa chỉ hiện "wisp://history"
const HISTORY_URL = pathToFileURL(path.join(__dirname, 'history.html')).href;
function isHistoryUrl(u) { return String(u || '').split(/[?#]/)[0] === HISTORY_URL; }

// Địa chỉ hiển thị trên thanh địa chỉ: bỏ lớp player.html / ruffle://file
function displayUrl(u) {
  if (isHistoryUrl(u)) return 'wisp://history';
  const m = String(u || '').match(/(?:player\.html|__flash_player__\.html)\?src=([^&#]+)/);
  if (m) u = decodeURIComponent(m[1]);
  if (u.startsWith('ruffle://file/')) u = 'file://' + u.slice('ruffle://file'.length);
  return u;
}

function normalizeUrl(input) {
  let u = String(input || '').trim();
  if (!u) return null;
  if (/^wisp:\/*history\/?$/i.test(u)) return HISTORY_URL;
  if (u.startsWith('~/')) u = path.join(app.getPath('home'), u.slice(2));
  if (u.startsWith('/') && fs.existsSync(u)) u = pathToFileURL(u).href;
  else if (!/^[a-z]+:/i.test(u)) u = (/^(localhost|[\d.]+)(:\d+)?(\/|$)/.test(u) ? 'http://' : 'https://') + u;
  // File .swf mở thẳng → bọc vào trang player.html để cả Flash thật lẫn Ruffle đều chạy
  if (/\.swf(\?|#|$)/i.test(u)) {
    if (MODE === 'ruffle' && u.startsWith('file:')) {
      return 'ruffle://file' + PLAYER_PATH + '?src=' + encodeURIComponent('ruffle://file' + new URL(u).pathname);
    }
    return pathToFileURL(path.join(__dirname, 'player.html')).href + '?src=' + encodeURIComponent(u);
  }
  return u;
}

// ---------- cửa sổ + tab ----------
// Mỗi tab là một BrowserView; chỉ tab đang xem được gắn vào cửa sổ.
let win = null;
let pendingFile = null;
const seenSwfHosts = new Set(); // domain của các file .swf trang đã tải (gợi ý thêm vào allowlist)
let tabs = [];                  // { id, view, title, favicon, htmlFull, hist }
let activeId = null;
let tabSeq = 0;
const closedTabs = [];          // tab vừa đóng, để Shift+Cmd+T mở lại
const CLOSED_MAX = 25;

function homeUrl() { return loadConfig().url || DEFAULT_URL; }
function winOk() { return win && !win.isDestroyed(); }
function tabOf(id) { return tabs.find(t => t.id === id) || null; }
function activeTab() { return tabOf(activeId); }
function wc() {
  const t = activeTab();
  return t && !t.view.webContents.isDestroyed() ? t.view.webContents : null;
}

function sendState() {
  if (!winOk() || !wc()) return;
  const w = wc();
  win.webContents.send('state', {
    url: displayUrl(w.getURL()),
    canBack: w.canGoBack(),
    canForward: w.canGoForward(),
    loading: w.isLoading(),
    mode: MODE,
    version: FLASH_VERSION,
    wantedFlash: wantedMode === 'flash',
  });
}

function tabInfo(t) {
  const w = t.view.webContents;
  const url = w.isDestroyed() ? '' : displayUrl(w.getURL());
  return { id: t.id, title: t.title || url || 'Tab mới', url, favicon: t.favicon || '',
           loading: !w.isDestroyed() && w.isLoading(), history: isHistoryUrl(w.isDestroyed() ? '' : w.getURL()) };
}

// Gom nhiều thay đổi (đang tải, đổi tiêu đề…) rồi mới vẽ lại thanh tab + menu Tab
let tabsTimer = null;
function sendTabs() {
  if (tabsTimer) return;
  tabsTimer = setTimeout(() => {
    tabsTimer = null;
    if (!winOk()) return;
    win.webContents.send('tabs', { tabs: tabs.map(tabInfo), active: activeId });
    scheduleMenu();
  }, 30);
}

function updateTitle() {
  const t = activeTab();
  if (winOk()) win.setTitle((t && t.title ? t.title + ' — ' : '') + 'Wisp');
}

function layout() {
  const t = activeTab();
  if (!winOk() || !t) return;
  const [width, height] = win.getContentSize();
  const top = t.htmlFull ? 0 : TOOLBAR_HEIGHT; // trình phát Flash bật toàn màn hình → ẩn thanh công cụ
  t.view.setBounds({ x: 0, y: top, width, height: height - top });
}

function tabPrefs() {
  return {
    plugins: MODE === 'flash',
    contextIsolation: true,
    nodeIntegration: false,
    worldSafeExecuteJavaScript: true,
    // page-preload.js: chèn Ruffle (chế độ Ruffle) + cầu nối cho trang Lịch sử
    preload: path.join(__dirname, 'page-preload.js'),
    additionalArguments: ['--wisp-history=' + HISTORY_URL, ...(MODE === 'ruffle' ? ['--flash-mode=ruffle'] : [])],
    // Chế độ Ruffle: preload chạy trong mọi frame (kể cả iframe) để chèn Ruffle
    ...(MODE === 'ruffle' ? { nodeIntegrationInSubFrames: true } : {}),
  };
}

function createTab(url, { activate = true, index = tabs.length } = {}) {
  const view = new BrowserView({ webPreferences: tabPrefs() });
  const t = { id: ++tabSeq, view, title: '', favicon: '', htmlFull: false, hist: null };
  tabs.splice(Math.max(0, Math.min(index, tabs.length)), 0, t);
  // Game ở tab khác vẫn chạy bình thường (không bị Chromium hãm timer khi tab ẩn)
  view.webContents.setBackgroundThrottling(false);
  wireTab(t);
  view.webContents.loadURL(url).catch(() => {});
  if (activate) activateTab(t.id); else sendTabs();
  return t;
}

function activateTab(id) {
  const t = tabOf(id);
  if (!t || !winOk()) return;
  const prev = activeTab();
  if (prev !== t) {
    if (prev) win.removeBrowserView(prev.view);
    activeId = t.id;
    win.addBrowserView(t.view);
  }
  layout();
  t.view.webContents.focus();
  updateTitle();
  sendState();
  sendTabs();
}

function closeTab(id) {
  const i = tabs.findIndex(t => t.id === id);
  if (i < 0) return;
  const t = tabs[i];
  const w = t.view.webContents;
  if (!w.isDestroyed() && w.getURL()) {
    closedTabs.push({ url: w.getURL(), index: i });
    if (closedTabs.length > CLOSED_MAX) closedTabs.shift();
  }
  tabs.splice(i, 1);
  if (activeId === id) {
    activeId = null;
    if (winOk()) win.removeBrowserView(t.view);
  }
  try { w.destroy(); } catch {}
  // Đóng tab cuối cùng thì mở tab trang chủ thay vì tắt app (tránh lỡ tay thoát game)
  if (!tabs.length) { createTab(homeUrl()); return; }
  if (activeId === null) activateTab(tabs[Math.min(i, tabs.length - 1)].id);
  else sendTabs();
}

function reopenClosedTab() {
  const c = closedTabs.pop();
  if (c) createTab(c.url, { index: c.index });
}

function cycleTab(step) {
  if (tabs.length < 2) return;
  const i = tabs.findIndex(t => t.id === activeId);
  activateTab(tabs[(i + step + tabs.length) % tabs.length].id);
}

function newTab() {
  createTab(homeUrl());
  focusUrlBar();
}

function focusUrlBar() {
  if (!winOk()) return;
  win.webContents.focus();
  win.webContents.executeJavaScript("document.getElementById('url').select()").catch(() => {});
}

function tabMenu(id) {
  const t = tabOf(id);
  if (!t) return;
  const i = tabs.indexOf(t);
  Menu.buildFromTemplate([
    { label: 'Tải lại', click: () => t.view.webContents.reload() },
    { label: 'Nhân bản tab', click: () => createTab(t.view.webContents.getURL(), { index: i + 1 }) },
    { type: 'separator' },
    { label: 'Đóng tab', click: () => closeTab(id) },
    { label: 'Đóng các tab khác', enabled: tabs.length > 1, click: () => tabs.filter(x => x !== t).forEach(x => closeTab(x.id)) },
    { label: 'Đóng các tab bên phải', enabled: i < tabs.length - 1, click: () => tabs.slice(i + 1).forEach(x => closeTab(x.id)) },
    { type: 'separator' },
    { label: 'Mở lại tab vừa đóng', enabled: closedTabs.length > 0, click: reopenClosedTab },
  ]).popup({ window: win });
}

function wireTab(t) {
  const w = t.view.webContents;
  const isActive = () => activeId === t.id;

  w.on('enter-html-full-screen', () => { t.htmlFull = true; if (isActive()) layout(); });
  w.on('leave-html-full-screen', () => { t.htmlFull = false; if (isActive()) layout(); });

  // Popup (window.open / target=_blank / Cmd+bấm link) → mở tab mới ngay bên phải
  w.on('new-window', (e, url, _name, disposition) => {
    e.preventDefault();
    createTab(url, { index: tabs.indexOf(t) + 1, activate: disposition !== 'background-tab' });
  });

  ['did-navigate-in-page', 'did-start-loading', 'did-stop-loading'].forEach(ev => w.on(ev, () => { if (isActive()) sendState(); sendTabs(); }));
  w.on('did-navigate', (_e, url) => {
    t.favicon = '';
    recordVisit(t, url);
    if (isActive()) sendState();
    sendTabs();
  });
  w.on('did-navigate-in-page', (_e, url, isMain) => { if (isMain) recordVisit(t, url); });
  w.on('page-title-updated', (_e, title) => {
    t.title = title;
    if (t.hist && t.hist.url === displayUrl(w.getURL()) && t.hist.title !== title) { t.hist.title = title; historyChanged(); }
    if (isActive()) updateTitle();
    sendTabs();
  });
  w.on('page-favicon-updated', (_e, favicons) => { t.favicon = favicons[0] || ''; sendTabs(); });
  w.on('did-fail-load', (_e, code, desc, url, isMain) => {
    if (isMain && code !== -3) console.warn('Lỗi tải trang', code, desc, url);
  });
  w.on('plugin-crashed', (_e, name, version) => {
    addLog('error', 'event', `Plugin ${name} ${version} bị crash`);
    dialog.showMessageBox(win, { type: 'warning', message: `Plugin ${name} ${version} bị lỗi và đã dừng.`, detail: 'Bấm Tải lại (Cmd+R) để thử lại.' });
  });

  // Ghi lại console của trang + các sự kiện đáng chú ý cho Bảng kiểm tra
  const LEVELS = ['verbose', 'info', 'warning', 'error'];
  w.on('console-message', (_e, level, message, line, sourceId) => {
    addLog(LEVELS[level] || 'info', 'console', message, sourceId ? `${sourceId}:${line}` : '');
  });
  w.on('did-start-navigation', (_e, url, inPage, isMain) => { if (isMain && !inPage) addLog('info', 'event', 'Mở trang ' + displayUrl(url)); });
  w.on('did-fail-load', (_e, code, desc, url, isMain) => {
    if (code !== -3) addLog('error', 'event', `Tải ${isMain ? 'trang' : 'frame'} lỗi ${code} ${desc}`, url);
  });
  w.on('render-process-gone', (_e, d) => addLog('error', 'event', `Tiến trình trang bị dừng: ${d.reason} (exit ${d.exitCode})`));
  w.on('unresponsive', () => addLog('warning', 'event', 'Trang bị treo (không phản hồi)'));
  w.on('responsive', () => addLog('info', 'event', 'Trang phản hồi lại'));
}

function createWindow() {
  const argUrl = process.argv.slice(1).find(a => /^https?:|\.swf$/i.test(a));
  const startUrl = normalizeUrl(process.env.FLASH_URL || pendingFile || argUrl) || homeUrl();
  pendingFile = null;

  // Cửa sổ chính chứa thanh tab + thanh công cụ; trang web nằm trong BrowserView bên dưới
  win = new BrowserWindow({
    width: 1280, height: 820, title: 'Wisp', backgroundColor: '#2b2d31',
    webPreferences: { preload: path.join(__dirname, 'toolbar-preload.js'), contextIsolation: true, nodeIntegration: false, worldSafeExecuteJavaScript: true },
  });
  win.loadFile(path.join(__dirname, 'toolbar.html'));
  win.on('resize', layout);
  win.on('closed', () => { win = null; tabs = []; activeId = null; });

  buildMenu();
  createTab(startUrl);

  if (wantedMode === 'flash' && !FLASH_PATH) setTimeout(askForFlashPlugin, 800);
}

// ---------- lịch sử duyệt web (userData/history.json) ----------
const HISTORY_MAX = 5000;
let history = null;   // [{ id, url, title, time }], cũ → mới
let histSeq = 0;
let histSaveTimer = null;

function historyPath() { return path.join(app.getPath('userData'), 'history.json'); }
function loadHistory() {
  if (history) return history;
  try { history = JSON.parse(fs.readFileSync(historyPath(), 'utf8')); } catch {}
  if (!Array.isArray(history)) history = [];
  history = history.filter(h => h && typeof h.url === 'string' && typeof h.time === 'number');
  for (const h of history) if (typeof h.id === 'number') histSeq = Math.max(histSeq, h.id);
  for (const h of history) if (typeof h.id !== 'number') h.id = ++histSeq;
  return history;
}
function saveHistoryNow() {
  clearTimeout(histSaveTimer); histSaveTimer = null;
  if (!history) return;
  try { fs.writeFileSync(historyPath(), JSON.stringify(history)); } catch (e) { console.error('Không lưu được lịch sử:', e); }
}
function historyChanged() {
  if (!histSaveTimer) histSaveTimer = setTimeout(saveHistoryNow, 1000);
  for (const t of tabs) {
    const w = t.view.webContents;
    if (!w.isDestroyed() && isHistoryUrl(w.getURL())) w.send('history:changed');
  }
  scheduleMenu();
}

function recordVisit(t, rawUrl) {
  const url = displayUrl(rawUrl);
  if (!/^(https?|file):/i.test(url) || isHistoryUrl(rawUrl)) return;
  const h = loadHistory();
  const now = Date.now();
  const last = h[h.length - 1];
  // Tải lại / đổi #hash cùng một trang trong vòng 1 phút thì chỉ cập nhật giờ, không thêm dòng mới
  if (last && last.url === url && now - last.time < 60000) {
    last.time = now;
    t.hist = last;
  } else {
    t.hist = { id: ++histSeq, url, title: '', time: now };
    h.push(t.hist);
    if (h.length > HISTORY_MAX) h.splice(0, h.length - HISTORY_MAX);
  }
  historyChanged();
}

async function clearHistoryDialog() {
  const { response } = await dialog.showMessageBox(win, {
    type: 'question', message: 'Xoá lịch sử duyệt web',
    detail: 'Chỉ xoá danh sách trang đã xem. Cookie và đăng nhập vẫn giữ nguyên.',
    buttons: ['Giờ vừa qua', 'Hôm nay', 'Toàn bộ', 'Huỷ'], defaultId: 0, cancelId: 3,
  });
  if (response === 3) return false;
  const since = response === 0 ? Date.now() - 3600e3 : response === 1 ? new Date().setHours(0, 0, 0, 0) : 0;
  history = loadHistory().filter(h => since && h.time < since);
  for (const t of tabs) t.hist = null;
  historyChanged();
  return true;
}

function openHistory() {
  const t = tabs.find(x => !x.view.webContents.isDestroyed() && isHistoryUrl(x.view.webContents.getURL()));
  if (t) activateTab(t.id);
  else createTab(HISTORY_URL, { index: tabs.indexOf(activeTab()) + 1 });
}

function openUrl(url) {
  const u = normalizeUrl(url);
  if (!u) return;
  if (wc()) wc().loadURL(u).catch(() => {}); else createTab(u);
}

function fromHistoryPage(e) { try { return isHistoryUrl(e.sender.getURL()); } catch { return false; } }
ipcMain.handle('history:list', (e) => fromHistoryPage(e) ? loadHistory().slice().reverse() : []);
ipcMain.handle('history:open', (e, url, inNewTab) => {
  if (!fromHistoryPage(e) || !/^(https?|file):/i.test(String(url))) return;
  const u = normalizeUrl(url);
  if (!u) return;
  if (inNewTab) {
    const t = tabs.find(x => x.view.webContents === e.sender);
    createTab(u, { index: t ? tabs.indexOf(t) + 1 : tabs.length, activate: false });
  } else e.sender.loadURL(u).catch(() => {});
});
ipcMain.handle('history:remove', (e, ids) => {
  if (!fromHistoryPage(e) || !Array.isArray(ids)) return;
  const del = new Set(ids);
  history = loadHistory().filter(h => !del.has(h.id));
  for (const t of tabs) if (t.hist && del.has(t.hist.id)) t.hist = null;
  historyChanged();
});
ipcMain.handle('history:clear', (e) => fromHistoryPage(e) ? clearHistoryDialog() : false);

// ---------- điều hướng từ thanh công cụ ----------
ipcMain.on('nav', (_e, action, arg) => {
  const w = wc();
  if (!w) return;
  if (action === 'go') { const u = normalizeUrl(arg); if (u) w.loadURL(u).catch(() => {}); }
  else if (action === 'back') { if (w.canGoBack()) w.goBack(); }
  else if (action === 'forward') { if (w.canGoForward()) w.goForward(); }
  else if (action === 'reload') { w.isLoading() ? w.stop() : w.reload(); }
  else if (action === 'home') { w.loadURL(homeUrl()).catch(() => {}); }
  else if (action === 'sethome') { saveConfig({ url: w.getURL() }); }
  else if (action === 'inspect') { openInspector(); }
  else if (action === 'history') { openHistory(); }
});
ipcMain.on('tab', (e, action, id) => {
  if (!winOk() || e.sender !== win.webContents) return;
  if (action === 'new') newTab();
  else if (action === 'close') closeTab(id);
  else if (action === 'switch') activateTab(id);
  else if (action === 'menu') tabMenu(id);
});
ipcMain.on('ready', () => { sendState(); sendTabs(); });

// ---------- Bảng kiểm tra: HTTP, socket TCP, console, thông tin Flash ----------
// DevTools không thấy kết nối socket của Flash (chúng không đi qua tab Network),
// nên app tự ghi: mọi request HTTP của phiên (cả request do Flash gửi), các kết nối
// TCP của mọi tiến trình Wisp (đọc bằng lsof), console + sự kiện của trang.
const LOG_MAX = 3000;
const APP_FILE_URL = pathToFileURL(__dirname).href + '/';
const httpLog = new Map();        // id → request
const appLog = [];                // console + sự kiện
const sockets = new Map();        // pid:fd:địa chỉ → kết nối TCP
let inspectWin = null;
let logSeq = 0;
let sockTimer = null;
let sockBusy = false;
let netLogFile = null;

function inspectorOpen() { return inspectWin && !inspectWin.isDestroyed(); }

// Gom thay đổi rồi gửi theo lô để bảng không bị giật khi trang tải hàng trăm file
const dirty = { http: new Map(), log: [], sock: new Map() };
let flushTimer = null;
function scheduleFlush() {
  if (flushTimer || !inspectorOpen()) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    if (!inspectorOpen()) return;
    inspectWin.webContents.send('inspect:update', {
      http: [...dirty.http.values()], log: dirty.log, sock: [...dirty.sock.values()],
    });
    dirty.http.clear(); dirty.log = []; dirty.sock.clear();
  }, 200);
}

function trimMap(map) {
  while (map.size > LOG_MAX) map.delete(map.keys().next().value);
}

function addLog(level, kind, message, source = '') {
  const entry = { id: ++logSeq, time: Date.now(), level, kind, message: String(message).slice(0, 4000), source };
  appLog.push(entry);
  if (appLog.length > LOG_MAX) appLog.shift();
  if (inspectorOpen()) { dirty.log.push(entry); scheduleFlush(); }
}

function httpUpdate(id, patch) {
  let r = httpLog.get(id);
  if (!r) return;
  Object.assign(r, patch);
  if (inspectorOpen()) { dirty.http.set(id, r); scheduleFlush(); }
}

// Request của chính toolbar / Bảng kiểm tra / DevTools thì bỏ qua
function ownWebContents(id) {
  return id != null && ((win && !win.isDestroyed() && win.webContents.id === id) ||
                        (inspectorOpen() && inspectWin.webContents.id === id));
}

function installRequestLog(ses) {
  const wr = ses.webRequest;
  wr.onBeforeRequest((d, cb) => {
    cb({});
    if (/^(devtools|chrome-extension|data|blob):/i.test(d.url) || ownWebContents(d.webContentsId)) return;
    // file giao diện của chính app (toolbar.html, inspect.html…), trừ player.html bọc file .swf
    if (d.url.startsWith(APP_FILE_URL) && !d.url.startsWith(APP_FILE_URL + 'player.html')) return;
    httpLog.set(d.id, { id: d.id, start: Date.now(), method: d.method, url: d.url, type: d.resourceType,
                        status: 0, state: 'pending', error: '', ip: '', fromCache: false, end: 0,
                        reqHeaders: null, resHeaders: null, redirects: [] });
    trimMap(httpLog);
    httpUpdate(d.id, {});
  });
  wr.onSendHeaders((d) => httpUpdate(d.id, { reqHeaders: d.requestHeaders }));
  wr.onHeadersReceived((d, cb) => {
    const h = { ...d.responseHeaders };
    if (MODE === 'ruffle') {
      // Gỡ Content-Security-Policy để script Ruffle chạy được trên mọi trang
      for (const k of Object.keys(h)) if (/^content-security-policy/i.test(k)) delete h[k];
      cb({ responseHeaders: h });
    } else cb({});
    httpUpdate(d.id, { status: d.statusCode, resHeaders: d.responseHeaders, statusLine: d.statusLine });
  });
  wr.onBeforeRedirect((d) => {
    const r = httpLog.get(d.id);
    if (r) httpUpdate(d.id, { redirects: [...r.redirects, `${d.statusCode} → ${d.redirectURL}`], status: d.statusCode });
  });
  wr.onCompleted((d) => {
    if (MODE === 'flash' && (/\.swf(\?|#|$)/i.test(d.url) || d.resourceType === 'object')) {
      try { seenSwfHosts.add(new URL(d.url).hostname); } catch {}
    }
    httpUpdate(d.id, { state: 'done', status: d.statusCode, ip: d.ip || '', fromCache: d.fromCache, end: Date.now() });
  });
  wr.onErrorOccurred((d) => {
    httpUpdate(d.id, { state: 'error', error: d.error, ip: d.ip || '', end: Date.now() });
  });
}

// ----- socket TCP: lsof trên mọi tiến trình của app (Flash nối qua tiến trình network) -----
function procTypes() {
  const m = new Map();
  for (const p of app.getAppMetrics()) m.set(p.pid, p.serviceName || p.name || p.type);
  return m;
}

function pollSockets() {
  if (sockBusy) return;
  const types = procTypes();
  const pids = [...types.keys()];
  if (!pids.length) return;
  sockBusy = true;
  execFile('lsof', ['-nP', '-a', '-iTCP', '-p', pids.join(','), '-F', 'pfnT'], { timeout: 4000 }, (_err, out) => {
    sockBusy = false;
    // lsof thoát mã 1 khi không có kết nối nào → vẫn xử lý như danh sách rỗng
    const now = Date.now();
    const seen = new Set();
    let pid = 0, cur = null;
    const commit = () => {
      if (!cur || !cur.name || !cur.name.includes('->')) return; // bỏ socket đang LISTEN
      const key = `${pid}:${cur.fd}:${cur.name}`;
      seen.add(key);
      const [local, remote] = cur.name.split('->');
      const port = Number(remote.slice(remote.lastIndexOf(':') + 1));
      let s = sockets.get(key);
      if (!s) {
        s = { key, pid, proc: types.get(pid) || '', local, remote, port, first: now, last: now, end: 0, states: [] };
        sockets.set(key, s);
        trimMap(sockets);
        if (port !== 443 && port !== 80) addLog('info', 'socket', `Mở kết nối TCP tới ${remote} (${cur.state || '?'})`);
      }
      s.last = now;
      if (cur.state && s.states[s.states.length - 1] !== cur.state) s.states.push(cur.state);
      if (inspectorOpen()) dirty.sock.set(key, s);
    };
    for (const line of String(out || '').split('\n')) {
      const t = line[0], v = line.slice(1);
      if (t === 'p') { commit(); cur = null; pid = Number(v); }
      else if (t === 'f') { commit(); cur = { fd: v, name: '', state: '' }; }
      else if (t === 'n' && cur) cur.name = v;
      else if (t === 'T' && cur && v.startsWith('ST=')) cur.state = v.slice(3);
    }
    commit();
    for (const s of sockets.values()) {
      if (!s.end && !seen.has(s.key)) {
        s.end = now;
        if (s.port !== 443 && s.port !== 80) {
          addLog(s.states.includes('ESTABLISHED') ? 'info' : 'warning', 'socket',
                 `Đóng kết nối TCP tới ${s.remote} sau ${((now - s.first) / 1000).toFixed(1)}s (trạng thái: ${s.states.join(' → ') || '?'})`);
        }
        if (inspectorOpen()) dirty.sock.set(s.key, s);
      }
    }
    scheduleFlush();
  });
}

function startSocketWatch() {
  if (sockTimer) return;
  pollSockets();
  sockTimer = setInterval(pollSockets, 400);
}
function stopSocketWatch() { clearInterval(sockTimer); sockTimer = null; }

// Thử kết nối TCP từ app (tiến trình chính) – tách lỗi mạng khỏi lỗi của Flash
function probeTcp(host, port, policy) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const res = { host, port, policy, ok: false, ms: 0, ip: '', response: '', error: '' };
    const sock = net.connect({ host, port: Number(port) });
    let done = false;
    const finish = (patch) => {
      if (done) return;
      done = true;
      Object.assign(res, patch);
      sock.destroy();
      addLog(res.ok ? 'info' : 'error', 'probe',
             `Thử ${host}:${port}${policy ? ' (policy)' : ''}: ${res.ok ? 'OK ' + res.ms + 'ms' : res.error}`);
      resolve(res);
    };
    sock.setTimeout(8000, () => finish({ error: res.ms ? 'Không nhận được trả lời policy sau 8s' : 'Hết thời gian kết nối (8s)' }));
    sock.on('connect', () => {
      res.ms = Date.now() - t0;
      res.ip = sock.remoteAddress || '';
      if (!policy) return finish({ ok: true });
      sock.write('<policy-file-request/>\0');
    });
    sock.on('data', (buf) => {
      res.response += buf.toString('utf8');
      if (res.response.includes('\0') || res.response.includes('</cross-domain-policy>')) {
        finish({ ok: true, response: res.response.replace(/\0/g, '') });
      }
    });
    sock.on('end', () => finish(res.response ? { ok: true } : { error: 'Máy chủ đóng kết nối, không gửi gì' }));
    sock.on('error', (e) => finish({ error: `${e.code || ''} ${e.message}`.trim() }));
  });
}

async function flashInfo() {
  const w = wc();
  let plugin = '';
  try {
    plugin = await w.executeJavaScript(`(() => { const p = navigator.plugins['Shockwave Flash']; return p ? (p.name + ' — ' + p.description) : ''; })()`);
  } catch {}
  let mms = '';
  try { mms = fs.readFileSync(mmsCfgPath(), 'utf8'); } catch (e) { mms = '(không đọc được: ' + e.message + ')'; }
  return {
    mode: MODE, wantedMode, flashPath: FLASH_PATH, flashVersion: FLASH_VERSION, plugin,
    arch: process.arch, electron: process.versions.electron, chrome: process.versions.chrome,
    userAgent: w ? w.getUserAgent() : '', pageUrl: w ? displayUrl(w.getURL()) : '',
    mmsCfgPath: mmsCfgPath(), mmsCfg: mms, allowDomains: allowDomains(), seenSwfHosts: [...seenSwfHosts],
    netLogFile, netLogging: !!netLogFile && netLogActive,
  };
}

let netLogActive = false;
function netLogApi() { return session.defaultSession.netLog || require('electron').netLog; }

function openInspector() {
  if (inspectorOpen()) { inspectWin.show(); inspectWin.focus(); return; }
  inspectWin = new BrowserWindow({
    width: 1100, height: 700, minWidth: 720, minHeight: 420, title: 'Bảng kiểm tra — Wisp', backgroundColor: '#1e1f22',
    webPreferences: { preload: path.join(__dirname, 'inspect-preload.js'), contextIsolation: true, nodeIntegration: false, worldSafeExecuteJavaScript: true },
  });
  inspectWin.loadFile(path.join(__dirname, 'inspect.html'));
  inspectWin.on('closed', () => { inspectWin = null; stopSocketWatch(); });
  startSocketWatch();
}

ipcMain.handle('inspect:snapshot', () => ({
  http: [...httpLog.values()], log: appLog, sock: [...sockets.values()],
}));
ipcMain.handle('inspect:clear', (_e, kind) => {
  if (kind === 'http') httpLog.clear();
  if (kind === 'log') appLog.length = 0;
  if (kind === 'sock') { for (const [k, s] of sockets) if (s.end) sockets.delete(k); }
});
ipcMain.handle('inspect:info', () => flashInfo());
ipcMain.handle('inspect:probe', (_e, host, port, policy) => probeTcp(String(host || '').trim(), port, !!policy));
ipcMain.handle('inspect:devtools', () => { const w = wc(); if (w) w.openDevTools({ mode: 'detach' }); });
ipcMain.handle('inspect:copy', (_e, text) => clipboard.writeText(String(text)));
ipcMain.handle('inspect:reveal', (_e, p) => { if (p) shell.showItemInFolder(p); });
ipcMain.handle('inspect:netlog', async (_e, on) => {
  const api = netLogApi();
  if (on && !netLogActive) {
    netLogFile = path.join(app.getPath('downloads'), `wisp-netlog-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    await api.startLogging(netLogFile, { captureMode: 'includeSensitive' });
    netLogActive = true;
    addLog('info', 'event', 'Bắt đầu ghi NetLog: ' + netLogFile);
  } else if (!on && netLogActive) {
    await api.stopLogging();
    netLogActive = false;
    addLog('info', 'event', 'Đã lưu NetLog: ' + netLogFile);
  }
  return { active: netLogActive, file: netLogFile };
});
ipcMain.handle('inspect:report', async () => {
  const r = await dialog.showSaveDialog(inspectWin || win, {
    defaultPath: path.join(app.getPath('downloads'), `wisp-bao-cao-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`),
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (r.canceled || !r.filePath) return null;
  const report = { createdAt: new Date().toISOString(), info: await flashInfo(),
                   http: [...httpLog.values()], sockets: [...sockets.values()], log: appLog };
  fs.writeFileSync(r.filePath, JSON.stringify(report, null, 2));
  shell.showItemInFolder(r.filePath);
  return r.filePath;
});

// ---------- các thao tác trong menu Flash ----------
function relaunch() { app.relaunch(); app.exit(0); }

async function askRelaunch(message) {
  const { response } = await dialog.showMessageBox(win, {
    type: 'question', buttons: ['Khởi động lại', 'Để sau'], defaultId: 0, cancelId: 1,
    message, detail: 'Thay đổi có hiệu lực sau khi mở lại app.',
  });
  if (response === 0) relaunch();
}

function setMode(mode) {
  if (mode === wantedMode) return;
  saveConfig({ mode });
  askRelaunch(mode === 'flash' ? 'Chuyển sang Flash Player thật.' : 'Chuyển sang chế độ Ruffle.');
}

async function allowCurrentSite() {
  const w = wc();
  if (!w) return;
  const hosts = new Set();
  try {
    const h = new URL(displayUrl(w.getURL())).hostname;
    if (h) hosts.add(baseDomain(h));
  } catch {}
  seenSwfHosts.forEach(h => hosts.add(baseDomain(h)));
  const current = allowDomains();
  const added = [...hosts].filter(h => h && !current.includes(h));
  if (!added.length) {
    dialog.showMessageBox(win, { message: 'Các domain của trang này đã có trong danh sách cho phép.', detail: current.join('\n') });
    return;
  }
  saveConfig({ allowDomains: [...current, ...added] });
  writeMmsCfg();
  askRelaunch('Đã cho phép Flash trên: ' + added.join(', '));
}

async function editAllowList() {
  // Mở config.json để sửa tay "allowDomains"
  saveConfig({ allowDomains: allowDomains() });
  await shell.openPath(configPath());
  dialog.showMessageBox(win, {
    message: 'Sửa mục "allowDomains" trong config.json rồi lưu, sau đó mở lại app.',
    detail: 'Mỗi domain gốc một dòng, vd. "cmn.vn" (tự gồm cả các subdomain).',
  });
}

async function checkFlash() {
  const w = wc();
  if (!w) return;
  let info = '';
  try {
    info = await w.executeJavaScript(`(() => {
      const p = navigator.plugins['Shockwave Flash'];
      return p ? (p.name + ' — ' + p.description) : '';
    })()`);
  } catch {}
  dialog.showMessageBox(win, {
    type: info ? 'info' : 'warning',
    message: MODE === 'ruffle' ? 'Đang ở chế độ Ruffle (giả lập Flash)' : (info ? 'Flash Player đã nạp ✓' : 'Không thấy Flash Player trong navigator.plugins'),
    detail: [
      info && `navigator.plugins: ${info}${MODE === 'ruffle' ? ' (Ruffle giả lập)' : ''}`,
      `Chế độ: ${MODE === 'flash' ? 'Flash thật' : 'Ruffle'}`,
      `Plugin: ${FLASH_PATH || '(chưa có)'}`,
      FLASH_VERSION && `Version: ${FLASH_VERSION}`,
      `Kiến trúc Electron: ${process.arch}`,
      `mms.cfg: ${mmsCfgPath()}`,
      `Domain được phép: ${allowDomains().join(', ')}`,
      seenSwfHosts.size ? `Domain .swf đã thấy: ${[...seenSwfHosts].join(', ')}` : '',
    ].filter(Boolean).join('\n'),
  });
}

// ---------- cài plugin Flash (chọn file, kiểm tra chữ ký, chép vào userData/plugins) ----------
async function askForFlashPlugin() {
  if (!win) return;
  const { response } = await dialog.showMessageBox(win, {
    type: 'warning',
    message: 'Chưa có Flash Player (PepperFlashPlayer.plugin)',
    detail: 'App đang chạy tạm bằng Ruffle (không chơi được game online cần socket).\n\n' +
      'Chọn file PepperFlashPlayer.plugin (bản PPAPI, x64, 32.0.0.x) để cài. ' +
      'App chỉ nhận plugin có chữ ký hợp lệ của Adobe.',
    buttons: ['Chọn plugin…', 'Để sau'], defaultId: 0, cancelId: 1,
  });
  if (response === 0) choosePluginFile();
}

async function choosePluginFile() {
  const r = await dialog.showOpenDialog(win, {
    title: `Chọn ${PLUGIN_NAME}`,
    properties: ['openFile', 'openDirectory'],
    filters: [{ name: 'Pepper Flash', extensions: ['plugin'] }],
  });
  if (r.canceled || !r.filePaths[0]) return;
  let src = r.filePaths[0];
  // chọn nhầm thư mục chứa plugin (vd. .../PepperFlashPlayer/) thì tìm bên trong
  if (path.basename(src) !== PLUGIN_NAME && fs.existsSync(path.join(src, PLUGIN_NAME))) src = path.join(src, PLUGIN_NAME);
  const err = verifyFlashPlugin(src);
  if (err) {
    dialog.showMessageBox(win, { type: 'error', message: 'Không cài được plugin này', detail: `${src}\n\n${err}` });
    return;
  }
  try {
    if (path.resolve(src) !== path.resolve(userPluginPath())) installFlashPlugin(src);
  } catch (e) {
    dialog.showMessageBox(win, { type: 'error', message: 'Chép plugin bị lỗi', detail: String(e.message || e) });
    return;
  }
  saveConfig({ mode: 'flash' });
  const { response } = await dialog.showMessageBox(win, {
    type: 'info', message: `Đã cài Flash Player ${readFlashVersion(userPluginPath())} ✓`,
    detail: `Plugin nằm ở:\n${userPluginPath()}\n\nMở lại app để dùng Flash thật.`,
    buttons: ['Mở lại ngay', 'Để sau'], defaultId: 0, cancelId: 1,
  });
  if (response === 0) { app.relaunch(); app.exit(0); }
}

async function openSwfFile() {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'Flash', extensions: ['swf'] }] });
  if (!r.canceled && r.filePaths[0]) createTab(normalizeUrl(r.filePaths[0]), { index: tabs.indexOf(activeTab()) + 1 });
}

let menuTimer = null;
function scheduleMenu() {
  if (menuTimer) return;
  menuTimer = setTimeout(() => { menuTimer = null; if (winOk()) buildMenu(); }, 300);
}

function shorten(s, n = 60) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

function buildMenu() {
  const w = () => wc();
  const cfg = loadConfig();
  // 15 trang xem gần nhất (không lặp)
  const recent = [];
  const seen = new Set();
  const hist = loadHistory();
  for (let i = hist.length - 1; i >= 0 && recent.length < 15; i--) {
    if (seen.has(hist[i].url)) continue;
    seen.add(hist[i].url);
    recent.push(hist[i]);
  }
  const menu = Menu.buildFromTemplate([
    { label: app.name, submenu: [
      { role: 'about', label: 'Giới thiệu Wisp' },
      { type: 'separator' },
      { role: 'hide', label: 'Ẩn Wisp' },
      { role: 'hideOthers', label: 'Ẩn ứng dụng khác' },
      { type: 'separator' },
      { role: 'quit', label: 'Thoát Wisp' },
    ]},
    { label: 'Tệp', submenu: [
      { label: 'Tab mới', accelerator: 'Cmd+T', click: newTab },
      { label: 'Mở file .swf…', accelerator: 'Cmd+O', click: openSwfFile },
      { type: 'separator' },
      { label: 'Đóng tab', accelerator: 'Cmd+W', click: () => activeTab() && closeTab(activeId) },
      { label: 'Mở lại tab vừa đóng', accelerator: 'Shift+Cmd+T', click: reopenClosedTab },
    ]},
    { label: 'Sửa', submenu: [
      { role: 'undo', label: 'Hoàn tác' }, { role: 'redo', label: 'Làm lại' }, { type: 'separator' },
      { role: 'cut', label: 'Cắt' }, { role: 'copy', label: 'Sao chép' }, { role: 'paste', label: 'Dán' },
      { role: 'selectAll', label: 'Chọn tất cả' },
    ]},
    { label: 'Trang', submenu: [
      { label: 'Mở địa chỉ…', accelerator: 'Cmd+L', click: focusUrlBar },
      { label: 'Quay lại', accelerator: 'Cmd+[', click: () => w() && w().canGoBack() && w().goBack() },
      { label: 'Tiến tới', accelerator: 'Cmd+]', click: () => w() && w().canGoForward() && w().goForward() },
      { label: 'Tải lại', accelerator: 'Cmd+R', click: () => w() && w().reload() },
      { label: 'Toàn màn hình', accelerator: 'Ctrl+Cmd+F', click: () => win.setFullScreen(!win.isFullScreen()) },
      { label: 'Phóng to', accelerator: 'Cmd+=', click: () => w() && w().setZoomLevel(w().getZoomLevel() + 0.5) },
      { label: 'Thu nhỏ', accelerator: 'Cmd+-', click: () => w() && w().setZoomLevel(w().getZoomLevel() - 0.5) },
      { label: 'Cỡ gốc', accelerator: 'Cmd+0', click: () => w() && w().setZoomLevel(0) },
      { type: 'separator' },
      { label: 'Bảng kiểm tra (mạng, socket, console)', accelerator: 'Shift+Cmd+I', click: openInspector },
      { label: 'Công cụ nhà phát triển', accelerator: 'Alt+Cmd+I', click: () => w() && w().toggleDevTools() },
    ]},
    { label: 'Flash', submenu: [
      { label: 'Kiểm tra Flash Player', click: checkFlash },
      { label: FLASH_PATH ? 'Thay plugin Flash…' : 'Cài plugin Flash…', click: choosePluginFile },
      { label: 'Mở thư mục plugin', click: () => { const d = path.dirname(userPluginPath()); fs.mkdirSync(d, { recursive: true }); shell.openPath(d); } },
      { type: 'separator' },
      { label: 'Chế độ: Flash Player thật', type: 'radio', checked: wantedMode === 'flash', enabled: !!FLASH_PATH || wantedMode === 'flash', click: () => setMode('flash') },
      { label: 'Chế độ: Ruffle (dự phòng)', type: 'radio', checked: wantedMode === 'ruffle', click: () => setMode('ruffle') },
      { type: 'separator' },
      { label: 'Cho phép Flash trên trang này', accelerator: 'Shift+Cmd+A', enabled: MODE === 'flash', click: allowCurrentSite },
      { label: 'Sửa danh sách domain cho phép…', click: editAllowList },
      { label: 'Ghi log allowlist (gỡ lỗi)', type: 'checkbox', checked: !!cfg.flashDebug, click: (item) => { saveConfig({ flashDebug: item.checked }); writeMmsCfg(); askRelaunch(item.checked ? 'Đã bật log allowlist.' : 'Đã tắt log allowlist.'); } },
      { label: 'Mở thư mục mms.cfg', click: () => shell.showItemInFolder(mmsCfgPath()) },
    ]},
    { label: 'Lịch sử', submenu: [
      { label: 'Hiện toàn bộ lịch sử', accelerator: 'Cmd+Y', click: openHistory },
      { label: 'Xoá lịch sử…', accelerator: 'Shift+Cmd+Backspace', click: clearHistoryDialog },
      { type: 'separator' },
      { label: 'Xem gần đây', enabled: false },
      ...recent.map(h => ({ label: shorten(h.title || h.url), click: () => openUrl(h.url) })),
    ]},
    { label: 'Tab', submenu: [
      { label: 'Tab tiếp theo', accelerator: 'Ctrl+Tab', click: () => cycleTab(1) },
      { label: 'Tab trước', accelerator: 'Ctrl+Shift+Tab', click: () => cycleTab(-1) },
      { type: 'separator' },
      ...tabs.map((t, i) => ({
        label: shorten(tabInfo(t).title, 50), type: 'radio', checked: t.id === activeId,
        accelerator: i < 8 ? `Cmd+${i + 1}` : undefined, click: () => activateTab(t.id),
      })),
      ...(tabs.length > 8 ? [{ label: 'Tab cuối', accelerator: 'Cmd+9', click: () => activateTab(tabs[tabs.length - 1].id) }] : []),
    ]},
    { role: 'windowMenu', label: 'Cửa sổ' },
  ]);
  Menu.setApplicationMenu(menu);
}

// ---------- khởi động ----------
app.whenReady().then(() => {
  // Một số trang chặn UA có chữ "Electron" → bỏ đi cho giống Chrome thường
  app.userAgentFallback = app.userAgentFallback.replace(/\s?(Electron|wisp|flash-browser)\/\S+/gi, '');

  // Mỗi sự kiện webRequest chỉ gắn được một listener, nên ghi log HTTP, gom domain .swf
  // (gợi ý allowlist) và gỡ CSP cho Ruffle đều nằm chung trong installRequestLog.
  installRequestLog(session.defaultSession);

  if (MODE === 'flash') {
    writeMmsCfg();
  } else {
    // ruffle://local/<file>  → file Ruffle đóng gói sẵn (trang nào cũng tải được)
    // ruffle://file/<đường dẫn> → file .swf trên máy (Ruffle không đọc được file:// trực tiếp)
    const RUFFLE_DIR = path.dirname(require.resolve('@ruffle-rs/ruffle/ruffle.js'));
    const MIME = { '.wasm': 'application/wasm', '.js': 'text/javascript', '.map': 'application/json',
                   '.swf': 'application/x-shockwave-flash', '.html': 'text/html', '.xml': 'text/xml',
                   '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.txt': 'text/plain' };
    protocol.registerBufferProtocol('ruffle', (req, cb) => {
      try {
        const u = new URL(req.url);
        let file, headers = {};
        if (u.hostname === 'local') {
          file = path.join(RUFFLE_DIR, path.basename(u.pathname));
          headers = { 'Access-Control-Allow-Origin': '*' };
        } else if (u.hostname === 'file') {
          // không gắn CORS: trang web bên ngoài không đọc trộm được file trên máy
          file = u.pathname === PLAYER_PATH ? path.join(__dirname, 'player.html') : decodeURIComponent(u.pathname);
        }
        if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) return cb({ error: -6 });
        cb({ mimeType: MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', headers, data: fs.readFileSync(file) });
      } catch { cb({ error: -2 }); }
    });
  }

  createWindow();
  if (process.env.WISP_INSPECT) openInspector();
});

// Mở file .swf bằng cách kéo thả vào icon app trên Dock / "Open With"
app.on('open-file', (e, file) => {
  e.preventDefault();
  if (app.isReady() && winOk()) createTab(normalizeUrl(file), { index: tabs.indexOf(activeTab()) + 1 });
  else pendingFile = file;
});

app.on('before-quit', saveHistoryNow);
app.on('window-all-closed', () => app.quit());
