// Popover Tài khoản Google (account.html): đăng nhập / đăng xuất, đồng bộ ngay, xoá dữ liệu trên Drive + IPC.
// Nút avatar trên thanh công cụ nhận { signedIn, initial } qua kênh 'account'.
const { ipcMain, dialog } = require('electron');
const popover = require('./popover');
const tabs = require('./tabs');
const auth = require('./google-auth');
const store = require('./token-store');
const sync = require('./sync');
const cookieSync = require('./cookie-sync');

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
  const win = popover.get('account');
  if (win) win.webContents.send('account:changed', v);
}
auth.events.on('changed', push);
sync.events.on('status', push);

let keepOpen = false; // đang đăng nhập ở trình duyệt ngoài / hộp xác nhận xoá: mất focus không được đóng popup

function toggleAccountPopup(anchor) {
  popover.toggle('account', anchor, { file: 'account.html', preload: 'account-preload.js', width: 340, keepOpen: () => keepOpen });
}

const fromAccount = (e) => popover.isFrom('account', e);
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
  const { response } = await dialog.showMessageBox(popover.get('account') || tabs.getWin(), {
    type: 'warning', message: 'Xoá dữ liệu đồng bộ trên Google Drive?',
    detail: 'Xoá cấu hình, dấu trang, lịch sử đã đồng bộ khỏi Drive. Dữ liệu trên các máy vẫn còn; lần đồng bộ sau sẽ đẩy lên lại nếu vẫn đăng nhập.',
    buttons: ['Xoá trên Drive', 'Huỷ'], defaultId: 1, cancelId: 1,
  });
  keepOpen = false;
  if (response !== 0) return { ok: false };
  try { await sync.wipeRemote(); return { ok: true }; } catch (err) { return { ok: false, error: err.message }; }
});

module.exports = { toggleAccountPopup, push };
