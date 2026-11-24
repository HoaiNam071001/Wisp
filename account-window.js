// Cửa sổ Tài khoản Google (account.html): đăng nhập / đăng xuất, đồng bộ ngay, xoá dữ liệu trên Drive + IPC.
// Nút avatar trên thanh công cụ nhận { signedIn, initial } qua kênh 'account'.
const { BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const tabs = require('./tabs');
const auth = require('./google-auth');
const store = require('./token-store');
const sync = require('./sync');

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

function openAccountWindow() {
  if (win && !win.isDestroyed()) { win.show(); win.focus(); return; }
  win = new BrowserWindow({
    width: 380, height: 460, minWidth: 340, minHeight: 360, title: 'Tài khoản Google', parent: tabs.getWin() || undefined,
    webPreferences: { preload: path.join(__dirname, 'account-preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, 'account.html'));
}

const fromAccount = (e) => win && !win.isDestroyed() && e.sender === win.webContents;
ipcMain.handle('account:get', (e) => fromAccount(e) ? view() : null);
ipcMain.handle('account:login', async (e) => {
  if (!fromAccount(e)) return null;
  try { await auth.login(); return { ok: true }; } catch (err) { return { ok: false, error: err.message }; }
});
ipcMain.handle('account:logout', (e) => { if (fromAccount(e)) auth.logout(); });
ipcMain.handle('account:sync', (e) => { if (fromAccount(e)) sync.syncNow(); });
ipcMain.handle('account:wipe', async (e) => {
  if (!fromAccount(e)) return null;
  const { response } = await dialog.showMessageBox(win, {
    type: 'warning', message: 'Xoá dữ liệu đồng bộ trên Google Drive?',
    detail: 'Xoá cấu hình, dấu trang, lịch sử đã đồng bộ khỏi Drive. Dữ liệu trên các máy vẫn còn; lần đồng bộ sau sẽ đẩy lên lại nếu vẫn đăng nhập.',
    buttons: ['Xoá trên Drive', 'Huỷ'], defaultId: 1, cancelId: 1,
  });
  if (response !== 0) return { ok: false };
  try { await sync.wipeRemote(); return { ok: true }; } catch (err) { return { ok: false, error: err.message }; }
});

module.exports = { openAccountWindow, push };
