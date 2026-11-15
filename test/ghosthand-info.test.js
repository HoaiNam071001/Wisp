const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { FILE, newToken, writeInfo, removeInfo, tokenOk } = require('../ghosthand/info-file');

test('writeInfo: ghi JSON quyền 600; removeInfo chỉ xoá file của đúng pid', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wisp-gh-'));
  const file = writeInfo(dir, { port: 5000, token: 't', pid: 11, version: '3.0.0', api: 1 });
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(file, 'utf8')).port, 5000);
  if (process.platform !== 'win32') assert.strictEqual(fs.statSync(file).mode & 0o777, 0o600);
  removeInfo(dir, 99);
  assert.ok(fs.existsSync(path.join(dir, FILE)), 'pid khác thì giữ');
  removeInfo(dir, 11);
  assert.ok(!fs.existsSync(path.join(dir, FILE)));
  fs.rmdirSync(dir);
});

test('tokenOk: chỉ nhận "Bearer <token>" đúng', () => {
  const t = newToken();
  assert.strictEqual(t.length, 48);
  assert.ok(tokenOk('Bearer ' + t, t));
  assert.ok(!tokenOk('Bearer ' + t + 'x', t));
  assert.ok(!tokenOk(t, t));
  assert.ok(!tokenOk(undefined, t));
});
