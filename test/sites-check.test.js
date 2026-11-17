const test = require('node:test');
const assert = require('node:assert');
const { checkSite } = require('../scripts/sites-check');

test('trang bình thường đạt', () => {
  assert.deepStrictEqual(checkSite({ expectUrl: 'github\\.com' }, { engine: 'web', url: 'https://github.com/', title: 'GitHub', text: 'Build software' }), []);
});

test('bắt chữ báo trình duyệt cũ / không an toàn', () => {
  assert.strictEqual(checkSite({}, { title: 'x', text: 'This browser or app may not be secure.' }).length, 1);
  assert.strictEqual(checkSite({}, { title: 'Trình duyệt này không được hỗ trợ', text: '' }).length, 1);
});

test('sai engine, sai địa chỉ, trang trống', () => {
  assert.strictEqual(checkSite({ expectEngine: 'flash' }, { engine: 'web', title: 't', text: '' }).length, 1);
  assert.strictEqual(checkSite({ expectUrl: 'a\\.com' }, { url: 'https://b.com', title: 't' }).length, 1);
  assert.strictEqual(checkSite({}, { engine: 'web', url: 'about:blank', title: '', text: '' }).length, 1);
});
