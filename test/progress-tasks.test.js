const test = require('node:test');
const assert = require('node:assert');

function fresh() { delete require.cache[require.resolve('../progress-tasks')]; return require('../progress-tasks'); }

test('summary: không có việc → null; có việc → nhãn + tỉ lệ', () => {
  const t = fresh();
  assert.strictEqual(t.summary(), null);
  t.set('a', 'Đang tải', 0.5);
  assert.deepStrictEqual(t.summary(), { count: 1, label: 'Đang tải', fraction: 0.5 });
  t.finish('a');
  assert.strictEqual(t.summary(), null);
});

test('fraction: kẹp 0..1, không phải số → null (vòng quay)', () => {
  const t = fresh();
  t.set('a', 'x', 3); assert.strictEqual(t.summary().fraction, 1);
  t.set('a', 'x', -1); assert.strictEqual(t.summary().fraction, 0);
  t.set('a', 'x', undefined); assert.strictEqual(t.summary().fraction, null);
});

test('nhiều việc: hiện việc vừa cập nhật, count đúng', () => {
  const t = fresh();
  t.set('a', 'Wisp', 0.1);
  t.set('b', 'Flash', 0.2);
  assert.deepStrictEqual(t.summary(), { count: 2, label: 'Flash', fraction: 0.2 });
  t.set('a', 'Wisp', 0.5);
  assert.strictEqual(t.summary().label, 'Wisp');
  t.finish('a');
  assert.deepStrictEqual(t.summary(), { count: 1, label: 'Flash', fraction: 0.2 });
});

test('events: bỏ qua cập nhật <1% cùng nhãn, finish việc không có không phát', () => {
  const t = fresh();
  let n = 0;
  t.events.on('changed', () => n++);
  t.set('a', 'x', 0.10); t.set('a', 'x', 0.105); assert.strictEqual(n, 1);
  t.set('a', 'x', 0.2); assert.strictEqual(n, 2);
  t.finish('zzz'); assert.strictEqual(n, 2);
  t.finish('a'); assert.strictEqual(n, 3);
});
