const test = require('node:test');
const assert = require('node:assert');
const s = require('../site-info');

test('describe: https / http mở được, wisp / file thì không', () => {
  assert.deepStrictEqual(s.describe('https://a.com/x'), { kind: 'https', host: 'a.com', openable: true });
  assert.strictEqual(s.describe('http://a.com').kind, 'http');
  assert.strictEqual(s.describe('wisp://bookmarks').openable, false);
  assert.strictEqual(s.describe('file:///x.html').openable, false);
  assert.strictEqual(s.describe('').kind, 'other');
});

test('listPermissions / setPermission / reset', () => {
  let saved = { 'a.com': { media: true, geolocation: false }, 'b.com': { media: true } };
  assert.deepStrictEqual(s.listPermissions(saved, 'a.com').map(p => [p.key, p.state]), [['media', 'allow'], ['geolocation', 'deny']]);
  assert.deepStrictEqual(s.listPermissions(saved, 'zzz.com'), []);
  saved = s.setPermission(saved, 'a.com', 'media', 'deny');
  assert.strictEqual(saved['a.com'].media, false);
  saved = s.setPermission(saved, 'a.com', 'media', 'ask');
  assert.strictEqual('media' in saved['a.com'], false);
  assert.strictEqual(s.setPermission(saved, 'a.com', 'khong-co', 'allow'), saved);
  assert.strictEqual(s.setPermission(saved, 'a.com', 'media', 'xyz'), saved);
  saved = s.setPermission(saved, 'a.com', 'geolocation', 'ask'); // hết quyền → bỏ host
  assert.strictEqual('a.com' in saved, false);
  assert.deepStrictEqual(Object.keys(s.resetPermissions({ 'b.com': { media: true } }, 'b.com')), []);
});

test('setPermission không sửa bản gốc', () => {
  const saved = { 'a.com': { media: true } };
  s.setPermission(saved, 'a.com', 'media', 'deny');
  assert.strictEqual(saved['a.com'].media, true);
});

test('cookieMatchesHost: domain cha khớp, domain khác thì không', () => {
  assert.ok(s.cookieMatchesHost('.example.com', 'www.example.com'));
  assert.ok(s.cookieMatchesHost('example.com', 'example.com'));
  assert.ok(!s.cookieMatchesHost('example.com', 'notexample.com'));
  assert.ok(!s.cookieMatchesHost('www.example.com', 'example.com'));
});
