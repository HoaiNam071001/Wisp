// Hộp thoại JS (alert / confirm / prompt / beforeunload) của tab. Electron 11 không báo cho main → webContents.debugger,
// chỉ domain Page (không Runtime / không chạy JS trong trang – trang không thấy). Chỉ gắn khi có client subscribe
// 'dialog' (enable(true)), gỡ khi không còn ai (enable(false)). Không mở cổng CDP ra ngoài.
const { EventEmitter } = require('events');
const tabs = require('../tabs');
const { fail } = require('./protocol');
const { addLog } = require('../inspect/store');

const events = new EventEmitter(); // 'open' {tab, type, message, url}
const opened = new Map();          // tab id → hộp đang mở
const handlers = new Map();        // tab id → { onMsg, onDetach } đã gắn vào debugger
let on = false;

function attach(t) {
  const w = t.view.webContents;
  if (w.isDestroyed() || handlers.has(t.id)) return;
  try { w.debugger.attach('1.3'); } catch (e) {
    // DevTools / client khác đang gắn → không theo dõi được tab này
    addLog('warning', 'event', `Ghosthand: không theo dõi được hộp thoại tab ${t.id} – ${e.message}`);
    return;
  }
  const onMsg = (_e, method, p) => {
    if (method === 'Page.javascriptDialogOpening') {
      const d = { tab: t.id, type: p.type, message: String(p.message || '').slice(0, 2000), url: p.url };
      opened.set(t.id, d);
      events.emit('open', d);
    } else if (method === 'Page.javascriptDialogClosed') opened.delete(t.id);
  };
  // tab bị huỷ / DevTools giành debugger → quên tab (lần 'changed' sau gắn lại nếu được)
  const onDetach = () => { handlers.delete(t.id); opened.delete(t.id); w.debugger.removeListener('message', onMsg); };
  w.debugger.on('message', onMsg);
  w.debugger.once('detach', onDetach);
  handlers.set(t.id, { onMsg, onDetach });
  w.debugger.sendCommand('Page.enable').catch(e => addLog('warning', 'event', 'Ghosthand: Page.enable lỗi – ' + e.message));
}

function detach(t) {
  const h = handlers.get(t.id), w = t.view.webContents;
  handlers.delete(t.id);
  opened.delete(t.id);
  if (!h || w.isDestroyed()) return;
  w.debugger.removeListener('message', h.onMsg);
  w.debugger.removeListener('detach', h.onDetach);
  try { w.debugger.detach(); } catch (e) { /* đã gỡ */ }
}

const attachAll = () => tabs.list().forEach(attach);

function enable(want) {
  if (want === on) return;
  on = want;
  if (on) { attachAll(); tabs.events.on('changed', attachAll); } // tab mới mở sau đó
  else { tabs.events.removeListener('changed', attachAll); tabs.list().forEach(detach); }
}

// Trả lời hộp đang mở: accept = OK (prompt điền text), false = Huỷ.
async function answer(t, accept, text) {
  if (!handlers.has(t.id)) fail('bad_args', 'chưa subscribe "dialog" – gọi subscribe {events:["dialog"]} trước');
  if (!opened.has(t.id)) fail('not_found', 'tab không có hộp thoại đang mở');
  await t.view.webContents.debugger.sendCommand('Page.handleJavaScriptDialog', { accept, promptText: text || '' });
  opened.delete(t.id);
  return { tab: t.id, accept };
}

module.exports = { events, enable, answer, current: id => opened.get(id) || null };
