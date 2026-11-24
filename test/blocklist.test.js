const test = require('node:test');
const assert = require('node:assert');
const { shouldBlock, isTrackerHost, siteOf, toggleSite } = require('../blocklist');

const d = (url, pageUrl, resourceType = 'script') => ({ url, pageUrl, resourceType });

test('siteOf / isTrackerHost', () => {
  assert.strictEqual(siteOf('a.b.example.co.uk'), 'example.co.uk');
  assert.strictEqual(siteOf('www.vnexpress.net'), 'vnexpress.net');
  assert.ok(isTrackerHost('securepubads.g.doubleclick.net'));
  assert.ok(!isTrackerHost('notdoubleclick.net'));
  assert.ok(!isTrackerHost('cdn.example.com'));
});
test('chỉ chặn bên thứ ba trong danh sách', () => {
  assert.ok(shouldBlock(d('https://ad.doubleclick.net/x.js', 'https://news.com/'), {}));
  assert.ok(!shouldBlock(d('https://ad.doubleclick.net/x.js', 'https://www.doubleclick.net/'), {}));  // bên thứ nhất
  assert.ok(!shouldBlock(d('https://cdn.news.com/x.js', 'https://news.com/'), {}));
  assert.ok(!shouldBlock(d('https://doubleclick.net/', 'https://news.com/', 'mainFrame'), {}));
});
test('tắt toàn cục / theo trang', () => {
  const r = d('https://criteo.com/a', 'https://news.com/');
  assert.ok(!shouldBlock(r, { adblock: false }));
  assert.ok(!shouldBlock(r, { adblockOff: ['news.com'] }));
  assert.ok(shouldBlock(r, { adblockOff: ['other.com'] }));
  assert.deepStrictEqual(toggleSite([], 'a.com'), ['a.com']);
  assert.deepStrictEqual(toggleSite(['a.com'], 'a.com'), []);
});
