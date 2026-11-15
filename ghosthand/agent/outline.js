// Agent – cây accessibility rút gọn cho AI (theo autoclicker/internal/web/outline.js): phần tử tương tác, tiêu đề,
// ảnh có alt, vùng chính đang hiện, cả iframe cùng nguồn + shadow DOM mở, theo thứ tự trang; mỗi dòng có ref + selector đã kiểm.
const { clean, tag, allRoots, up, inside, view, ariaLabel, accName, roleOf, usable, autoLike, cssPath, shown, place, rectOf } = require('./dom');
const { refOf } = require('./elements');

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
const norm = s => clean(s).toLowerCase();

// Selector đã kiểm trong một lượt (không tìm lại cả trang cho từng dòng – O(n²) trên trang lớn): find.js lấy phần tử
// hiện đầu tiên khớp, nên role[name] đúng khi không phần tử hiện cùng vai trò nào đứng trước có tên chứa tên này.
// prev = tên (chuẩn hoá) các phần tử hiện cùng vai trò đứng trước; docs = mọi root (css kiểm bằng querySelectorAll).
function selectorOf(el, role, prev, docs) {
  const name = clean(accName(el));
  if (usable(name) && !prev.some(p => p.includes(norm(name)))) return `role=${role}[name="${name}"]`;
  const firstShown = css => { try { return docs.map(d => Array.from(d.querySelectorAll(css))).reduce((a, b) => a.concat(b), []).find(shown); } catch (e) { return null; } };
  if (el.id && !autoLike(el.id) && firstShown('#' + CSS.escape(el.id)) === el) return 'css=#' + CSS.escape(el.id);
  for (const a of ['data-testid', 'data-test', 'data-qa', 'name']) {
    const v = el.getAttribute(a), css = `${tag(el).toLowerCase()}[${a}="${v}"]`;
    if (usable(v) && firstShown(css) === el) return 'css=' + css;
  }
  if (!prev.length) return 'role=' + role;
  return 'css=' + cssPath(el);
}

const ariaBool = (el, a) => { const v = el.getAttribute(a); return v === 'true' || v === 'false' || v === 'mixed' ? v : ''; };

function stateOf(el, role) {
  const s = {};
  if (el.disabled || el.getAttribute('aria-disabled') === 'true') s.disabled = true;
  if (el.getRootNode().activeElement === el && tag(el) !== 'BODY') s.focused = true;
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
  const items = [], depth = new Map(), before = {}, docs = allRoots(), v = view();
  const parentOf = el => up(el) || el.ownerDocument.defaultView.frameElement;
  let total = 0;
  for (const doc of docs) {
    const body = doc.nodeType === Node.DOCUMENT_NODE ? doc.body : doc;
    if (!body) continue;
    for (const el of body.querySelectorAll('*')) {
      if (SKIP.has(tag(el))) continue;
      const role = roleOf(el);
      if (!KEEP(role) || !shown(el)) continue;
      // tên đứng trước tính cả phần tử bị lọc (root / visibleOnly / option của <select>) – find.js vẫn đếm chúng
      const prev = before[role] || (before[role] = []);
      const sel = BOXES.has(role) ? '' : selectorOf(el, role, prev, docs); // vùng ít khi bấm – không cần selector
      prev.push(norm(accName(el)));
      if ((root && !inside(root, el)) || (role === 'option' && el.closest('select'))) continue;
      const { box, inView: center } = place(el);
      // vùng lớn: tâm hay nằm ngoài khung nhìn – tính là trong khi có phần chồng lên khung nhìn
      const inView = BOXES.has(role) ? box.x < v.x + v.w && box.y < v.y + v.h && box.x + box.w > v.x && box.y + box.h > v.y : center;
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
      if (sel) item.selector = sel;
      items.push(item);
    }
  }
  return { url: location.href, title: document.title, view: { w: innerWidth, h: innerHeight, scrollX: Math.round(scrollX), scrollY: Math.round(scrollY) },
    items, total, truncated: total > items.length };
}

module.exports = { outline };
