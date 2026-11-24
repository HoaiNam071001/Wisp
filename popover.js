// Popover dưới một nút trên thanh công cụ (kiểu Chrome): cửa sổ con không viền, đóng khi mất focus, tự co theo nội dung.
// Dùng chung cho popover Tài khoản và Thông tin trang. Mỗi popover có một khoá; trang trong popover gửi 'popover:size'.
const { BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const tabs = require('./tabs');

const wins = new Map();      // khoá → { win, keepOpen }
const closedAt = new Map();  // khoá → mốc đóng gần nhất (cú bấm nút làm popover mất focus thì không mở lại ngay)

function get(key) { const p = wins.get(key); return p && !p.win.isDestroyed() ? p.win : null; }
function isFrom(key, e) { const w = get(key); return !!w && e.sender === w.webContents; }
function close(key) { const w = get(key); if (w) w.close(); }

// opts: { file, preload, width, keepOpen?: () => boolean }; anchor: { x, y, w } theo toạ độ trang của thanh công cụ
function toggle(key, anchor, opts) {
  const main = tabs.getWin();
  if (!main) return null;
  if (get(key)) { close(key); return null; }
  if (Date.now() - (closedAt.get(key) || 0) < 250) return null;
  const cb = main.getContentBounds();
  const a = anchor && typeof anchor === 'object' ? anchor : { x: cb.width - opts.width, y: 40, w: 0 };
  const x = Math.round(Math.max(cb.x + 8, Math.min(cb.x + a.x + a.w - opts.width, cb.x + cb.width - opts.width - 8)));
  const win = new BrowserWindow({
    parent: main, x, y: Math.round(cb.y + a.y + 4), width: opts.width, height: 240,
    frame: false, resizable: false, movable: false, minimizable: false, maximizable: false, fullscreenable: false,
    skipTaskbar: true, show: false, hasShadow: true, roundedCorners: true,
    webPreferences: { preload: path.join(__dirname, opts.preload), contextIsolation: true, nodeIntegration: false, sandbox: false },
  });
  wins.set(key, { win, keepOpen: opts.keepOpen || (() => false) });
  win.loadFile(path.join(__dirname, opts.file));
  win.on('blur', () => { const p = wins.get(key); if (p && !p.keepOpen() && !win.isDestroyed()) win.close(); });
  win.on('closed', () => { if (wins.get(key) && wins.get(key).win === win) wins.delete(key); closedAt.set(key, Date.now()); });
  return win;
}

ipcMain.on('popover:size', (e, h) => {
  for (const { win } of wins.values()) {
    if (win.isDestroyed() || e.sender !== win.webContents) continue;
    const b = win.getBounds();
    const area = screen.getDisplayMatching(b).workArea;
    win.setBounds({ x: b.x, y: b.y, width: b.width, height: Math.max(80, Math.min(Math.ceil(h), area.y + area.height - b.y - 8)) });
    if (!win.isVisible()) win.show();
  }
});

module.exports = { toggle, get, isFrom, close };
