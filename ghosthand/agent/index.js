// Agent cổng Ghosthand trong preload của tab (khung chính). Main gửi 'gh:call' {id, fn, args} → trả 'gh:reply'.
// Chạy trong thế giới riêng: không gắn gì vào window của trang, không đổi DOM (trang không thấy dấu vết).
// Iframe khác nguồn chưa hỗ trợ (docs/plan/01 – việc ⬜ iframe).
const { ipcRenderer } = require('electron');
const { parseSelector } = require('../selector');
const { clean, describe, place, coverOf, rectOf, shown } = require('./dom');
const { findAll, firstMatch, pickClear } = require('./find');
const { resolveRef, info } = require('./elements');
const { outline } = require('./outline');
const { readElement, pageText } = require('./read');

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
  find({ sels, all, visibleOnly = true }) {
    for (let i = 0; i < sels.length; i++) {
      const m = firstMatch([sels[i]]);
      const list = visibleOnly ? m.list : m.list.concat(hiddenOf(sels[i]));
      if (!list.length) continue;
      return { selectorIndex: i, found: (all ? list.slice(0, 50) : list.slice(0, 1)).map(el => info(el, true)), more: all ? Math.max(0, list.length - 50) : list.length - 1 };
    }
    return { selectorIndex: -1, found: [] };
  },
  // Chuẩn bị bấm / di chuột: cuộn vào giữa nếu cần, điểm bấm (toạ độ trang chính, CSS px), phần tử che điểm đó.
  locate(args) {
    const el = target(args, true);
    if (!shown(el)) throw err('not_visible', describe(el) + ' đang ẩn');
    let p = place(el);
    if (!p.inView) { el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }); p = place(el); }
    const off = args.offset;
    const x = off ? p.box.x + off.x : p.cx, y = off ? p.box.y + off.y : p.cy;
    return { ref: info(el, false).ref, x, y, rect: rectOf(p.box), inView: p.inView, covered: coverOf(el, x, y), url: location.href };
  },
  // Ô đang nhận phím có phải el (hoặc nằm trong el, vd. ô trong combobox) không. Trang thay ô khi bấm vào (thanh tìm
  // kiếm Wikipedia, ô dựng lại bằng Vue / React) → el đã gỡ: nhận ô nhập đang focus nếu nó nằm ngay điểm vừa bấm (x, y).
  focused({ ref, x, y }) {
    let a = document.activeElement;
    while (a && a.contentDocument && a.contentDocument.activeElement) a = a.contentDocument.activeElement;
    const editable = !!a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable);
    let el = null;
    try { el = resolveRef(ref); } catch (e) { if (e.code !== 'stale_ref') throw e; }
    let ok = !!a && !!el && (a === el || el.contains(a));
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
  quiet() { return { readyState: document.readyState, quietMs: Date.now() - lastMutation, url: location.href, title: document.title }; },
};

// Phần tử khớp nhưng đang ẩn (find visibleOnly = false).
function hiddenOf(sel) { return findAll(sel).filter(el => !shown(el)); }

function install() {
  if (document.documentElement) watchMutations();
  else document.addEventListener('DOMContentLoaded', watchMutations, { once: true });
  ipcRenderer.on('gh:call', (_e, { id, fn, args }) => {
    let reply;
    try {
      if (!FNS[fn]) throw err('bad_args', 'agent không có ' + fn);
      reply = { id, ok: true, result: FNS[fn](args || {}) };
    } catch (e) {
      reply = { id, ok: false, error: { code: e.code || 'internal', detail: clean(e.message) || 'lỗi trong trang' } };
    }
    ipcRenderer.send('gh:reply', reply);
  });
}

module.exports = { install };
