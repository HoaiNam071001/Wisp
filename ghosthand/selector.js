// Selector cùng cú pháp Ghosthand (bản chép của ParseSelector / StableLabel / StableSelector / StableFirst ở
// autoclicker/internal/model/web.go + selstable.go). Dữ liệu thử chung: test/data/selectors.json, stable-labels.json
// (chép từ autoclicker/testdata – Ghosthand đổi thì chép lại). Logic thuần, không require('electron').
const KINDS = ['text', 'aria', 'role', 'label', 'css', 'xpath'];
const ROLE_RE = /^([a-zA-Z]+)\s*(?:\[\s*name\s*=\s*(?:"([^"]*)"|([^\]"]*?))\s*\])?$/;
// Chỗ cắt: phần sau dấu này có số thì là phần hay đổi ("Messenger, 1 unread", "Hộp thư (3)").
const STABLE_SEPS = [',', '(', '·', '•', '|', ':', ' - ', ' – '];

const hasDigit = s => /\p{Nd}/u.test(s);

// Một dòng selector → {by, value, exact?, name?}; sai dạng / trống → ném Error (message tiếng Việt).
function parseSelector(line) {
  line = String(line == null ? '' : line).trim();
  let sel = { by: 'text', value: line };
  const eq = line.indexOf('=');
  if (eq >= 0) {
    let by = line.slice(0, eq).trim().toLowerCase();
    if (by === 'aria-label') by = 'aria'; // chép thẳng từ DevTools
    if (KINDS.includes(by)) sel = { by, value: line.slice(eq + 1).trim() };
  }
  if (['text', 'aria', 'label'].includes(sel.by)) {
    const v = sel.value;
    if (v.length >= 2 && v[0] === '"' && v[v.length - 1] === '"') sel = { by: sel.by, value: v.slice(1, -1), exact: true };
  }
  if (sel.by === 'role' && sel.value !== '') {
    const m = ROLE_RE.exec(sel.value);
    if (!m) throw new Error(`selector “${line}” sai dạng – viết role=button hoặc role=button[name="Gửi"]`);
    sel = { by: 'role', value: m[1].toLowerCase() };
    const name = ((m[2] || '') + (m[3] || '')).trim();
    if (name) sel.name = name;
  }
  if (sel.value === '') throw new Error(`selector “${line}” chưa có giá trị`);
  return sel;
}

// Phần cố định của nhãn; '' = nhãn không có phần hay đổi, hoặc phần còn lại có số / không có chữ.
function stableLabel(s) {
  s = String(s || '').trim();
  let cut = -1;
  for (const sep of STABLE_SEPS) {
    const i = s.indexOf(sep);
    if (i > 0 && hasDigit(s.slice(i)) && (cut < 0 || i < cut)) cut = i;
  }
  if (cut < 0) return '';
  const core = s.slice(0, cut).trim();
  if (hasDigit(core) || !/\p{L}/u.test(core)) return '';
  return core;
}

// Selector tìm theo phần cố định; '' = không có phần hay đổi, có {{biến}}, sai dạng hoặc css / xpath.
function stableSelector(line) {
  if (String(line).includes('{{')) return '';
  let sel;
  try { sel = parseSelector(line); } catch (e) { return ''; }
  if (['text', 'aria', 'label'].includes(sel.by)) {
    const core = stableLabel(sel.value);
    if (core) return sel.by + '=' + core;
  } else if (sel.by === 'role') {
    const core = stableLabel(sel.name);
    if (core && !core.includes('"')) return `role=${sel.value}[name="${core}"]`;
  }
  return '';
}

// Dòng có giá trị hay đổi → chèn dạng chứa phần cố định ngay trước nó (bỏ trùng).
function stableFirst(lines) {
  const out = [];
  for (const line of lines) {
    const fix = stableSelector(line);
    if (fix && !out.includes(fix)) out.push(fix);
    out.push(line);
  }
  return out;
}

module.exports = { KINDS, parseSelector, stableLabel, stableSelector, stableFirst };
