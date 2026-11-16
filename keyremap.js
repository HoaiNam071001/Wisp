// Đổi phím – logic thuần (không require electron) để test bằng node --test.
// Tên phím theo KeyboardEvent.key (chữ cái viết thường); đích gửi bằng sendInputEvent nên cần mã Accelerator.
const NAMED = {
  ArrowLeft: 'Left', ArrowRight: 'Right', ArrowUp: 'Up', ArrowDown: 'Down', Escape: 'Esc',
  Enter: 'Enter', Tab: 'Tab', Backspace: 'Backspace', Delete: 'Delete', Insert: 'Insert',
  Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown',
};
const PUNCT = ';=,-./`[\\]\'';

function normalizeKey(key) {
  const k = String(key == null ? '' : key);
  return k.length === 1 ? k.toLowerCase() : k;
}

// Mã Accelerator của phím, null nếu không hỗ trợ
function accelOf(key) {
  const k = normalizeKey(key);
  if (k === ' ') return 'Space';
  if (k.length === 1) return /[a-z0-9]/.test(k) ? k.toUpperCase() : PUNCT.includes(k) ? k : null;
  if (NAMED[k]) return NAMED[k];
  return /^F([1-9]|1\d|2[0-4])$/.test(k) ? k : null;
}

// Giữ cặp hợp lệ, khác nhau; hoán đổi B↔S là hợp lệ (gửi lại không bị đổi tiếp)
function normalizeMap(raw) {
  const map = {};
  if (!raw || typeof raw !== 'object') return map;
  for (const [from, to] of Object.entries(raw)) {
    const f = normalizeKey(from), t = normalizeKey(to);
    if (f !== t && accelOf(f) && accelOf(t)) map[f] = t;
  }
  return map;
}

function normalizeConfig(raw) {
  const c = raw && typeof raw === 'object' ? raw : {};
  return { enabled: c.enabled === true, map: normalizeMap(c.map) };
}

// getState() → { enabled, map }. handle(input) trả mảng sự kiện cần gửi thay phím này, hoặc null (để phím đi tiếp).
function createRemapper(getState) {
  const held = new Map(); // phím gốc đang giữ → phím đích: nhả đúng phím dù cấu hình đổi giữa chừng

  function mods(input) {
    const m = [];
    if (input.shift) m.push('shift');
    if (input.isAutoRepeat) m.push('isAutoRepeat');
    return m;
  }

  function handle(input) {
    const key = normalizeKey(input.key);
    if (input.type === 'keyUp') {
      if (!held.has(key)) return null;
      const to = held.get(key);
      held.delete(key);
      return [{ type: 'keyUp', keyCode: accelOf(to), modifiers: mods(input) }];
    }
    if (input.type !== 'keyDown') return null;
    if (input.control || input.alt || input.meta) return null;
    const st = getState();
    const to = st.enabled ? st.map[key] : null;
    if (!to) return null;
    held.set(key, to);
    const modifiers = mods(input);
    const events = [{ type: 'keyDown', keyCode: accelOf(to), modifiers }];
    if (to.length === 1) { // phím in được → thêm sự kiện char để ô nhập nhận chữ
      const ch = input.shift && /[a-z]/.test(to) ? to.toUpperCase() : to;
      events.push({ type: 'char', keyCode: ch === ' ' ? 'Space' : ch, modifiers });
    }
    return events;
  }

  return { handle };
}

module.exports = { normalizeKey, accelOf, normalizeMap, normalizeConfig, createRemapper };
