// Thanh địa chỉ thông minh (logic thuần, không Electron): gõ chữ → địa chỉ hay tìm kiếm; xếp hạng gợi ý
// từ tab đang mở + dấu trang + lịch sử.
const ENGINES = {
  google: { name: 'Google', url: 'https://www.google.com/search?q=' },
  duckduckgo: { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=' },
  bing: { name: 'Bing', url: 'https://www.bing.com/search?q=' },
};
const DEFAULT_ENGINE = 'google';

function engineOf(id) { return ENGINES[id] ? id : DEFAULT_ENGINE; }

// Chữ gõ vào ô địa chỉ có phải địa chỉ không (có scheme, có dạng domain / localhost / IP, đường dẫn file)
function looksLikeUrl(input) {
  const s = String(input || '').trim();
  if (!s || /\s/.test(s)) return /^[a-z][a-z0-9+.-]*:\/\/\S+$/i.test(s) && !/\s/.test(s);
  if (/^[a-z][a-z0-9+.-]*:/i.test(s) && !/^[a-z0-9.-]+:\d+/i.test(s)) return true; // scheme: (wisp:, file:, mailto:…)
  if (s.startsWith('/') || s.startsWith('~/') || /^[a-z]:[\\/]/i.test(s)) return true;
  if (/^(localhost|\d{1,3}(\.\d{1,3}){3})(:\d+)?([/?#]|$)/i.test(s)) return true;
  return /^[^\s/?#]+\.[a-z]{2,}(:\d+)?([/?#]|$)/i.test(s);
}

function searchUrl(engineId, query) { return ENGINES[engineOf(engineId)].url + encodeURIComponent(String(query).trim()); }

const lower = (s) => String(s || '').toLowerCase();
function hostOf(url) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } }

// Điểm khớp của một mục với truy vấn (0 = không khớp)
function matchScore(q, url, title) {
  const host = hostOf(url);
  const t = lower(title);
  const u = lower(url).replace(/^https?:\/\/(www\.)?/, '');
  const words = q.split(/\s+/).filter(Boolean);
  if (!words.every(w => host.includes(w) || t.includes(w) || u.includes(w))) return 0;
  if (host.startsWith(q)) return 100;
  if (u.startsWith(q)) return 90;
  if (host.includes(q)) return 60;
  if (t.split(/\s+/).some(w => w.startsWith(q))) return 50;
  return 30;
}

// sources: { tabs: [{id,url,title}], bookmarks: [{url,title}], history: [{url,title,time}] }
function suggest(query, sources, now, limit = 6) {
  const q = lower(query).trim();
  if (!q) return [];
  const best = new Map(); // url → mục điểm cao nhất
  const put = (type, url, title, base, extra = {}) => {
    const m = matchScore(q, url, title);
    if (!m || !/^(https?|file):/i.test(url)) return;
    const score = m + base;
    const cur = best.get(url);
    if (!cur || score > cur.score) best.set(url, { type, url, title: title || url, score, ...extra });
  };
  for (const t of sources.tabs || []) put('tab', t.url, t.title, 25, { tabId: t.id });
  for (const b of sources.bookmarks || []) put('bookmark', b.url, b.title, 15);
  const visits = new Map();
  for (const h of sources.history || []) {
    const v = visits.get(h.url) || { n: 0, last: 0, title: '' };
    v.n++; v.last = Math.max(v.last, h.time); if (h.title) v.title = h.title;
    visits.set(h.url, v);
  }
  for (const [url, v] of visits) {
    const recent = now - v.last < 86400000 ? 8 : now - v.last < 7 * 86400000 ? 4 : 0;
    put('history', url, v.title, Math.min(v.n, 10) + recent);
  }
  return [...best.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}

module.exports = { ENGINES, DEFAULT_ENGINE, engineOf, looksLikeUrl, searchUrl, suggest };
