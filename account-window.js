// Popover Tài khoản Google (account.html): đăng nhập / đăng xuất, đồng bộ ngay, xoá dữ liệu trên Drive + IPC.
// Nút avatar trên thanh công cụ nhận { signedIn, initial } qua kênh 'account'.
const { BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const tabs = require('./tabs');
const auth = require('./google-auth');
const store = require('./token-store');
const sync = require('./sync');
const cookieSync = require('./cookie-sync');

let win = null;

function view() {
  const a = auth.account(), st = sync.getStatus();
  return {
    signedIn: !!a, email: a ? a.email : '', name: a ? a.name : '', keychain: store.available(),
    syncing: st.syncing, lastSync: st.lastSync, errors: st.errors,
  };
}

function initialOf(v) { return ((v.name || v.email || '?').trim()[0] || '?').toUpperCase(); }

function push() {
  const v = view();
  const main = tabs.getWin();
  if (main) main.webContents.send('account', { signedIn: v.signedIn, initial: initialOf(v), email: v.email });
  if (win && !win.isDestroyed()) win.webContents.send('account:changed', v);
}
auth.events.on('changed', push);
sync.events.on('status', push);

const WIDTH = 340;
let closedAt = 0;
let keepOpen = false; // đang đăng nhập ở trình duyệt ngoài / hộp xác nhận xoá: mất focus không được đóng popup

// Popover dưới nút tài khoản như Chrome: không viền, đóng khi bấm ra ngoài.
function toggleAccountPopup(anchor) {
  const main = tabs.getWin();
  if (!main) return;
  if (win && !win.isDestroyed()) { win.close(); return; }
  if (Date.now() - closedAt < 250) return; // cú bấm nút vừa làm popup mất focus → không mở lại
  const cb = main.getContentBounds();
  const a = anchor && typeof anchor === 'object' ? anchor : { x: cb.width - WIDTH, y: 40, w: 0 };
  const x = Math.round(Math.max(cb.x + 8, Math.min(cb.x + a.x + a.w - WIDTH, cb.x + cb.width - WIDTH - 8)));
  win = new BrowserWindow({
    parent: main, x, y: Math.round(cb.y + a.y + 4), width: WIDTH, height: 360,
    frame: false, resizable: false, movable: false, minimizable: false, maximizable: false, fullscreenable: false,
    skipTaskbar: true, show: false, hasShadow: true, roundedCorners: true,
    webPreferences: { preload: path.join(__dirname, 'account-preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false },
  });
  win.loadFile(path.join(__dirname, 'account.html'));
  win.on('blur', () => { if (!keepOpen && win && !win.isDestroyed()) win.close(); });
  win.on('closed', () => { win = null; closedAt = Date.now(); });
}

ipcMain.on('account:size', (e, h) => {
  if (!win || win.isDestroyed() || e.sender !== win.webContents) return;
  const { screen } = require('electron');
  const b = win.getBounds();
  const max = screen.getDisplayMatching(b).workArea.y + screen.getDisplayMatching(b).workArea.height - b.y - 8;
  win.setBounds({ x: b.x, y: b.y, width: WIDTH, height: Math.max(120, Math.min(Math.ceil(h), max)) });
  if (!win.isVisible()) win.show();
});

const fromAccount = (e) => win && !win.isDestroyed() && e.sender === win.webContents;
ipcMain.handle('account:get', (e) => fromAccount(e) ? view() : null);
ipcMain.handle('account:login', async (e) => {
  if (!fromAccount(e)) return null;
  keepOpen = true;
  try { await auth.login(); return { ok: true }; } catch (err) { return { ok: false, error: err.message }; } finally { keepOpen = false; }
});
ipcMain.handle('account:logout', (e) => { if (fromAccount(e)) auth.logout(); });
ipcMain.handle('account:sync', (e) => { if (fromAccount(e)) sync.syncNow(); });
ipcMain.handle('account:cookies-get', (e) => fromAccount(e) ? cookieSync.view() : null);
ipcMain.handle('account:cookies-set', (e, p) => {
  if (!fromAccount(e) || !p || typeof p !== 'object') return null;
  const r = cookieSync.update({ enabled: p.enabled, domains: p.domains, password: p.password });
  if (r.ok && cookieSync.ready()) sync.syncNow();
  return r;
});
ipcMain.handle('account:cookies-forget', (e) => { if (fromAccount(e)) cookieSync.forgetPassword(); });
ipcMain.handle('account:wipe', async (e) => {
  if (!fromAccount(e)) return null;
  keepOpen = true;
  const { response } = await dialog.showMessageBox(win, {
    type: 'warning', message: 'Xoá dữ liệu đồng bộ trên Google Drive?',
    detail: 'Xoá cấu hình, dấu trang, lịch sử đã đồng bộ khỏi Drive. Dữ liệu trên các máy vẫn còn; lần đồng bộ sau sẽ đẩy lên lại nếu vẫn đăng nhập.',
    buttons: ['Xoá trên Drive', 'Huỷ'], defaultId: 1, cancelId: 1,
  });
  keepOpen = false;
  if (response !== 0) return { ok: false };
  try { await sync.wipeRemote(); return { ok: true }; } catch (err) { return { ok: false, error: err.message }; }
});

module.exports = { toggleAccountPopup, push };
