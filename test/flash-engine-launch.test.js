const test = require('node:test');
const assert = require('node:assert');
const { launchFor } = require('../flash-engine/launch');

test('launchFor: có / không có plugin', () => {
  const a = launchFor({ electronPath: '/e', userData: '/u', pluginPath: '/p', pluginVersion: '32.0.0.465' });
  assert.strictEqual(a.command, '/e');
  assert.ok(a.args[0].endsWith('main.js'));
  assert.deepStrictEqual(a.env, { WISP_USER_DATA: '/u', WISP_FLASH_PLUGIN: '/p', WISP_FLASH_VERSION: '32.0.0.465' });
  assert.deepStrictEqual(launchFor({ electronPath: '/e', userData: '/u' }).env, { WISP_USER_DATA: '/u' });
});
