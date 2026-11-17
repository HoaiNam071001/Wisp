const test = require('node:test');
const assert = require('node:assert');
const { chromeUserAgent } = require('../ua');

const RAW = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) wisp/3.0.0 Chrome/156.0.8078.100 Electron/45.3.3 Safari/537.36';

test('bỏ Electron / tên app, rút gọn số bản Chrome', () => {
  assert.strictEqual(chromeUserAgent(RAW),
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36');
});

test('UA sạch sẵn giữ nguyên', () => {
  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36';
  assert.strictEqual(chromeUserAgent(ua), ua);
});
