const test = require('node:test');
const assert = require('node:assert');
const { decide, remember, originHost } = require('../permission-policy');

test('quyền an toàn tự cho, quyền lạ từ chối, quyền nhạy cảm hỏi', () => {
  assert.strictEqual(decide('fullscreen', 'a.com', {}), 'allow');
  assert.strictEqual(decide('hid', 'a.com', {}), 'deny');
  assert.strictEqual(decide('media', 'a.com', {}), 'ask');
});

test('nhớ theo domain', () => {
  let s = remember({}, 'a.com', 'media', true);
  assert.strictEqual(decide('media', 'a.com', s), 'allow');
  assert.strictEqual(decide('media', 'b.com', s), 'ask');
  s = remember(s, 'a.com', 'media', false);
  assert.strictEqual(decide('media', 'a.com', s), 'deny');
});

test('không rõ domain thì từ chối', () => {
  assert.strictEqual(decide('media', '', {}), 'deny');
  assert.strictEqual(originHost('not a url'), '');
});
