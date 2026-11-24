// Ảnh icon (nativeImage 16×16) của trang cho menu hệ thống (menu » của thanh dấu trang không vẽ HTML được).
// Nguồn: icon đã học (favicon-cache) hoặc /favicon.ico của trang; cache trong bộ nhớ theo host; lỗi / quá chậm → không có icon.
const { net, nativeImage } = require('electron');
const favicons = require('./favicon-cache');

const MAX_BYTES = 300 * 1024;
const TIMEOUT_MS = 2500;
const cache = new Map(); // host → nativeImage | null

function sourceOf(pageUrl) {
  const known = favicons.get(pageUrl);
  if (known) return known;
  try { return new URL(pageUrl).origin + '/favicon.ico'; } catch { return ''; }
}

async function fetchImage(src) {
  const res = await net.fetch(src, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.length || buf.length > MAX_BYTES) return null;
  const img = nativeImage.createFromBuffer(buf);
  return img.isEmpty() ? null : img.resize({ width: 16, height: 16 });
}

// → nativeImage hoặc null (không bao giờ ném lỗi)
async function iconFor(pageUrl) {
  const host = favicons.hostOf(pageUrl);
  if (!host) return null;
  if (cache.has(host)) return cache.get(host);
  let img = null;
  try { const src = sourceOf(pageUrl); img = src ? await fetchImage(src) : null; } catch { img = null; }
  cache.set(host, img);
  return img;
}

module.exports = { iconFor };
