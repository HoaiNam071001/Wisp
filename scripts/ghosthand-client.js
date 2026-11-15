// Thử cổng Ghosthand như Ghosthand sẽ dùng (docs/plan/01 – "Xong khi"): nối cổng, mở trang tìm kiếm, gõ ô tìm kiếm,
// Enter, đọc tiêu đề kết quả; lặp N lần. Cần Wisp đang chạy (npm run dev).
//   node scripts/ghosthand-client.js [số lần=20] [google|wiki] [từ khoá]   WISP_USER_DATA=… đổi thư mục dữ liệu (mặc định .dev-data)
// google: Chromium 87 (Electron 11) bị Google đưa trang cũ + CAPTCHA khi tìm liên tục → chạy đủ 20 lần sau bước 04.
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const dataDir = process.env.WISP_USER_DATA || path.join(__dirname, '..', '.dev-data');
const runs = Number(process.argv[2]) || 20;
const site = process.argv[3] || 'google';
const query = process.argv[4] || 'electron browser';
const info = JSON.parse(fs.readFileSync(path.join(dataDir, 'ghosthand.json'), 'utf8'));

const ws = new WebSocket(`ws://127.0.0.1:${info.port}`, { headers: { Authorization: 'Bearer ' + info.token } });
let seq = 0;
const waiting = new Map();
ws.on('message', raw => {
  const msg = JSON.parse(raw);
  const p = waiting.get(msg.id);
  if (!p) return;
  waiting.delete(msg.id);
  if (msg.ok) p.resolve(msg.result);
  else p.reject(Object.assign(new Error(`${msg.error.code}: ${msg.error.detail}`), { code: msg.error.code }));
});
function call(cmd, args) {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    waiting.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, cmd, args }));
  });
}

const SITES = {
  google: { url: 'https://www.google.com/', box: ['css=textarea[name=q]', 'css=input[name=q]', 'role=combobox'], result: ['css=#search a h3'] },
  wiki: { url: 'https://vi.wikipedia.org/', box: ['css=input[name=search]'], result: ['css=.mw-search-result-heading a', 'css=#firstHeading'] },
};
if (!SITES[site]) { console.error('trang thử: ' + Object.keys(SITES).join(' | ')); process.exit(2); }
const { url: SITE_URL, box: SEARCH_BOX, result: RESULT } = SITES[site];

async function once(tab, i) {
  const t0 = Date.now();
  await call('navigate', { tab, url: SITE_URL });
  await call('waitLoad', { tab, until: 'idle', timeoutMs: 20000 });
  await call('waitFor', { tab, selectors: SEARCH_BOX, timeoutMs: 10000 });
  await call('type', { tab, selectors: SEARCH_BOX, text: `${query} ${i}`, clear: true, enter: true });
  await call('waitFor', { tab, selectors: RESULT, timeoutMs: 20000 });
  const r = await call('find', { tab, selectors: RESULT, all: true });
  const titles = r.found.map(f => f.text).filter(Boolean);
  if (!titles.length) throw new Error('không đọc được tiêu đề kết quả');
  return { ms: Date.now() - t0, titles, selector: r.found[0].selector };
}

ws.on('open', async () => {
  let fails = 0;
  try {
    const tabsBefore = await call('tabs');
    console.log(`Nối được Wisp ${info.version} (api ${info.api}), ${tabsBefore.length} tab`);
    const { tab } = await call('open', { url: SITE_URL, newTab: true });
    for (let i = 1; i <= runs; i++) {
      try {
        const r = await once(tab, i);
        console.log(`#${i} ok ${r.ms}ms – ${r.titles.length} kết quả, đầu: “${r.titles[0]}” (${r.selector})`);
      } catch (e) {
        fails++;
        console.log(`#${i} LỖI ${e.message}`);
      }
    }
    await call('close', { tab });
  } catch (e) {
    fails++;
    console.log('LỖI ' + e.message);
  }
  console.log(`${runs - fails}/${runs} lần ok`);
  ws.close();
  process.exit(fails ? 1 : 0);
});
ws.on('error', e => { console.error('Không nối được cổng: ' + e.message); process.exit(1); });
