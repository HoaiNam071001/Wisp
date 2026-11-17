const test = require('node:test');
const assert = require('node:assert');
const { popupFor } = require('../popup-policy');

test('popup đăng nhập có kích thước → cửa sổ thật', () => {
  const r = popupFor({ url: 'https://accounts.google.com/o/oauth2/auth', disposition: 'new-window', features: 'width=500,height=600,left=100' });
  assert.deepStrictEqual(r, { popup: true, width: 500, height: 600 });
});

test('link thường / target=_blank → tab', () => {
  assert.strictEqual(popupFor({ url: 'https://a.com', disposition: 'foreground-tab', features: '' }).popup, false);
  assert.strictEqual(popupFor({ url: 'https://a.com', disposition: 'new-window', features: '' }).popup, false);
});

test('chặn scheme lạ, kẹp cỡ cửa sổ', () => {
  assert.strictEqual(popupFor({ url: 'file:///etc/passwd', disposition: 'new-window', features: 'width=300' }).popup, false);
  assert.strictEqual(popupFor({ url: 'https://a.com', disposition: 'new-window', features: 'width=99999,height=1' }).width, 1600);
});
