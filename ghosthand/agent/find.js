// Agent – tìm phần tử theo selector {by, value, exact, name} cùng cách so với autoclicker/internal/web/find.js
// (chữ chứa, không phân biệt hoa thường / khoảng trắng; "…" = đúng cả chuỗi), cả trong iframe cùng nguồn và shadow DOM mở.
// Mỗi hàm by… nhận một root: document hoặc shadow root (shadow root không có body / evaluate).
const { clean, tag, allRoots, inside, ownText, ariaLabel, IMPLICIT, accName, shown, place, coverOf } = require('./dom');

const norm = s => clean(s).toLowerCase();
const matches = (got, value, exact) => {
  const a = norm(got), b = norm(value);
  return a !== '' && (exact ? a === b : a.includes(b));
};
// Chữ nằm trực tiếp trong phần tử: nhãn “<span>*</span> Ngày sinh” khớp đúng cả chuỗi “Ngày sinh”.
const directText = el => Array.from(el.childNodes).filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.data).join(' ');
const ownMatches = (el, sel) => matches(ownText(el), sel.value, sel.exact) || (sel.exact && matches(directText(el), sel.value, true));
const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'HEAD']);
const isDoc = r => r.nodeType === Node.DOCUMENT_NODE;
const bodyOf = r => (isDoc(r) ? r.body : r);
const all = r => Array.from(bodyOf(r) ? bodyOf(r).querySelectorAll('*') : []).filter(el => !SKIP.has(tag(el)));
const deepest = list => { const set = new Set(list); return list.filter(el => !Array.from(el.children).some(c => set.has(c))); };
const inDocOrder = list => Array.from(new Set(list)).sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));

// Nhanh: text node chứa chữ → phần tử cha (+ ô nhập theo value / placeholder); chữ bị tách qua nhiều thẻ mới quét hết.
const byText = (sel, doc) => {
  const hits = [];
  const w = (isDoc(doc) ? doc : doc.ownerDocument).createTreeWalker(bodyOf(doc) || doc.documentElement, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());) {
    const p = n.parentElement;
    if (p && !SKIP.has(tag(p)) && matches(n.data, sel.value, false) && ownMatches(p, sel)) hits.push(p);
  }
  for (const el of doc.querySelectorAll('input, textarea')) if (matches(ownText(el), sel.value, sel.exact)) hits.push(el);
  if (hits.length) return inDocOrder(hits);
  return deepest(all(doc).filter(el => matches(el.textContent, sel.value, false) && ownMatches(el, sel)));
};
const byAria = (sel, doc) => all(doc).filter(el => (el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby')) && matches(ariaLabel(el), sel.value, sel.exact));
const byRole = (sel, doc) => {
  const explicit = all(doc).filter(el => el.hasAttribute('role') && el.getAttribute('role').trim().split(/\s+/)[0].toLowerCase() === sel.value);
  const implicit = IMPLICIT[sel.value] ? Array.from(doc.querySelectorAll(IMPLICIT[sel.value])).filter(el => !el.hasAttribute('role')) : [];
  const list = inDocOrder(explicit.concat(implicit));
  return sel.name ? list.filter(el => matches(accName(el), sel.name, false)) : list;
};
// label=: ô nhập của nhãn – label for / aria-labelledby, không có thì ô đầu tiên sau nhãn trong khối gần (≤ 4 tầng).
const FIELD = 'input:not([type=hidden]), textarea, select, [contenteditable=""], [contenteditable=true], [role=textbox], [role=combobox], [role=spinbutton]';
const after = (a, b) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
const fieldOf = lab => {
  const own = lab.closest('label');
  if (own && own.control) return own.control;
  const id = lab.id || (own && own.id);
  const by = id && lab.getRootNode().querySelector('[aria-labelledby~="' + CSS.escape(id) + '"]');
  if (by) return by;
  let box = own || lab;
  for (let up = 0; up < 4 && box.parentElement; up++) {
    box = box.parentElement;
    const f = Array.from(box.querySelectorAll(FIELD)).find(x => after(lab, x) && !(own || lab).contains(x));
    if (f) return f;
  }
  return null;
};
const byLabel = (sel, doc) => Array.from(new Set(byText(sel, doc).map(fieldOf).filter(Boolean)));
const byXPath = (v, doc) => {
  if (!isDoc(doc)) return []; // XPath không đi vào shadow root
  const r = doc.evaluate(v, doc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
  const out = [];
  for (let i = 0; i < r.snapshotLength; i++) if (r.snapshotItem(i).nodeType === Node.ELEMENT_NODE) out.push(r.snapshotItem(i));
  return out;
};
const findIn = (sel, doc) => {
  switch (sel.by) {
    case 'text': return byText(sel, doc);
    case 'aria': return byAria(sel, doc);
    case 'role': return byRole(sel, doc);
    case 'label': return byLabel(sel, doc);
    case 'css': return Array.from(doc.querySelectorAll(sel.value));
    case 'xpath': return byXPath(sel.value, doc);
  }
  throw new Error('cách tìm không hợp lệ: ' + sel.by);
};

// Mọi phần tử khớp một selector (mọi document + shadow root); css / xpath sai cú pháp → lỗi bad_args.
function findAll(sel, scope) {
  let list;
  try { list = [].concat(...allRoots().map(r => findIn(sel, r))); } catch (e) {
    throw Object.assign(new Error(`selector ${sel.by}=${sel.value} lỗi: ${e.message}`), { code: 'bad_args' });
  }
  return scope ? list.filter(el => inside(scope, el)) : list;
}

// Selector đầu tiên có phần tử đang hiện → {index, list (đang hiện), hidden}; không có → index -1.
function firstMatch(sels, scope) {
  let hidden = 0;
  for (let i = 0; i < sels.length; i++) {
    const found = findAll(sels[i], scope);
    const list = found.filter(shown);
    if (list.length) return { index: i, list, hidden: found.length - list.length };
    hidden = Math.max(hidden, found.length);
  }
  return { index: -1, list: [], hidden };
}

// Hộp thoại đang mở trên cùng (cùng cách chọn với autoclicker/internal/web/find.js): cái cuối trong trang có tâm
// nhìn thấy mà không bị che; không có thì cái cuối đang hiện; null = không có hộp thoại.
const DIALOG = '[role=dialog], [role=alertdialog], [aria-modal=true], dialog[open]';
function topDialog() {
  const ds = [].concat(...allRoots().map(r => Array.from(r.querySelectorAll(DIALOG)))).filter(shown);
  return ds.slice().reverse().find(d => { const p = place(d); return p.inView && !coverOf(d, p.cx, p.cy); }) || ds[ds.length - 1] || null;
}

// Sắp bấm: cái đầu đang trong vùng nhìn mà không bị che; không có thì cái đầu (để báo đúng phần tử che).
function pickClear(list) {
  for (const el of list.slice(0, 20)) {
    const p = place(el);
    if (p.inView && !coverOf(el, p.cx, p.cy)) return el;
  }
  return list[0];
}

module.exports = { matches, findAll, firstMatch, pickClear, topDialog };
