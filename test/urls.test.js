const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { pathToFileURL } = require('url');
const { createUrls } = require('../urls');

const appDir = path.join(__dirname, '..');
const historyUrl = pathToFileURL(path.join(appDir, 'history.html')).href;
const playerUrl = pathToFileURL(path.join(appDir, 'player.html')).href;
const launcherUrl = pathToFileURL(path.join(appDir, 'flash-launcher.html')).href;
const make = (over = {}) => createUrls({
  historyUrl, launcherUrl, appDir, homeDir: () => '/Users/test', isWin: false, exists: () => false, ...over,
});

test('normalizeUrl: thêm https:// / http:// cho localhost và IP', () => {
  const { normalizeUrl } = make();
  assert.strictEqual(normalizeUrl('  bangbang.cmn.vn '), 'https://bangbang.cmn.vn');
  assert.strictEqual(normalizeUrl('localhost/x'), 'http://localhost/x');
  assert.strictEqual(normalizeUrl('192.168.1.2:8080'), 'http://192.168.1.2:8080');
  assert.strictEqual(normalizeUrl('https://a.vn/'), 'https://a.vn/');
  assert.strictEqual(normalizeUrl(''), null);
  assert.strictEqual(normalizeUrl(null), null);
});

test('normalizeUrl: wisp://history → trang Lịch sử nội bộ', () => {
  const { normalizeUrl } = make();
  assert.strictEqual(normalizeUrl('wisp://history'), historyUrl);
  assert.strictEqual(normalizeUrl('WISP:history/'), historyUrl);
});

test('normalizeUrl: đường dẫn file có thật → file://', () => {
  const { normalizeUrl } = make({ exists: (p) => p === '/Users/test/a.html' });
  assert.strictEqual(normalizeUrl('~/a.html'), 'file:///Users/test/a.html');
  assert.strictEqual(normalizeUrl('/Users/test/a.html'), 'file:///Users/test/a.html');
});

test('normalizeUrl: .swf bọc vào player.html', () => {
  const swf = 'https://a.vn/game.swf?v=1';
  assert.strictEqual(make().normalizeUrl(swf), playerUrl + '?src=' + encodeURIComponent(swf));
});

test('displayUrl: bỏ lớp player.html, Lịch sử → wisp://history', () => {
  const { displayUrl, isHistoryUrl } = make();
  const swf = 'https://a.vn/game.swf';
  assert.strictEqual(displayUrl(playerUrl + '?src=' + encodeURIComponent(swf)), swf);
  assert.strictEqual(displayUrl(historyUrl + '#q'), 'wisp://history');
  assert.ok(isHistoryUrl(historyUrl + '?a=1'));
  assert.ok(!isHistoryUrl('https://a.vn/'));
  assert.strictEqual(displayUrl('https://a.vn/'), 'https://a.vn/');
});

test('trang chờ Flash: displayUrl trả địa chỉ thật, launcherUrlFor đảo ngược được', () => {
  const { launcherUrlFor, displayUrl, isLauncherUrl } = make();
  const real = 'https://cf4vn.bar/play?a=1&b=2';
  const u = launcherUrlFor(real);
  assert.ok(isLauncherUrl(u));
  assert.strictEqual(displayUrl(u), real);
  assert.strictEqual(isLauncherUrl(real), false);
});

test('wisp://bookmarks → trang Dấu trang nội bộ', () => {
  const bm = pathToFileURL(path.join(appDir, 'bookmarks.html')).href;
  const u = make({ bookmarksUrl: bm });
  assert.strictEqual(u.normalizeUrl('wisp://bookmarks'), bm);
  assert.strictEqual(u.displayUrl(bm + '#x'), 'wisp://bookmarks');
  assert.ok(u.isBookmarksUrl(bm + '?a=1'));
  assert.ok(!u.isBookmarksUrl('https://a.com'));
});
