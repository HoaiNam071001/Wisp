// Chạy bộ trang thử (test/sites.json) trên Wisp đang chạy (npm run dev): mở từng trang, chờ tải, đọc tiêu đề / chữ,
// chụp ảnh vào thư mục ra, báo trang nào lỗi hoặc báo "trình duyệt không hợp". Chạy trước mỗi bản phát hành.
//   node scripts/sites-try.js [thư-mục-ảnh=.dev-data/sites-shots] [tên-lọc]   WISP_USER_DATA=… đổi thư mục dữ liệu
// Cần mạng. Không tự đăng nhập; trang CAPTCHA / chờ Cloudflare chỉ kiểm tra có tải được, mắt người xem ảnh.
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const { checkSite } = require('./sites-check');

const dataDir = process.env.WISP_USER_DATA || path.join(__dirname, '..', '.dev-data');
const outDir = process.argv[2] || path.join(dataDir, 'sites-shots');
const filter = (process.argv[3] || '').toLowerCase();
const sites = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'test', 'sites.json'), 'utf8'))
  .filter(s => !filter || s.name.toLowerCase().includes(filter));
const info = JSON.parse(fs.readFileSync(path.join(dataDir, 'ghosthand.json'), 'utf8'));

const ws = new WebSocket(`ws://127.0.0.1:${info.port}`, { headers: { Authorization: 'Bearer ' + info.token } });
let seq = 0;
const waiting = new Map();
ws.on('message', raw => {
  const msg = JSON.parse(raw);
  const p = waiting.get(msg.id);
  if (!p) return;
  waiting.delete(msg.id);
  if (msg.ok) p.resolve(msg.result); else p.reject(new Error(`${msg.error.code}: ${msg.error.detail}`));
});
function call(cmd, args) {
  return new Promise((resolve, reject) => { const id = ++seq; waiting.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, cmd, args })); });
}

async function trySite(site) {
  const { tab } = await call('open', { url: site.url, newTab: true });
  try {
    // trang Flash: tab hiện trang chờ (flash-launcher) → không có DOM game để đọc; chỉ cần tab báo engine flash
    await call('waitLoad', { tab, until: 'load', timeoutMs: 25000 }).catch(() => {});
    const row = (await call('tabs')).find(t => t.id === tab) || {};
    let page = { url: row.url, title: row.title, text: '' };
    if (row.engine !== 'flash') page = await call('pageText', { tab, maxChars: 4000 }).catch(() => page);
    const shot = await call('screenshot', { tab }).catch(() => null);
    if (shot) fs.writeFileSync(path.join(outDir, site.name.replace(/[^\w.-]+/g, '_') + '.png'), Buffer.from(shot.png, 'base64'));
    return checkSite(site, { engine: row.engine, url: page.url || row.url, title: page.title || row.title, text: page.text });
  } finally { await call('close', { tab }).catch(() => {}); }
}

ws.on('open', async () => {
  fs.mkdirSync(outDir, { recursive: true });
  let fails = 0;
  for (const site of sites) {
    try {
      const errs = await trySite(site);
      console.log(`${errs.length ? 'LỖI' : 'ok  '} ${site.name}${errs.length ? ' – ' + errs.join('; ') : ''}`);
      if (errs.length) fails++;
    } catch (e) { fails++; console.log(`LỖI ${site.name} – ${e.message}`); }
  }
  console.log(`${sites.length - fails}/${sites.length} trang ok · ảnh: ${outDir}`);
  ws.close();
  process.exit(fails ? 1 : 0);
});
ws.on('error', e => { console.error('Không nối được cổng: ' + e.message); process.exit(1); });
