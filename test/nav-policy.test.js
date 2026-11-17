const test = require('node:test');
const assert = require('node:assert');
const { blockedNavigation } = require('../nav-policy');

test('trang web không được sang file://', () => {
  assert.strictEqual(blockedNavigation('https://a.com/x', 'file:///etc/passwd'), true);
  assert.strictEqual(blockedNavigation('http://a.com', 'FILE:///C:/x'), true);
  assert.strictEqual(blockedNavigation('data:text/html,hi', 'file:///x'), true);
});

test('trang nội bộ file: và đích không phải file giữ nguyên', () => {
  assert.strictEqual(blockedNavigation('file:///app/history.html', 'file:///a.swf'), false);
  assert.strictEqual(blockedNavigation('https://a.com', 'https://b.com'), false);
  assert.strictEqual(blockedNavigation('', 'file:///x'), false);
  assert.strictEqual(blockedNavigation(undefined, undefined), false);
});
