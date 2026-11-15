const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { pathToFileURL } = require('url');
const { createUrls, PLAYER_PATH } = require('../urls');

const appDir = path.join(__dirname, '..');
const historyUrl = pathToFileURL(path.join(appDir, 'history.html')).href;
const playerUrl = pathToFileURL(path.join(appDir, 'player.html')).href;
const make = (over = {}) => createUrls({
  historyUrl, appDir, homeDir: () => '/Users/test', ruffle: false, isWin: false, exists: () => false, ...over,
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

test('normalizeUrl: .swf bọc vào player.html; Ruffle + file → ruffle://file', () => {
  const swf = 'https://a.vn/game.swf?v=1';
  assert.strictEqual(make().normalizeUrl(swf), playerUrl + '?src=' + encodeURIComponent(swf));
  const ruffle = make({ ruffle: true, exists: () => true });
  assert.strictEqual(ruffle.normalizeUrl('/g/game.swf'),
    'ruffle://file' + PLAYER_PATH + '?src=' + encodeURIComponent('ruffle://file/g/game.swf'));
  // Ruffle với .swf trên mạng vẫn dùng player.html
  assert.strictEqual(ruffle.normalizeUrl(swf), playerUrl + '?src=' + encodeURIComponent(swf));
});

test('displayUrl: bỏ lớp player.html / ruffle://file, Lịch sử → wisp://history', () => {
  const { displayUrl, isHistoryUrl } = make();
  const swf = 'https://a.vn/game.swf';
  assert.strictEqual(displayUrl(playerUrl + '?src=' + encodeURIComponent(swf)), swf);
  assert.strictEqual(displayUrl('ruffle://file' + PLAYER_PATH + '?src=' + encodeURIComponent('ruffle://file/g/x.swf')), 'file:///g/x.swf');
  assert.strictEqual(displayUrl(historyUrl + '#q'), 'wisp://history');
  assert.ok(isHistoryUrl(historyUrl + '?a=1'));
  assert.ok(!isHistoryUrl('https://a.vn/'));
  assert.strictEqual(displayUrl('https://a.vn/'), 'https://a.vn/');
});
