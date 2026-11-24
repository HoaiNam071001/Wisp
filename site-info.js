// Thông tin trang (popover khi bấm khoá trên ô địa chỉ) – logic thuần, không require electron.
const { ASK, originHost } = require('./permission-policy');

// → { kind: 'https'|'http'|'file'|'internal'|'other', host, openable }  openable = có popover (chỉ http / https)
function describe(url) {
  const u = String(url || '');
  if (/^https:/i.test(u)) return { kind: 'https', host: originHost(u), openable: true };
  if (/^http:/i.test(u)) return { kind: 'http', host: originHost(u), openable: true };
  if (/^file:/i.test(u)) return { kind: 'file', host: '', openable: false };
  if (/^wisp:/i.test(u)) return { kind: 'internal', host: '', openable: false };
  return { kind: 'other', host: '', openable: false };
}

// Quyền đã nhớ cho host → [{ key, label, state: 'allow' | 'deny' }] (theo thứ tự ASK)
function listPermissions(saved, host) {
  const mine = (saved && saved[host]) || {};
  return Object.keys(ASK).filter(k => typeof mine[k] === 'boolean').map(k => ({ key: k, label: ASK[k], state: mine[k] ? 'allow' : 'deny' }));
}

// state: 'allow' | 'deny' | 'ask' ('ask' = quên lựa chọn, lần sau hỏi lại) → bản saved mới; khoá lạ bị bỏ qua
function setPermission(saved, host, key, state) {
  if (!host || !ASK[key] || !['allow', 'deny', 'ask'].includes(state)) return saved || {};
  const out = Object.assign({}, saved);
  const mine = Object.assign({}, out[host]);
  if (state === 'ask') delete mine[key]; else mine[key] = state === 'allow';
  if (Object.keys(mine).length) out[host] = mine; else delete out[host];
  return out;
}

function resetPermissions(saved, host) {
  const out = Object.assign({}, saved);
  delete out[host];
  return out;
}

// Domain cookie khớp host trang: chính nó và domain cha (".example.com" cho "www.example.com")
function cookieMatchesHost(cookieDomain, host) {
  const d = String(cookieDomain || '').replace(/^\./, '').toLowerCase(), h = String(host || '').toLowerCase();
  return !!d && !!h && (h === d || h.endsWith('.' + d));
}

module.exports = { describe, listPermissions, setPermission, resetPermissions, cookieMatchesHost };
