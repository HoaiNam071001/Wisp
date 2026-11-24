// Thanh "Tìm trong trang" (Cmd/Ctrl+F): cửa sổ con nhỏ không viền (find.html) ở góc trên phải vùng trang,
// dùng webContents.findInPage của tab đang xem. Tạo mới mỗi lần mở, đóng khi đổi tab / cửa sổ chính đóng.
const { BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const tabs = require('./tabs');

const BAR_W = 380, BAR_H = 52;
let bar = null;
let target = null; // webContents đang được tìm

function alive() { return bar && !bar.isDestroyed(); }

function stopFind() {
  if (target && !target.isDestroyed()) target.stopFindInPage('clearSelection');
  target = null;
}

function closeFindBar() {
  stopFind();
  if (alive()) bar.close();
  bar = null;
}

function place() {
  const win = tabs.getWin();
  if (!win || !alive()) return;
  const cb = win.getContentBounds();
  bar.setBounds({ x: cb.x + cb.width - BAR_W - 16, y: cb.y + tabs.toolbarHeight() + 6, width: BAR_W, height: BAR_H });
}

function openFindBar() {
  const win = tabs.getWin();
  const w = tabs.wc();
  if (!win || !w) return;
  if (alive() && target === w) { bar.focus(); bar.webContents.send('find:focus'); return; }
  closeFindBar();
  target = w;
  bar = new BrowserWindow({
    parent: win, width: BAR_W, height: BAR_H, frame: false, transparent: true, resizable: false, movable: false,
    minimizable: false, maximizable: false, fullscreenable: false, skipTaskbar: true, hasShadow: false, show: false,
    backgroundColor: '#00000000',
    webPreferences: { preload: path.join(__dirname, 'find-preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false },
  });
  place();
  bar.loadFile(path.join(__dirname, 'find.html'));
  bar.once('ready-to-show', () => { if (alive()) { bar.show(); bar.focus(); } });
  w.on('found-in-page', onFound);
  win.on('resize', place); // thanh theo cửa sổ chính khi kéo / đổi cỡ
  win.on('move', place);
  const mine = bar;
  bar.on('closed', () => {
    w.removeListener('found-in-page', onFound);
    win.removeListener('resize', place);
    win.removeListener('move', place);
    if (bar === mine) { bar = null; stopFind(); }
  });
}

function onFound(_e, r) {
  if (alive()) bar.webContents.send('find:result', { active: r.activeMatchOrdinal, total: r.matches });
}

function fromBar(e) { return alive() && e.sender === bar.webContents; }
ipcMain.on('find:query', (e, text, forward, next) => {
  if (!fromBar(e) || !target || target.isDestroyed()) return;
  const q = String(text || '').slice(0, 200);
  if (!q) { target.stopFindInPage('clearSelection'); bar.webContents.send('find:result', { active: 0, total: 0 }); return; }
  target.findInPage(q, { forward: forward !== false, findNext: !!next });
});
ipcMain.on('find:close', (e) => { if (fromBar(e)) closeFindBar(); });

tabs.events.on('changed', () => { if (alive() && tabs.wc() !== target) closeFindBar(); });
tabs.events.on('window-closed', closeFindBar);

module.exports = { openFindBar, closeFindBar };
