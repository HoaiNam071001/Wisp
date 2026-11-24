// Logic thuần cho đồng bộ cookie game (không require('electron'); Node 12 – engine Flash cũng dùng): lọc theo domain,
// gộp ba chiều, dựng tham số session.cookies.set. Cookie Google không bao giờ lên Drive.
const crypto = require('crypto');

const SESSION_DAYS = 30; // cookie phiên (không hạn) nạp sang máy khác được cho hạn này để sống qua lần tắt app
const BLOCKED = /(^|\.)(google|googleusercontent|googleapis|gstatic|youtube)\.[a-z.]+$/i;

const normDomain = (d) => String(d || '').trim().toLowerCase().replace(/^\.+/, '');

// Danh sách domain người dùng gõ → bỏ trống / trùng / domain Google; kèm lý do loại để UI báo
function normalizeDomains(list) {
  const out = [], rejected = [];
  for (const raw of Array.isArray(list) ? list : []) {
    const d = normDomain(raw);
    if (!d) continue;
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d) || BLOCKED.test(d)) { rejected.push(String(raw)); continue; }
    if (!out.includes(d)) out.push(d);
  }
  return { domains: out, rejected };
}

// cookie thuộc domain đã chọn: trùng domain gốc hoặc là subdomain của nó
const inDomains = (cookieDomain, domains) => {
  const h = normDomain(cookieDomain);
  return !BLOCKED.test(h) && domains.some((d) => h === d || h.endsWith('.' + d));
};

const keyOf = (c) => [normDomain(c.domain), c.path || '/', c.name].join('|');
const hashOf = (c) => crypto.createHash('sha1').update(String(c.value)).digest('hex');

// Cookie Electron → dạng gọn mang đi (giữ hostOnly để nạp lại đúng phạm vi)
function slim(c) {
  const o = { name: c.name, value: c.value, domain: c.domain, path: c.path || '/', hostOnly: !!c.hostOnly,
    secure: !!c.secure, httpOnly: !!c.httpOnly, sameSite: c.sameSite || 'unspecified' };
  if (c.expirationDate) o.expirationDate = c.expirationDate; // không có = cookie phiên
  return o;
}

function pick(cookies, domains) {
  return (cookies || []).filter((c) => c && c.name && inDomains(c.domain, domains)).map(slim);
}

// Tham số cho session.cookies.set; null nếu cookie hết hạn / hỏng
function toSetDetails(c, nowSec) {
  if (!c || !c.name || !c.domain) return null;
  const exp = c.expirationDate || nowSec + SESSION_DAYS * 86400;
  if (exp <= nowSec) return null;
  const host = normDomain(c.domain), p = c.path || '/';
  const d = { url: (c.secure ? 'https://' : 'http://') + host + p, name: c.name, value: c.value, path: p,
    secure: !!c.secure, httpOnly: !!c.httpOnly, sameSite: c.sameSite || 'unspecified', expirationDate: exp };
  if (!c.hostOnly) d.domain = '.' + host;
  return d;
}

// Gộp ba chiều theo từng cookie. base = { khoá: hash giá trị } ở lần đồng bộ trước:
//  - có ở cả hai, giá trị khác: máy này chưa đổi từ lần trước → lấy bên kia; đã đổi → giữ của máy này
//  - chỉ có bên kia: thêm, trừ khi máy này từng có rồi xoá (có trong base)
//  - chỉ có ở máy này: giữ. Cookie hết hạn bị bỏ. Xoá cookie không lan sang máy khác (không có mốc xoá).
// local = null (không đọc được, vd engine Flash chưa chạy): trả nguyên bên kia, không đụng base.
function mergeBucket(local, remote, base, nowSec) {
  if (!local) return { cookies: remote || [], base: base || {} };
  const L = new Map(local.map((c) => [keyOf(c), c])), R = new Map((remote || []).map((c) => [keyOf(c), c]));
  const out = [], nextBase = {};
  for (const k of new Set([...L.keys(), ...R.keys()])) {
    const l = L.get(k), r = R.get(k);
    let c;
    if (l && r) c = l.value === r.value ? l : (base && base[k] === hashOf(l) ? r : l);
    else if (l) c = l;
    else c = base && base[k] ? null : r;
    if (!c || (c.expirationDate && c.expirationDate <= nowSec)) continue;
    out.push(c);
    nextBase[k] = hashOf(c);
  }
  out.sort((a, b) => (keyOf(a) < keyOf(b) ? -1 : 1));
  return { cookies: out, base: nextBase };
}

// payload = { web: [...], flash: [...] | null }
function merge(local, remote, base, nowSec) {
  const b = base || {}, r = remote || {};
  const web = mergeBucket(local.web, r.web, b.web, nowSec), flash = mergeBucket(local.flash, r.flash, b.flash, nowSec);
  return { merged: { web: web.cookies, flash: flash.cookies }, base: { web: web.base, flash: flash.base } };
}

module.exports = { SESSION_DAYS, normalizeDomains, inDomains, keyOf, slim, pick, toSetDetails, mergeBucket, merge };
