// Engine Flash: chạy bằng Electron 11 (Pepper Flash), một cửa sổ cho trang cấu hình Flash.
// Vỏ app mở tiến trình này (bỏ ELECTRON_RUN_AS_NODE khỏi env), nói chuyện qua stdin / stdout JSON.
// Env: WISP_USER_DATA (thư mục dữ liệu), WISP_FLASH_PLUGIN + WISP_FLASH_VERSION (không có → Flash không nạp).
const { app, BrowserWindow } = require('electron');
const readline = require('readline');
const { parseLine, reply, fail, event, hostInDomains } = require('./protocol');

if (process.env.WISP_USER_DATA) app.setPath('userData', process.env.WISP_USER_DATA);
if (process.env.WISP_FLASH_PLUGIN) {
  app.commandLine.appendSwitch('ppapi-flash-path', process.env.WISP_FLASH_PLUGIN);
  app.commandLine.appendSwitch('ppapi-flash-version', process.env.WISP_FLASH_VERSION || '32.0.0.0');
}
const send = (s) => process.stdout.write(s);
let win = null;
let domains = []; // trang Flash thật; ra ngoài thì nhờ vỏ app mở bằng engine web

function hostOf(url) { try { return new URL(url).hostname; } catch { return ''; } }

function openWindow(url) {
  if (!win || win.isDestroyed()) {
    win = new BrowserWindow({
      width: 1100, height: 760,
      webPreferences: { plugins: true, contextIsolation: true, nodeIntegration: false },
    });
    const wc = win.webContents;
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
    wc.on('did-navigate', (_e, u) => send(event('url', { url: u })));
    wc.on('did-finish-load', async () => {
      const info = await wc.executeJavaScript(`(() => { const p = navigator.plugins['Shockwave Flash']; return p ? p.description : ''; })()`).catch(() => '');
      send(event('flash', { plugin: info }));
    });
    wc.on('page-title-updated', (_e, title) => send(event('title', { title })));
    win.on('closed', () => { win = null; send(event('closed', {})); });
  }
  return win.loadURL(url).catch(() => {});
}

function frameRect() {
  if (!win || win.isDestroyed()) throw Object.assign(new Error('chưa có cửa sổ'), { code: 'no_tab' });
  const c = win.getContentBounds();
  return { screenRect: { x: c.x, y: c.y, width: c.width, height: c.height } };
}

async function handle(m) {
  if (m.cmd === 'open') { domains = Array.isArray(m.domains) ? m.domains : []; await openWindow(m.url); return {}; }
  if (m.cmd === 'close') { if (win && !win.isDestroyed()) win.close(); return {}; }
  if (m.cmd === 'frameRect') return frameRect();
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
