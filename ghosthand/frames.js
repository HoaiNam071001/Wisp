// Sổ agent của frame khác nguồn theo tab (docs/plan/01): agent báo 'gh:frame' khi tải, 'gh:frame-gone' khi frame bị gỡ /
// chuyển trang; khung chính chuyển trang → xoá cả tab. Khung chính không đăng ký – gọi qua wc.send như cũ.
const { ipcMain } = require('electron');

const byWc = new Map(); // wc.id → Map("pid:fid" → {pid, fid, page})

function framesOf(wc) {
  let m = byWc.get(wc.id);
  if (!m) {
    m = new Map();
    byWc.set(wc.id, m);
    wc.on('did-start-navigation', (d) => { if (d.isMainFrame && !d.isSameDocument) m.clear(); });
    wc.once('destroyed', () => byWc.delete(wc.id));
  }
  return m;
}

ipcMain.on('gh:frame', (e, msg) => {
  if (!msg || typeof msg.page !== 'string') return;
  framesOf(e.sender).set(e.processId + ':' + e.frameId, { pid: e.processId, fid: e.frameId, page: msg.page });
});
ipcMain.on('gh:frame-gone', (e, msg) => {
  const m = byWc.get(e.sender.id), key = e.processId + ':' + e.frameId;
  // frame chuyển trang: agent mới có thể đã báo trước khi trang cũ gửi gone → chỉ xoá khi đúng mã lần tải
  if (m && m.has(key) && msg && m.get(key).page === msg.page) m.delete(key);
});

// Agent frame con của tab (thứ tự đăng ký; page-call sắp theo đường dẫn sau khi hỏi frames()).
function remotes(wc) { const m = byWc.get(wc.id); return m ? Array.from(m.values()) : []; }
function drop(wc, f) { const m = byWc.get(wc.id); if (m) m.delete(f.pid + ':' + f.fid); }

module.exports = { remotes, drop };
