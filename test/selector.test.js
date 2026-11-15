// Dữ liệu chép từ autoclicker/testdata – cùng kết quả với ParseSelector / StableSelector của Ghosthand.
const test = require('node:test');
const assert = require('node:assert');
const { parseSelector, stableLabel, stableSelector, stableFirst } = require('../ghosthand/selector');
const cases = require('./data/selectors.json');
const stable = require('./data/stable-labels.json');

test('parseSelector: như ParseSelector của Ghosthand', () => {
  for (const c of cases) {
    if (c.bad) { assert.throws(() => parseSelector(c.in), Error, c.in); continue; }
    assert.deepStrictEqual(parseSelector(c.in), c.want, c.in);
  }
});

test('stableLabel / stableSelector: như StableLabel / StableSelector', () => {
  for (const c of stable.labels) assert.strictEqual(stableLabel(c.in), c.want, c.in);
  for (const c of stable.selectors) assert.strictEqual(stableSelector(c.in), c.want, c.in);
});

test('stableFirst: chèn dạng cố định trước dòng hay đổi, bỏ trùng', () => {
  assert.deepStrictEqual(stableFirst(['aria="Messenger, 1 unread"', 'aria=Messenger, 2 unread', 'css=#a']),
    ['aria=Messenger', 'aria="Messenger, 1 unread"', 'aria=Messenger, 2 unread', 'css=#a']);
});
