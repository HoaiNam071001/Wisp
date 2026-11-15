// Gọi hàm của agent trong preload tab (ghosthand/agent/index.js) qua IPC: 'gh:call' → 'gh:reply'.
const { ipcMain } = require('electron');
const { GhError } = require('./protocol');
const tabs = require('../tabs');
const dialogs = require('./dialogs');

// Hộp thoại JS đang mở chặn trang → nói rõ thay vì "không trả lời".
function timeoutError(wc) {
  const t = tabs.list().find(x => x.view.webContents === wc);
  const d = t && dialogs.current(t.id);
  if (d) return new GhError('timeout', `trang đang mở hộp thoại ${d.type} “${d.message.slice(0, 80)}” – trả lời bằng lệnh dialog`);
  return new GhError('timeout', 'trang không trả lời (đang tải hoặc bị treo) – chờ waitLoad rồi thử lại');
}

const pending = new Map(); // id → { wc, resolve, reject, timer }
let seq = 0;

ipcMain.on('gh:reply', (e, msg) => {
  const p = msg && pending.get(msg.id);
  if (!p || e.sender !== p.wc) return; // chỉ nhận trả lời từ đúng tab đã hỏi
  pending.delete(msg.id);
  clearTimeout(p.timer);
  if (msg.ok) p.resolve(msg.result);
  else p.reject(new GhError(msg.error.code, msg.error.detail));
});

// Trang đang tải / chưa có preload thì không ai trả lời → timeout (lệnh chờ tự gọi lại).
function callAgent(wc, fn, args, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    if (!wc || wc.isDestroyed()) { reject(new GhError('no_tab', 'tab đã đóng')); return; }
    const id = ++seq;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(timeoutError(wc));
    }, timeoutMs);
    pending.set(id, { wc, resolve, reject, timer });
    wc.send('gh:call', { id, fn, args });
  });
}

module.exports = { callAgent };
