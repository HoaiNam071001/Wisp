const test = require('node:test');
const assert = require('node:assert');
const m = require('../sync-merge');
const c = require('../sync-crypt');
const g = require('../google-pkce');

test('mergeItems: thêm ở cả hai máy, bên mới thắng, xoá ở máy này – sửa cũ hơn ở máy kia', () => {
  const a = [{ id: 'x', updatedAt: 5, deleted: 5 }, { id: 'a', updatedAt: 1 }];
  const b = [{ id: 'x', updatedAt: 3, title: 'sửa' }, { id: 'b', updatedAt: 2 }];
  const r = m.mergeItems(a, b);
  assert.deepStrictEqual(r.map(i => i.id).sort(), ['a', 'b', 'x']);
  assert.ok(r.find(i => i.id === 'x').deleted);
  assert.strictEqual(m.mergeItems([{ id: 'y', updatedAt: 4 }], [{ id: 'y', updatedAt: 4, deleted: 4 }])[0].deleted, 4); // bằng nhau: xoá thắng
  assert.deepStrictEqual(m.mergeItems(null, [{ id: 1 }, null]), []); // mục hỏng bị bỏ
});

test('mergeHistory: bỏ trùng, giữ max gần nhất, cũ → mới', () => {
  const r = m.mergeHistory([{ url: 'a', time: 1 }, { url: 'b', time: 3 }], [{ url: 'a', time: 1 }, { url: 'c', time: 2 }], 2);
  assert.deepStrictEqual(r.map(h => h.url), ['c', 'b']);
  assert.deepStrictEqual(m.mergeHistory([], undefined, 5), []);
});

test('pickConfig / mergeConfig: chỉ khoá liệt kê, khoá mới hơn thắng', () => {
  const keys = ['home', 'sites'];
  const mine = m.pickConfig({ home: 'a', sites: [1], secret: 'x' }, keys, null, 10);
  assert.deepStrictEqual(Object.keys(mine), keys);
  assert.strictEqual(m.pickConfig({ home: 'a' }, keys, mine, 99).home.t, 10); // giá trị không đổi → giữ mốc cũ
  assert.strictEqual(m.pickConfig({ home: 'b' }, keys, mine, 99).home.t, 99);
  const r = m.mergeConfig({ home: { v: 'a', t: 1 } }, { home: { v: 'b', t: 2 }, sites: { v: [], t: 1 }, evil: { v: 1, t: 1 } }, keys);
  assert.strictEqual(r.home.v, 'b');
  assert.ok(r.sites && !r.evil);
});

test('crypt: khứ hồi, sai mật khẩu, mật khẩu ngắn, bản mã hỏng', () => {
  const blob = c.encrypt('cookie=1', 'matkhau-dai');
  assert.strictEqual(c.decrypt(blob, 'matkhau-dai'), 'cookie=1');
  assert.throws(() => c.decrypt(blob, 'sai-mat-khau'), /Sai mật khẩu/);
  assert.throws(() => c.encrypt('x', 'ngan'), /ít nhất/);
  assert.throws(() => c.decrypt('không phải json', 'matkhau-dai'), /hỏng/);
  assert.notStrictEqual(c.encrypt('cookie=1', 'matkhau-dai'), blob); // salt / iv ngẫu nhiên
});

test('pkce: challenge = sha256(verifier), URL đủ tham số, scope chỉ appdata', () => {
  const p = g.newPkce();
  assert.ok(/^[A-Za-z0-9_-]{43}$/.test(p.verifier));
  const u = new URL(g.authUrl({ clientId: 'id', redirectUri: 'http://127.0.0.1:1234', challenge: p.challenge, state: p.state }));
  assert.strictEqual(u.searchParams.get('code_challenge_method'), 'S256');
  assert.ok(u.searchParams.get('scope').includes('drive.appdata') && !u.searchParams.get('scope').includes('auth/drive '));
});

test('parseCallback: mã, sai state, từ chối, đường dẫn khác', () => {
  assert.deepStrictEqual(g.parseCallback('/?code=abc&state=s', 's'), { code: 'abc' });
  assert.ok(g.parseCallback('/?code=abc&state=sai', 's').error);
  assert.match(g.parseCallback('/?error=access_denied&state=s', 's').error, /từ chối/);
  assert.strictEqual(g.parseCallback('/favicon.ico', 's'), null);
  assert.ok(g.parseCallback('/?state=s', 's').error);
});

test('readIdToken: đọc email, token hỏng không ném', () => {
  const t = 'h.' + Buffer.from(JSON.stringify({ email: 'a@b.c', name: 'A' })).toString('base64') + '.s';
  assert.strictEqual(g.readIdToken(t).email, 'a@b.c');
  assert.strictEqual(g.readIdToken('rác').email, '');
});
