const test = require('node:test');
const assert = require('node:assert');
const { normalizeQuality, QUALITIES } = require('../flash/quality');

test('chất lượng hợp lệ giữ nguyên', () => {
  for (const q of QUALITIES) assert.strictEqual(normalizeQuality(q.value), q.value);
});
test('giá trị lạ / rỗng → null (theo game)', () => {
  for (const v of [undefined, null, '', 'best', 'LOW', 5, {}]) assert.strictEqual(normalizeQuality(v), null);
});
