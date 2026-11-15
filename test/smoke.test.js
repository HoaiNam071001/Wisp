// Giữ cho `npm test` chạy được khi chưa có module logic thuần nào; xoá khi có test thật.
const test = require('node:test');
const assert = require('node:assert');
const pkg = require('../package.json');

test('package.json có version semver', () => {
  assert.match(pkg.version, /^\d+\.\d+\.\d+$/);
});
