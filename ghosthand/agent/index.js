// Agent cổng Ghosthand trong preload của tab. Main gửi 'gh:call' {id, fn, args} → trả 'gh:reply'.
// Chạy trong thế giới riêng: không gắn gì vào window của trang, không đổi DOM (trang không thấy dấu vết).
// Khung chính lo mọi document cùng nguồn; frame khác nguồn với khung cha có agent riêng (báo main 'gh:frame'),
// main ghép kết quả (ghosthand/page-call.js) và gửi kèm args._frame = gốc toạ độ + clip của frame trong trang chính.
const { ipcRenderer } = require('electron');
const { parseSelector } = require('../selector');
const { setBase, inside, allRoots, pathOf, frameContent, frameOffset, view, clean, describe, place, coverOf, rectOf, shown } = require('./dom');
const { findAll, firstMatch, pickClear, topDialog } = require('./find');
const { PAGE, resolveRef, info } = require('./elements');
const { outline } = require('./outline');
const { readElement, pageText } = require('./read');
const form = require('./form');

const err = (code, detail) => Object.assign(new Error(detail), { code });
const REF_RE = /^[a-z0-9]{6}\.\d+$/;

// DOM đổi lần cuối – waitLoad idle / settle chờ trang đứng yên
let lastMutation = Date.now();
function watchMutations() {
  new MutationObserver(() => { lastMutation = Date.now(); })
    .observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
}

// Đích của lệnh: ref, hoặc phần tử hiện đầu tiên của selector đầu tiên tìm thấy (sắp bấm: cái không bị che).
function target({ ref, sels }, forAction) {
  if (ref) return resolveRef(ref);
  const m = firstMatch(sels);
  if (m.index < 0) {
    if (m.hidden) throw err('not_visible', `tìm thấy ${m.hidden} phần tử khớp nhưng đang ẩn`);
    throw err('not_found', 'không thấy phần tử khớp selector nào');
  }
  return forAction ? pickClear(m.list) : m.list[0];
}

const FNS = {
  // scope "dialog": chỉ trong hộp thoại đang mở trên cùng. covered = phần tử đè lên tâm (đang trong khung nhìn).
  // brief: không tính selector bền (nhanh – Ghosthand chạy kịch bản chỉ cần ref + khung).
  find({ sels, all, visibleOnly = true, scope, brief }) {
    const box = scopeOf(scope);
    if (box === undefined) return { selectorIndex: -1, found: [], hidden: 0, noDialog: true };
    let hidden = 0;
    for (let i = 0; i < sels.length; i++) {
      const m = firstMatch([sels[i]], box);
      hidden = Math.max(hidden, m.hidden);
      const list = visibleOnly ? m.list : m.list.concat(hiddenOf(sels[i], box));
      if (!list.length) continue;
      return { selectorIndex: i, found: (all ? list.slice(0, 50) : list.slice(0, 1)).map(el => foundInfo(el, !brief)), more: all ? Math.max(0, list.length - 50) : list.length - 1 };
    }
    return { selectorIndex: -1, found: [], hidden };
  },
  // Chuẩn bị bấm / di chuột: cuộn vào giữa nếu cần, điểm bấm (toạ độ trang chính, CSS px), phần tử che điểm đó.
  locate(args) {
    const el = target(args, true);
    if (!shown(el)) throw err('not_visible', describe(el) + ' đang ẩn');
    let p = place(el);
    const scrolled = !p.inView;
    if (scrolled) { el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }); p = place(el); }
    const off = args.offset;
    const x = off ? p.box.x + off.x : p.cx, y = off ? p.box.y + off.y : p.cy;
    // scrolled: frame khác nguồn cuộn thì cả trang cha có thể cuộn theo → main tính lại gốc toạ độ rồi hỏi lại
    return { ref: info(el, false).ref, x, y, rect: rectOf(p.box), inView: p.inView, covered: coverOf(el, x, y), scrolled, url: location.href };
  },
  // Ô đang nhận phím có phải el (hoặc nằm trong el, vd. ô trong combobox) không. Trang thay ô khi bấm vào (thanh tìm
  // kiếm Wikipedia, ô dựng lại bằng Vue / React) → el đã gỡ: nhận ô nhập đang focus nếu nó nằm ngay điểm vừa bấm (x, y).
  focused({ ref, x, y }) {
    let a = document.activeElement;
    for (;;) {
      if (a && a.shadowRoot && a.shadowRoot.activeElement) a = a.shadowRoot.activeElement;
      else if (a && a.contentDocument && a.contentDocument.activeElement) a = a.contentDocument.activeElement;
      else break;
    }
    const editable = !!a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable);
    let el = null;
    try { el = resolveRef(ref); } catch (e) { if (e.code !== 'stale_ref') throw e; }
    let ok = !!a && !!el && inside(el, a);
    if (!ok && !el && editable) {
      const r = place(a).box;
      ok = x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
    }
    return { ok, ref: ok ? info(a, false).ref : ref, active: ok ? '' : describe(a) };
  },
  // Xoá chữ cũ: chọn hết nội dung ô (người dùng bấm Backspace sau đó). false = để main dùng selectAll.
  selectText({ ref }) {
    const el = resolveRef(ref);
    if (typeof el.select === 'function' && /^(INPUT|TEXTAREA)$/.test(el.tagName)) { el.select(); return true; }
    return false;
  },
  read(args) {
    const el = target(args, false);
    return { ref: info(el, false).ref, value: readElement(el, args.what) };
  },
  pageText,
  outline({ root, maxNodes, visibleOnly }) {
    let rootEl = null;
    if (root) rootEl = REF_RE.test(root) ? resolveRef(root) : target({ sels: [parseSelector(root)] }, false);
    return outline({ root: rootEl, maxNodes, visibleOnly });
  },
  // waitFor: điều kiện đã thoả chưa (main gọi lặp tới hết giờ).
  check({ sels, state = 'visible' }) {
    const m = firstMatch(sels);
    if (state === 'hidden') return { met: m.index < 0 };
    if (m.index < 0) return { met: false };
    const el = m.list[0];
    if (state === 'enabled' && (el.disabled || el.getAttribute('aria-disabled') === 'true')) return { met: false };
    return { met: true, element: info(el, true) };
  },
  rect(args) { const el = target(args, false); return { rect: rectOf(place(el).box) }; },
  // Điểm giữa khung nhìn (lăn chuột khi không có đích).
  viewport() { return { x: innerWidth / 2, y: innerHeight / 2, w: innerWidth, h: innerHeight }; },
  selectPrep(args) { const el = target(args, false); return Object.assign({ ref: info(el, false).ref }, form.selectPrep(el, args)); },
  selectResult({ ref, index }) { return form.selectResult(resolveRef(ref), index); },
  checked(args) { const el = target(args, false); return { ref: info(el, false).ref, on: form.checkedOf(el) }; },
  gameRect: form.gameRect,
  // Ghép nhiều frame (page-call.js): selector đầu tiên có phần tử ở frame này; từng selector có khớp không.
  firstIndex({ sels, visibleOnly = true, scope }) {
    const box = scopeOf(scope);
    if (box === undefined) return { index: -1, hidden: 0, noDialog: true };
    if (visibleOnly) { const m = firstMatch(sels, box); return { index: m.index, hidden: m.hidden }; }
    return { index: sels.findIndex(s => findAll(s, box).length > 0), hidden: 0 };
  },
  matchesAny({ sels }) { return sels.map(s => firstMatch([s]).index === 0); },
  // Frame khác nguồn trong frame này: đường dẫn + vùng nội dung và phần nhìn thấy, theo toạ độ của frame này.
  frames() {
    const out = [];
    for (const r of allRoots()) for (const f of r.querySelectorAll('iframe, frame')) {
      let reachable = false;
      try { reachable = !!f.contentDocument; } catch (e) { /* khác nguồn */ }
      if (reachable || !f.contentWindow) continue;
      const c = frameContent(f), o = frameOffset(f.ownerDocument.defaultView);
      const box = { x: c.x + o.x, y: c.y + o.y, w: c.w, h: c.h };
      out.push({ path: pathOf(f.contentWindow), box, clip: visiblePart(f, box) });
    }
    return { self: pathOf(window), page: PAGE, frames: out };
  },
  // Thẻ iframe của frame con (path) có bị phần tử khác của frame này che tại (x, y) không.
  frameCover({ path, x, y }) {
    const f = frameEl(path);
    return { covered: f ? coverOf(f, x, y) : '' };
  },
  quiet() { return { readyState: document.readyState, quietMs: Date.now() - lastMutation, url: location.href, title: document.title }; },
};

// Phần nhìn thấy của khung box (thẻ frame f): cắt theo vùng nhìn và các frame cùng nguồn chứa nó.
function visiblePart(f, box) {
  const cut = (a, b) => {
    const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);
    return { x, y, w: Math.max(0, Math.min(a.x + a.w, b.x + b.w) - x), h: Math.max(0, Math.min(a.y + a.h, b.y + b.h) - y) };
  };
  let r = cut(box, view());
  for (let p = f.ownerDocument.defaultView.frameElement; p; p = p.ownerDocument.defaultView.frameElement) {
    const c = frameContent(p), o = frameOffset(p.ownerDocument.defaultView);
    r = cut(r, { x: c.x + o.x, y: c.y + o.y, w: c.w, h: c.h });
  }
  return r;
}
function frameEl(path) {
  for (const r of allRoots()) for (const f of r.querySelectorAll('iframe, frame')) if (f.contentWindow && pathOf(f.contentWindow) === path) return f;
  return null;
}

// Phần tử khớp nhưng đang ẩn (find visibleOnly = false).
function hiddenOf(sel, box) { return findAll(sel, box).filter(el => !shown(el)); }

// Phạm vi tìm: null = cả trang, undefined = cần hộp thoại mà trang không có.
function scopeOf(scope) { return scope === 'dialog' ? topDialog() || undefined : null; }

function foundInfo(el, withSelectors) {
  const out = info(el, withSelectors), p = place(el);
  out.covered = p.inView ? coverOf(el, p.cx, p.cy) : '';
  return out;
}

// sub = frame con khác nguồn với khung cha: báo main để được gọi riêng (sendToFrame), báo lại khi frame bị gỡ / chuyển trang.
function install(sub) {
  if (document.documentElement) watchMutations();
  else document.addEventListener('DOMContentLoaded', watchMutations, { once: true });
  if (sub) {
    ipcRenderer.send('gh:frame', { page: PAGE });
    addEventListener('pagehide', () => ipcRenderer.send('gh:frame-gone', { page: PAGE }));
  }
  ipcRenderer.on('gh:call', (_e, { id, fn, args }) => {
    let reply;
    try {
      if (!FNS[fn]) throw err('bad_args', 'agent không có ' + fn);
      const a = args || {};
      setBase(a._frame);
      reply = { id, ok: true, result: FNS[fn](a) };
    } catch (e) {
      reply = { id, ok: false, error: { code: e.code || 'internal', detail: clean(e.message) || 'lỗi trong trang' } };
    }
    ipcRenderer.send('gh:reply', reply);
  });
}

module.exports = { install };
