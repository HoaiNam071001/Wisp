const test = require('node:test');
const assert = require('node:assert');
const { hoverLabel, normalize } = require('../ghosthand/pick-payload');

test('nhãn rê chuột', () => {
  assert.strictEqual(hoverLabel('button', 'Tìm kiếm', 'BUTTON'), 'button “Tìm kiếm”');
  assert.strictEqual(hoverLabel('textbox', '', 'INPUT'), 'textbox');
  assert.strictEqual(hoverLabel('', '', 'DIV'), 'div');
  assert.strictEqual(hoverLabel('', '', ''), 'phần tử');
});

test('normalize: hợp lệ', () => {
  const r = normalize({ action: 'type', selector: 'role=searchbox', selectors: ['css=#q'], count: 1, role: 'searchbox', name: 'Tìm', input: 'hello' });
  assert.deepStrictEqual(r.selectors, ['role=searchbox', 'css=#q']);
  assert.strictEqual(r.input, 'hello');
  assert.strictEqual(r.count, 1);
});

test('normalize: không có input cho hành động khác', () => {
  assert.strictEqual('input' in normalize({ action: 'click', selector: 'text=OK', input: 'x' }), false);
});

test('normalize: bỏ tin sai', () => {
  assert.strictEqual(normalize(null), null);
  assert.strictEqual(normalize({ action: 'rm', selector: 'a' }), null);
  assert.strictEqual(normalize({ action: 'click', selector: '  ' }), null);
  assert.strictEqual(normalize({ action: 'click', selector: 5 }), null);
});

test('normalize: cắt độ dài, count sai về 0', () => {
  const r = normalize({ action: 'read', selector: 'a'.repeat(5000), count: -3, text: 'x'.repeat(900) });
  assert.strictEqual(r.selector.length, 2000);
  assert.strictEqual(r.text.length, 500);
  assert.strictEqual(r.count, 0);
});
