// Wisp — trình duyệt chạy Electron 11 + Flash Player thật (Pepper Flash / PPAPI).
// Chế độ dự phòng: Ruffle (giả lập Flash bằng WebAssembly), giống bản 1.
// Electron 12 trở lên đã bỏ Pepper Flash, nên app phải ở Electron 11.x (x64).
const { app, BrowserWindow, BrowserView, protocol, session, ipcMain, Menu, dialog, shell, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const net = require('net');
const { execFile } = require('child_process');
const { pathToFileURL } = require('url');

// ====== ĐỔI ĐỊA CHỈ TRANG MẶC ĐỊNH Ở ĐÂY (hoặc bấm "★ Đặt làm trang chủ") ======
const DEFAULT_URL = 'https://bangbang.cmn.vn/';
// Domain được phép chạy Flash thật (ghi vào mms.cfg). Thêm domain của game ở đây
// hoặc dùng menu Flash → "Cho phép Flash trên trang này".
const DEFAULT_ALLOW = ['cmn.vn', 'cf4vn.bar'];
// =================================================================================

const TOOLBAR_HEIGHT = 44;
const PLUGIN_NAME = 'PepperFlashPlayer.plugin';

// ---------- thư mục dữ liệu: ~/Library/Application Support/Wisp ----------
// Lần đầu chạy bản Wisp: chuyển nguyên thư mục cũ "Flash Browser 2" sang (giữ cookie, đăng nhập).
// Không có thì chép config.json của bản 1 ("Flash Browser"). Bản 1 (Electron 45) để lại cookie
// định dạng mới mà Chromium 87 không đọc được, nên chỉ chép config.json.
{
  const appData = app.getPath('appData');
  const newDir = path.join(appData, 'Wisp');
  app.setPath('userData', newDir);
  try {
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
function findFlashPlugin() {
  const candidates = [
    app.isPackaged ? path.join(process.resourcesPath, 'plugins', PLUGIN_NAME) : path.join(__dirname, 'plugins', PLUGIN_NAME),
    path.join('/Library/Internet Plug-Ins/PepperFlashPlayer', PLUGIN_NAME),
    path.join(app.getPath('home'), 'Library/Internet Plug-Ins/PepperFlashPlayer', PLUGIN_NAME),
  ];
  return candidates.find(p => fs.existsSync(p)) || null;
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

// Địa chỉ hiển thị trên thanh địa chỉ: bỏ lớp player.html / ruffle://file
function displayUrl(u) {
  const m = String(u || '').match(/(?:player\.html|__flash_player__\.html)\?src=([^&#]+)/);
  if (m) u = decodeURIComponent(m[1]);
  if (u.startsWith('ruffle://file/')) u = 'file://' + u.slice('ruffle://file'.length);
  return u;
}

function normalizeUrl(input) {
  let u = String(input || '').trim();
  if (!u) return null;
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

// ---------- cửa sổ ----------
let win = null;
let page = null;
let pendingFile = null;
const seenSwfHosts = new Set(); // domain của các file .swf trang đã tải (gợi ý thêm vào allowlist)

function wc() { return page && page.webContents; }

function sendState() {
  if (!win || win.isDestroyed() || !wc()) return;
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

function layout(full = false) {
  if (!win || !page) return;
  const [width, height] = win.getContentSize();
  const top = full ? 0 : TOOLBAR_HEIGHT;
  page.setBounds({ x: 0, y: top, width, height: height - top });
}

function createWindow() {
  const cfg = loadConfig();
  const argUrl = process.argv.slice(1).find(a => /^https?:|\.swf$/i.test(a));
  const startUrl = normalizeUrl(process.env.FLASH_URL || pendingFile || argUrl) || cfg.url || DEFAULT_URL;
  pendingFile = null;

  // Cửa sổ chính chứa thanh công cụ; trang web nằm trong BrowserView bên dưới
  win = new BrowserWindow({
    width: 1280, height: 820, title: 'Wisp', backgroundColor: '#2b2d31',
    webPreferences: { preload: path.join(__dirname, 'toolbar-preload.js'), contextIsolation: true, nodeIntegration: false, worldSafeExecuteJavaScript: true },
  });
  win.loadFile(path.join(__dirname, 'toolbar.html'));

  page = new BrowserView({
    webPreferences: {
      plugins: MODE === 'flash',
      contextIsolation: true,
      nodeIntegration: false,
      worldSafeExecuteJavaScript: true,
      // Chế độ Ruffle: preload chạy trong mọi frame (kể cả iframe) để chèn Ruffle
      ...(MODE === 'ruffle' ? {
        preload: path.join(__dirname, 'page-preload.js'),
        nodeIntegrationInSubFrames: true,
        additionalArguments: ['--flash-mode=ruffle'],
      } : {}),
    },
  });
  win.addBrowserView(page);
  layout();
  win.on('resize', () => layout(win.isFullScreen() && isHtmlFull));

  const w = page.webContents;

  // Trình phát Flash bật toàn màn hình → ẩn thanh công cụ
  let isHtmlFull = false;
  w.on('enter-html-full-screen', () => { isHtmlFull = true; layout(true); });
  w.on('leave-html-full-screen', () => { isHtmlFull = false; layout(false); });

  // Popup (window.open / target=_blank) mở ngay trong cửa sổ này
  w.on('new-window', (e, url) => { e.preventDefault(); w.loadURL(url); });

  ['did-navigate', 'did-navigate-in-page', 'did-start-loading', 'did-stop-loading'].forEach(ev => w.on(ev, sendState));
  w.on('page-title-updated', (_e, t) => win.setTitle(t + ' — Wisp'));
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

  win.on('closed', () => { win = null; page = null; });

  buildMenu();
  w.loadURL(startUrl);

  if (wantedMode === 'flash' && !FLASH_PATH) {
    setTimeout(() => dialog.showMessageBox(win, {
      type: 'warning',
      message: 'Chưa tìm thấy Flash Player (PepperFlashPlayer.plugin)',
      detail: 'App đang chạy tạm bằng Ruffle (không chơi được game online cần socket).\n\n' +
        'Hãy đặt PepperFlashPlayer.plugin (bản PPAPI, x64, 32.0.0.x) vào thư mục "plugins" của app ' +
        'hoặc /Library/Internet Plug-Ins/PepperFlashPlayer/, rồi mở lại app.',
    }), 800);
  }
}

// ---------- điều hướng từ thanh công cụ ----------
ipcMain.on('nav', (_e, action, arg) => {
  const w = wc();
  if (!w) return;
  if (action === 'go') { const u = normalizeUrl(arg); if (u) w.loadURL(u); }
  else if (action === 'back') { if (w.canGoBack()) w.goBack(); }
  else if (action === 'forward') { if (w.canGoForward()) w.goForward(); }
  else if (action === 'reload') { w.isLoading() ? w.stop() : w.reload(); }
  else if (action === 'home') { w.loadURL(loadConfig().url || DEFAULT_URL); }
  else if (action === 'sethome') { saveConfig({ url: w.getURL() }); }
  else if (action === 'inspect') { openInspector(); }
});
ipcMain.on('ready', sendState);

// ---------- Bảng kiểm tra: HTTP, socket TCP, console, thông tin Flash ----------
// DevTools không thấy kết nối socket của Flash (chúng không đi qua tab Network),
// nên app tự ghi: mọi request HTTP của phiên (cả request do Flash gửi), các kết nối
// TCP của mọi tiến trình Wisp (đọc bằng lsof), console + sự kiện của trang.
const LOG_MAX = 3000;
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

async function openSwfFile() {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'Flash', extensions: ['swf'] }] });
  if (!r.canceled && r.filePaths[0] && wc()) wc().loadURL(normalizeUrl(r.filePaths[0]));
}

function buildMenu() {
  const w = () => wc();
  const cfg = loadConfig();
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
      { label: 'Mở file .swf…', accelerator: 'Cmd+O', click: openSwfFile },
    ]},
    { label: 'Sửa', submenu: [
      { role: 'undo', label: 'Hoàn tác' }, { role: 'redo', label: 'Làm lại' }, { type: 'separator' },
      { role: 'cut', label: 'Cắt' }, { role: 'copy', label: 'Sao chép' }, { role: 'paste', label: 'Dán' },
      { role: 'selectAll', label: 'Chọn tất cả' },
    ]},
    { label: 'Trang', submenu: [
      { label: 'Mở địa chỉ…', accelerator: 'Cmd+L', click: () => { win.webContents.focus(); win.webContents.executeJavaScript("document.getElementById('url').select()"); } },
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
      { type: 'separator' },
      { label: 'Chế độ: Flash Player thật', type: 'radio', checked: wantedMode === 'flash', enabled: !!FLASH_PATH || wantedMode === 'flash', click: () => setMode('flash') },
      { label: 'Chế độ: Ruffle (dự phòng)', type: 'radio', checked: wantedMode === 'ruffle', click: () => setMode('ruffle') },
      { type: 'separator' },
      { label: 'Cho phép Flash trên trang này', accelerator: 'Shift+Cmd+A', enabled: MODE === 'flash', click: allowCurrentSite },
      { label: 'Sửa danh sách domain cho phép…', click: editAllowList },
      { label: 'Ghi log allowlist (gỡ lỗi)', type: 'checkbox', checked: !!cfg.flashDebug, click: (item) => { saveConfig({ flashDebug: item.checked }); writeMmsCfg(); askRelaunch(item.checked ? 'Đã bật log allowlist.' : 'Đã tắt log allowlist.'); } },
      { label: 'Mở thư mục mms.cfg', click: () => shell.showItemInFolder(mmsCfgPath()) },
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
});

// Mở file .swf bằng cách kéo thả vào icon app trên Dock / "Open With"
app.on('open-file', (e, file) => {
  e.preventDefault();
  if (app.isReady() && wc()) wc().loadURL(normalizeUrl(file));
  else pendingFile = file;
});

app.on('window-all-closed', () => app.quit());
