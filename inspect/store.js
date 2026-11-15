// Dữ liệu của Bảng kiểm tra: request HTTP, console + sự kiện, kết nối TCP, domain .swf đã thấy.
// Không require module khác của app: ai cũng ghi log được mà không tạo require vòng.
// inspect/window.js báo webContents của Bảng kiểm tra qua setInspector() để gửi thay đổi theo lô.
const LOG_MAX = 3000;
const httpLog = new Map();        // id → request
const appLog = [];                // console + sự kiện
const sockets = new Map();        // pid:fd:địa chỉ → kết nối TCP
const seenSwfHosts = new Set();   // domain của các file .swf trang đã tải (gợi ý thêm vào allowlist)
let logSeq = 0;
let inspectorWc = null;

function setInspector(wc) { inspectorWc = wc; }
function inspector() { return inspectorWc && !inspectorWc.isDestroyed() ? inspectorWc : null; }
function inspectorOpen() { return !!inspector(); }

// Gom thay đổi rồi gửi theo lô để bảng không bị giật khi trang tải hàng trăm file
const dirty = { http: new Map(), log: [], sock: new Map() };
let flushTimer = null;
function scheduleFlush() {
  if (flushTimer || !inspectorOpen()) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    const wc = inspector();
    if (!wc) return;
    wc.send('inspect:update', {
      http: [...dirty.http.values()], log: dirty.log, sock: [...dirty.sock.values()],
    });
    dirty.http.clear(); dirty.log = []; dirty.sock.clear();
  }, 200);
}

function trimMap(map) {
  while (map.size > LOG_MAX) map.delete(map.keys().next().value);
}

function addLog(level, kind, message, source = '') {
  const entry = { id: ++logSeq, time: Date.now(), level, kind, message: String(message).slice(0, 4000), source };
  appLog.push(entry);
  if (appLog.length > LOG_MAX) appLog.shift();
  if (inspectorOpen()) { dirty.log.push(entry); scheduleFlush(); }
}

function httpUpdate(id, patch) {
  const r = httpLog.get(id);
  if (!r) return;
  Object.assign(r, patch);
  if (inspectorOpen()) { dirty.http.set(id, r); scheduleFlush(); }
}

// Kết nối TCP đổi trạng thái → gửi lên bảng ở lô kế tiếp
function socketChanged(s) { if (inspectorOpen()) dirty.sock.set(s.key, s); }

module.exports = {
  httpLog, appLog, sockets, seenSwfHosts,
  setInspector, inspector, inspectorOpen, scheduleFlush, trimMap, addLog, httpUpdate, socketChanged,
};
