// Cấu hình Flash theo trang – logic thuần (không require electron).
// flashSites: [{domain, engine: 'flash'}]; trang không có trong danh sách = engine web.
const { baseDomain } = require('./allowlist');

const ENGINES = ['flash']; // khoá engine giữ lại để đọc được config cũ (mục 'ruffle' cũ → 'flash')

function cleanEntry(e) {
  const domain = baseDomain(e && e.domain);
  if (!domain) return null;
  return { domain, engine: 'flash' };
}

// Danh sách hợp lệ, không trùng domain (mục sau đè mục trước); config hỏng → []
function normalize(list) {
  const byDomain = new Map();
  for (const e of Array.isArray(list) ? list : []) {
    const c = cleanEntry(e);
    if (c) byDomain.set(c.domain, c);
  }
  return [...byDomain.values()];
}

// Config 2.x (allowDomains) → flashSites. Không xoá khoá cũ: bản 2.x quay lại vẫn chạy.
function migrate(cfg, defaultDomains) {
  cfg = cfg || {};
  if (Array.isArray(cfg.flashSites)) return normalize(cfg.flashSites);
  const domains = [...(defaultDomains || []), ...(Array.isArray(cfg.allowDomains) ? cfg.allowDomains : [])];
  return normalize(domains.map((domain) => ({ domain, engine: 'flash' })));
}

// Mục khớp host: domain gốc hoặc subdomain của nó
function siteFor(sites, host) {
  host = String(host || '').toLowerCase();
  if (!host) return null;
  return sites.find((s) => host === s.domain || host.endsWith('.' + s.domain)) || null;
}

// Engine mở trang: 'web' | 'flash'
function engineFor(sites, host) {
  return siteFor(sites, host) ? 'flash' : 'web';
}

// engine: 'flash' | 'off' (tắt = xoá khỏi danh sách)
function setSite(sites, host, engine) {
  const domain = baseDomain(host);
  const rest = sites.filter((s) => s.domain !== domain);
  if (!domain || !ENGINES.includes(engine)) return rest;
  return [...rest, { domain, engine }];
}

// Domain đưa vào mms.cfg
function allowDomainsOf(sites) { return sites.map((s) => s.domain); }

module.exports = { normalize, migrate, siteFor, engineFor, setSite, allowDomainsOf };
