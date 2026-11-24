// Nhớ icon trang theo host (userData/favicons.json) để thanh dấu trang hiện icon thật như Chrome.
// Học khi người dùng mở trang (tabs.events 'favicon'); chỉ lưu cục bộ, không đồng bộ Drive. Giới hạn số host.
const { app } = require('electron');
const path = require('path');
const fs = require('fs');

const MAX_HOSTS = 3000;
let map = null;
let timer = null;

const file = () => path.join(app.getPath('userData'), 'favicons.json');
function hostOf(url) { try { const u = new URL(url); return /^https?:$/.test(u.protocol) ? u.host : ''; } catch { return ''; } }
function load() {
  if (map) return map;
  try { map = JSON.parse(fs.readFileSync(file(), 'utf8')); } catch { map = {}; }
  if (!map || typeof map !== 'object' || Array.isArray(map)) map = {};
  return map;
}
function save() {
  timer = null;
  try { fs.writeFileSync(file(), JSON.stringify(map)); } catch (e) { console.error('Không lưu được favicons:', e); }
}

// → true nếu giá trị đổi
function set(pageUrl, icon) {
  const h = hostOf(pageUrl);
  if (!h || !/^https?:\/\//i.test(String(icon || '')) || String(icon).length > 600) return false;
  const m = load();
  if (m[h] === icon) return false;
  m[h] = icon;
  const keys = Object.keys(m);
  if (keys.length > MAX_HOSTS) for (const k of keys.slice(0, keys.length - MAX_HOSTS)) delete m[k]; // khoá cũ nhất (thứ tự chèn) đi trước
  if (!timer) timer = setTimeout(save, 2000);
  return true;
}
function get(pageUrl) { const h = hostOf(pageUrl); return h ? load()[h] || '' : ''; }
function flush() { if (timer) { clearTimeout(timer); save(); } }

module.exports = { set, get, flush, hostOf };
