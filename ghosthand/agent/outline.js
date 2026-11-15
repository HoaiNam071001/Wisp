// Agent – cây accessibility rút gọn cho AI (theo autoclicker/internal/web/outline.js): phần tử tương tác, tiêu đề,
// ảnh có alt, vùng chính đang hiện, cả iframe cùng nguồn, theo thứ tự trang; mỗi dòng có ref + selector đã kiểm.
const { clean, tag, allDocs, ariaLabel, accName, roleOf, shown, place, rectOf } = require('./dom');
const { refOf, selectorsOf } = require('./elements');

const ACTIVE = new Set(['button', 'link', 'textbox', 'searchbox', 'checkbox', 'radio', 'switch', 'slider', 'spinbutton',
  'combobox', 'tab', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'option', 'treeitem']);
const BOXES = new Set(['navigation', 'main', 'form', 'search', 'dialog', 'alertdialog', 'tablist', 'menu', 'menubar',
  'listbox', 'tree', 'table', 'banner', 'contentinfo', 'complementary', 'region', 'alert']);
const KEEP = r => ACTIVE.has(r) || BOXES.has(r) || r === 'heading' || r === 'img';
const VALUED = new Set(['textbox', 'searchbox', 'spinbutton', 'combobox', 'slider']);
const CHECKABLE = ['checkbox', 'radio', 'switch', 'menuitemcheckbox', 'menuitemradio'];
const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'HEAD']);

// vùng (main / nav…) chỉ lấy tên ghi rõ – tên theo chữ bên trong là cả trang
const nameOf = (el, role) => clean(BOXES.has(role) ? ariaLabel(el) || el.getAttribute('title') : accName(el));
const ariaBool = (el, a) => { const v = el.getAttribute(a); return v === 'true' || v === 'false' || v === 'mixed' ? v : ''; };

function stateOf(el, role) {
  const s = {};
  if (el.disabled || el.getAttribute('aria-disabled') === 'true') s.disabled = true;
  if (el.ownerDocument.activeElement === el && tag(el) !== 'BODY') s.focused = true;
  if (role === 'heading') s.level = +(el.getAttribute('aria-level') || tag(el).slice(1)) || 0;
  if (CHECKABLE.includes(role)) {
    s.checked = typeof el.checked === 'boolean' && !el.hasAttribute('aria-checked') ? String(el.checked) : ariaBool(el, 'aria-checked');
  }
  if (el.hasAttribute('aria-expanded')) s.expanded = ariaBool(el, 'aria-expanded');
  if (el.getAttribute('aria-selected') === 'true') s.selected = true;
  return s;
}

// root = phần tử gốc (đã tìm theo ref / selector) hoặc null; visibleOnly = chỉ phần tử có tâm trong khung nhìn.
function outline({ root, maxNodes = 300, visibleOnly = false }) {
  const items = [], depth = new Map();
  const parentOf = el => el.parentElement || el.ownerDocument.defaultView.frameElement;
  let total = 0;
  for (const doc of allDocs()) {
    if (!doc.body) continue;
    for (const el of doc.body.querySelectorAll('*')) {
      if (SKIP.has(tag(el))) continue;
      const role = roleOf(el);
      if (!KEEP(role) || (root && !root.contains(el)) || !shown(el)) continue;
      if (role === 'option' && el.closest('select')) continue;
      const { box, inView: center } = place(el);
      // vùng lớn: tâm hay nằm ngoài khung nhìn – tính là trong khi có phần chồng lên khung nhìn
      const inView = BOXES.has(role) ? box.x < innerWidth && box.y < innerHeight && box.x + box.w > 0 && box.y + box.h > 0 : center;
      if (visibleOnly && !inView) continue;
      total++;
      if (items.length >= maxNodes) continue;
      let d = 0;
      for (let p = parentOf(el); p; p = parentOf(p)) if (depth.has(p)) { d = depth.get(p) + 1; break; }
      if (BOXES.has(role)) depth.set(el, d);
      const item = { ref: refOf(el), role, name: nameOf(el, role).slice(0, 80), depth: d, inView, rect: rectOf(box), state: stateOf(el, role) };
      if (VALUED.has(role)) {
        if (el.type === 'password') item.state.secret = true;
        else item.value = clean(el.value != null ? String(el.value) : el.innerText).slice(0, 100);
      }
      // vùng không cần selector (ít khi bấm) – đỡ chậm trên trang lớn
      if (!BOXES.has(role)) item.selector = selectorsOf(el, 1)[0];
      items.push(item);
    }
  }
  return { url: location.href, title: document.title, view: { w: innerWidth, h: innerHeight, scrollX: Math.round(scrollX), scrollY: Math.round(scrollY) },
    items, total, truncated: total > items.length };
}

module.exports = { outline };
