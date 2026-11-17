// Chọn element (bước 06): bật chế độ chọn trong trang (agent ghosthand/agent/pick.js), nhận lựa chọn của người dùng
// ('gh:pick') và đẩy sự kiện `pick` cho Ghosthand – Ghosthand thêm step rồi báo lại bằng lệnh pickDone (toast).
const { ipcMain, clipboard } = require('electron');
const tabs = require('../tabs');
const events = require('./events');
const { callAgent } = require('./agent-call');
const { resolveTab } = require('./target');
const { normalize } = require('./pick-payload');

// on: true / false ép trạng thái, bỏ trống = đảo. Lỗi (trang Flash, không có tab…) ném lên cho nơi gọi.
async function toggle(tabArg, on) {
  const t = resolveTab(tabArg);
  return callAgent(t.view.webContents, 'pickToggle', on === undefined ? {} : { on }, 3000);
}

// Từ thanh công cụ / menu / phím tắt: lỗi hiện ra bằng toast.
async function toggleActive() {
  try { await toggle(); } catch (e) { tabs.toast('Không bật được chọn element: ' + (e.detail || e.message)); }
}

ipcMain.on('gh:pick', (e, raw) => {
  const t = tabs.list().find(x => x.view.webContents === e.sender);
  const p = t && normalize(raw);
  if (!p) return;
  if (p.action === 'copy') { clipboard.writeText(p.selector); tabs.toast('Đã chép selector'); return; }
  if (!events.listening('pick')) { tabs.toast('Chưa có Ghosthand nhận – bật Ghosthand, nối với Wisp rồi thử lại (vẫn dùng được nút Chép)'); return; }
  events.emit('pick', Object.assign({ tab: t.id, url: e.sender.getURL() }, p));
  tabs.toast('Đã gửi cho Ghosthand…');
});

ipcMain.on('pick:toggle', e => { const w = tabs.getWin(); if (w && e.sender === w.webContents) toggleActive(); });

module.exports = {
  toggleActive,
  commands: {
    async pick(a) { return toggle(a.tab, a.on); },
    pickDone(a) { tabs.toast(a.message); return null; },
  },
};
