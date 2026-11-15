const test = require('node:test');
const assert = require('node:assert');
const { baseDomain, mergeDomains, mmsCfgContent } = require('../flash/allowlist');

test('baseDomain: lấy domain gốc, giữ TLD hai phần', () => {
  assert.strictEqual(baseDomain('static.game.cmn.vn'), 'cmn.vn');
  assert.strictEqual(baseDomain('a.b.example.com.vn'), 'example.com.vn');
  assert.strictEqual(baseDomain('CF4VN.bar'), 'cf4vn.bar');
  assert.strictEqual(baseDomain('10.0.0.5'), '10.0.0.5');
  assert.strictEqual(baseDomain(''), '');
});

test('mergeDomains: gồm mặc định, bỏ trùng, bỏ qua giá trị hỏng', () => {
  assert.deepStrictEqual(mergeDomains(['cmn.vn'], ['a.vn', 'cmn.vn']), ['cmn.vn', 'a.vn']);
  assert.deepStrictEqual(mergeDomains(['cmn.vn'], 'hỏng'), ['cmn.vn']);
  assert.deepStrictEqual(mergeDomains(['cmn.vn'], undefined), ['cmn.vn']);
});

test('mmsCfgContent: allowlist chỉ SWF gốc, mỗi domain hai mẫu, log khi debug', () => {
  const c = mmsCfgContent(['cmn.vn'], false);
  assert.ok(c.includes('EnableAllowList=1\n'));
  assert.ok(c.includes('AllowListRootMovieOnly=1\n'));
  assert.ok(c.includes('AllowListUrlPattern=*://cmn.vn/\nAllowListUrlPattern=*://*.cmn.vn/\n'));
  assert.ok(c.endsWith('AllowListUrlPattern=file:*\n'));
  assert.ok(!c.includes('TraceOutputEcho'));
  assert.ok(mmsCfgContent([], true).endsWith('AllowListPreview=1\nTraceOutputEcho=1\n'));
});
