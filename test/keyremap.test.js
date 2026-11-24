const test = require('node:test');
const assert = require('node:assert');
const { normalizeKey, accelOf, normalizeMap, normalizeConfig, createRemapper, attach } = require('../keyremap');

test('accelOf: chữ, số, phím tên, F-key, phím lạ', () => {
  assert.strictEqual(accelOf('B'), 'B');
  assert.strictEqual(accelOf('s'), 'S');
  assert.strictEqual(accelOf(' '), 'Space');
  assert.strictEqual(accelOf('ArrowLeft'), 'Left');
  assert.strictEqual(accelOf('F12'), 'F12');
  assert.strictEqual(accelOf('Shift'), null);
  assert.strictEqual(accelOf('é'), null);
});

test('normalizeMap: bỏ cặp giống nhau / không hỗ trợ, cho phép hoán đổi', () => {
  assert.deepStrictEqual(normalizeMap({ B: 'S', s: 's', x: 'Shift', é: 'a' }), { b: 's' });
  assert.deepStrictEqual(normalizeMap({ a: 'b', b: 'a' }), { a: 'b', b: 'a' });
  assert.deepStrictEqual(normalizeMap(null), {});
  assert.deepStrictEqual(normalizeMap('x'), {});
});

test('normalizeConfig: mặc định tắt, config hỏng không lỗi', () => {
  assert.deepStrictEqual(normalizeConfig(undefined), { enabled: false, map: {} });
  assert.deepStrictEqual(normalizeConfig({ enabled: 'yes', map: { b: 's' } }), { enabled: false, map: { b: 's' } });
});

const make = (state) => createRemapper(() => state);
const down = (key, extra = {}) => ({ type: 'keyDown', key, ...extra });
const up = (key) => ({ type: 'keyUp', key });

test('handle: B → S gửi keyDown + char, nhả đúng phím đích', () => {
  const r = make({ enabled: true, map: { b: 's' } });
  assert.deepStrictEqual(r.handle(down('b')), [
    { type: 'keyDown', keyCode: 'S', modifiers: [] }, { type: 'char', keyCode: 's', modifiers: [] }]);
  assert.deepStrictEqual(r.handle(up('B')), [{ type: 'keyUp', keyCode: 'S', modifiers: [] }]);
  assert.strictEqual(r.handle(up('b')), null);
});

test('handle: giữ phím → auto-repeat, Shift cho chữ hoa', () => {
  const r = make({ enabled: true, map: { b: 's' } });
  const ev = r.handle(down('B', { shift: true, isAutoRepeat: true }));
  assert.deepStrictEqual(ev[0].modifiers, ['shift', 'isAutoRepeat']);
  assert.strictEqual(ev[1].keyCode, 'S');
});

test('handle: tắt, phím không có trong bảng, có Ctrl/Cmd/Alt → để đi tiếp', () => {
  assert.strictEqual(make({ enabled: false, map: { b: 's' } }).handle(down('b')), null);
  const r = make({ enabled: true, map: { b: 's' } });
  assert.strictEqual(r.handle(down('x')), null);
  assert.strictEqual(r.handle(down('b', { control: true })), null);
  assert.strictEqual(r.handle(down('b', { meta: true })), null);
});

test('handle: tắt giữa lúc đang giữ vẫn nhả đúng phím đích (không kẹt)', () => {
  const state = { enabled: true, map: { b: 's' } };
  const r = createRemapper(() => state);
  r.handle(down('b'));
  state.enabled = false;
  assert.deepStrictEqual(r.handle(up('b')), [{ type: 'keyUp', keyCode: 'S', modifiers: [] }]);
});

test('handle: phím đích không in được (mũi tên) không gửi char', () => {
  const ev = make({ enabled: true, map: { q: 'ArrowLeft' } }).handle(down('q'));
  assert.deepStrictEqual(ev, [{ type: 'keyDown', keyCode: 'Left', modifiers: [] }]);
});

test('normalizeKey', () => assert.strictEqual(normalizeKey('B'), 'b'));

test('attach: chặn phím, gửi phím thay, không đổi lại sự kiện do chính mình gửi', () => {
  let handler; const sent = []; let prevented = 0;
  const w = { on: (_n, f) => { handler = f; }, sendInputEvent: (ev) => { sent.push(ev.type); handler({ preventDefault() { prevented++; } }, down('s')); } };
  attach(w, make({ enabled: true, map: { b: 's', s: 'b' } })); // hoán đổi: s gửi lại không bị đổi tiếp
  handler({ preventDefault() { prevented++; } }, down('b'));
  assert.deepStrictEqual(sent, ['keyDown', 'char']);
  assert.strictEqual(prevented, 1);
  handler({ preventDefault() { prevented++; } }, down('x')); // phím ngoài bảng đi tiếp
  assert.strictEqual(prevented, 1);
});
