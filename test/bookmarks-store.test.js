const test = require('node:test');
const assert = require('node:assert');
const s = require('../bookmarks-store');

test('thêm rồi bấm lại thì xoá bằng tombstone', () => {
  let l = s.toggle([], 'https://a.com/', 'A', 100, 0.5);
  assert.strictEqual(l.length, 1);
  assert.ok(s.has(l, 'https://a.com/'));
  l = s.toggle(l, 'https://a.com/', 'A', 200);
  assert.strictEqual(l.length, 1);          // vẫn giữ mục (tombstone) cho đồng bộ
  assert.strictEqual(l[0].deleted, 200);
  assert.strictEqual(l[0].updatedAt, 200);
  assert.ok(!s.has(l, 'https://a.com/'));
  l = s.toggle(l, 'https://a.com/', 'A', 300, 0.7); // thêm lại = mục mới
  assert.strictEqual(l.length, 2);
  assert.strictEqual(s.sorted(l).length, 1);
});

test('chỉ http(s) được đánh dấu', () => {
  assert.deepStrictEqual(s.toggle([], 'file:///a.html', 'x', 1), []);
  assert.deepStrictEqual(s.toggle([], 'wisp://history', 'x', 1), []);
  assert.strictEqual(s.isBookmarkable(undefined), false);
});

test('sorted: mới trước, bỏ mục đã xoá; remove theo id', () => {
  let l = s.toggle([], 'https://a.com', 'A', 100, 0.1);
  l = s.toggle(l, 'https://b.com', 'B', 200, 0.2);
  assert.deepStrictEqual(s.sorted(l).map(b => b.title), ['B', 'A']);
  l = s.remove(l, s.find(l, 'https://b.com').id, 300);
  assert.deepStrictEqual(s.sorted(l).map(b => b.title), ['A']);
  assert.strictEqual(s.remove(l, 'khong-co', 400).length, 2);
});

test('clean: bỏ mục hỏng, giữ tombstone', () => {
  const l = s.clean([null, { id: 1 }, { id: 'a', url: 'https://x', updatedAt: 5, deleted: 7 }, { id: 'b', url: 'https://y', updatedAt: 6, title: 3 }]);
  assert.strictEqual(l.length, 2);
  assert.strictEqual(l[0].deleted, 7);
  assert.strictEqual(l[1].title, '3');
  assert.deepStrictEqual(s.clean('hỏng'), []);
});

test('prune: quá giới hạn bỏ tombstone trước', () => {
  const l = [];
  for (let i = 0; i < s.MAX_ITEMS + 2; i++) l.push({ id: String(i), url: 'https://x/' + i, title: '', addedAt: i, updatedAt: i, ...(i < 2 ? { deleted: i } : {}) });
  const p = s.prune(l);
  assert.strictEqual(p.length, s.MAX_ITEMS);
  assert.ok(p.every(b => !b.deleted));
});
