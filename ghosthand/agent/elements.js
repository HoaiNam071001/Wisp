// Agent – ref của phần tử + mô tả phần tử trả cho Ghosthand (selector bền đã kiểm).
const { parseSelector, stableFirst } = require('../selector');
const { clean, tag, allDocs, ownText, ariaLabel, accName, roleOf, usable, autoLike, cssPath, shown, place, rectOf } = require('./dom');
const { firstMatch } = require('./find');

// ref = "<mã lần tải trang>.<số>": preload chạy lại mỗi lần tải trang → mã mới → ref cũ thành stale_ref.
const PAGE = Math.random().toString(36).slice(2, 8);
const byNum = new Map();
const numOf = new WeakMap();
let seq = 0;

function refOf(el) {
  let n = numOf.get(el);
  if (!n) { n = ++seq; numOf.set(el, n); byNum.set(n, el); }
  return PAGE + '.' + n;
}

function resolveRef(ref) {
  const [page, num] = String(ref).split('.');
  const el = page === PAGE ? byNum.get(+num) : null;
  if (!el || !el.isConnected) {
    const why = page === PAGE ? 'phần tử đã bị gỡ khỏi trang' : 'trang đã tải lại';
    throw Object.assign(new Error(`ref ${ref} không còn dùng được (${why}) – tìm lại bằng selector`), { code: 'stale_ref' });
  }
  return el;
}

// Ứng viên theo thứ tự độ bền (docs/plan/01): role[name] → aria → css data-testid / #id không tự sinh → text → đường CSS.
function candidates(el) {
  const out = [];
  const role = roleOf(el), name = clean(accName(el));
  if (role && usable(name)) out.push(`role=${role}[name="${name}"]`);
  const aria = clean(ariaLabel(el));
  if (usable(aria)) out.push('aria=' + aria);
  for (const a of ['data-testid', 'data-test', 'data-qa']) {
    const v = el.getAttribute(a);
    if (usable(v)) out.push(`css=${tag(el).toLowerCase()}[${a}="${v}"]`);
  }
  if (el.id && !autoLike(el.id)) out.push('css=#' + CSS.escape(el.id));
  const nm = el.getAttribute('name');
  if (usable(nm)) out.push(`css=${tag(el).toLowerCase()}[name="${nm}"]`);
  const text = clean(ownText(el) || '');
  if (usable(text)) out.push('text=' + text);
  if (role) out.push('role=' + role);
  out.push('css=' + cssPath(el));
  return Array.from(new Set(out)); // đường CSS dừng ở #id → có thể trùng ứng viên id
}

// Selector đã kiểm: tìm lại ra đúng el (phần tử hiện đầu tiên khớp); dạng chứa phần cố định đứng trước.
function selectorsOf(el, max) {
  const ok = [];
  for (const c of candidates(el)) {
    if (ok.length >= max) break;
    try {
      const m = firstMatch([parseSelector(c)]);
      if (m.list[0] === el) ok.push(c);
    } catch (e) { /* ứng viên sai cú pháp – bỏ */ }
  }
  const out = stableFirst(ok).filter(s => {
    try { return firstMatch([parseSelector(s)]).list[0] === el; } catch (e) { return false; }
  });
  return out.length ? out : ['css=' + cssPath(el)];
}

// Mô tả một phần tử; withSelectors = false khi chỉ cần toạ độ (nhanh hơn).
function info(el, withSelectors) {
  const p = place(el);
  const out = {
    ref: refOf(el), role: roleOf(el), name: clean(accName(el)).slice(0, 120), text: clean(ownText(el) || '').slice(0, 200),
    rect: rectOf(p.box), inView: p.inView, visible: shown(el), frame: Math.max(0, allDocs().indexOf(el.ownerDocument)),
  };
  if (withSelectors) {
    const sels = selectorsOf(el, 4);
    out.selector = sels[0];
    out.selectors = sels;
  }
  return out;
}

module.exports = { refOf, resolveRef, info, selectorsOf };
