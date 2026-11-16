// Đổi phím trong nội dung tab: chặn phím ở before-input-event rồi gửi phím thay thế bằng sendInputEvent.
// Chỉ gắn vào tab nội dung – thanh địa chỉ / menu của app (cửa sổ khác) giữ nguyên phím thật.
// Cửa sổ cấu hình keys.html + IPC; cấu hình lưu ở config.json khoá keyRemap.
const { BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const tabs = require('./tabs');
const { loadConfig, saveConfig } = require('./config');
const { createRemapper, normalizeConfig } = require('./keyremap');

let state = normalizeConfig(loadConfig().keyRemap); // giữ trong RAM: không đọc đĩa mỗi lần bấm phím
const remapper = createRemapper(() => state);
let sending = false; // sendInputEvent có thể kích hoạt lại before-input-event → không đổi phím vừa gửi
let keysWin = null;

function attach(w) {
  w.on('before-input-event', (event, input) => {
    if (sending) return;
    const events = remapper.handle(input);
    if (!events) return;
    event.preventDefault();
    sending = true;
    try { for (const ev of events) w.sendInputEvent(ev); } catch (e) { console.error('Đổi phím:', e); } finally { sending = false; }
  });
}
tabs.events.on('created', (t) => attach(t.view.webContents));

function openKeysWindow() {
  if (keysWin && !keysWin.isDestroyed()) { keysWin.show(); keysWin.focus(); return; }
  keysWin = new BrowserWindow({
    width: 560, height: 640, minWidth: 400, minHeight: 420, title: 'Đổi phím',
    webPreferences: { preload: path.join(__dirname, 'keys-preload.js'), contextIsolation: true, nodeIntegration: false, worldSafeExecuteJavaScript: true },
  });
  keysWin.setMenuBarVisibility(false);
  keysWin.loadFile(path.join(__dirname, 'keys.html'));
}

const fromKeys = (e) => keysWin && !keysWin.isDestroyed() && e.sender === keysWin.webContents;
ipcMain.handle('keys:get', (e) => fromKeys(e) ? state : null);
ipcMain.handle('keys:set', (e, raw) => {
  if (!fromKeys(e)) return null;
  state = normalizeConfig(raw);
  saveConfig({ keyRemap: state });
  return state;
});

module.exports = { openKeysWindow };
