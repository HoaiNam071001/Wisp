const test = require('node:test');
const assert = require('node:assert');
const { EngineClient } = require('../flash-engine/client');

// Engine giả: báo ready, trả lời open / quit, lệnh "frameRect" thì không trả lời, "boom" thì lỗi
const FAKE = `
const rl = require('readline').createInterface({ input: process.stdin });
const out = (o) => process.stdout.write(JSON.stringify(o) + '\\n');
out({ event: 'ready', data: {} });
rl.on('line', (l) => { const m = JSON.parse(l);
  if (m.cmd === 'open') { out({ event: 'url', data: { url: m.url } }); out({ id: m.id, ok: true, result: {} }); }
  else if (m.cmd === 'close') out({ id: m.id, ok: false, error: { code: 'no_tab', detail: 'x' } });
  else if (m.cmd === 'quit') { out({ id: m.id, ok: true, result: {} }); process.exit(0); }
});`;
const mk = () => new EngineClient({ command: process.execPath, args: ['-e', FAKE] });

test('start / request / sự kiện / stop', async () => {
  const c = mk();
  await c.start();
  const urls = [];
  c.on('url', (d) => urls.push(d.url));
  assert.deepStrictEqual(await c.request('open', { url: 'https://a.vn/' }), {});
  assert.deepStrictEqual(urls, ['https://a.vn/']);
  await assert.rejects(c.request('close'), (e) => e.code === 'no_tab');
  await c.stop();
  assert.strictEqual(c.running, false);
});

test('engine chết giữa chừng: lệnh đang chờ bị từ chối, request sau báo engine_exit', async () => {
  const c = mk();
  await c.start();
  const exited = new Promise((r) => c.once('exit', r));
  const p = c.request('hang'); // engine giả không trả lời lệnh này
  await c.child.kill();
  await assert.rejects(p, (e) => e.code === 'engine_exit');
  await exited;
  await assert.rejects(c.request('open', { url: 'https://a.vn/' }), (e) => e.code === 'engine_exit');
});

test('lệnh khởi chạy sai: start bị từ chối', async () => {
  const c = new EngineClient({ command: '/không/có/file' });
  await assert.rejects(c.start());
});
