const test = require('node:test');
const assert = require('node:assert');
const { nextVersion } = require('../scripts/release');

test('nextVersion', () => {
  assert.strictEqual(nextVersion('2.4.2', 'patch'), '2.4.3');
  assert.strictEqual(nextVersion('2.4.2', 'minor'), '2.5.0');
  assert.strictEqual(nextVersion('2.4.2', 'major'), '3.0.0');
  assert.strictEqual(nextVersion('2.4.2', '3.1.0'), '3.1.0');
  assert.strictEqual(nextVersion('2.4.2', 'z'), '2.4.3');
  assert.strictEqual(nextVersion('2.4.2', 'y'), '2.5.0');
  assert.strictEqual(nextVersion('2.4.2', 'x'), '3.0.0');
  assert.throws(() => nextVersion('2.4.2', 'abc'));
});
