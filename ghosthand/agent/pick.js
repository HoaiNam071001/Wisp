// Agent – chế độ chọn element (bước 06): rê chuột tô khung + nhãn, bấm để mở bảng nhỏ, chọn hành động → gửi main ('gh:pick').
// Lớp phủ là một host + shadow root *đóng* gắn vào documentElement, chỉ có khi người dùng đang chọn và gỡ hẳn khi thoát;
// không để biến nào trên window. Chromium 87 / Node 12: không ?. / ??.
const { ipcRenderer } = require('electron');
const { parseSelector } = require('../selector');
const { clean, tag, roleOf, accName, up, allDocs, place, topAt } = require('./dom');
const { firstMatch } = require('./find');
const { selectorsOf } = require('./elements');
const { hoverLabel } = require('../pick-payload');

const BLOCK = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick', 'auxclick', 'contextmenu'];
const STYLE = `
:host{all:initial}
.box{position:fixed;pointer-events:none;border:2px solid #a371f7;background:rgba(163,113,247,.14);border-radius:3px;display:none;z-index:1}
.tag{position:fixed;pointer-events:none;background:#a371f7;color:#fff;font:600 11px/1 system-ui,sans-serif;padding:3px 6px;border-radius:3px;display:none;z-index:2;white-space:nowrap}
.panel{position:fixed;display:none;z-index:3;width:300px;box-sizing:border-box;padding:10px;border-radius:8px;background:#1c1c24;color:#e8e8ef;
  font:12px/1.4 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.45);border:1px solid #3a3a48}
.panel *{box-sizing:border-box;font:inherit}
.row{display:flex;gap:6px;margin-top:6px;align-items:center}
.head{display:flex;justify-content:space-between;font-weight:600}
.x{cursor:pointer;opacity:.7;background:none;border:0;color:inherit}
input,select{width:100%;padding:4px 6px;border-radius:4px;border:1px solid #3a3a48;background:#12121a;color:inherit}
.cnt{margin-top:4px;color:#7ee787}.cnt.warn{color:#f0b429}.cnt.bad{color:#ff7b72}
.cur{margin-top:4px;opacity:.75;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
button.a{flex:1;padding:5px 4px;border-radius:4px;border:1px solid #3a3a48;background:#2a2a38;color:inherit;cursor:pointer}
button.a:hover{background:#a371f7;border-color:#a371f7}
.hint{margin-top:6px;opacity:.55;font-size:11px}
.msg{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#1c1c24;color:#e8e8ef;padding:6px 12px;border-radius:14px;
  font:12px system-ui,sans-serif;z-index:4;display:none;border:1px solid #a371f7}`;
const ACTIONS = [['click', 'Click'], ['type', 'Gõ chữ'], ['waitFor', 'Chờ thấy'], ['read', 'Đọc giá trị'], ['copy', 'Chép']];

let ses = null; // { host, els, listeners, cur, chain, frozen, sels }

const mk = (parent, name, cls, text) => {
  const e = document.createElement(name);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  parent.appendChild(e);
  return e;
};
const inHost = e => !!ses && e.composedPath().indexOf(ses.host) >= 0;
const valueOf = el => (/^(INPUT|TEXTAREA|SELECT)$/.test(tag(el)) ? String(el.value || '') : clean(el.innerText));

function build() {
  const host = document.createElement('div');
  const root = host.attachShadow({ mode: 'closed' });
  const st = document.createElement('style');
  st.textContent = STYLE;
  root.appendChild(st);
  const els = { box: mk(root, 'div', 'box'), tag: mk(root, 'div', 'tag'), msg: mk(root, 'div', 'msg') };
  const p = els.panel = mk(root, 'div', 'panel');
  const head = mk(p, 'div', 'head');
  els.title = mk(head, 'span');
  els.close = mk(head, 'button', 'x', '✕');
  els.pickSel = mk(p, 'select');
  els.sel = mk(p, 'input');
  els.sel.spellcheck = false;
  els.cnt = mk(p, 'div', 'cnt');
  els.cur = mk(p, 'div', 'cur');
  els.input = mk(p, 'input');
  els.input.placeholder = 'Chữ để gõ (cho nút Gõ chữ)';
  els.input.style.marginTop = '6px';
  const r1 = mk(p, 'div', 'row'), r2 = mk(p, 'div', 'row');
  els.btns = ACTIONS.map(([a, label], i) => { const b = mk(i < 3 ? r1 : r2, 'button', 'a', label); b.dataset.a = a; return b; });
  mk(p, 'div', 'hint', '↑ / ↓ chọn cha / con · Esc thoát');
  // phím gõ trong bảng không lọt ra script của trang
  for (const t of ['keydown', 'keypress', 'keyup', 'input']) host.addEventListener(t, e => e.stopPropagation());
  return { host, els };
}

function count(sel) {
  try { return { n: firstMatch([parseSelector(sel)]).list.length }; } catch (e) { return { err: e.message }; }
}

function showCount() {
  const c = count(ses.els.sel.value.trim()), e = ses.els.cnt;
  if (c.err) { e.textContent = c.err; e.className = 'cnt bad'; } else if (c.n === 1) { e.textContent = '1 phần tử khớp'; e.className = 'cnt'; } else if (c.n === 0) { e.textContent = 'Không phần tử nào khớp'; e.className = 'cnt bad'; } else { e.textContent = `${c.n} phần tử khớp – chọn selector khác hoặc sửa cho đúng 1`; e.className = 'cnt warn'; }
  return c;
}

// Vẽ khung quanh phần tử đang chọn / rê tới (toạ độ khung nhìn trang chính).
function draw() {
  const { els, cur, frozen } = ses;
  if (!cur || !cur.isConnected) { els.box.style.display = els.tag.style.display = els.panel.style.display = 'none'; return; }
  const b = place(cur).box;
  Object.assign(els.box.style, { display: 'block', left: b.x + 'px', top: b.y + 'px', width: b.w + 'px', height: b.h + 'px' });
  els.tag.textContent = hoverLabel(roleOf(cur), clean(accName(cur)), tag(cur));
  Object.assign(els.tag.style, { display: 'block', left: b.x + 'px', top: Math.max(0, b.y - 20) + 'px' });
  if (!frozen) { els.panel.style.display = 'none'; return; }
  const w = 300, h = els.panel.offsetHeight || 190;
  const below = b.y + b.h + 8 + h < innerHeight;
  els.panel.style.display = 'block';
  els.panel.style.left = Math.max(4, Math.min(b.x, innerWidth - w - 4)) + 'px';
  els.panel.style.top = Math.max(4, below ? b.y + b.h + 8 : b.y - h - 8) + 'px';
}

// Chọn phần tử el: tính selector bền + chữ hiện tại, điền bảng.
function select(el) {
  ses.cur = el;
  ses.frozen = true;
  const { els } = ses;
  const sels = selectorsOf(el, 4);
  els.title.textContent = hoverLabel(roleOf(el), clean(accName(el)), tag(el));
  els.pickSel.textContent = '';
  for (const s of sels) { const o = mk(els.pickSel, 'option', '', s); o.value = s; }
  els.pickSel.style.display = sels.length > 1 ? 'block' : 'none';
  els.sel.value = sels[0];
  els.cur.textContent = 'Hiện tại: ' + (valueOf(el).slice(0, 80) || '(trống)');
  showCount();
  draw();
}

function send(action) {
  const { cur, els } = ses;
  const selector = els.sel.value.trim();
  const c = count(selector);
  if (c.err) { toast(c.err); return; }
  if (action !== 'copy' && c.n === 0) { toast('Selector không khớp phần tử nào'); return; }
  if (action === 'type' && !els.input.value) { toast('Nhập chữ cần gõ trước'); els.input.focus(); return; }
  ipcRenderer.send('gh:pick', {
    action, selector, selectors: Array.from(els.pickSel.options).map(o => o.value), count: c.n,
    role: roleOf(cur), name: clean(accName(cur)), text: clean(cur.innerText).slice(0, 200), value: valueOf(cur).slice(0, 200), input: els.input.value,
  });
  ses.frozen = false;
  ses.chain = [];
  draw();
  if (action === 'copy') toast('Đã chép selector');
}

function toast(text) {
  const m = ses.els.msg;
  m.textContent = text;
  m.style.display = 'block';
  clearTimeout(ses.timer);
  ses.timer = setTimeout(() => { if (ses) m.style.display = 'none'; }, 2200);
}

function onMove(e) {
  if (ses.frozen || inHost(e)) return;
  const el = topAt(e.target.ownerDocument || document, e.clientX, e.clientY);
  if (el && el !== ses.cur) { ses.cur = el; ses.chain = []; draw(); }
}

function onBlock(e) {
  if (inHost(e)) return;
  e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
  if (e.type !== 'click' || e.button !== 0) return;
  const el = topAt(e.target.ownerDocument || document, e.clientX, e.clientY);
  if (el) { ses.chain = []; select(el); }
}

function onKey(e) {
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); stop(); return; }
  if ((e.key !== 'ArrowUp' && e.key !== 'ArrowDown') || !ses.cur) return;
  if (inHost(e) && e.composedPath()[0] && e.composedPath()[0].tagName === 'INPUT') return; // đang gõ trong bảng
  e.preventDefault(); e.stopPropagation();
  if (e.key === 'ArrowUp') { const p = up(ses.cur); if (p && tag(p) !== 'HTML') { ses.chain.push(ses.cur); ses.cur = p; } } else if (ses.chain.length) ses.cur = ses.chain.pop();
  if (ses.frozen) select(ses.cur); else draw();
}

function listen(target, type, fn, opts) {
  target.addEventListener(type, fn, opts);
  ses.listeners.push([target, type, fn, opts]);
}

function start() {
  const { host, els } = build();
  ses = { host, els, listeners: [], cur: null, chain: [], frozen: false, timer: 0 };
  for (const d of allDocs()) {
    const w = d.defaultView;
    listen(d, 'mousemove', onMove, true);
    for (const t of BLOCK) listen(d, t, onBlock, true);
    listen(d, 'keydown', onKey, true);
    listen(w, 'scroll', () => draw(), true);
    listen(w, 'resize', () => draw(), true);
  }
  els.pickSel.onchange = () => { els.sel.value = els.pickSel.value; showCount(); };
  els.sel.oninput = showCount;
  els.close.onclick = stop;
  for (const b of els.btns) b.onclick = () => send(b.dataset.a);
  document.documentElement.appendChild(host);
  ipcRenderer.send('gh:pick-state', true);
}

function stop() {
  if (!ses) return;
  for (const [t, type, fn, opts] of ses.listeners) t.removeEventListener(type, fn, opts);
  clearTimeout(ses.timer);
  ses.host.remove();
  ses = null;
  ipcRenderer.send('gh:pick-state', false);
}

// Bật / tắt (want: true / false ép về trạng thái đó; không ghi = đảo); trả trạng thái mới.
function toggle(want) {
  if (want === undefined) want = !ses;
  if (want && !ses) start(); else if (!want && ses) stop();
  return { on: !!ses };
}

module.exports = { toggle, stop };
