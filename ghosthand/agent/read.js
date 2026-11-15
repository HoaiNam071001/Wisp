// Agent – đọc phần tử / chữ chính của trang.
const { clean, tag } = require('./dom');

function readTable(el) {
  const table = tag(el) === 'TABLE' ? el : el.closest('table') || el.querySelector('table');
  if (!table) return [];
  return Array.from(table.rows).map(r => Array.from(r.cells).map(c => clean(c.innerText)));
}

function readAttrs(el) {
  const out = {};
  for (const a of Array.from(el.attributes)) out[a.name] = a.value.slice(0, 2000);
  // href / src: URL đầy đủ (thuộc tính có thể là đường dẫn tương đối)
  for (const k of ['href', 'src']) if (el.hasAttribute(k) && typeof el[k] === 'string') out[k] = el[k];
  return out;
}

function readElement(el, what) {
  switch (what || 'text') {
    case 'value': return el.value == null ? '' : String(el.value);
    case 'html': return el.outerHTML.slice(0, 200000);
    case 'attrs': return readAttrs(el);
    case 'table': return readTable(el);
    default: return clean(el.innerText != null ? el.innerText : el.textContent).slice(0, 100000);
  }
}

// Chữ chính: vùng main / article nếu có, bỏ menu / header / footer / aside. Chỉ đọc, không đổi DOM / style
// (trang theo dõi DOM sẽ thấy dấu vết): nhánh không chứa vùng bỏ thì lấy innerText cả nhánh, có thì đi xuống con.
const CHROME = 'nav, header, footer, aside, [role=navigation], [role=banner], [role=contentinfo], [role=complementary]';
function textOf(el) {
  // thẻ ẩn: innerText của phần tử display:none trả cả mã nguồn
  if (el.matches(CHROME) || /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/.test(tag(el))) return '';
  if (!el.querySelector(CHROME)) return el.innerText || '';
  const parts = [];
  for (const n of Array.from(el.childNodes)) {
    if (n.nodeType === Node.TEXT_NODE) parts.push(n.data);
    else if (n.nodeType === Node.ELEMENT_NODE) parts.push(textOf(n));
  }
  return parts.join('\n');
}
function pageText({ maxChars = 20000 }) {
  const root = document.querySelector('main, [role=main]') || document.querySelector('article') || document.body;
  if (!root) return { url: location.href, title: document.title, text: '', truncated: false };
  const text = textOf(root).replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n\n').trim();
  return { url: location.href, title: document.title, text: text.slice(0, maxChars), truncated: text.length > maxChars };
}

module.exports = { readElement, pageText };
