const test = require('node:test');
const assert = require('assert');
test('missingScopes: thiếu quyền Drive thì báo', () => {
  const m = require('../google-pkce');
  assert.deepStrictEqual(m.missingScopes('openid https://www.googleapis.com/auth/userinfo.email'), ['https://www.googleapis.com/auth/drive.appdata']);
  assert.deepStrictEqual(m.missingScopes('openid email https://www.googleapis.com/auth/drive.appdata'), []);
});
