// Wisp — trình duyệt chạy Electron 11 + Flash Player thật (Pepper Flash / PPAPI).
// Chế độ dự phòng: Ruffle (giả lập Flash bằng WebAssembly), giống bản 1.
// Electron 12 trở lên đã bỏ Pepper Flash, nên app phải ở Electron 11.x (x64).
const { app, BrowserWindow, BrowserView, protocol, session, ipcMain, Menu, dialog, shell, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const net = require('net');
const { execFile, execFileSync, spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const updater = require('./updater');
const flashWin = require('./flash-win');

const IS_MAC = process.platform === 'darwin';
const IS_WIN = process.platform === 'win32';

// ====== ĐỔI ĐỊA CHỈ TRANG MẶC ĐỊNH Ở ĐÂY (hoặc bấm "★ Đặt làm trang chủ") ======
const DEFAULT_URL = 'https://bangbang.cmn.vn/';
// Domain được phép chạy Flash thật (ghi vào mms.cfg). Thêm domain của game ở đây
// hoặc dùng menu Flash → "Cho phép Flash trên trang này".
const DEFAULT_ALLOW = ['cmn.vn', 'cf4vn.bar'];
// =================================================================================

const TOOLBAR_HEIGHT = 80; // thanh tab (36) + thanh địa chỉ (44)
// macOS: thư mục PepperFlashPlayer.plugin; Windows: một file pepflashplayer.dll (bản 64-bit)
const PLUGIN_NAME = IS_WIN ? flashWin.PLUGIN_FILE : 'PepperFlashPlayer.plugin';

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

// Chỉ chạy một Wisp cho mỗi thư mục dữ liệu (khoá theo userData, nên bản dev có WISP_USER_DATA riêng vẫn chạy song song)
const SECOND_INSTANCE = !app.requestSingleInstanceLock();
if (SECOND_INSTANCE) app.quit();

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
  const candidates = IS_WIN ? [
    userPluginPath(),
    bundledPluginPath(),
    ...flashWin.systemPlugins(),
  ] : [
    userPluginPath(),
    bundledPluginPath(),
    path.join('/Library/Internet Plug-Ins/PepperFlashPlayer', PLUGIN_NAME),
    path.join(app.getPath('home'), 'Library/Internet Plug-Ins/PepperFlashPlayer', PLUGIN_NAME),
  ];
  return candidates.find(p => fs.existsSync(p)) || null;
}

// Kiểm tra plugin là bản thật của Adobe: chữ ký hợp lệ + đúng Team ID của Adobe + có bản x86_64
// (Windows: chữ ký Authenticode của Adobe + bản 64-bit, xem flash-win.js). Trả về Promise.
async function verifyFlashPlugin(p) {
  if (IS_WIN) return flashWin.verifyDll(p);
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
function installFlashPlugin(src, version) {
  const dest = userPluginPath();
  const tmp = dest + '.tmp';
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (IS_WIN) {
    fs.copyFileSync(src, tmp);
    fs.renameSync(tmp, dest);
    // ghi version cạnh plugin để lúc khởi động khỏi đọc cả file .dll 32 MB
    const v = version || flashWin.versionOf(src);
    if (v) fs.writeFileSync(dest.replace(/\.dll$/i, '.json'), JSON.stringify({ version: v }));
    return dest;
  }
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
  if (IS_WIN) return flashWin.versionOf(pluginPath) || '32.0.0.465';
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
    // Chỉ kiểm tra SWF gốc. Không có dòng này, Flash kiểm tra cả SWF con, request
    // và socket: mẫu "*://domain/" không khớp URL có cổng (xmlsocket://game.cf4vn.bar:49119)
    // → Flash lặng lẽ không nối tới máy chủ game → game báo 登陆超时.
    'AllowListRootMovieOnly=1',
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
  if ((u.startsWith('/') || (IS_WIN && /^[a-z]:[\\/]|^\\\\/i.test(u))) && fs.existsSync(u)) u = pathToFileURL(u).href;
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
           loading: !w.isDestroyed() && w.isLoading(), history: isHistoryUrl(w.isDestroyed() ? '' : w.getURL()),
           audible: !!t.audible, muted: !!t.muted };
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
    if (loadConfig().restoreTabs !== false) saveSession();
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
  const t = { id: ++tabSeq, view, title: '', favicon: '', htmlFull: false, hist: null, audible: false, muted: false };
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
    { label: t.muted ? 'Bật tiếng tab' : 'Tắt tiếng tab', click: () => toggleMute(id) },
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
  const pendingFileUsed = !!pendingFile;
  pendingFile = null;

  // Cửa sổ chính chứa thanh tab + thanh công cụ; trang web nằm trong BrowserView bên dưới
  win = new BrowserWindow({
    width: 1280, height: 820, title: 'Wisp', backgroundColor: '#2b2d31', autoHideMenuBar: !IS_MAC,
    webPreferences: { preload: path.join(__dirname, 'toolbar-preload.js'), contextIsolation: true, nodeIntegration: false, worldSafeExecuteJavaScript: true },
  });
  win.loadFile(path.join(__dirname, 'toolbar.html'));
  win.on('resize', layout);
  // Nhớ tab trước khi cửa sổ đóng (sau 'closed' danh sách tab đã bị xoá)
  win.on('close', () => { if (loadConfig().restoreTabs !== false) saveSession(); });
  win.on('closed', () => {
    // BrowserView không tự huỷ theo cửa sổ → DevTools (detach) của tab vẫn còn,
    // Bảng kiểm tra cũng là cửa sổ riêng → đóng hết để app thoát hẳn
    tabs.forEach(t => {
      try { const w = t.view.webContents; if (!w.isDestroyed()) { w.closeDevTools(); w.destroy(); } } catch {}
    });
    win = null; tabs = []; activeId = null;
    if (inspectorOpen()) inspectWin.close();
    closeMenuPopup();
  });

  buildMenu();
  const cfg = loadConfig();
  const explicit = process.env.FLASH_URL || argUrl || pendingFileUsed;
  const saved = cfg.session && Array.isArray(cfg.session.tabs) ? cfg.session.tabs.map(normalizeUrl).filter(Boolean) : [];
  if (!explicit && cfg.restoreTabs !== false && saved.length) {
    // mở lại các tab lần trước
    saved.forEach((u) => createTab(u, { activate: false }));
    activateTab(tabs[Math.min(cfg.session.active || 0, tabs.length - 1)].id);
  } else createTab(startUrl);
  startPerf();

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
  else if (action === 'update') { updater.promptUpdate(true); }
  else if (action === 'flash') { if (MODE !== 'flash') askForFlashPlugin(); else checkFlash(); }
});
ipcMain.on('menu', (e, x, y) => { if (winOk() && e.sender === win.webContents) showMainMenu(x, y); });
ipcMain.on('open-inspector', (e, tab) => { if (winOk() && e.sender === win.webContents) openInspector(tab); });
ipcMain.on('tab', (e, action, id) => {
  if (!winOk() || e.sender !== win.webContents) return;
  if (action === 'new') newTab();
  else if (action === 'close') closeTab(id);
  else if (action === 'switch') activateTab(id);
  else if (action === 'menu') tabMenu(id);
  else if (action === 'mute') toggleMute(id);
});
ipcMain.on('ready', () => { sendState(); sendTabs(); if (winOk()) win.webContents.send('update', updater.state()); });

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

// ----- socket TCP: lsof / netstat trên mọi tiến trình của app (Flash nối qua tiến trình network) -----
function procTypes() {
  const m = new Map();
  // dùng số liệu của perfTick: gọi getAppMetrics ở đây sẽ làm sai % CPU
  const list = lastProcs.length ? lastProcs : app.getAppMetrics().map(p => ({ pid: p.pid, name: p.serviceName || p.name, type: p.type }));
  for (const p of list) if (p.pid !== process.pid) m.set(p.pid, p.name || p.type);
  return m;
}

// Các kết nối TCP (không tính LISTEN) của những tiến trình pids → [{ pid, fd, name: "local->remote", state }]
// macOS: lsof; Windows: netstat -ano (không có fd, mỗi kết nối nhận diện bằng cặp địa chỉ)
function readSockets(pids, cb) {
  if (IS_WIN) {
    execFile('netstat', ['-ano'], { timeout: 4000, windowsHide: true, maxBuffer: 16 << 20 }, (_err, out) => {
      const want = new Set(pids);
      const list = [];
      for (const line of String(out || '').split(/\r?\n/)) {
        const c = line.trim().split(/\s+/);
        if (c.length < 5 || c[0].toUpperCase() !== 'TCP') continue;
        // TCP  <local>  <remote>  <trạng thái>  <PID>
        const pid = Number(c[4]);
        if (!want.has(pid) || /:0$/.test(c[2])) continue; // remote :0 = đang LISTEN
        list.push({ pid, fd: '', name: `${c[1]}->${c[2]}`, state: c[3] });
      }
      cb(list);
    });
    return;
  }
  execFile('lsof', ['-nP', '-a', '-iTCP', '-p', pids.join(','), '-F', 'pfnT'], { timeout: 4000 }, (_err, out) => {
    // lsof thoát mã 1 khi không có kết nối nào → vẫn xử lý như danh sách rỗng
    const list = [];
    let pid = 0, cur = null;
    const commit = () => { if (cur && cur.name && cur.name.includes('->')) list.push({ pid, ...cur }); cur = null; }; // bỏ socket đang LISTEN
    for (const line of String(out || '').split('\n')) {
      const t = line[0], v = line.slice(1);
      if (t === 'p') { commit(); pid = Number(v); }
      else if (t === 'f') { commit(); cur = { fd: v, name: '', state: '' }; }
      else if (t === 'n' && cur) cur.name = v;
      else if (t === 'T' && cur && v.startsWith('ST=')) cur.state = v.slice(3);
    }
    commit();
    cb(list);
  });
}

function pollSockets() {
  if (sockBusy) return;
  const types = procTypes();
  const pids = [...types.keys()];
  if (!pids.length) return;
  sockBusy = true;
  readSockets(pids, (list) => {
    sockBusy = false;
    const now = Date.now();
    const seen = new Set();
    for (const cur of list) {
      const pid = cur.pid;
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
    }
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

// Luôn đọc mỗi 2s (để biết máy chủ game mà đo ping); mở Bảng kiểm tra thì đọc mỗi 0,4s
function startSocketWatch() {
  clearInterval(sockTimer);
  pollSockets();
  // netstat trên Windows chậm hơn lsof (đọc cả máy) → 1s khi bảng đang mở
  sockTimer = setInterval(pollSockets, inspectorOpen() ? (IS_WIN ? 1000 : 400) : 2000);
}
function stopSocketWatch() { startSocketWatch(); }

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

function openInspector(tab) {
  if (inspectorOpen()) {
    inspectWin.show(); inspectWin.focus();
    if (tab) inspectWin.webContents.send('inspect:tab', tab);
    return;
  }
  inspectWin = new BrowserWindow({
    width: 1100, height: 700, minWidth: 720, minHeight: 420, title: 'Bảng kiểm tra — Wisp', backgroundColor: '#1e1f22',
    webPreferences: { preload: path.join(__dirname, 'inspect-preload.js'), contextIsolation: true, nodeIntegration: false, worldSafeExecuteJavaScript: true },
  });
  inspectWin.loadFile(path.join(__dirname, 'inspect.html'), tab ? { hash: tab } : undefined);
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
ipcMain.handle('inspect:perf', () => perfPayload());
ipcMain.handle('inspect:shots', () => { fs.mkdirSync(shotsDir(), { recursive: true }); shell.openPath(shotsDir()); });
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
  const report = { createdAt: new Date().toISOString(), info: await flashInfo(), perf: perfPayload(),
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

// ---------- cài plugin Flash ----------
// Adobe đã gỡ bản cài khỏi trang của họ; archive.org còn giữ bản cuối (32.0.0.465, PPAPI, macOS).
// App không chạy bộ cài của Adobe: chỉ mở gói (.dmg → .app → .pkg → payload LZMA) để lấy
// PepperFlashPlayer.plugin, kiểm tra chữ ký Adobe rồi chép vào userData/plugins.
// Windows: bộ cài PPAPI bản đầy đủ (offline) 32.0.0.465; app tách pepflashplayer64 khỏi tài nguyên của .exe.
const FLASH_DOWNLOAD = IS_WIN ? {
  url: 'https://archive.org/download/adobe-flash-player-ppapi-32.0.0.465/Adobe%20Flash%20Player%20%28PPAPI%29%2032.0.0.465.exe',
  page: 'https://archive.org/details/adobe-flash-player-ppapi-32.0.0.465',
  md5: '80b45a47f1055a1d1381b708f4c372e1',
  file: 'install_flash_player_32_ppapi.exe',
  size: '~21 MB',
} : {
  url: 'https://archive.org/download/adobe-flash-player-archive_202012/install_flash_player_osx_ppapi.dmg',
  page: 'https://archive.org/details/adobe-flash-player-archive_202012',
  md5: '01276b441efca664141d42dc9680a2be',
  file: 'install_flash_player_osx_ppapi.dmg',
  size: '~15 MB',
};
const { promisify } = require('util');
const execFileP = promisify(execFile);
let flashInstalling = false;

function progress(text, fraction) {
  if (!winOk()) return;
  toast(text);
  win.setProgressBar(fraction == null ? -1 : fraction);
}

async function askForFlashPlugin() {
  if (!winOk() || flashInstalling) return;
  const { response } = await dialog.showMessageBox(win, {
    type: FLASH_PATH ? 'question' : 'warning',
    message: FLASH_PATH ? `Cài lại / thay Flash Player (đang dùng ${FLASH_VERSION})` : 'Chưa có Flash Player',
    detail: (FLASH_PATH ? '' : 'App đang chạy tạm bằng Ruffle (không chơi được game online cần socket).\n\n') +
      `• Tải và cài tự động: tải bản 32.0.0.465 (PPAPI) từ archive.org, ${FLASH_DOWNLOAD.size}, rồi tự cài.\n` +
      (IS_WIN
        ? '• Chọn file đã tải: bộ cài Adobe Flash Player PPAPI (.exe), file .zip, hoặc pepflashplayer64_32_0_0_xxx.dll — app tự tách plugin ra và cài.\n\n'
        : '• Chọn file đã tải: file .dmg / .pkg / .zip của bộ cài Adobe, hoặc PepperFlashPlayer.plugin — app tự tách plugin ra và cài.\n\n') +
      'App chỉ nhận plugin có chữ ký hợp lệ của Adobe, và không chạy bộ cài của Adobe.',
    buttons: ['Tải và cài tự động', 'Chọn file đã tải…', 'Mở trang tải', 'Để sau'], defaultId: 0, cancelId: 3,
  });
  if (response === 0) downloadFlashPlugin();
  else if (response === 1) choosePluginFile();
  else if (response === 2) shell.openExternal(FLASH_DOWNLOAD.page);
}

// Tải file (theo chuyển hướng), báo tiến độ, kiểm tra MD5
function downloadFile(url, dest, onProgress, redirects = 0) {
  const https = require('https');
  const crypto = require('crypto');
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Wisp' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        if (redirects > 5) return reject(new Error('Chuyển hướng quá nhiều lần'));
        return resolve(downloadFile(new URL(res.headers.location, url).href, dest, onProgress, redirects + 1));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('Máy chủ trả về HTTP ' + res.statusCode)); }
      const total = Number(res.headers['content-length']) || 0;
      const hash = crypto.createHash('md5');
      const out = fs.createWriteStream(dest);
      let got = 0;
      res.on('data', (c) => { got += c.length; hash.update(c); if (total) onProgress(got / total); });
      res.pipe(out);
      out.on('finish', () => resolve(hash.digest('hex')));
      out.on('error', reject);
      res.on('error', reject);
    });
    req.setTimeout(30000, () => req.destroy(new Error('Hết thời gian chờ (30s)')));
    req.on('error', reject);
  });
}

async function downloadFlashPlugin() {
  if (flashInstalling) return;
  flashInstalling = true;
  const tmp = fs.mkdtempSync(path.join(app.getPath('temp'), 'wisp-flash-'));
  try {
    const file = path.join(tmp, FLASH_DOWNLOAD.file);
    progress('Đang tải Flash Player…', 0);
    let last = 0;
    const md5 = await downloadFile(FLASH_DOWNLOAD.url, file, (f) => {
      const pct = Math.floor(f * 100);
      if (pct >= last + 5) { last = pct; progress(`Đang tải Flash Player… ${pct}%`, f); }
    });
    if (md5 !== FLASH_DOWNLOAD.md5) throw new Error(`File tải về không đúng (MD5 ${md5}, cần ${FLASH_DOWNLOAD.md5}). Thử lại sau, hoặc tải tay rồi chọn file.`);
    addLog('info', 'event', 'Đã tải bộ cài Flash Player, MD5 khớp');
    flashInstalling = false;
    await installFromFile(file);
  } catch (e) {
    if (winOk()) win.setProgressBar(-1);
    addLog('error', 'event', 'Tải Flash Player lỗi: ' + e.message);
    const { response } = await dialog.showMessageBox(win, {
      type: 'error', message: 'Không tải được Flash Player', detail: String(e.message || e),
      buttons: ['Mở trang tải', 'Chọn file đã tải…', 'Đóng'], defaultId: 0, cancelId: 2,
    });
    if (response === 0) shell.openExternal(FLASH_DOWNLOAD.page);
    else if (response === 1) choosePluginFile();
  } finally {
    flashInstalling = false;
    try { fs.rmdirSync(tmp, { recursive: true }); } catch {}
  }
}

async function choosePluginFile() {
  // Windows: hộp thoại không chọn được cả file lẫn thư mục cùng lúc → chỉ chọn file
  const r = await dialog.showOpenDialog(win, IS_WIN ? {
    title: 'Chọn bộ cài Flash Player (PPAPI) hoặc pepflashplayer64.dll',
    defaultPath: app.getPath('downloads'),
    properties: ['openFile'],
    filters: [{ name: 'Flash Player', extensions: ['exe', 'dll', 'zip'] }],
  } : {
    title: 'Chọn bộ cài Flash Player hoặc PepperFlashPlayer.plugin',
    message: 'Chọn file .dmg / .pkg / .zip của bộ cài Adobe Pepper Flash, hoặc PepperFlashPlayer.plugin',
    defaultPath: app.getPath('downloads'),
    properties: ['openFile', 'openDirectory', 'treatPackageAsDirectory'],
    filters: [{ name: 'Flash Player', extensions: ['plugin', 'dmg', 'pkg', 'zip', 'app', 'lzma'] }],
  });
  if (r.canceled || !r.filePaths[0]) return;
  await installFromFile(r.filePaths[0]);
}

// Từ file người dùng chọn (hoặc vừa tải) → tìm plugin → kiểm tra → cài → hỏi mở lại
async function installFromFile(src) {
  if (flashInstalling) return;
  flashInstalling = true;
  const work = fs.mkdtempSync(path.join(app.getPath('temp'), 'wisp-flash-x-'));
  const mounts = [];
  let plugin = null;
  try {
    progress('Đang tìm Flash Player trong file…');
    plugin = IS_WIN ? await findPluginWin(src, work, 0) : await findPluginIn(src, work, mounts, 0);
    if (!plugin) {
      throw new Error(IS_WIN
        ? 'Không tìm thấy pepflashplayer64.dll trong file này.\nCần bộ cài "Adobe Flash Player for Opera and Chromium – PPAPI" cho Windows (bản đầy đủ, ~21 MB; bản cài online ~1 MB không dùng được).'
        : 'Không tìm thấy PepperFlashPlayer.plugin trong file này.\nCần bộ cài "Adobe Flash Player for Opera and Chromium – PPAPI" cho macOS (install_flash_player_osx_ppapi.dmg).');
    }
    progress('Đang kiểm tra chữ ký của Adobe…');
    const err = await verifyFlashPlugin(plugin);
    if (err) throw new Error(err);
    if (path.resolve(plugin) !== path.resolve(userPluginPath())) installFlashPlugin(plugin);
  } catch (e) {
    if (winOk()) win.setProgressBar(-1);
    addLog('error', 'event', 'Cài Flash Player lỗi: ' + e.message);
    dialog.showMessageBox(win, { type: 'error', message: 'Không cài được Flash Player', detail: `${src}\n\n${e.message || e}` });
    return;
  } finally {
    for (const m of mounts.reverse()) { try { await execFileP('/usr/bin/hdiutil', ['detach', m, '-quiet', '-force']); } catch {} }
    try { fs.rmdirSync(work, { recursive: true }); } catch {}
    flashInstalling = false;
  }
  if (winOk()) win.setProgressBar(-1);
  saveConfig({ mode: 'flash' });
  const ver = readFlashVersion(userPluginPath());
  addLog('info', 'event', `Đã cài Flash Player ${ver} vào ${userPluginPath()}`);
  const { response } = await dialog.showMessageBox(win, {
    type: 'info', message: `Đã cài Flash Player ${ver} ✓`,
    detail: `Plugin nằm ở:\n${userPluginPath()}\n\nMở lại app để dùng Flash thật.`,
    buttons: ['Mở lại ngay', 'Để sau'], defaultId: 0, cancelId: 1,
  });
  if (response === 0) relaunch();
}

// Windows: tìm pepflashplayer64.dll trong file .dll / bộ cài .exe của Adobe / .zip / thư mục
const WIN_DLL = /^pepflashplayer(64)?(_[\d_]+)?\.dll$/i; // không nhận pepflashplayer32_… (bản 32-bit)
async function findPluginWin(p, work, depth) {
  if (depth > 4 || !fs.existsSync(p)) return null;
  const st = fs.statSync(p);
  const ext = path.extname(p).toLowerCase();
  if (st.isFile() && ext === '.dll') return p;
  if (st.isFile() && ext === '.exe') {
    progress('Đang tách Flash Player khỏi bộ cài (khoảng 20–60 giây)…');
    if (winOk()) win.setProgressBar(2);
    const out = path.join(fs.mkdtempSync(path.join(work, 'x')), PLUGIN_NAME);
    const r = await extractWinInstaller(p, out);
    if (r.error === 'notfound') return null;
    if (r.error) throw new Error(r.error);
    if (r.version) fs.writeFileSync(out.replace(/\.dll$/i, '.json'), JSON.stringify({ version: r.version }));
    return out;
  }
  if (st.isFile() && ext === '.zip') {
    const out = fs.mkdtempSync(path.join(work, 'x'));
    await flashWin.unzip(p, out);
    return findPluginWin(out, work, depth + 1);
  }
  if (!st.isDirectory()) return null;
  const found = { dll: [], nested: [] };
  const walk = (dir, d) => {
    if (d > 6) return;
    let list = [];
    try { list = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of list) {
      const f = path.join(dir, e.name);
      if (e.isFile() && WIN_DLL.test(e.name)) found.dll.push(f);
      else if (e.isFile() && /\.(exe|zip)$/i.test(e.name)) found.nested.push(f);
      else if (e.isDirectory()) walk(f, d + 1);
    }
  };
  walk(p, 0);
  found.dll.sort((a, b) => /64/.test(path.basename(b)) - /64/.test(path.basename(a)));
  for (const f of [...found.dll, ...found.nested]) {
    const r = await findPluginWin(f, work, depth + 1);
    if (r) return r;
  }
  return null;
}

// Tách DLL trong tiến trình riêng (flash-win.js chạy bằng Node của Electron): tốn vài GB RAM tạm thời
function extractWinInstaller(src, dest) {
  return new Promise((resolve) => {
    execFile(process.execPath, [path.join(__dirname, 'flash-win.js'), src, dest],
      { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, timeout: 5 * 60000, maxBuffer: 1 << 20, windowsHide: true },
      (err, out) => {
        try { return resolve(JSON.parse(String(out))); } catch {}
        resolve({ error: 'Tách plugin lỗi: ' + (err ? err.message : 'không rõ') });
      });
  });
}

// Tìm PepperFlashPlayer.plugin: mở .dmg, giải nén .pkg / .zip, giải mã payload .lzma của Adobe
async function findPluginIn(p, work, mounts, depth) {
  if (depth > 6 || !fs.existsSync(p)) return null;
  const base = path.basename(p);
  const ext = path.extname(p).toLowerCase();
  const st = fs.statSync(p);
  const sub = () => fs.mkdtempSync(path.join(work, 'x'));

  if (base === PLUGIN_NAME && st.isDirectory()) return p;
  if (base === PLUGIN_NAME + '.lzma' && st.isFile()) {
    progress('Đang giải nén Flash Player (khoảng 10 giây)…');
    return extractAdobeLzma(p, path.join(sub(), PLUGIN_NAME));
  }
  if (st.isFile() && ext === '.dmg') {
    const mnt = sub();
    await execFileP('/usr/bin/hdiutil', ['attach', p, '-nobrowse', '-readonly', '-noautoopen', '-mountpoint', mnt]);
    mounts.push(mnt);
    return findPluginIn(mnt, work, mounts, depth + 1);
  }
  if (st.isFile() && ext === '.pkg') {
    // pkgutil chỉ giải nén, không chạy script cài đặt
    const out = path.join(sub(), 'pkg');
    await execFileP('/usr/sbin/pkgutil', ['--expand-full', p, out]);
    return findPluginIn(out, work, mounts, depth + 1);
  }
  if (st.isFile() && ext === '.zip') {
    const out = sub();
    await execFileP('/usr/bin/ditto', ['-x', '-k', p, out]);
    return findPluginIn(out, work, mounts, depth + 1);
  }
  if (!st.isDirectory()) return null;

  // duyệt thư mục: ưu tiên plugin có sẵn, rồi tới payload .lzma, rồi tới gói lồng bên trong
  const found = { plugin: [], lzma: [], nested: [] };
  const walk = (dir, d) => {
    if (d > 8) return;
    let list = [];
    try { list = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of list) {
      const f = path.join(dir, e.name);
      if (e.isSymbolicLink()) continue;
      if (e.name === PLUGIN_NAME && e.isDirectory()) { found.plugin.push(f); continue; }
      if (e.name === PLUGIN_NAME + '.lzma') { found.lzma.push(f); continue; }
      const x = path.extname(e.name).toLowerCase();
      // .pkg dạng file thì cần giải nén; dạng thư mục (gói đã mở sẵn) thì duyệt vào như thư mục thường
      if (e.isFile() && ['.pkg', '.dmg', '.zip'].includes(x)) { found.nested.push(f); continue; }
      if (e.isDirectory()) walk(f, d + 1);
    }
  };
  walk(p, 0);
  for (const f of [...found.plugin, ...found.lzma, ...found.nested]) {
    const r = await findPluginIn(f, work, mounts, depth + 1);
    if (r) return r;
  }
  return null;
}

// Payload của bộ cài Adobe: 11 byte đầu riêng (byte 7–10: kích thước sau giải nén, big-endian),
// tiếp theo là luồng LZMA (5 byte thuộc tính + dữ liệu). Sau giải nén là cây thư mục:
// mỗi mục = [loại][cờ: 0x80 = thư mục][độ dài tên][tên][kích thước nội dung, 4 byte big-endian][nội dung].
async function extractAdobeLzma(file, dest) {
  const b = await flashWin.decodeAdobeLzma(fs.readFileSync(file));
  const writeTree = (pos, end, dir) => {
    while (pos < end) {
      const flag = b[pos + 1], nlen = b[pos + 2];
      const name = b.toString('utf8', pos + 3, pos + 3 + nlen);
      if (name.includes('/') || name === '..' || name === '.') throw new Error('Tên mục không hợp lệ: ' + name);
      const len = b.readUInt32BE(pos + 3 + nlen);
      const body = pos + 3 + nlen + 4;
      if (body + len > end) throw new Error('Payload bị cắt cụt');
      const target = name ? path.join(dir, name) : dir;
      if (flag & 0x80) {
        fs.mkdirSync(target, { recursive: true });
        writeTree(body, body + len, target);
      } else {
        fs.writeFileSync(target, b.subarray(body, body + len));
        // file chạy được nằm trong Contents/MacOS
        fs.chmodSync(target, path.basename(dir) === 'MacOS' ? 0o755 : 0o644);
      }
      pos = body + len;
    }
  };
  writeTree(0, b.length, dest);
  return dest;
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

// ----- các thao tác trên trang hiện tại -----
function zoomBy(step) { const w = wc(); if (w) w.setZoomLevel(step === 0 ? 0 : w.getZoomLevel() + step); }
function zoomPercent() { const w = wc(); return w ? Math.round(100 * Math.pow(1.2, w.getZoomLevel())) : 100; }
function toggleFullScreen() { if (winOk()) win.setFullScreen(!win.isFullScreen()); }
function hardReload() { const w = wc(); if (w) w.reloadIgnoringCache(); }
async function clearCacheReload() {
  await session.defaultSession.clearCache();
  addLog('info', 'event', 'Đã xoá cache HTTP, tải lại trang không dùng cache');
  hardReload();
  toast('Đã xoá cache, đang tải lại');
}
function setHomeHere() {
  const w = wc();
  if (!w) return;
  saveConfig({ url: w.getURL() });
  toast('Đã đặt trang này làm trang chủ');
}
function shotsDir() { return path.join(app.getPath('pictures'), 'Wisp'); }
async function screenshotTab() {
  const w = wc();
  if (!w) return;
  try {
    const img = await w.capturePage();
    const d = new Date();
    const stamp = `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
    fs.mkdirSync(shotsDir(), { recursive: true });
    const file = path.join(shotsDir(), `wisp-${stamp}.png`);
    fs.writeFileSync(file, img.toPNG());
    clipboard.writeImage(img);
    addLog('info', 'event', 'Đã chụp màn hình: ' + file);
    toast('Đã lưu ảnh vào Ảnh/Wisp và chép vào clipboard');
  } catch (e) { toast('Không chụp được: ' + e.message); }
}
function pad2(n) { return String(n).padStart(2, '0'); }
function toast(text) { if (winOk()) win.webContents.send('toast', text); }

function recentHistory(n = 15) {
  const recent = [];
  const seen = new Set();
  const hist = loadHistory();
  for (let i = hist.length - 1; i >= 0 && recent.length < n; i--) {
    if (seen.has(hist[i].url)) continue;
    seen.add(hist[i].url);
    recent.push(hist[i]);
  }
  return recent;
}

function historySubmenu() {
  const recent = recentHistory();
  return [
    { label: 'Hiện toàn bộ lịch sử', accelerator: IS_MAC ? 'Cmd+Y' : 'Ctrl+H', click: openHistory },
    { label: 'Xoá lịch sử…', accelerator: IS_MAC ? 'Shift+Cmd+Backspace' : 'Ctrl+Shift+Delete', click: clearHistoryDialog },
    { type: 'separator' },
    { label: recent.length ? 'Xem gần đây' : 'Chưa có lịch sử', enabled: false },
    ...recent.map(h => ({ label: shorten(h.title || h.url), click: () => openUrl(h.url) })),
  ];
}

function flashSubmenu() {
  const cfg = loadConfig();
  return [
    { label: 'Kiểm tra Flash Player', click: checkFlash },
    { label: FLASH_PATH ? 'Cài lại / thay Flash Player…' : 'Cài Flash Player…', click: askForFlashPlugin },
    { label: 'Chọn file Flash Player đã tải…', click: choosePluginFile },
    { label: 'Mở thư mục plugin', click: () => { const d = path.dirname(userPluginPath()); fs.mkdirSync(d, { recursive: true }); shell.openPath(d); } },
    { type: 'separator' },
    { label: 'Chế độ: Flash Player thật', type: 'radio', checked: wantedMode === 'flash', enabled: !!FLASH_PATH || wantedMode === 'flash', click: () => setMode('flash') },
    { label: 'Chế độ: Ruffle (dự phòng)', type: 'radio', checked: wantedMode === 'ruffle', click: () => setMode('ruffle') },
    { type: 'separator' },
    { label: 'Cho phép Flash trên trang này', accelerator: 'Shift+CmdOrCtrl+A', enabled: MODE === 'flash', click: allowCurrentSite },
    { label: 'Sửa danh sách domain cho phép…', click: editAllowList },
    { label: 'Ghi log allowlist (gỡ lỗi)', type: 'checkbox', checked: !!cfg.flashDebug, click: (item) => { saveConfig({ flashDebug: item.checked }); writeMmsCfg(); askRelaunch(item.checked ? 'Đã bật log allowlist.' : 'Đã tắt log allowlist.'); } },
    { label: 'Mở thư mục mms.cfg', click: () => shell.showItemInFolder(mmsCfgPath()) },
  ];
}

function optionsSubmenu() {
  const cfg = loadConfig();
  return [
    { label: 'Mở lại các tab lần trước khi mở app', type: 'checkbox', checked: cfg.restoreTabs !== false,
      click: (item) => { saveConfig({ restoreTabs: item.checked }); saveSession(true); } },
    { label: IS_MAC ? 'Chống App Nap (game không bị chậm khi ẩn cửa sổ)' : 'Không cho máy ngủ khi đang mở Wisp', type: 'checkbox', checked: cfg.preventAppNap !== false,
      click: (item) => { saveConfig({ preventAppNap: item.checked }); applyAppNap(); } },
    { label: 'Theo dõi ping máy chủ game', type: 'checkbox', checked: cfg.pingGame !== false,
      click: (item) => { saveConfig({ pingGame: item.checked }); if (!item.checked) pingTargets.clear(); } },
  ];
}

// ---------- menu ⋮ (bảng xổ xuống tự vẽ: menu.html trong cửa sổ con không viền) ----------
// Menu hệ thống của macOS không tô màu / đặt công tắc được, nên dùng cửa sổ HTML riêng.
const MENU_W = 340;
let menuWin = null;
let menuClosedAt = 0;

function menuOpen() { return menuWin && !menuWin.isDestroyed(); }
function closeMenuPopup() { if (menuOpen()) menuWin.close(); }

function showMainMenu(x, y) {
  if (!winOk()) return;
  if (menuOpen()) { closeMenuPopup(); return; }
  // bấm ⋮ lúc menu đang mở: menu tự đóng vì mất focus ngay trước cú bấm → đừng mở lại
  if (Date.now() - menuClosedAt < 250) return;
  const cb = win.getContentBounds();
  menuWin = new BrowserWindow({
    parent: win, x: Math.round(cb.x + x - MENU_W), y: Math.round(cb.y + y), width: MENU_W, height: 120,
    frame: false, transparent: true, resizable: false, movable: false, minimizable: false, maximizable: false,
    fullscreenable: false, skipTaskbar: true, hasShadow: false, show: false, backgroundColor: '#00000000',
    webPreferences: { preload: path.join(__dirname, 'menu-preload.js'), contextIsolation: true, nodeIntegration: false, worldSafeExecuteJavaScript: true },
  });
  menuWin.loadFile(path.join(__dirname, 'menu.html'));
  menuWin.on('blur', closeMenuPopup);
  menuWin.on('closed', () => {
    menuWin = null;
    menuClosedAt = Date.now();
    if (winOk()) win.webContents.send('menu-closed');
  });
}

function menuState() {
  const w = wc();
  const t = activeTab();
  const cfg = loadConfig();
  return {
    hasTab: !!w, zoom: zoomPercent(), muted: !!(t && t.muted), canReopen: closedTabs.length > 0,
    fullScreen: winOk() && win.isFullScreen(),
    recent: recentHistory(4).map(h => ({ title: h.title || h.url, url: h.url, host: (() => { try { return new URL(h.url).host || 'file'; } catch { return ''; } })() })),
    ping: pingSummary(),
    mode: MODE, wantedMode, hasPlugin: !!FLASH_PATH, version: FLASH_VERSION,
    options: { restoreTabs: cfg.restoreTabs !== false, preventAppNap: cfg.preventAppNap !== false, pingGame: cfg.pingGame !== false },
    update: updater.state(),
  };
}

function fromMenu(e) { return menuOpen() && e.sender === menuWin.webContents; }
ipcMain.handle('menu:state', (e) => fromMenu(e) ? menuState() : null);
ipcMain.on('menu:size', (e, h) => {
  if (!fromMenu(e) || !winOk()) return;
  const { screen } = require('electron');
  const b = menuWin.getBounds();
  const area = screen.getDisplayMatching(b).workArea;
  const height = Math.max(80, Math.min(Math.ceil(h), area.y + area.height - b.y - 8));
  menuWin.setBounds({ x: b.x, y: b.y, width: MENU_W, height });
  if (!menuWin.isVisible()) { menuWin.show(); menuWin.focus(); }
});
ipcMain.on('menu:close', (e) => { if (fromMenu(e)) closeMenuPopup(); });
ipcMain.handle('menu:do', (e, action, arg) => {
  if (!fromMenu(e)) return null;
  const w = wc();
  // các thao tác giữ menu mở, trả lại trạng thái mới
  const stay = {
    zoomIn: () => zoomBy(0.5), zoomOut: () => zoomBy(-0.5), zoomReset: () => zoomBy(0),
    option: () => {
      const key = String(arg);
      if (!['restoreTabs', 'preventAppNap', 'pingGame'].includes(key)) return;
      const on = loadConfig()[key] === false; // đang tắt → bật
      saveConfig({ [key]: on });
      if (key === 'preventAppNap') applyAppNap();
      if (key === 'restoreTabs') saveSession(true);
      if (key === 'pingGame' && !on) pingTargets.clear();
      scheduleMenu();
    },
  };
  if (stay[action]) { stay[action](); return menuState(); }

  const bounds = menuOpen() ? menuWin.getBounds() : null;
  closeMenuPopup();
  const run = {
    newTab, reopen: reopenClosedTab, mute: () => activeTab() && toggleMute(activeId),
    screenshot: screenshotTab, fullscreen: toggleFullScreen, shots: () => { fs.mkdirSync(shotsDir(), { recursive: true }); shell.openPath(shotsDir()); },
    history: openHistory, clearHistory: clearHistoryDialog, recent: () => openUrl(String(arg || '')),
    home: () => w && w.loadURL(homeUrl()).catch(() => {}), setHome: setHomeHere,
    inspector: () => openInspector(arg ? String(arg) : undefined), devtools: () => w && w.toggleDevTools(),
    hardReload, clearCache: clearCacheReload,
    checkFlash, allowSite: allowCurrentSite, plugin: askForFlashPlugin,
    modeFlash: () => setMode('flash'), modeRuffle: () => setMode('ruffle'),
    flashMore: () => {
      // các tuỳ chọn Flash ít dùng: menu hệ thống ngay chỗ menu vừa đóng
      if (!winOk()) return;
      const cb = win.getContentBounds();
      Menu.buildFromTemplate(flashSubmenu()).popup({ window: win, x: bounds ? bounds.x - cb.x + 12 : 0, y: bounds ? bounds.y - cb.y + 12 : TOOLBAR_HEIGHT });
    },
    openSwf: openSwfFile,
    update: () => (updater.state().available ? updater.promptUpdate(true) : updater.check({ manual: true })),
  };
  if (run[action]) setTimeout(run[action], 0);
  return null;
});

function buildMenu() {
  const w = () => wc();
  const updateItem = { label: updater.state && updater.state().available ? `Cập nhật lên ${updater.state().available}…` : 'Kiểm tra cập nhật…',
    click: () => (updater.state().available ? updater.promptUpdate(true) : updater.check({ manual: true })) };
  const menu = Menu.buildFromTemplate([
    ...(!IS_MAC ? [] : [{ label: app.name, submenu: [
      { role: 'about', label: 'Giới thiệu Wisp' },
      updateItem,
      { type: 'separator' },
      { role: 'hide', label: 'Ẩn Wisp' },
      { role: 'hideOthers', label: 'Ẩn ứng dụng khác' },
      { type: 'separator' },
      { role: 'quit', label: 'Thoát Wisp' },
    ]}]),
    { label: 'Tệp', submenu: [
      { label: 'Tab mới', accelerator: 'CmdOrCtrl+T', click: newTab },
      { label: 'Mở file .swf…', accelerator: 'CmdOrCtrl+O', click: openSwfFile },
      { type: 'separator' },
      { label: 'Đóng tab', accelerator: 'CmdOrCtrl+W', click: () => activeTab() && closeTab(activeId) },
      { label: 'Mở lại tab vừa đóng', accelerator: 'Shift+CmdOrCtrl+T', click: reopenClosedTab },
      { type: 'separator' },
      { label: 'Chụp màn hình tab', accelerator: 'Shift+CmdOrCtrl+S', click: screenshotTab },
      ...(IS_MAC ? [] : [
        { type: 'separator' },
        updateItem,
        { label: `Giới thiệu Wisp ${app.getVersion()}`, click: () => dialog.showMessageBox(win, { type: 'info', message: `Wisp ${app.getVersion()}`,
          detail: `Electron ${process.versions.electron} · Chromium ${process.versions.chrome} · ${process.arch}\nFlash: ${FLASH_VERSION || 'chưa cài'} (${MODE})` }) },
        { type: 'separator' },
        { role: 'quit', label: 'Thoát Wisp', accelerator: 'Alt+F4' },
      ]),
    ]},
    { label: 'Sửa', submenu: [
      { role: 'undo', label: 'Hoàn tác' }, { role: 'redo', label: 'Làm lại' }, { type: 'separator' },
      { role: 'cut', label: 'Cắt' }, { role: 'copy', label: 'Sao chép' }, { role: 'paste', label: 'Dán' },
      { role: 'selectAll', label: 'Chọn tất cả' },
    ]},
    { label: 'Trang', submenu: [
      { label: 'Mở địa chỉ…', accelerator: 'CmdOrCtrl+L', click: focusUrlBar },
      { label: 'Quay lại', accelerator: IS_MAC ? 'Cmd+[' : 'Alt+Left', click: () => w() && w().canGoBack() && w().goBack() },
      { label: 'Tiến tới', accelerator: IS_MAC ? 'Cmd+]' : 'Alt+Right', click: () => w() && w().canGoForward() && w().goForward() },
      { label: 'Tải lại', accelerator: 'CmdOrCtrl+R', click: () => w() && w().reload() },
      { label: 'Tải lại không dùng cache', accelerator: 'Shift+CmdOrCtrl+R', click: hardReload },
      { label: 'Xoá cache và tải lại', click: clearCacheReload },
      { type: 'separator' },
      { label: 'Toàn màn hình', accelerator: IS_MAC ? 'Ctrl+Cmd+F' : 'F11', click: toggleFullScreen },
      { label: 'Phóng to', accelerator: 'CmdOrCtrl+=', click: () => zoomBy(0.5) },
      { label: 'Thu nhỏ', accelerator: 'CmdOrCtrl+-', click: () => zoomBy(-0.5) },
      { label: 'Cỡ gốc', accelerator: 'CmdOrCtrl+0', click: () => zoomBy(0) },
      { type: 'separator' },
      { label: 'Bảng kiểm tra (hiệu năng, mạng, socket)', accelerator: 'Shift+CmdOrCtrl+I', click: () => openInspector() },
      { label: 'Công cụ nhà phát triển', accelerator: IS_MAC ? 'Alt+Cmd+I' : 'Ctrl+Alt+I', click: () => w() && w().toggleDevTools() },
    ]},
    { label: 'Flash', submenu: flashSubmenu() },
    { label: 'Lịch sử', submenu: historySubmenu() },
    { label: 'Tab', submenu: [
      { label: 'Tab tiếp theo', accelerator: 'Ctrl+Tab', click: () => cycleTab(1) },
      { label: 'Tab trước', accelerator: 'Ctrl+Shift+Tab', click: () => cycleTab(-1) },
      { label: 'Tắt / bật tiếng tab', accelerator: 'Shift+CmdOrCtrl+M', click: () => activeTab() && toggleMute(activeId) },
      { type: 'separator' },
      ...tabs.map((t, i) => ({
        label: shorten(tabInfo(t).title, 50), type: 'radio', checked: t.id === activeId,
        accelerator: i < 8 ? `CmdOrCtrl+${i + 1}` : undefined, click: () => activateTab(t.id),
      })),
      ...(tabs.length > 8 ? [{ label: 'Tab cuối', accelerator: 'CmdOrCtrl+9', click: () => activateTab(tabs[tabs.length - 1].id) }] : []),
    ]},
    { label: 'Tuỳ chọn', submenu: optionsSubmenu() },
    { role: 'windowMenu', label: 'Cửa sổ' },
  ]);
  Menu.setApplicationMenu(menu);
}

// ---------- theo dõi hiệu năng + ping máy chủ game ----------
// Mỗi 2 giây: CPU / RAM của từng tiến trình (tab, Flash, GPU…), gửi lên thanh công cụ và Bảng kiểm tra.
// Ping: lấy các kết nối TCP của game (không phải cổng 80/443) rồi đo ping ICMP tới máy chủ;
// máy chủ chặn ICMP thì đo thời gian mở kết nối TCP tới đúng cổng game (thưa hơn, 10 giây / lần).
const PERF_EVERY = 2000;
const PERF_KEEP = 180;            // 6 phút
const perfHist = [];              // { t, cpu, mem, flashCpu, flashMem }
const pingTargets = new Map();    // "host:port" → { key, host, port, mode, icmpOk, fails, samples, busy, next, lastLive }
let lastProcs = [];
let perfTimer = null;
let perfTicks = 0;
const warned = { flashCpu: 0, mem: 0, ping: 0 };

function splitHostPort(addr) {
  const i = addr.lastIndexOf(':');
  return [addr.slice(0, i).replace(/^\[|\]$/g, ''), Number(addr.slice(i + 1))];
}

function collectProcs() {
  const byPid = new Map();
  for (const t of tabs) {
    const w = t.view.webContents;
    if (!w.isDestroyed()) { const pid = w.getOSProcessId(); if (pid) byPid.set(pid, t); }
  }
  const ownPids = new Map();
  if (winOk()) ownPids.set(win.webContents.getOSProcessId(), 'Thanh công cụ');
  if (inspectorOpen()) ownPids.set(inspectWin.webContents.getOSProcessId(), 'Bảng kiểm tra');
  return app.getAppMetrics().map(m => {
    const t = byPid.get(m.pid);
    let kind = m.type;
    if (m.type === 'Pepper Plugin') kind = 'Flash';
    else if (m.type === 'Browser') kind = 'Tiến trình chính';
    else if (t) kind = 'Tab';
    else if (ownPids.has(m.pid)) kind = ownPids.get(m.pid);
    else if (m.type === 'Utility' && /network/i.test(m.serviceName || m.name || '')) kind = 'Mạng';
    return {
      pid: m.pid, type: m.type, kind, name: m.serviceName || m.name || '',
      tabId: t ? t.id : null, tab: t ? tabInfo(t).title : '',
      cpu: Math.round((m.cpu.percentCPUUsage || 0) * 10) / 10,
      mem: Math.round((m.memory.workingSetSize || 0) / 1024), // MB
    };
  });
}

function pingSummary() {
  // máy chủ game đang kết nối, mẫu ping gần nhất
  let best = null;
  for (const p of pingTargets.values()) {
    if (!p.live || !p.samples.length) continue;
    if (!best || p.lastLive > best.lastLive) best = p;
  }
  if (!best) return null;
  const recent = best.samples.slice(-15);
  const ok = recent.filter(s => s.ms != null);
  return {
    host: best.host, port: best.port, mode: best.mode,
    ms: recent[recent.length - 1].ms,
    avg: ok.length ? Math.round(ok.reduce((a, s) => a + s.ms, 0) / ok.length) : null,
    loss: Math.round(100 * (recent.length - ok.length) / recent.length),
  };
}

function perfTick() {
  perfTicks++;
  // âm thanh: tab nào đang phát tiếng (mỗi 1s)
  let audioChanged = false;
  for (const t of tabs) {
    const w = t.view.webContents;
    if (w.isDestroyed()) continue;
    const a = w.isCurrentlyAudible();
    if (a !== t.audible) { t.audible = a; audioChanged = true; }
  }
  if (audioChanged) sendTabs();
  if (perfTicks % 2) return;

  const procs = collectProcs();
  lastProcs = procs;
  const sum = (list, k) => list.reduce((a, p) => a + p[k], 0);
  const flash = procs.filter(p => p.kind === 'Flash');
  const active = activeTab();
  const tabProcs = procs.filter(p => active && p.tabId === active.id);
  const point = {
    t: Date.now(),
    cpu: Math.round(sum(procs, 'cpu')), mem: sum(procs, 'mem'),
    flashCpu: Math.round(sum(flash, 'cpu')), flashMem: sum(flash, 'mem'),
    tabCpu: Math.round(sum(tabProcs, 'cpu')), tabMem: sum(tabProcs, 'mem'),
  };
  perfHist.push(point);
  if (perfHist.length > PERF_KEEP) perfHist.shift();

  // cảnh báo (mỗi loại tối đa 1 lần / 5 phút)
  const now = Date.now();
  const recent = perfHist.slice(-5);
  if (recent.length === 5 && recent.every(p => p.flashCpu >= 90) && now - warned.flashCpu > 300000) {
    warned.flashCpu = now;
    addLog('warning', 'perf', `Flash dùng ${point.flashCpu}% CPU liên tục 10 giây — máy có thể nóng / giật. Thử tắt bớt tab game hoặc giảm chất lượng trong game.`);
  }
  for (const p of procs) {
    if (p.kind === 'Tab' && p.mem > 1500 && now - warned.mem > 300000) {
      warned.mem = now;
      addLog('warning', 'perf', `Tab "${shorten(p.tab, 40)}" dùng ${p.mem} MB RAM — nếu game chậm dần, tải lại tab (Cmd+R).`);
    }
  }

  // ping máy chủ game
  if (loadConfig().pingGame !== false) {
    updatePingTargets();
    for (const p of pingTargets.values()) if (p.live && now >= p.next) pingOnce(p);
  }
  const ping = pingSummary();
  if (ping && ping.loss >= 50 && now - warned.ping > 120000) {
    warned.ping = now;
    addLog('warning', 'perf', `Mất ${ping.loss}% gói ping tới máy chủ game ${ping.host} — mạng chập chờn, game dễ bị lag / rớt kết nối.`);
  }

  if (winOk()) win.webContents.send('perf', { ...point, ping });
  if (inspectorOpen()) inspectWin.webContents.send('inspect:perf', perfPayload());
}

function perfPayload() {
  return {
    procs: lastProcs, hist: perfHist,
    pings: [...pingTargets.values()].map(p => ({ key: p.key, host: p.host, port: p.port, mode: p.mode, live: p.live, samples: p.samples })),
    appNap: napBlocker !== null,
  };
}

function updatePingTargets() {
  const now = Date.now();
  for (const s of sockets.values()) {
    if (s.end || s.port === 80 || s.port === 443 || !s.states.includes('ESTABLISHED')) continue;
    const [host, port] = splitHostPort(s.remote);
    if (!host || /^(127\.|::1$|localhost)/.test(host)) continue;
    const key = `${host}:${port}`;
    let p = pingTargets.get(key);
    if (!p) {
      p = { key, host, port, mode: 'icmp', icmpOk: false, fails: 0, samples: [], busy: false, next: 0, lastLive: now, live: true };
      pingTargets.set(key, p);
      addLog('info', 'perf', `Theo dõi ping máy chủ game ${key}`);
    }
    p.lastLive = now;
  }
  for (const [k, p] of pingTargets) {
    p.live = now - p.lastLive < 5000;
    if (now - p.lastLive > 10 * 60000) pingTargets.delete(k);
  }
}

function pingOnce(p) {
  if (p.busy) return;
  p.busy = true;
  const record = (ms) => {
    p.busy = false;
    p.samples.push({ t: Date.now(), ms });
    if (p.samples.length > PERF_KEEP) p.samples.shift();
  };
  if (p.mode === 'icmp') {
    p.next = Date.now() + 2000;
    const [cmd, args] = IS_WIN ? ['ping', ['-n', '1', '-w', '1500', p.host]] : ['/sbin/ping', ['-n', '-c', '1', '-W', '1500', p.host]];
    execFile(cmd, args, { timeout: 3000, windowsHide: true }, (_err, out) => {
      // Windows có thể in tiếng địa phương ("thời gian=12ms") → chỉ dựa vào "=12ms" / "<1ms"
      const m = (IS_WIN ? /[=<]\s*([\d.]+)\s*ms\b/i : /time[=<]([\d.]+)\s*ms/).exec(String(out || ''));
      if (m) { p.icmpOk = true; p.fails = 0; return record(Math.round(Number(m[1]))); }
      if (!p.icmpOk && ++p.fails >= 2) {
        // máy chủ chặn ICMP → đo bằng thời gian mở kết nối TCP tới cổng game
        p.busy = false; p.mode = 'tcp'; p.next = 0;
        addLog('info', 'perf', `${p.host} không trả lời ping ICMP → đo bằng thời gian nối TCP tới cổng ${p.port} (10 giây / lần)`);
        return;
      }
      if (p.icmpOk) record(null); else p.busy = false;
    });
  } else {
    p.next = Date.now() + 10000;
    const t0 = Date.now();
    const sock = net.connect({ host: p.host, port: p.port });
    let done = false;
    const fin = (ms) => { if (done) return; done = true; sock.destroy(); record(ms); };
    sock.setTimeout(3000, () => fin(null));
    sock.on('connect', () => fin(Date.now() - t0));
    sock.on('error', () => fin(null));
  }
}

function startPerf() {
  if (perfTimer) return;
  perfTimer = setInterval(perfTick, PERF_EVERY / 2);
  startSocketWatch();
}

// ---------- âm thanh từng tab ----------
function toggleMute(id) {
  const t = tabOf(id);
  if (!t) return;
  t.muted = !t.muted;
  t.view.webContents.setAudioMuted(t.muted);
  sendTabs();
}

// ---------- chống App Nap: macOS hãm app bị che / thu nhỏ → game giật, rớt kết nối ----------
const { powerSaveBlocker } = require('electron');
let napBlocker = null;
function applyAppNap() {
  const on = loadConfig().preventAppNap !== false;
  if (on && napBlocker === null) napBlocker = powerSaveBlocker.start('prevent-app-suspension');
  else if (!on && napBlocker !== null) { powerSaveBlocker.stop(napBlocker); napBlocker = null; }
}

// ---------- nhớ các tab đang mở để lần sau mở lại ----------
let lastSessionJson = '';
function saveSession(force = false) {
  if (!tabs.length) return;
  const list = tabs.map(t => t.view.webContents.isDestroyed() ? '' : displayUrl(t.view.webContents.getURL())).filter(Boolean);
  const data = { tabs: list, active: Math.max(0, tabs.indexOf(activeTab())) };
  const json = JSON.stringify(data);
  if (!force && json === lastSessionJson) return;
  lastSessionJson = json;
  saveConfig({ session: data });
}

// ---------- khởi động ----------
app.whenReady().then(() => {
  if (SECOND_INSTANCE) return;
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
          // Windows: /C:/game.swf → C:/game.swf
          if (IS_WIN && /^\/[a-z]:\//i.test(file)) file = file.slice(1);
        }
        if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) return cb({ error: -6 });
        cb({ mimeType: MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', headers, data: fs.readFileSync(file) });
      } catch { cb({ error: -2 }); }
    });
  }

  applyAppNap();
  createWindow();
  updater.init({
    getWin: () => (winOk() ? win : null), toast, addLog, loadConfig, saveConfig,
    notify: (st) => { if (winOk()) win.webContents.send('update', st); scheduleMenu(); },
  });
  if (process.env.WISP_INSPECT) openInspector();
});

// Windows / Linux: mở file .swf (hoặc chạy lại app) khi Wisp đang mở → Windows chạy tiến trình mới
// với đường dẫn trong argv → tiến trình đó thoát (SECOND_INSTANCE), cửa sổ cũ mở file thành tab mới.
app.on('second-instance', (_e, argv) => {
  if (!winOk()) return;
  if (win.isMinimized()) win.restore();
  win.focus();
  const arg = argv.slice(1).find(a => /^https?:|\.swf$/i.test(a));
  if (arg) createTab(normalizeUrl(arg), { index: tabs.indexOf(activeTab()) + 1 });
});

// Mở file .swf bằng cách kéo thả vào icon app trên Dock / "Open With"
app.on('open-file', (e, file) => {
  e.preventDefault();
  if (app.isReady() && winOk()) createTab(normalizeUrl(file), { index: tabs.indexOf(activeTab()) + 1 });
  else pendingFile = file;
});

app.on('before-quit', () => { saveHistoryNow(); if (loadConfig().restoreTabs !== false) saveSession(); });
app.on('window-all-closed', () => app.quit());
