const test = require('node:test');
const assert = require('node:assert');
const { runKind, runAll } = require('../sync-run');
const { mergeItems } = require('../sync-merge');

function memDrive(initial) {
  let text = initial, mt = 1; const writes = [];
  return {
    writes,
    read: async () => text == null ? null : { text, modifiedTime: mt },
    write: async (_n, t, prev) => { if (prev && prev.modifiedTime !== mt) throw Object.assign(new Error('c'), { code: 'conflict' }); text = t; mt++; writes.push(t); },
    poke: (t) => { text = t; mt++; },
  };
}
const kind = (local, applied) => ({ name: 'b.json', local: () => local, merge: mergeItems, apply: (m) => applied.push(m) });

test('máy A đẩy, máy B kéo về: gộp cả hai bên', async () => {
  const d = memDrive(null), got = [];
  await runKind(d, kind([{ id: 'a', updatedAt: 1 }], got));
  assert.strictEqual(d.writes.length, 1);
  await runKind(d, kind([{ id: 'b', updatedAt: 2 }], got));
  assert.deepStrictEqual(got[1].map(i => i.id).sort(), ['a', 'b']);
});

test('không đổi gì thì không ghi lại', async () => {
  const d = memDrive(null);
  await runKind(d, kind([{ id: 'a', updatedAt: 1 }], []));
  const r = await runKind(d, kind([{ id: 'a', updatedAt: 1 }], []));
  assert.strictEqual(r.wrote, false);
  assert.strictEqual(d.writes.length, 1);
});

test('conflict giữa chừng → đọc gộp lại, không mất mục của máy kia', async () => {
  const d = memDrive('[]'); const got = [];
  const realRead = d.read; let first = true;
  d.read = async () => { const r = await realRead(); if (first) { first = false; d.poke(JSON.stringify([{ id: 'x', updatedAt: 5 }])); } return r; };
  await runKind(d, kind([{ id: 'a', updatedAt: 1 }], got));
  assert.deepStrictEqual(got[got.length - 1].map(i => i.id).sort(), ['a', 'x']);
});

test('file Drive hỏng → lỗi nói rõ, không ghi đè', async () => {
  const d = memDrive('{hỏng');
  await assert.rejects(runKind(d, kind([], [])), /hỏng/);
  assert.strictEqual(d.writes.length, 0);
});

test('runAll: lỗi một loại không chặn loại khác', async () => {
  const d = memDrive(null);
  const bad = { name: 'x', local: () => [], merge: () => { throw new Error('boom'); }, apply() {} };
  const r = await runAll(d, [bad, kind([], [])]);
  assert.strictEqual(r.errors.x, 'boom');
  assert.ok(r.ok['b.json']);
});

// Loại mã hoá: local / merge / apply async, encode tự giữ bản cũ khi nội dung không đổi (salt ngẫu nhiên mỗi lần mã hoá)
test('kind async + encode: nội dung không đổi thì không ghi lại Drive', async () => {
  const crypt = require('../sync-crypt');
  const d = memDrive(null), pw = 'mat-khau-12345';
  const mk = () => ({
    name: 's.enc', local: async () => ({ web: ['a'] }),
    merge: async (l, r) => (r ? JSON.parse(crypt.decrypt(JSON.stringify(r), pw)) : l), apply: async () => {},
    encode: async (m, prev) => {
      const plain = JSON.stringify(m);
      if (prev && crypt.decrypt(prev, pw) === plain) return prev;
      return crypt.encrypt(plain, pw);
    },
  });
  assert.strictEqual((await runKind(d, mk())).wrote, true);
  assert.strictEqual((await runKind(d, mk())).wrote, false);
  assert.strictEqual(d.writes.length, 1);
});

test('kind mã hoá: sai mật khẩu thì lỗi nói rõ, không ghi đè Drive', async () => {
  const crypt = require('../sync-crypt');
  const d = memDrive(crypt.encrypt('{"web":[]}', 'mat-khau-cu-12345'));
  const k = { name: 's.enc', local: () => ({}), merge: (l, r) => JSON.parse(crypt.decrypt(JSON.stringify(r), 'mat-khau-moi-1234')), apply: () => {} };
  await assert.rejects(() => runKind(d, k), /Sai mật khẩu/);
  assert.strictEqual(d.writes.length, 0);
});
