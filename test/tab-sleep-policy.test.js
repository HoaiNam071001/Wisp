const test = require('node:test');
const assert = require('node:assert');
const { pickSleepers, sleepMinutes, sleepableUrl } = require('../tab-sleep-policy');

const base = { url: 'https://a.com/', lastActive: 0, active: false, audible: false, loading: false, sleeping: false };
const now = 31 * 60000;

test('tab nền quá hạn thì ngủ', () => {
  assert.deepStrictEqual(pickSleepers([{ id: 1, ...base }], now, {}), [1]);
});
test('không ngủ: đang xem, có tiếng, đang tải, Flash, trang nội bộ, chưa đủ hạn', () => {
  const bad = [
    { id: 1, active: true }, { id: 2, audible: true }, { id: 3, loading: true }, { id: 4, wantsFlash: true },
    { id: 5, url: 'wisp://history' }, { id: 6, lastActive: now - 1000 }, { id: 7, sleeping: true }, { id: 8, devtools: true },
  ].map(o => ({ ...base, ...o }));
  assert.deepStrictEqual(pickSleepers(bad, now, {}), []);
});
test('tắt bằng config và chỉnh số phút', () => {
  assert.deepStrictEqual(pickSleepers([{ id: 1, ...base }], now, { sleepTabs: false }), []);
  assert.deepStrictEqual(pickSleepers([{ id: 1, ...base }], now, { sleepMinutes: 60 }), []);
  assert.strictEqual(sleepMinutes({ sleepMinutes: 'x' }), 30);
  assert.strictEqual(sleepableUrl('file:///a'), false);
});

test('trang "Tab bị dừng"', () => {
  const c = require('../tab-crashed');
  const u = c.crashedPageUrl('https://a.com/?x=<b>', 'oom');
  assert.ok(c.isCrashedPage(u));
  assert.ok(!decodeURIComponent(u).includes('<b>'));
  assert.ok(c.isCrash('oom') && !c.isCrash('clean-exit') && !c.isCrash('killed'));
  assert.ok(!c.isCrashedPage('https://a.com'));
});
