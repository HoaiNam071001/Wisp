// Lệnh nhóm form: select (<select> thật – focus + gõ typeahead), check (bấm ô đánh dấu khi trạng thái khác yêu cầu).
const { fail } = require('../protocol');
const { resolveTab } = require('../target');
const { callAgent } = require('../agent-call');
const input = require('../input');
const { click } = require('./act');

// Chromium gom phím gõ vào <select> thành một phiên typeahead tới khi ngừng gõ ~1s → lần chọn sau phải chờ phiên cũ hết,
// không thì chữ bị nối vào (gõ "Hà" rồi "Đà" thành "HàĐà").
const TYPEAHEAD_MS = 1100;
let lastTyped = 0;

const targetArgs = a => { const o = {}; for (const k of ['ref', 'sels']) if (a[k] !== undefined) o[k] = a[k]; return o; };

async function select(a) {
  const t = resolveTab(a.tab), w = t.view.webContents;
  const prep = await callAgent(w, 'selectPrep', Object.assign(targetArgs(a), { value: a.value, label: a.label }));
  if (!prep.already) {
    const wait = lastTyped + TYPEAHEAD_MS - Date.now();
    if (wait > 0) await input.sleep(wait);
    await input.typeText(w, prep.typed); // gõ liền tay – cả chuỗi trong một phiên
    lastTyped = Date.now();
    await input.sleep(50);
  }
  const r = await callAgent(w, 'selectResult', { ref: prep.ref, index: prep.index });
  if (!r.ok) fail('not_found', `gõ “${prep.typed}” nhưng ô đang chọn “${r.label}” – thử value thay cho label`);
  return { ref: prep.ref, value: r.value, label: r.label, changed: !prep.already };
}

async function check(a) {
  const t = resolveTab(a.tab), w = t.view.webContents;
  const cur = await callAgent(w, 'checked', targetArgs(a));
  if (cur.on === a.on) return { ref: cur.ref, on: cur.on, changed: false };
  const r = await click({ tab: a.tab, ref: cur.ref });
  const now = await callAgent(w, 'checked', { ref: cur.ref }).catch(() => null);
  if (now && now.on !== a.on) fail('covered', 'đã bấm nhưng ô không đổi trạng thái – trang chặn hoặc cần bấm vào nhãn');
  return { ref: cur.ref, on: a.on, changed: true, navigated: r.navigated };
}

module.exports = { select, check };
