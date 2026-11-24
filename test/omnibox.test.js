const test = require('node:test');
const assert = require('node:assert');
const { looksLikeUrl, searchUrl, suggest, engineOf } = require('../omnibox');

test('looksLikeUrl: địa chỉ hay tìm kiếm', () => {
  for (const s of ['example.com', 'https://a.com/x', 'localhost:3000', '192.168.1.1:8080/a', 'wisp://history', 'a.vn/path?q=1', 'file:///x'])
    assert.ok(looksLikeUrl(s), s);
  for (const s of ['hello world', 'cách nấu phở', 'node', 'what is a.b c', '', 'foo bar.com'])
    assert.ok(!looksLikeUrl(s), s);
});

test('searchUrl mã hoá truy vấn, engine lạ về mặc định', () => {
  assert.strictEqual(searchUrl('google', 'a b&c'), 'https://www.google.com/search?q=a%20b%26c');
  assert.strictEqual(engineOf('x'), 'google');
  assert.ok(searchUrl('duckduckgo', 'x').startsWith('https://duckduckgo.com/'));
});

const now = Date.now();
const src = {
  tabs: [{ id: 1, url: 'https://github.com/a', title: 'Repo A' }],
  bookmarks: [{ url: 'https://news.ycombinator.com/', title: 'Hacker News' }],
  history: [
    { url: 'https://github.com/a', title: 'Repo A', time: now },
    { url: 'https://github.com/b', title: 'Repo B', time: now - 10 * 86400000 },
    { url: 'https://docs.github.com/', title: 'Docs', time: now - 10 * 86400000 },
    { url: 'https://example.com/', title: 'Example', time: now },
  ],
};

test('suggest: host bắt đầu bằng truy vấn lên trước, tab thắng trùng, không khớp thì bỏ', () => {
  const r = suggest('git', src, now);
  assert.strictEqual(r[0].url, 'https://github.com/a');
  assert.strictEqual(r[0].type, 'tab');
  assert.strictEqual(r[0].tabId, 1);
  assert.strictEqual(r.filter(x => x.url === 'https://github.com/a').length, 1);
  assert.ok(!r.some(x => x.url === 'https://example.com/'));
});
test('suggest: khớp tiêu đề, nhiều từ, rỗng, giới hạn', () => {
  assert.strictEqual(suggest('hacker', src, now)[0].type, 'bookmark');
  assert.strictEqual(suggest('hacker news', src, now)[0].url, 'https://news.ycombinator.com/');
  assert.deepStrictEqual(suggest('  ', src, now), []);
  assert.strictEqual(suggest('g', src, now, 2).length, 2);
});
