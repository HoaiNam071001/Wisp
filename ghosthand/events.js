// Sự kiện Wisp đẩy cho Ghosthand (lệnh subscribe): {"event":"navigate","data":{tab, url}} – navigate, popup,
// download, dialog. Mỗi kết nối một danh sách; lệnh dialog trả lời hộp thoại JS đang mở.
const { session } = require('electron');
const tabs = require('../tabs');
const dialogs = require('./dialogs');
const { resolveTab } = require('./target');

const subs = new Map(); // conn (có .send(text)) → Set tên sự kiện
let wired = false;

function emit(event, data) {
  const text = JSON.stringify({ event, data });
  for (const [conn, set] of subs) if (set.has(event)) conn.send(text);
}

function tabOfWc(wc) { const t = tabs.list().find(x => x.view.webContents === wc); return t ? t.id : null; }

function wire() {
  if (wired) return;
  wired = true;
  tabs.events.on('visit', (t, url) => emit('navigate', { tab: t.id, url }));
  tabs.events.on('opened', (nt, opener, url) => emit('popup', { tab: nt.id, opener: opener.id, url }));
  session.defaultSession.on('will-download', (_e, item, wc) => emit('download', { tab: tabOfWc(wc), url: item.getURL(), file: item.getFilename() }));
  dialogs.events.on('open', d => emit('dialog', d));
  // hộp đã đóng (client trả lời hoặc người dùng tự bấm): {tab, closed: true}
  dialogs.events.on('closed', d => emit('dialog', { tab: d.tab, closed: true }));
}

// Bật debugger theo dõi hộp thoại chỉ khi còn kết nối cần.
function syncDialogs() { dialogs.enable(Array.from(subs.values()).some(s => s.has('dialog'))); }

// subscribe thay cả danh sách (events: [] = bỏ hết).
function subscribe(conn, events) {
  wire();
  subs.set(conn, new Set(events));
  syncDialogs();
  return { events };
}

// Có kết nối nào đang nghe sự kiện này không.
function listening(event) { return Array.from(subs.values()).some(s => s.has(event)); }

function drop(conn) { if (subs.delete(conn)) syncDialogs(); }

module.exports = {
  drop, emit, listening,
  commands: {
    subscribe: (a, conn) => subscribe(conn, a.events),
    dialog: a => dialogs.answer(resolveTab(a.tab), a.accept, a.text),
  },
};
