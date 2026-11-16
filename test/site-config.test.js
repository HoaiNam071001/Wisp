const test = require('node:test');
const assert = require('node:assert');
const sc = require('../flash/site-config');

test('migrate: config 2.x → flashSites, mode ruffle áp cho mọi trang', () => {
  const r = sc.migrate({ allowDomains: ['a.vn'], mode: 'ruffle' }, ['cmn.vn']);
  assert.deepStrictEqual(r, [
    { domain: 'cmn.vn', engine: 'ruffle' }, { domain: 'a.vn', engine: 'ruffle' }]);
  assert.deepStrictEqual(sc.migrate({}, ['x.vn']), [{ domain: 'x.vn', engine: 'flash' }]);
});

test('migrate: đã có flashSites thì giữ, bỏ mục hỏng, không trùng', () => {
  const r = sc.migrate({ flashSites: [{ domain: 'a.vn' }, { domain: '' }, null, { domain: 'a.vn', engine: 'ruffle' }] }, ['z.vn']);
  assert.deepStrictEqual(r, [{ domain: 'a.vn', engine: 'ruffle' }]);
  assert.deepStrictEqual(sc.migrate({ flashSites: 'xấu' }, []), []);
});

test('engineFor: khớp subdomain, không khớp đuôi giả, thiếu plugin → ruffle', () => {
  const s = [{ domain: 'cf4vn.bar', engine: 'flash' }];
  assert.strictEqual(sc.engineFor(s, 'game.cf4vn.bar', true), 'flash');
  assert.strictEqual(sc.engineFor(s, 'cf4vn.bar', false), 'ruffle');
  assert.strictEqual(sc.engineFor(s, 'evilcf4vn.bar', true), 'web');
  assert.strictEqual(sc.engineFor(s, 'youtube.com', true), 'web');
  assert.strictEqual(sc.engineFor(s, '', true), 'web');
});

test('setSite: bật, đổi engine, tắt', () => {
  let s = sc.setSite([], 'static.game.cmn.vn', 'flash');
  assert.deepStrictEqual(s, [{ domain: 'cmn.vn', engine: 'flash' }]);
  s = sc.setSite(s, 'cmn.vn', 'ruffle');
  assert.deepStrictEqual(s, [{ domain: 'cmn.vn', engine: 'ruffle' }]);
  assert.deepStrictEqual(sc.setSite(s, 'a.cmn.vn', 'off'), []);
  assert.deepStrictEqual(sc.allowDomainsOf(s), ['cmn.vn']);
});
