const test = require('node:test');
const assert = require('assert');
const { compose, pickFirst, pathOrder } = require('../ghosthand/frame-layout');

const box = (x, y, w, h) => ({ x, y, w, h });

test('compose: frame con + cháu, cộng gốc và cắt vùng nhìn', () => {
  const m = compose([
    { key: 'top', self: '', frames: [{ path: '1', box: box(100, 200, 300, 150), clip: box(100, 200, 300, 100) }] },
    { key: 'b', self: '1', frames: [{ path: '1.0', box: box(10, 80, 200, 100), clip: box(10, 80, 200, 70) }] },
    { key: 'c', self: '1.0', frames: [] },
  ]);
  assert.deepStrictEqual(m.get('top'), { x: 0, y: 0, clip: null, path: '', owner: null });
  assert.deepStrictEqual(m.get('b'), { x: 100, y: 200, clip: box(100, 200, 300, 100), path: '1', owner: 'top' });
  // cháu: gốc 110, 280; clip của nó (110..310, 280..350) cắt theo clip của cha (y ≤ 300)
  assert.deepStrictEqual(m.get('c'), { x: 110, y: 280, clip: box(110, 280, 200, 20), path: '1.0', owner: 'b' });
});

test('compose: không thấy thẻ iframe → bỏ agent đó', () => {
  const m = compose([{ key: 'top', self: '', frames: [] }, { key: 'x', self: '3', frames: [] }]);
  assert.ok(m.has('top'));
  assert.ok(!m.has('x'));
});

test('compose: báo cáo vòng (tự chứa mình) không treo', () => {
  const m = compose([{ key: 'x', self: '2', frames: [{ path: '2', box: box(0, 0, 1, 1), clip: box(0, 0, 1, 1) }] }]);
  assert.ok(!m.has('x'));
});

test('pickFirst: index nhỏ nhất, bằng nhau lấy agent trước', () => {
  assert.deepStrictEqual(pickFirst([{ index: 1, hidden: 0 }, { index: 0, hidden: 2 }, null]), { agent: 1, index: 0, hidden: 2 });
  assert.deepStrictEqual(pickFirst([{ index: 0 }, { index: 0 }]), { agent: 0, index: 0, hidden: 0 });
  assert.deepStrictEqual(pickFirst([{ index: -1, hidden: 3 }, null]), { agent: -1, index: -1, hidden: 3 });
});

test('pathOrder: thứ tự trang', () => {
  assert.deepStrictEqual(['10', '1', '', '0.1', '0'].sort(pathOrder), ['', '0', '0.1', '1', '10']);
});
