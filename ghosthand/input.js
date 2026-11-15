// Chuột / phím thật cho tab: webContents.sendInputEvent (trang nhận isTrusted = true, như người dùng bấm).
// Toạ độ vào là CSS px của trang chính; sendInputEvent nhận toạ độ của view → nhân zoomFactor.
const { keyEvents, textEvents } = require('./keys');

const sleep = ms => new Promise(r => setTimeout(r, ms));
const BUTTONS = { left: 'left', right: 'right', middle: 'middle' };

function viewPoint(wc, x, y) {
  const z = wc.getZoomFactor();
  return { x: Math.round(x * z), y: Math.round(y * z) };
}

async function mouseMove(wc, x, y) {
  const p = viewPoint(wc, x, y);
  wc.sendInputEvent({ type: 'mouseMove', x: p.x, y: p.y });
  await sleep(30);
}

// count = 2 → nhấp đúp (mỗi lần bấm tăng clickCount như chuột thật).
async function click(wc, x, y, button = 'left', count = 1) {
  const p = viewPoint(wc, x, y);
  const b = BUTTONS[button] || 'left';
  wc.sendInputEvent({ type: 'mouseMove', x: p.x, y: p.y });
  await sleep(40);
  for (let i = 1; i <= count; i++) {
    wc.sendInputEvent({ type: 'mouseDown', x: p.x, y: p.y, button: b, clickCount: i });
    await sleep(30);
    wc.sendInputEvent({ type: 'mouseUp', x: p.x, y: p.y, button: b, clickCount: i });
    if (i < count) await sleep(60);
  }
}

// Lăn chuột tại (x, y); dy > 0 = xuống. Electron: deltaY âm là lăn xuống (như bánh xe).
async function wheel(wc, x, y, dx, dy) {
  const p = viewPoint(wc, x, y);
  wc.sendInputEvent({ type: 'mouseMove', x: p.x, y: p.y });
  // chia nhỏ như bánh xe thật (mỗi nấc ~100px) để trang cuộn mượt / bắt được sự kiện wheel
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 100));
  for (let i = 0; i < steps; i++) {
    wc.sendInputEvent({ type: 'mouseWheel', x: p.x, y: p.y, deltaX: -dx / steps, deltaY: -dy / steps, canScroll: true });
    await sleep(16);
  }
}

async function sendEvents(wc, events, gapMs) {
  for (const ev of events) {
    wc.sendInputEvent(ev);
    if (gapMs) await sleep(gapMs);
  }
}

// Một phím / tổ hợp (tên như Ghosthand); tổ hợp sửa chữ (Cmd/Ctrl+A…) chạy lệnh soạn thảo của webContents.
async function pressKey(wc, name, mods) {
  const k = keyEvents(name, mods);
  if (k.edit) { wc[k.edit](); await sleep(30); return; }
  await sendEvents(wc, k.events, 10);
}

async function typeText(wc, text) { await sendEvents(wc, textEvents(text), 8); }

module.exports = { sleep, mouseMove, click, wheel, pressKey, typeText };
