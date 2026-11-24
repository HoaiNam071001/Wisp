// Chặn quảng cáo / theo dõi bên thứ ba (logic thuần, không Electron). Danh sách ngắn, chỉ tên miền quảng cáo / đo lường
// quen thuộc (không chặn tên miền cũng phục vụ nội dung thật như cdn, fonts, tag manager) để ít làm vỡ trang.
const TRACKERS = [
  'doubleclick.net', 'googlesyndication.com', 'googleadservices.com', 'google-analytics.com', 'adservice.google.com',
  'adnxs.com', 'criteo.com', 'criteo.net', 'taboola.com', 'outbrain.com', 'scorecardresearch.com', 'quantserve.com',
  'hotjar.com', 'amazon-adsystem.com', 'pubmatic.com', 'rubiconproject.com', 'openx.net', 'adsrvr.org', 'moatads.com',
  '2mdn.net', 'advertising.com', 'zedo.com', 'casalemedia.com', 'adform.net', 'smartadserver.com', 'bidswitch.net',
  'sharethrough.com', 'teads.tv', 'yieldmo.com', 'mathtag.com', 'bluekai.com', 'demdex.net', 'krxd.net', 'adroll.com',
  'popads.net', 'propellerads.com', 'adcolony.com', 'applovin.com', 'serving-sys.com', 'contextweb.com',
];
const SET = new Set(TRACKERS);

const TWO_LEVEL = new Set(['co.uk', 'com.au', 'com.vn', 'co.jp', 'com.br', 'co.in', 'com.cn', 'co.kr', 'net.vn', 'org.vn', 'edu.vn', 'gov.vn']);

// Tên miền gốc ("a.b.example.co.uk" → "example.co.uk") – đủ để phân biệt bên thứ nhất / thứ ba
function siteOf(host) {
  const p = String(host || '').toLowerCase().split('.');
  if (p.length <= 2 || /^\d+(\.\d+){3}$/.test(host)) return p.join('.');
  return p.slice(-(TWO_LEVEL.has(p.slice(-2).join('.')) ? 3 : 2)).join('.');
}
function hostOf(url) { try { return new URL(url).hostname; } catch { return ''; } }

function isTrackerHost(host) {
  const p = String(host || '').toLowerCase().split('.');
  for (let i = 0; i < p.length - 1; i++) if (SET.has(p.slice(i).join('.'))) return true;
  return false;
}

// d: { url, pageUrl, resourceType }; cfg: { adblock?: false = tắt hẳn, adblockOff?: [host trang tắt riêng] }
function shouldBlock(d, cfg) {
  if (cfg && cfg.adblock === false) return false;
  if (d.resourceType === 'mainFrame' || !/^https?:/i.test(d.url || '')) return false;
  const host = hostOf(d.url), page = hostOf(d.pageUrl);
  if (!host || !page || siteOf(host) === siteOf(page)) return false; // chỉ chặn bên thứ ba
  if (((cfg && cfg.adblockOff) || []).includes(page)) return false;
  return isTrackerHost(host);
}

// Bật / tắt chặn cho riêng một trang → danh sách adblockOff mới
function toggleSite(off, host) {
  const list = (off || []).filter(h => h !== host);
  return list.length === (off || []).length ? [...list, host] : list;
}

module.exports = { shouldBlock, isTrackerHost, siteOf, toggleSite, TRACKERS };
