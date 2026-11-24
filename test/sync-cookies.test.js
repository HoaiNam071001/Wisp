const test = require('node:test');
const assert = require('assert');
const c = require('../sync-cookies');

const ck = (name, value, extra) => Object.assign({ name, value, domain: '.cf4vn.bar', path: '/', hostOnly: false, secure: true, httpOnly: false, sameSite: 'unspecified', expirationDate: 2000 }, extra);
const NOW = 1000;

test('normalizeDomains: bỏ trống / trùng / sai / domain Google', () => {
  const r = c.normalizeDomains([' CF4VN.bar ', '.cf4vn.bar', '', 'abc', 'accounts.google.com', 'mail.google.co.uk', 'x.youtube.com']);
  assert.deepStrictEqual(r.domains, ['cf4vn.bar']);
  assert.deepStrictEqual(r.rejected, ['abc', 'accounts.google.com', 'mail.google.co.uk', 'x.youtube.com']);
  assert.deepStrictEqual(c.normalizeDomains(null).domains, []);
});

test('pick: chỉ cookie của domain đã chọn (cả subdomain), không bao giờ Google', () => {
  const list = [ck('a', '1'), ck('b', '2', { domain: 'play.cf4vn.bar' }), ck('c', '3', { domain: 'evil-cf4vn.bar' }), ck('d', '4', { domain: '.google.com' })];
  assert.deepStrictEqual(c.pick(list, ['cf4vn.bar']).map((x) => x.name), ['a', 'b']);
  assert.deepStrictEqual(c.pick(list, ['google.com']), []); // dù ai đó cố gắng liệt kê
});

test('toSetDetails: hostOnly không đặt domain; phiên được hạn; hết hạn → null', () => {
  const host = c.toSetDetails(ck('a', '1', { domain: 'cf4vn.bar', hostOnly: true }), NOW);
  assert.strictEqual(host.url, 'https://cf4vn.bar/');
  assert.strictEqual('domain' in host, false);
  const dom = c.toSetDetails(ck('a', '1'), NOW);
  assert.strictEqual(dom.domain, '.cf4vn.bar');
  const sess = c.toSetDetails(ck('s', 'x', { expirationDate: undefined, secure: false }), NOW);
  assert.strictEqual(sess.expirationDate, NOW + c.SESSION_DAYS * 86400);
  assert.strictEqual(sess.url.startsWith('http://'), true);
  assert.strictEqual(c.toSetDetails(ck('old', 'x', { expirationDate: 500 }), NOW), null);
  assert.strictEqual(c.toSetDetails({ name: 'x' }, NOW), null);
});

test('mergeBucket: máy chưa đổi thì lấy giá trị bên kia; đã đổi thì giữ', () => {
  const base = { [c.keyOf(ck('s', 'v0'))]: require('crypto').createHash('sha1').update('v0').digest('hex') };
  assert.strictEqual(c.mergeBucket([ck('s', 'v0')], [ck('s', 'v1')], base, NOW).cookies[0].value, 'v1');
  assert.strictEqual(c.mergeBucket([ck('s', 'mine')], [ck('s', 'v1')], base, NOW).cookies[0].value, 'mine');
  assert.strictEqual(c.mergeBucket([ck('s', 'mine')], [ck('s', 'v1')], {}, NOW).cookies[0].value, 'mine'); // chưa có base: giữ máy này
});

test('mergeBucket: thêm cookie mới của máy kia; không sống lại cookie đã xoá ở máy này; bỏ hết hạn', () => {
  const gone = ck('gone', 'x');
  const base = { [c.keyOf(gone)]: 'h' };
  const r = c.mergeBucket([ck('mine', '1')], [gone, ck('new', '2'), ck('old', '3', { expirationDate: 900 })], base, NOW);
  assert.deepStrictEqual(r.cookies.map((x) => x.name), ['mine', 'new']);
  assert.deepStrictEqual(Object.keys(r.base).sort(), [c.keyOf(ck('mine', '')), c.keyOf(ck('new', ''))].sort());
});

test('merge: local.flash = null (engine Flash chưa chạy) giữ nguyên bên Drive, không đụng base', () => {
  const remote = { web: [], flash: [ck('f', '1')] };
  const r = c.merge({ web: [ck('w', '1')], flash: null }, remote, { flash: { k: 'h' } }, NOW);
  assert.deepStrictEqual(r.merged.flash, remote.flash);
  assert.deepStrictEqual(r.base.flash, { k: 'h' });
  assert.deepStrictEqual(r.merged.web.map((x) => x.name), ['w']);
  assert.deepStrictEqual(c.merge({ web: [], flash: null }, null, null, NOW).merged, { web: [], flash: [] });
});
