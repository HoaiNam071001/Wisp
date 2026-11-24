const test = require('node:test');
const assert = require('assert');
const { fromChromeJson, fromHtml, mergeImported } = require('../chrome-bookmarks');

test('fromChromeJson: làm phẳng thư mục, thanh dấu trang trước, bỏ non-http', () => {
  const json = { roots: {
    other: { type: 'folder', children: [{ type: 'url', name: 'O', url: 'https://o.com/' }] },
    bookmark_bar: { type: 'folder', children: [
      { type: 'url', name: 'A', url: 'https://a.com/' },
      { type: 'folder', name: 'F', children: [{ type: 'url', name: 'B', url: 'http://b.com/' }, { type: 'url', name: 'JS', url: 'javascript:1' }] },
    ] },
  } };
  assert.deepStrictEqual(fromChromeJson(json).map(b => b.url), ['https://a.com/', 'http://b.com/', 'https://o.com/']);
  assert.deepStrictEqual(fromChromeJson(null), []);
});

test('fromHtml: đọc <A HREF>, giải mã ký tự', () => {
  const html = '<DL><DT><A HREF="https://x.com/?a=1&amp;b=2" ADD_DATE="1">X &amp; <b>Y</b></A><DT><A HREF="chrome://settings">S</A>';
  assert.deepStrictEqual(fromHtml(html), [{ url: 'https://x.com/?a=1&b=2', title: 'X & Y' }]);
});

test('mergeImported: bỏ trùng URL, giữ thứ tự nguồn khi sắp mới → cũ', () => {
  const have = [{ id: 'k', url: 'https://a.com/', title: 'A', addedAt: 1, updatedAt: 1 }];
  const r = mergeImported(have, [{ url: 'https://a.com/', title: 'A' }, { url: 'https://b.com/', title: 'B' }, { url: 'https://c.com/', title: 'C' }, { url: 'https://b.com/', title: 'B2' }], 1000);
  assert.strictEqual(r.added, 2);
  const byTime = r.list.slice().sort((x, y) => y.addedAt - x.addedAt).map(b => b.url);
  assert.deepStrictEqual(byTime.slice(0, 2), ['https://b.com/', 'https://c.com/']);
  assert.strictEqual(have.length, 1); // không sửa danh sách gốc
});

test('mergeImported: mục đã xoá (tombstone) thì nhập lại được', () => {
  const have = [{ id: 'k', url: 'https://a.com/', title: 'A', addedAt: 1, updatedAt: 2, deleted: 2 }];
  assert.strictEqual(mergeImported(have, [{ url: 'https://a.com/', title: 'A' }], 1000).added, 1);
});

test('mergeImported: order tăng dần theo thứ tự nguồn (thanh dấu trang giữ thứ tự Chrome)', () => {
  const { barSorted } = require('../bookmarks-store');
  const r = mergeImported([], [{ url: 'https://a.com/', title: 'A' }, { url: 'https://b.com/', title: 'B' }, { url: 'https://c.com/', title: 'C' }], 1000);
  assert.deepStrictEqual(barSorted(r.list).map(b => b.title), ['A', 'B', 'C']);
});
