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

test('hostInDomains: domain gốc, subdomain, danh sách rỗng', () => {
  assert.strictEqual(p.hostInDomains(['cf4vn.bar'], 'cf4vn.bar'), true);
  assert.strictEqual(p.hostInDomains(['cf4vn.bar'], 'game.cf4vn.bar'), true);
  assert.strictEqual(p.hostInDomains(['cf4vn.bar'], 'evilcf4vn.bar'), false);
  assert.strictEqual(p.hostInDomains(['cf4vn.bar'], 'youtube.com'), false);
  assert.strictEqual(p.hostInDomains([], 'bất kỳ'), true);
});

test('parseLine: game cần action hợp lệ', () => {
  assert.strictEqual(p.parseLine('{"id":1,"cmd":"game"}').error.code, 'bad_args');
  assert.strictEqual(p.parseLine('{"id":1,"cmd":"game","action":"x"}').error.code, 'bad_args');
  assert.ok(p.parseLine('{"id":1,"cmd":"game","action":"reload"}').msg);
});

test('parseLine: game resize cần kích thước trong khoảng', () => {
  assert.strictEqual(p.parseLine('{"id":1,"cmd":"game","action":"resize"}').error.code, 'bad_args');
  assert.strictEqual(p.parseLine('{"id":1,"cmd":"game","action":"resize","width":99999,"height":600}').error.code, 'bad_args');
  assert.ok(p.parseLine('{"id":1,"cmd":"game","action":"resize","width":1000,"height":600}').msg);
});

test('parseLine: lệnh keyRemap hợp lệ', () => {
  assert.ok(p.parseLine('{"id":4,"cmd":"keyRemap","keyRemap":{"enabled":true,"map":{"b":"s"}}}').msg);
});
