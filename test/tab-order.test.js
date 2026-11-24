const test = require('node:test');
const assert = require('node:assert');
const { moveTab, setPinned } = require('../tab-order');

const mk = (...spec) => spec.map(s => ({ id: s.replace('*', ''), pinned: s.endsWith('*') }));

test('kéo tab thường trước tab thường khác / ra cuối', () => {
  assert.deepStrictEqual(moveTab(mk('a*', 'b', 'c', 'd'), 'd', 'b'), ['a', 'd', 'b', 'c']);
  assert.deepStrictEqual(moveTab(mk('a', 'b', 'c'), 'a', null), ['b', 'c', 'a']);
});
test('tab thường không chen vào nhóm ghim và ngược lại', () => {
  assert.deepStrictEqual(moveTab(mk('a*', 'b*', 'c', 'd'), 'd', 'a'), ['a', 'b', 'c', 'd']);
  assert.deepStrictEqual(moveTab(mk('a*', 'b*', 'c'), 'a', 'c'), ['b', 'a', 'c']);
});
test('ghim / bỏ ghim', () => {
  assert.deepStrictEqual(setPinned(mk('a*', 'b', 'c'), 'c', true), ['a', 'c', 'b']);
  assert.deepStrictEqual(setPinned(mk('a*', 'b*', 'c'), 'a', false), ['b', 'a', 'c']);
});
test('id lạ giữ nguyên thứ tự', () => {
  assert.deepStrictEqual(moveTab(mk('a', 'b'), 'zz', null), ['a', 'b']);
});
