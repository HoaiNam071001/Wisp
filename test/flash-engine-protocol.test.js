const test = require('node:test');
const assert = require('node:assert');
const p = require('../flash-engine/protocol');

test('parseLine: lệnh hợp lệ / sai', () => {
  assert.deepStrictEqual(p.parseLine('{"id":1,"cmd":"frameRect"}').msg, { id: 1, cmd: 'frameRect' });
  assert.strictEqual(p.parseLine('xấu').error.code, 'bad_args');
  assert.strictEqual(p.parseLine('{"cmd":"rm"}').error.code, 'bad_args');
  assert.strictEqual(p.parseLine('{"cmd":"open","url":"file:///etc/passwd"}').error.code, 'bad_args');
  assert.ok(p.parseLine('{"id":2,"cmd":"open","url":"https://a.vn/"}').msg);
});

test('reply / fail / event: một dòng JSON', () => {
  assert.deepStrictEqual(JSON.parse(p.reply(3, { a: 1 })), { id: 3, ok: true, result: { a: 1 } });
  assert.strictEqual(p.fail(3, { code: 'x', detail: 'y' }).endsWith('\n'), true);
  assert.deepStrictEqual(JSON.parse(p.event('url', { url: 'u' })), { event: 'url', data: { url: 'u' } });
});
