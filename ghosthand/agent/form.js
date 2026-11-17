// Agent – <select> / ô đánh dấu / khung game. Chỉ đọc + focus; thay đổi giá trị luôn do phím / chuột thật từ main.
const { clean, tag, describe, shown, place, rectOf, allRoots } = require('./dom');

const err = (code, detail) => Object.assign(new Error(detail), { code });
const norm = s => clean(s).toLowerCase();

// Lựa chọn cần chọn trong <select>: theo value (đúng) hoặc nhãn (đúng, không phân biệt hoa thường / khoảng trắng).
function optionOf(el, { value, label }) {
  if (tag(el) !== 'SELECT') throw err('bad_args', describe(el) + ' không phải <select> – danh sách tự dựng: click mở rồi click lựa chọn');
  if (el.disabled) throw err('not_visible', describe(el) + ' đang bị khoá');
  const opts = Array.from(el.options);
  const o = value !== undefined ? opts.find(x => x.value === value) : opts.find(x => norm(x.label || x.text) === norm(label));
  if (!o) {
    const list = opts.slice(0, 15).map(x => clean(x.label || x.text)).join(' | ');
    throw err('not_found', `không có lựa chọn ${value !== undefined ? 'value “' + value + '”' : '“' + label + '”'} – có: ${list}`);
  }
  if (o.disabled) throw err('not_visible', `lựa chọn “${clean(o.label)}” đang bị khoá`);
  return o;
}

// Typeahead của Chromium (TypeAhead): 1 ký tự → tìm từ sau lựa chọn đang chọn, nhiều ký tự → từ chính nó, vòng lại đầu;
// chuỗi một ký tự lặp ("aa") tính như gõ lại 1 ký tự (chuyển vòng) → bỏ qua.
function typeaheadHit(labels, current, p) {
  const n = labels.length, start = p.length === 1 ? current + 1 : Math.max(0, current);
  for (let i = 0; i < n; i++) {
    const idx = (start + i) % n;
    if (labels[idx].startsWith(p)) return idx;
  }
  return -1;
}
// Đoạn đầu ngắn nhất của nhãn mà typeahead chọn đúng o: gõ ít ký tự, tránh dấu cách (ngoài phiên typeahead mở menu).
function shortestPrefix(el, o) {
  const label = clean(o.label || o.text), labels = Array.from(el.options).map(x => norm(x.label || x.text));
  for (let k = 1; k <= label.length; k++) {
    const p = label.slice(0, k).toLowerCase();
    if (k > 1 && new Set(p).size === 1) continue;
    if (typeaheadHit(labels, el.selectedIndex, p) === o.index) return label.slice(0, k);
  }
  return label;
}

// Chuẩn bị chọn: focus ô (không bấm – bấm mở menu gốc của hệ điều hành, sendInputEvent không điều khiển được),
// trả chữ cần gõ (typeahead của <select> chọn lựa chọn đầu tiên bắt đầu bằng chữ đã gõ).
function selectPrep(el, args) {
  const o = optionOf(el, args);
  el.focus();
  if (el.ownerDocument.activeElement !== el) throw err('not_focused', 'không đưa được focus vào ' + describe(el));
  return { index: o.index, typed: shortestPrefix(el, o), already: el.selectedIndex === o.index };
}

function selectResult(el, index) {
  const o = el.options[el.selectedIndex];
  return { ok: el.selectedIndex === index, value: o ? o.value : '', label: o ? clean(o.label || o.text) : '' };
}

// Trạng thái bật / tắt của checkbox / radio / switch (thuộc tính checked hoặc aria-checked).
function checkedOf(el) {
  if (typeof el.checked === 'boolean' && !el.hasAttribute('aria-checked')) return el.checked;
  const a = el.getAttribute('aria-checked');
  if (a === 'true' || a === 'false') return a === 'true';
  throw err('bad_args', describe(el) + ' không phải ô đánh dấu (checkbox / radio / switch)');
}

// Khung game: phần tử plugin / canvas / iframe lớn nhất đang hiện (Flash: embed / object).
const GAME = 'embed, object, canvas, iframe';
function gameRect() {
  let best = null, area = 0;
  for (const el of [].concat(...allRoots().map(r => Array.from(r.querySelectorAll(GAME))))) {
    if (!shown(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width * r.height > area) { area = r.width * r.height; best = el; }
  }
  if (!best) throw err('not_found', 'trang không có khung game (embed / object / canvas / iframe) đang hiện');
  return { tag: tag(best).toLowerCase(), rect: rectOf(place(best).box) };
}

module.exports = { selectPrep, selectResult, checkedOf, gameRect };
