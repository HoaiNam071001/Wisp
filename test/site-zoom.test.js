const test = require('node:test');
const assert = require('node:assert');
const { hostOf, levelFor, remember } = require('../site-zoom');

test('chỉ http(s) có host', () => {
  assert.strictEqual(hostOf('https://Example.com/a?b'), 'example.com');
  assert.strictEqual(hostOf('file:///a.html'), '');
  assert.strictEqual(hostOf('không phải url'), '');
});

test('nhớ, đọc lại, về 100% thì xoá', () => {
  let m = remember(undefined, 'https://a.com/x', 1.5);
  assert.deepStrictEqual(m, { 'a.com': 1.5 });
  assert.strictEqual(levelFor(m, 'https://a.com/khac'), 1.5);
  assert.strictEqual(levelFor(m, 'https://b.com'), 0);
  m = remember(m, 'https://a.com', 0);
  assert.deepStrictEqual(m, {});
});

test('kẹp mức, bỏ qua dữ liệu hỏng', () => {
  assert.strictEqual(remember({}, 'https://a.com', 99)['a.com'], 5);
  assert.strictEqual(levelFor({ 'a.com': 'xyz' }, 'https://a.com'), 0);
  assert.strictEqual(levelFor('hỏng', 'https://a.com'), 0);
  assert.deepStrictEqual(remember({ 'a.com': 1 }, 'file:///x', 2), { 'a.com': 1 });
});
