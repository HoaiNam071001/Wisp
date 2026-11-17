// Agent cổng Ghosthand – hàm DOM dùng chung (chép từ autoclicker/internal/web/common.js, sửa cho Chromium 87).
// Chạy trong preload (thế giới riêng của tab): DOM chung với trang, biến JS thì không – trang không thấy gì của Wisp.
// Chromium 87: không có Element.checkVisibility; tránh ?. / ?? cho đồng bộ quy ước Node 12.
const clean = s => (s || '').replace(/\s+/g, ' ').trim();
const tag = el => el.tagName; // so tagName thay vì instanceof: phần tử trong iframe thuộc realm khác

const describe = el => {
  if (!el || !el.tagName) return 'phần tử khác';
  let s = el.tagName.toLowerCase();
  if (el.id) s += '#' + el.id;
  const t = clean(el.innerText).slice(0, 40);
  return t ? s + ' “' + t + '”' : s;
};

// Agent của frame khác nguồn với khung cha (docs/plan/01): main gửi kèm gốc toạ độ của frame trong trang chính +
// vùng nhìn thấy (clip) – toạ độ trả về luôn theo trang chính. Khung chính: gốc 0, clip = viewport.
let base = { x: 0, y: 0, clip: null };
const setBase = b => { base = b && typeof b.x === 'number' ? b : { x: 0, y: 0, clip: null }; };
const view = () => base.clip || { x: 0, y: 0, w: innerWidth, h: innerHeight };

// Cha theo cây phẳng (qua ranh shadow root): phần tử trong shadow DOM mở vẫn tính tổ tiên là host.
const up = e => e.parentElement || (e.parentNode && e.parentNode.host) || null;
const inside = (outer, el) => { for (let e = el; e; e = up(e)) if (e === outer) return true; return false; };
// Shadow root mở trong root (document / shadow root), cả lồng nhau. Shadow đóng: trang giấu – bỏ qua.
const shadowsIn = root => {
  const out = [];
  for (const el of root.querySelectorAll('*')) if (el.shadowRoot) out.push(el.shadowRoot, ...shadowsIn(el.shadowRoot));
  return out;
};
const rootsOf = doc => [doc].concat(shadowsIn(doc));

// document con cùng nguồn (iframe / frame, cả trong shadow DOM); khác nguồn thì contentDocument null / ném lỗi → bỏ
// qua (frame đó có agent riêng).
const childDocs = doc => {
  const out = [];
  for (const r of rootsOf(doc)) for (const f of r.querySelectorAll('iframe, frame')) {
    try { if (f.contentDocument && f.contentDocument.documentElement) out.push({ frame: f, doc: f.contentDocument }); } catch (e) { /* khác nguồn */ }
  }
  return out;
};
const allDocs = () => {
  const docs = [];
  const walk = doc => { docs.push(doc); for (const c of childDocs(doc)) walk(c.doc); };
  walk(document);
  return docs;
};
// Mọi chỗ tìm: document + shadow root mở của chúng.
const allRoots = () => [].concat(...allDocs().map(rootsOf));
// Đường tới frame từ trang chính theo chỉ số trong window.frames ("" = trang chính, "1.0") – đọc được cả khi khác nguồn.
const pathOf = w => {
  const p = [];
  for (; w && w !== w.parent; w = w.parent) {
    const fs = w.parent.frames;
    let i = 0;
    while (i < fs.length && fs[i] !== w) i++;
    p.unshift(i);
  }
  return p.join('.');
};

// Vùng nội dung của frame trong viewport của document chứa nó (cộng viền + padding).
const frameContent = f => {
  const r = f.getBoundingClientRect(), cs = f.ownerDocument.defaultView.getComputedStyle(f);
  const pl = parseFloat(cs.paddingLeft), pt = parseFloat(cs.paddingTop);
  return { x: r.left + f.clientLeft + pl, y: r.top + f.clientTop + pt,
    w: f.clientWidth - pl - parseFloat(cs.paddingRight), h: f.clientHeight - pt - parseFloat(cs.paddingBottom) };
};
// Độ lệch toạ độ client của window w so với trang chính (cộng dồn qua frame lồng nhau + gốc của agent).
const frameOffset = w => {
  let x = base.x, y = base.y;
  for (let f = w.frameElement; f; f = f.ownerDocument.defaultView.frameElement) {
    const c = frameContent(f);
    x += c.x; y += c.y;
  }
  return { x, y };
};

// Chữ theo cách người dùng thấy: nút input → value, ô nhập → placeholder.
const ownText = el => {
  if (tag(el) === 'INPUT') return ['button', 'submit', 'reset'].includes(el.type) ? el.value : el.placeholder;
  if (tag(el) === 'TEXTAREA') return el.placeholder;
  return el.innerText;
};
const ariaLabel = el => {
  const ids = (el.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean);
  if (ids.length) return ids.map(id => { const x = el.getRootNode().getElementById(id); return x ? x.innerText : ''; }).join(' ');
  return el.getAttribute('aria-label') || '';
};
// Vai trò ngầm định của thẻ (rút gọn theo HTML-ARIA; ô mật khẩu tính là textbox) – giống Ghosthand.
const IMPLICIT = {
  button: 'button, input[type=button], input[type=submit], input[type=reset], input[type=image], summary',
  link: 'a[href], area[href]',
  textbox: 'input:not([type]), input[type=text], input[type=email], input[type=tel], input[type=url], input[type=password], textarea',
  searchbox: 'input[type=search]', checkbox: 'input[type=checkbox]', radio: 'input[type=radio]', slider: 'input[type=range]',
  spinbutton: 'input[type=number]', combobox: 'select', option: 'option', heading: 'h1, h2, h3, h4, h5, h6',
  img: 'img[alt]:not([alt=""])', list: 'ul, ol', listitem: 'li', navigation: 'nav', main: 'main', dialog: 'dialog',
  form: 'form', article: 'article', table: 'table', row: 'tr', cell: 'td', columnheader: 'th',
};
// Tên truy cập rút gọn: aria → <label> → alt / title / placeholder → chữ.
const accName = el => {
  const a = ariaLabel(el);
  if (a) return a;
  if (el.labels && el.labels.length) return Array.from(el.labels).map(l => l.innerText).join(' ');
  return el.getAttribute('alt') || el.getAttribute('title') || el.getAttribute('placeholder') || ownText(el) || '';
};
const roleOf = el => {
  if (el.hasAttribute('role')) return el.getAttribute('role').trim().split(/\s+/)[0].toLowerCase();
  return Object.keys(IMPLICIT).find(k => el.matches(IMPLICIT[k])) || '';
};

// Giá trị dùng được trong selector sinh tự động (ngắn, không nháy / biến).
const usable = s => !!s && s.length <= 60 && !s.includes('"') && !s.includes('{{');
// id / giá trị do framework sinh (":r1:", "x1n2onr6", "ember123") – đổi mỗi lần dựng trang.
const autoLike = s => /[:]|\d{3,}|^[a-z]{1,3}\d|[a-z0-9]{8,}/.test(s) && !/^[a-z]+(-[a-z]+)*$/.test(s);
const cssPath = el => {
  const parts = [];
  for (let e = el; e && e.nodeType === Node.ELEMENT_NODE && tag(e) !== 'HTML'; e = e.parentElement) {
    if (e.id && !autoLike(e.id)) { parts.unshift('#' + CSS.escape(e.id)); break; }
    const same = Array.from(e.parentElement ? e.parentElement.children : []).filter(c => tag(c) === tag(e));
    const t = tag(e).toLowerCase();
    parts.unshift(same.length > 1 ? `${t}:nth-of-type(${same.indexOf(e) + 1})` : t);
  }
  return parts.join(' > ');
};

// Đang hiện: có cỡ, không ẩn / trong suốt (thay cho checkVisibility – Chromium 87 chưa có).
const shown = el => {
  const r = el.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) return false;
  const win = el.ownerDocument.defaultView;
  if (win.getComputedStyle(el).visibility !== 'visible') return false;
  for (let e = el; e; e = up(e)) {
    if (win.getComputedStyle(e).opacity === '0') return false;
  }
  return true;
};

// Tâm bị khung cuộn tổ tiên cắt mất (elementFromPoint ra chính khung nên không bắt được là bị che).
const clipped = (el, x, y) => {
  const win = el.ownerDocument.defaultView;
  for (let p = up(el); p && p !== el.ownerDocument.body && p !== el.ownerDocument.documentElement; p = up(p)) {
    const cs = win.getComputedStyle(p);
    if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
    const r = p.getBoundingClientRect();
    if (x < r.left || y < r.top || x >= r.right || y >= r.bottom) return true;
  }
  return false;
};
// Khung theo toạ độ trang chính (CSS px) + tâm có nằm trong vùng nhìn thấy (viewport và mọi frame chứa nó).
const place = el => {
  const r = el.getBoundingClientRect(), off = frameOffset(el.ownerDocument.defaultView);
  const box = { x: r.left + off.x, y: r.top + off.y, w: r.width, h: r.height };
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  const v = view();
  let inView = cx >= v.x && cy >= v.y && cx < v.x + v.w && cy < v.y + v.h && !clipped(el, cx - off.x, cy - off.y);
  for (let f = el.ownerDocument.defaultView.frameElement; f && inView; f = f.ownerDocument.defaultView.frameElement) {
    const c = frameContent(f), o = frameOffset(f.ownerDocument.defaultView);
    inView = cx >= c.x + o.x && cy >= c.y + o.y && cx < c.x + o.x + c.w && cy < c.y + o.y + c.h;
  }
  return { box, cx, cy, inView };
};
// Phần tử trên cùng tại điểm, đi xuống cả shadow root mở (elementFromPoint của document chỉ ra host).
const topAt = (doc, x, y) => {
  let t = doc.elementFromPoint(x, y);
  while (t && t.shadowRoot) {
    const inner = t.shadowRoot.elementFromPoint(x, y);
    if (!inner || inner === t) break;
    t = inner;
  }
  return t;
};
// Phần tử che điểm (x, y) của el: xét từ trang chính xuống từng tầng frame; '' = không bị che.
const coverOf = (el, x, y) => {
  const chain = [el];
  for (let f = el.ownerDocument.defaultView.frameElement; f; f = f.ownerDocument.defaultView.frameElement) chain.unshift(f);
  for (const want of chain) {
    const doc = want.ownerDocument, off = frameOffset(doc.defaultView);
    const top = topAt(doc, x - off.x, y - off.y);
    if (top && top !== want && !inside(want, top) && !inside(top, want)) return describe(top);
  }
  return '';
};
const rectOf = box => ({ x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.w), h: Math.round(box.h) });

module.exports = {
  setBase, view, up, inside, allRoots, pathOf, frameContent,
  clean, tag, describe, allDocs, frameOffset, ownText, ariaLabel, IMPLICIT, accName, roleOf,
  usable, autoLike, cssPath, shown, place, coverOf, rectOf, topAt,
};
