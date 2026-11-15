// Tên phím như Ghosthand (autoclicker/internal/web/keys.go: enter, tab, esc, f1–f12, chữ / số / dấu; phím kèm
// cmd | ctrl | alt | shift) → sự kiện webContents.sendInputEvent. Logic thuần, không require('electron').
const { fail } = require('./protocol');

// tên → [keyCode của Electron (Accelerator), ký tự chèn]
const NAMED = {
  enter: ['Enter', '\r'], tab: ['Tab', ''], esc: ['Escape', ''], escape: ['Escape', ''], backspace: ['Backspace', ''],
  delete: ['Delete', ''], space: ['Space', ' '], up: ['Up', ''], down: ['Down', ''], left: ['Left', ''], right: ['Right', ''],
  home: ['Home', ''], end: ['End', ''], pageup: ['PageUp', ''], pagedown: ['PageDown', ''],
};
const MODS = { alt: 'alt', ctrl: 'control', control: 'control', cmd: 'meta', command: 'meta', meta: 'meta', shift: 'shift' };
// Tổ hợp sửa chữ: sendInputEvent không chạy lệnh của menu (Cmd+A trên macOS do menu app xử lý) → gọi thẳng
// webContents.selectAll() … như Ghosthand dùng editCommands.
const EDIT = { a: 'selectAll', c: 'copy', x: 'cut', v: 'paste', z: 'undo' };

function keyOf(name) {
  const n = String(name).trim().toLowerCase();
  if (NAMED[n]) return { code: NAMED[n][0], text: NAMED[n][1] };
  const f = /^f([1-9]|1[0-2])$/.exec(n);
  if (f) return { code: 'F' + f[1], text: '' };
  if (n.length === 1 && n >= ' ' && n <= '~') return { code: n, text: n };
  return null;
}

function modsOf(mods) {
  return (mods || []).map(m => {
    const v = MODS[String(m).trim().toLowerCase()];
    if (!v) fail('bad_args', `phím kèm không hợp lệ: “${m}” (cmd | ctrl | alt | shift)`);
    return v;
  });
}

// Một phím (+ phím kèm) → {edit} (lệnh soạn thảo) hoặc {events: [keyDown, char?, keyUp]}.
function keyEvents(name, mods) {
  const k = keyOf(name);
  if (!k) fail('bad_args', `phím “${name}” không bấm được (enter, tab, esc, backspace, delete, space, mũi tên, home, end, pageup, pagedown, f1–f12, chữ / số)`);
  const modifiers = modsOf(mods);
  const command = modifiers.includes('meta') || modifiers.includes('control');
  if (command && EDIT[k.code.toLowerCase()] && modifiers.length === 1) return { edit: EDIT[k.code.toLowerCase()] };
  const events = [{ type: 'keyDown', keyCode: k.code, modifiers }];
  if (k.text && !command && !modifiers.includes('alt')) {
    const ch = modifiers.includes('shift') ? k.text.toUpperCase() : k.text;
    events.push({ type: 'char', keyCode: ch, modifiers });
  }
  events.push({ type: 'keyUp', keyCode: k.code, modifiers });
  return { events };
}

// Gõ chữ: mỗi ký tự một sự kiện char (cả tiếng Việt / emoji – theo code point); \n → Enter.
function textEvents(text) {
  const out = [];
  for (const ch of String(text)) {
    if (ch === '\n' || ch === '\r') out.push(...keyEvents('enter').events);
    else out.push({ type: 'char', keyCode: ch });
  }
  return out;
}

module.exports = { keyEvents, textEvents };
