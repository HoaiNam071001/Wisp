// Lệnh nhóm thao tác: click, type, keys, scroll, hover – sự kiện thật qua sendInputEvent.
const tabs = require('../../tabs');
const { fail } = require('../protocol');
const { keyEvents } = require('../keys');
const { resolveTab, screenRect } = require('../target');
const { callAgent } = require('../agent-call');
const input = require('../input');

const targetArgs = a => { const o = {}; for (const k of ['ref', 'sels', 'offset']) if (a[k] !== undefined) o[k] = a[k]; return o; };

// Điểm bấm của đích: cuộn vào giữa nếu cần; bị che / ngoài khung nhìn → lỗi (không bấm nhầm phần tử khác).
async function locate(t, a) {
  const loc = await callAgent(t.view.webContents, 'locate', targetArgs(a));
  if (!loc.inView) fail('not_visible', 'phần tử nằm ngoài khung nhìn, cuộn không tới được');
  if (loc.covered) fail('covered', `điểm bấm bị ${loc.covered} đè lên – đóng / bỏ phần đó trước`);
  return loc;
}

// Tab đang xem thì đưa focus bàn phím vào trang (bấm vào ô nhập mới nhận phím). Tab khác: không giành focus của người dùng.
function focusIfActive(t) { if (t.id === tabs.getActiveId()) t.view.webContents.focus(); }

// Sau cú bấm: trang có chuyển / mở popup không (chờ ngắn – trang chậm thì gọi waitLoad sau).
function watchAfter(t, ms) {
  const w = t.view.webContents;
  let navigated = false, popup = null;
  const onNav = (_e, _url, _inPage, isMain) => { if (isMain) navigated = true; };
  const onOpen = (nt, opener) => { if (opener === t) popup = nt.id; };
  w.on('did-start-navigation', onNav);
  tabs.events.on('opened', onOpen);
  return input.sleep(ms).then(() => {
    w.removeListener('did-start-navigation', onNav);
    tabs.events.removeListener('opened', onOpen);
    return { navigated, url: w.getURL(), popup };
  });
}

async function click(a) {
  const t = resolveTab(a.tab), w = t.view.webContents;
  const loc = await locate(t, a);
  focusIfActive(t);
  const after = watchAfter(t, 300);
  await input.click(w, loc.x, loc.y, a.button, Math.max(1, Math.min(3, a.count || 1)));
  return Object.assign({ ref: loc.ref, screenRect: screenRect(t, loc.rect) }, await after);
}

// Gõ như người dùng: bấm vào ô → kiểm ô nhận phím đúng là đích → (xoá chữ cũ) → gõ từng ký tự → (Enter).
async function type(a) {
  const t = resolveTab(a.tab), w = t.view.webContents;
  const loc = await locate(t, a);
  focusIfActive(t);
  await input.click(w, loc.x, loc.y);
  await input.sleep(50);
  const f = await callAgent(w, 'focused', { ref: loc.ref, x: loc.x, y: loc.y });
  if (!f.ok) fail('not_focused', `bấm vào rồi nhưng ô nhận phím là ${f.active} – chọn đúng ô nhập`);
  if (a.clear) {
    const selected = await callAgent(w, 'selectText', { ref: f.ref });
    if (!selected) w.selectAll();
    await input.pressKey(w, 'backspace');
  }
  await input.typeText(w, a.text);
  const after = a.enter ? watchAfter(t, 300) : null;
  if (a.enter) await input.pressKey(w, 'enter');
  const r = { ref: f.ref };
  return after ? Object.assign(r, await after) : r;
}

async function keys(a) {
  const t = resolveTab(a.tab), w = t.view.webContents;
  for (const k of a.keys) keyEvents(k, a.mods); // kiểm hết trước khi bấm phím nào
  focusIfActive(t);
  for (const k of a.keys) await input.pressKey(w, k, a.mods);
  return { count: a.keys.length };
}

// Có đích, không hướng → cuộn tới đích. Có hướng → lăn chuột amount px (mặc định 600) tại đích / giữa trang.
async function scroll(a) {
  const t = resolveTab(a.tab), w = t.view.webContents;
  const hasTarget = a.ref || a.sels;
  if (!a.dir) {
    if (!hasTarget) fail('bad_args', 'cần dir (up | down | left | right) hoặc ref / selector để cuộn tới');
    const loc = await callAgent(w, 'locate', targetArgs(a));
    return { ref: loc.ref, inView: loc.inView };
  }
  const p = hasTarget ? await callAgent(w, 'locate', targetArgs(a)) : await callAgent(w, 'viewport', {});
  const n = a.amount || 600;
  const d = { up: [0, -n], down: [0, n], left: [-n, 0], right: [n, 0] }[a.dir];
  await input.wheel(w, p.x, p.y, d[0], d[1]);
  return { dir: a.dir, amount: n };
}

async function hover(a) {
  const t = resolveTab(a.tab);
  const loc = await locate(t, a);
  await input.mouseMove(t.view.webContents, loc.x, loc.y);
  return { ref: loc.ref, screenRect: screenRect(t, loc.rect) };
}

module.exports = { click, type, keys, scroll, hover };
