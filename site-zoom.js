// Nhớ mức zoom theo domain (logic thuần): config.siteZoom = { "host": mức }, mức 0 = 100% thì bỏ khỏi danh sách.
const MIN_LEVEL = -3, MAX_LEVEL = 5;

function hostOf(url) {
  try { const u = new URL(url); return /^https?:$/.test(u.protocol) ? u.hostname.toLowerCase() : ''; } catch { return ''; }
}

function levelFor(map, url) {
  const host = hostOf(url);
  const v = host && map && typeof map === 'object' ? Number(map[host]) : 0;
  return Number.isFinite(v) ? Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, v)) : 0;
}

// → map mới (không sửa map cũ); url không phải http(s) thì giữ nguyên
function remember(map, url, level) {
  const host = hostOf(url);
  const next = { ...(map && typeof map === 'object' ? map : {}) };
  if (!host) return next;
  const v = Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, Number(level) || 0));
  if (Math.abs(v) < 0.01) delete next[host]; else next[host] = v;
  return next;
}

module.exports = { hostOf, levelFor, remember };
