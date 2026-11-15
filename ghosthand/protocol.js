// Giao thức cổng Ghosthand (docs/plan/01-cong-ghosthand.md): đọc lệnh JSON, kiểm tra đối số, mã lỗi.
// Logic thuần, không require('electron').
const { parseSelector } = require('./selector');

const API = 1;
const CODES = ['not_found', 'not_visible', 'covered', 'not_focused', 'stale_ref', 'timeout', 'no_tab', 'flash_page', 'bad_args', 'internal'];

class GhError extends Error {
  constructor(code, detail) { super(detail); this.code = code; this.detail = detail; }
}
const fail = (code, detail) => { throw new GhError(code, detail); };

// Đối số mỗi lệnh: 'string' / 'number' / 'boolean' / 'string[]' / 'object' / mảng = một trong các giá trị;
// '!' cuối = bắt buộc. target = ref | selector | selectors (một trong ba, bắt buộc nếu ghi 'target!').
const TARGET = { ref: 'string', selector: 'string', selectors: 'string[]' };
const SPEC = {
  tabs: {},
  open: { url: 'string!', newTab: 'boolean' },
  navigate: { url: 'string!' },
  back: {}, forward: {}, reload: {}, close: {}, activate: {},
  waitLoad: { until: ['load', 'idle'], timeoutMs: 'number' },
  outline: { root: 'string', maxNodes: 'number', visibleOnly: 'boolean' },
  find: { selectors: 'string[]!', all: 'boolean', visibleOnly: 'boolean', scope: ['dialog'], brief: 'boolean' },
  read: { target: '!', what: ['text', 'value', 'html', 'attrs', 'table'] },
  pageText: { maxChars: 'number' },
  screenshot: { target: '', fullPage: 'boolean' },
  click: { target: '!', button: ['left', 'right', 'middle'], count: 'number', offset: 'object' },
  type: { target: '', text: 'string!', clear: 'boolean', enter: 'boolean' }, // không đích = ô đang nhận phím
  focused: { ref: 'string!' },
  keys: { keys: 'string[]!', mods: 'string[]' },
  scroll: { target: '', dir: ['up', 'down', 'left', 'right'], amount: 'number' },
  hover: { target: '!' },
  waitFor: { selectors: 'string[]!', state: ['visible', 'hidden', 'enabled'], timeoutMs: 'number' },
  select: { target: '!', value: 'string', label: 'string' },
  check: { target: '!', on: 'boolean!' },
  settle: { timeoutMs: 'number' },
  frameRect: {},
  subscribe: { events: 'string[]!' },
  dialog: { accept: 'boolean!', text: 'string' },
};
const EVENTS = ['navigate', 'popup', 'download', 'dialog'];

function typeOk(type, v) {
  if (Array.isArray(type)) return type.includes(v);
  if (type === 'string[]') return Array.isArray(v) && v.every(x => typeof x === 'string');
  if (type === 'object') return v !== null && typeof v === 'object' && !Array.isArray(v);
  if (type === 'number') return typeof v === 'number' && isFinite(v);
  return typeof v === type;
}

// Trần của đối số: lệnh không chạy mãi / trả về quá lớn (gõ 4MB chữ từng ký tự, chờ 1 ngày…).
const MAX_NUM = { timeoutMs: 120000, maxNodes: 2000, maxChars: 500000, amount: 20000, count: 3 };
const MAX_LEN = { text: 10000, url: 8192, selectors: 20, keys: 50, mods: 4, value: 1000, label: 1000 };

function checkLimits(args) {
  for (const [k, max] of Object.entries(MAX_NUM)) {
    if (args[k] !== undefined && (args[k] < 0 || args[k] > max)) fail('bad_args', `“${k}” phải trong 0–${max}`);
  }
  for (const [k, max] of Object.entries(MAX_LEN)) {
    if (args[k] !== undefined && args[k].length > max) fail('bad_args', `“${k}” dài quá (tối đa ${max})`);
  }
  const o = args.offset;
  if (o !== undefined && !(typeOk('number', o.x) && typeOk('number', o.y))) fail('bad_args', 'offset phải là {x, y} (CSS px tính từ góc trên trái phần tử)');
}

// Chỉ trang web http(s): không cho mở file:// / chrome:// … (đọc được file trên máy qua pageText).
function webUrlOnly(url) {
  if (!/^https?:\/\//i.test(String(url || ''))) fail('bad_args', `chỉ mở được địa chỉ http(s) – “${url}”`);
  return url;
}

// Danh sách selector đã kiểm cú pháp (sai → bad_args, nói dòng nào).
function parseSelectors(lines) {
  if (!lines.length) fail('bad_args', 'selectors trống');
  return lines.map(l => {
    try { return parseSelector(l); } catch (e) { return fail('bad_args', e.message); }
  });
}

// Kiểm đối số theo SPEC; trả args đã chuẩn hoá (selector / selectors → sels đã phân tích).
function checkArgs(cmd, args) {
  const spec = SPEC[cmd];
  if (!spec) fail('bad_args', `không có lệnh “${cmd}” – lệnh có: ${Object.keys(SPEC).join(', ')}`);
  if (args == null) args = {};
  if (typeof args !== 'object' || Array.isArray(args)) fail('bad_args', 'args phải là object');
  const fields = Object.assign({ tab: '' }, spec);
  if ('target' in spec) Object.assign(fields, TARGET);
  for (const k of Object.keys(args)) {
    if (!(k in fields) || k === 'target') fail('bad_args', `“${cmd}” không có đối số “${k}”`);
    if (k === 'tab') {
      if (typeof args.tab !== 'string' && typeof args.tab !== 'number') fail('bad_args', 'tab phải là id, URL hoặc tiêu đề');
      continue;
    }
    if (!typeOk(fields[k].replace ? fields[k].replace('!', '') : fields[k], args[k])) {
      const want = Array.isArray(fields[k]) ? fields[k].join(' | ') : fields[k].replace('!', '');
      fail('bad_args', `“${k}” phải là ${want}`);
    }
  }
  for (const [k, t] of Object.entries(spec)) {
    if (k !== 'target' && typeof t === 'string' && t.endsWith('!') && args[k] === undefined) fail('bad_args', `thiếu “${k}”`);
  }
  checkLimits(args);
  if (cmd === 'select' && (args.value === undefined) === (args.label === undefined)) fail('bad_args', 'ghi một trong value / label');
  if (cmd === 'subscribe') {
    const bad = args.events.filter(e => !EVENTS.includes(e));
    if (bad.length) fail('bad_args', `sự kiện không có: ${bad.join(', ')} – có: ${EVENTS.join(', ')}`);
  }
  const out = Object.assign({}, args);
  if (spec.selectors) out.sels = parseSelectors(args.selectors);
  if ('target' in spec) {
    const n = ['ref', 'selector', 'selectors'].filter(k => args[k] !== undefined).length;
    if (n > 1) fail('bad_args', 'chỉ ghi một trong ref / selector / selectors');
    if (n === 0 && spec.target === '!') fail('bad_args', 'thiếu ref hoặc selector');
    if (args.selector !== undefined) out.sels = parseSelectors([args.selector]);
    if (args.selectors !== undefined) out.sels = parseSelectors(args.selectors);
  }
  return out;
}

// Một tin nhắn WebSocket → {id, cmd, args} đã kiểm; lỗi → ném GhError (id lấy được thì kèm theo).
function parseRequest(raw) {
  let msg;
  try { msg = JSON.parse(String(raw)); } catch (e) { fail('bad_args', 'tin nhắn không phải JSON'); }
  if (!msg || typeof msg !== 'object') fail('bad_args', 'tin nhắn phải là object {id, cmd, args}');
  const id = msg.id;
  try {
    if (typeof msg.cmd !== 'string') fail('bad_args', 'thiếu “cmd”');
    return { id, cmd: msg.cmd, args: checkArgs(msg.cmd, msg.args) };
  } catch (e) { e.id = id; throw e; }
}

function okReply(id, result) { return JSON.stringify({ id, ok: true, result: result === undefined ? null : result }); }

// Lỗi không có mã (lỗi lập trình, Electron ném) → internal kèm chữ gốc cho dễ dò.
function errorReply(id, err) {
  const code = err && CODES.includes(err.code) ? err.code : 'internal';
  const detail = err && (err.detail || err.message) ? String(err.detail || err.message) : 'lỗi không rõ';
  return JSON.stringify({ id: id === undefined ? null : id, ok: false, error: { code, detail } });
}

module.exports = { API, CODES, SPEC, EVENTS, GhError, fail, checkArgs, webUrlOnly, parseRequest, parseSelectors, okReply, errorReply };
