const test = require('node:test');
const assert = require('node:assert');
const { classify, errorPageUrl, parseAction } = require('../error-page');
const { isCrashedPage } = require('../tab-crashed');

test('classify mã lỗi', () => {
  assert.strictEqual(classify(-3), null);
  assert.strictEqual(classify(-202).kind, 'cert');
  assert.strictEqual(classify(-105).kind, 'dns');
  assert.strictEqual(classify(-999).kind, 'other');
});
test('trang lỗi: nhận ra là trang nội bộ, chứng chỉ có nút Vẫn tiếp tục, không chèn HTML', () => {
  const u = errorPageUrl('https://a.com/<x>', -202, 'ERR_CERT_AUTHORITY_INVALID');
  assert.ok(isCrashedPage(u));
  const html = decodeURIComponent(u);
  assert.ok(html.includes('wisp-error:proceed'));
  assert.ok(!html.includes('<x>'));
  assert.ok(!decodeURIComponent(errorPageUrl('https://a.com', -105, '')).includes('proceed'));
  assert.strictEqual(errorPageUrl('https://a.com', -3, ''), null);
});
test('parseAction', () => {
  assert.deepStrictEqual(parseAction('wisp-error:proceed?url=https%3A%2F%2Fa.com%2F'), { action: 'proceed', url: 'https://a.com/' });
  assert.strictEqual(parseAction('wisp-error:proceed?url=file%3A%2F%2F%2Fx'), null);
  assert.strictEqual(parseAction('https://a.com'), null);
});
