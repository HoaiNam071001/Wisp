// Engine Flash: chạy bằng Electron 11 (Pepper Flash), một cửa sổ cho trang cấu hình Flash.
// Vỏ app mở tiến trình này (bỏ ELECTRON_RUN_AS_NODE khỏi env), nói chuyện qua stdin / stdout JSON.
// Env: WISP_USER_DATA (thư mục dữ liệu), WISP_FLASH_PLUGIN + WISP_FLASH_VERSION (không có → Flash không nạp).
const { app, BrowserWindow, BrowserView, ipcMain, session } = require('electron');
const path = require('path');
const readline = require('readline');
const { createRemapper, normalizeConfig, attach } = require('../keyremap'); // dùng chung với vỏ app (keyremap-main.js)
const { parseLine, reply, fail, event, hostInDomains } = require('./protocol');
const syncCookies = require('../sync-cookies');

if (process.env.WISP_USER_DATA) app.setPath('userData', process.env.WISP_USER_DATA);
if (process.env.WISP_FLASH_PLUGIN) {
  app.commandLine.appendSwitch('ppapi-flash-path', process.env.WISP_FLASH_PLUGIN);
  app.commandLine.appendSwitch('ppapi-flash-version', process.env.WISP_FLASH_VERSION || '32.0.0.0');
}
// Vỏ app thoát / đóng ống thì ghi nữa sẽ ném lỗi → bỏ qua, và tự thoát theo vỏ app
process.stdout.on('error', () => app.quit());
const send = (s) => { if (!process.stdout.destroyed && process.stdout.writable) process.stdout.write(s); };
let win = null;
let view = null; // BrowserView chứa trang game; win.webContents là thanh công cụ (bar.html)
const BAR_H = 40;
let keyRemap = normalizeConfig(null); // cấu hình đổi phím do vỏ app gửi (open / keyRemap)
const remapper = createRemapper(() => keyRemap);
let domains = []; // trang Flash thật; ra ngoài thì nhờ vỏ app mở bằng engine web

function hostOf(url) { try { return new URL(url).hostname; } catch { return ''; } }

function layoutView() {
  if (!win || win.isDestroyed() || !view) return;
  const c = win.getContentBounds();
  view.setBounds({ x: 0, y: BAR_H, width: c.width, height: Math.max(0, c.height - BAR_H) });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1100, height: 760 + BAR_H,
    webPreferences: { preload: path.join(__dirname, 'bar-preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  win.loadFile(path.join(__dirname, 'bar.html'));
  view = new BrowserView({ webPreferences: { plugins: true, contextIsolation: true, nodeIntegration: false } });
  win.setBrowserView(view);
  layoutView();
  view.setAutoResize({ width: true, height: true });
  const wc = view.webContents;
  attach(wc, remapper); // đổi phím trong trang game (thanh công cụ không đổi)
  // Ra khỏi trang Flash: huỷ và báo vỏ app mở ở cửa sổ chính (engine web)
  const leave = (e, url) => {
    if (!/^https?:/i.test(url) || hostInDomains(domains, hostOf(url))) return;
    e.preventDefault();
    send(event('leave', { url }));
  };
  wc.on('will-navigate', leave);
  wc.on('will-redirect', leave);
  wc.on('new-window', (e, url) => { // popup: cùng domain mở trong cửa sổ này, khác domain nhờ vỏ app
    e.preventDefault();
    if (hostInDomains(domains, hostOf(url))) wc.loadURL(url).catch(() => {}); else send(event('leave', { url }));
  });
  const showHost = (u) => { if (win && !win.isDestroyed()) win.webContents.send('bar:host', hostOf(u)); };
  win.webContents.on('did-finish-load', () => showHost(wc.getURL()));
  wc.on('did-navigate', (_e, u) => { showHost(u); send(event('url', { url: u })); });
  wc.on('did-finish-load', async () => {
    const info = await wc.executeJavaScript(`(() => { const p = navigator.plugins['Shockwave Flash']; return p ? p.description : ''; })()`).catch(() => '');
    send(event('flash', { plugin: info }));
  });
  wc.on('page-title-updated', (_e, title) => { if (win && !win.isDestroyed()) win.setTitle(title); send(event('title', { title })); });
  win.on('closed', () => { win = null; view = null; send(event('closed', {})); });
}

// Nút trên thanh: tải lại
ipcMain.on('bar', (e, action) => {
  if (!win || win.isDestroyed() || e.sender !== win.webContents || !view) return;
  if (action === 'reload') view.webContents.reload();
});

function openWindow(url) {
  if (!win || win.isDestroyed()) createWindow();
  return view.webContents.loadURL(url).catch(() => {});
}

function frameRect() {
  if (!win || win.isDestroyed()) throw Object.assign(new Error('chưa có cửa sổ'), { code: 'no_tab' });
  const c = win.getContentBounds(); // chỉ vùng trang game, trừ thanh công cụ
  // state: để kịch bản biết cửa sổ có đang thu nhỏ / ẩn (khi đó ảnh chụp màn hình không thấy game)
  const state = { minimized: win.isMinimized(), visible: win.isVisible(), focused: win.isFocused() };
  return { screenRect: { x: c.x, y: c.y + BAR_H, width: c.width, height: Math.max(0, c.height - BAR_H) }, state };
}

// Việc cho kịch bản tự xử lý game treo: tải lại / tắt tiếng / đưa cửa sổ lên trước
function gameAction(m) {
  const action = m.action;
  if (!win || win.isDestroyed() || !view) throw Object.assign(new Error('chưa có cửa sổ'), { code: 'no_tab' });
  const wc = view.webContents;
  if (action === 'reload') wc.reload();
  else if (action === 'resize') { if (win.isMaximized() || win.isFullScreen()) { win.unmaximize(); win.setFullScreen(false); } win.setContentSize(m.width, m.height + BAR_H); }
  else if (action === 'mute' || action === 'unmute') wc.setAudioMuted(action === 'mute');
  else { if (win.isMinimized()) win.restore(); win.show(); win.focus(); wc.focus(); }
  return {};
}

// Đồng bộ phiên game giữa các máy (vỏ app mã hoá + gộp): đọc / nạp cookie của domain đã chọn
async function readCookies(domains) {
  return { cookies: syncCookies.pick(await session.defaultSession.cookies.get({}), domains) };
}
async function writeCookies(list, onlyMissing) {
  let set = 0;
  const have = new Set(onlyMissing ? (await session.defaultSession.cookies.get({})).map(syncCookies.keyOf) : []);
  const now = Math.floor(Date.now() / 1000);
  for (const c of list) {
    if (onlyMissing && have.has(syncCookies.keyOf(c))) continue;
    const d = syncCookies.toSetDetails(c, now);
    if (d) { try { await session.defaultSession.cookies.set(d); set++; } catch { /* cookie hỏng: bỏ qua, không chặn cái khác */ } }
  }
  await session.defaultSession.cookies.flushStore();
  return { set };
}

async function handle(m) {
  if (m.cmd === 'cookies') return readCookies(m.domains);
  if (m.cmd === 'setCookies') return writeCookies(m.cookies, m.onlyMissing === true);
  if (m.cmd === 'keyRemap') { keyRemap = normalizeConfig(m.keyRemap); return {}; }
  if (m.cmd === 'open') { keyRemap = normalizeConfig(m.keyRemap); domains = Array.isArray(m.domains) ? m.domains : []; await openWindow(m.url); return {}; }
  if (m.cmd === 'close') { if (win && !win.isDestroyed()) win.close(); return {}; }
  if (m.cmd === 'frameRect') return frameRect();
  if (m.cmd === 'game') return gameAction(m);
  app.quit();
  return {};
}

app.whenReady().then(() => {
  send(event('ready', { version: process.versions.electron }));
  readline.createInterface({ input: process.stdin }).on('line', async (line) => {
    const { msg, error } = parseLine(line);
    if (error) return send(fail(null, error));
    try { send(reply(msg.id, await handle(msg))); } catch (e) { send(fail(msg.id, { code: e.code || 'internal', detail: e.message })); }
  }).on('close', () => app.quit());
});
app.on('window-all-closed', () => {}); // đóng cửa sổ game không tắt engine
