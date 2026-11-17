const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { safeName, uniquePath } = require('../download-name');

test('làm sạch tên', () => {
  assert.strictEqual(safeName('../../etc/passwd'), 'passwd');
  assert.strictEqual(safeName('a:b*c?.zip'), 'a_b_c_.zip');
  assert.strictEqual(safeName('.bashrc'), 'bashrc');
  assert.strictEqual(safeName(''), 'tai-ve');
});

test('không đè file có sẵn', () => {
  const have = new Set([path.join('/d', 'a.zip'), path.join('/d', 'a (1).zip')]);
  assert.strictEqual(uniquePath('/d', 'a.zip', (p) => have.has(p)), path.join('/d', 'a (2).zip'));
  assert.strictEqual(uniquePath('/d', 'b.zip', (p) => have.has(p)), path.join('/d', 'b.zip'));
});
