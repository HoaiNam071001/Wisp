// OAuth PKCE cho app desktop – phần thuần (Node 12): verifier / challenge, URL xin quyền, đọc lời gọi lại loopback.
const crypto = require('crypto');

const SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/drive.appdata']; // chỉ thư mục dữ liệu riêng của app
const b64url = (b) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function newPkce() {
  const verifier = b64url(crypto.randomBytes(32));
  return { verifier, challenge: b64url(crypto.createHash('sha256').update(verifier).digest()), state: b64url(crypto.randomBytes(16)) };
}

function authUrl({ clientId, redirectUri, challenge, state }) {
  const q = new URLSearchParams({
    client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: SCOPES.join(' '),
    code_challenge: challenge, code_challenge_method: 'S256', state, access_type: 'offline', prompt: 'consent',
  });
  return 'https://accounts.google.com/o/oauth2/v2/auth?' + q;
}

// reqUrl: đường dẫn + query của request loopback → { code } | { error } | null (không phải lời gọi lại, vd /favicon.ico)
function parseCallback(reqUrl, state) {
  const u = new URL(reqUrl, 'http://127.0.0.1');
  if (u.pathname !== '/') return null;
  if (u.searchParams.get('state') !== state) return { error: 'Phiên đăng nhập không khớp, thử lại' };
  const err = u.searchParams.get('error');
  if (err) return { error: err === 'access_denied' ? 'Bạn đã từ chối quyền đăng nhập' : 'Google báo lỗi: ' + err };
  const code = u.searchParams.get('code');
  return code ? { code } : { error: 'Không nhận được mã đăng nhập' };
}

// id_token chỉ để đọc email / tên hiển thị (nhận trực tiếp từ Google qua TLS, không dùng để xác thực với bên khác)
function readIdToken(idToken) {
  try {
    const p = JSON.parse(Buffer.from(String(idToken).split('.')[1], 'base64').toString('utf8'));
    return { email: p.email || '', name: p.name || '', picture: p.picture || '' };
  } catch { return { email: '', name: '', picture: '' }; }
}

// Google cho người dùng bỏ tích từng quyền ở màn hình đồng ý → token có thể thiếu quyền Drive
function missingScopes(granted) {
  const have = String(granted || '').split(/\s+/);
  return SCOPES.filter(s => s !== 'openid' && s !== 'email' && !have.includes(s));
}

module.exports = { missingScopes, SCOPES, newPkce, authUrl, parseCallback, readIdToken };
