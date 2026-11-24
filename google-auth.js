// Đăng nhập Google: trình duyệt hệ thống + loopback 127.0.0.1 (OAuth PKCE), token refresh lưu bằng token-store.
// Dùng `https` (Node 12 không có fetch). Client ID không bí mật; client secret loại Desktop đọc từ google-oauth.local.json (gitignore) hoặc env.
const { shell, app } = require('electron');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const { missingScopes, newPkce, authUrl, parseCallback, readIdToken } = require('./google-pkce');
const store = require('./token-store');

const CLIENT_ID = '413793643993-qa50gkndk565ok0v7ko9s0lei0guulf9.apps.googleusercontent.com';
const LOGIN_TIMEOUT_MS = 3 * 60 * 1000;
const events = new EventEmitter(); // 'changed' (đăng nhập / đăng xuất)
let access = null; // { token, exp }
let pending = null; // phiên đăng nhập đang chờ: { server, cancel }

function clientSecret() {
  if (process.env.WISP_GOOGLE_SECRET) return process.env.WISP_GOOGLE_SECRET;
  try { return JSON.parse(fs.readFileSync(path.join(app.getAppPath(), 'google-oauth.local.json'), 'utf8')).clientSecret || ''; } catch { return ''; }
}

function postForm(body) {
  const data = new URLSearchParams(body).toString();
  return new Promise((resolve, reject) => {
    const req = https.request('https://oauth2.googleapis.com/token', {
      method: 'POST', timeout: 20000,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(data) },
    }, (res) => {
      let s = '';
      res.on('data', (d) => { s += d; });
      res.on('end', () => {
        let j = {}; try { j = JSON.parse(s); } catch {}
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(j);
        else reject(Object.assign(new Error(j.error_description || j.error || 'Google trả lỗi ' + res.statusCode), { code: j.error || 'http_' + res.statusCode }));
      });
    });
    req.on('timeout', () => req.destroy(new Error('Hết thời gian chờ Google – kiểm tra mạng')));
    req.on('error', reject);
    req.end(data);
  });
}

function tokenBody(extra) {
  const b = Object.assign({ client_id: CLIENT_ID }, extra);
  const sec = clientSecret();
  if (sec) b.client_secret = sec;
  return b;
}

const page = (msg) => `<!doctype html><meta charset="utf-8"><title>Wisp</title><body style="font:16px system-ui;text-align:center;margin-top:20vh">${msg}</body>`;

// Mở trình duyệt hệ thống → chờ mã về loopback → đổi token. Trả { email, name, picture }.
function login() {
  if (!store.available()) return Promise.reject(new Error('Máy chưa có kho khoá hệ thống (Keychain / DPAPI) nên không đăng nhập Google được'));
  if (pending) pending.cancel(new Error('Đã mở phiên đăng nhập mới'));
  const pkce = newPkce();
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    let done = false;
    const finish = (err, val) => {
      if (done) return;
      done = true; clearTimeout(timer); pending = null;
      server.close();
      err ? reject(err) : resolve(val);
    };
    const timer = setTimeout(() => finish(new Error('Hết thời gian chờ đăng nhập – bấm Đăng nhập lại')), LOGIN_TIMEOUT_MS);
    pending = { cancel: (e) => finish(e) };
    server.on('request', async (req, res) => {
      const r = parseCallback(req.url, pkce.state);
      if (!r) { res.writeHead(404).end(); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      if (r.error) { res.end(page(r.error + '. Quay lại Wisp để thử lại.')); return finish(new Error(r.error)); }
      try {
        const redirectUri = 'http://127.0.0.1:' + server.address().port;
        const t = await postForm(tokenBody({ code: r.code, code_verifier: pkce.verifier, grant_type: 'authorization_code', redirect_uri: redirectUri }));
        if (t.scope && missingScopes(t.scope).length) throw new Error('Chưa cấp quyền Google Drive – đăng nhập lại và tích ô “See, create, and delete its own configuration data in your Google Drive”');
        if (!t.refresh_token) throw new Error('Google không cấp quyền truy cập lâu dài – thử đăng nhập lại');
        const who = readIdToken(t.id_token);
        store.save(Object.assign({ refreshToken: t.refresh_token }, who));
        access = { token: t.access_token, exp: Date.now() + (t.expires_in - 60) * 1000 };
        res.end(page('Đăng nhập xong. Quay lại Wisp.'));
        events.emit('changed');
        finish(null, who);
      } catch (e) { res.end(page('Đăng nhập chưa được: ' + e.message)); finish(e); }
    });
    server.on('error', (e) => finish(e));
    server.listen(0, '127.0.0.1', () => {
      shell.openExternal(authUrl({ clientId: CLIENT_ID, redirectUri: 'http://127.0.0.1:' + server.address().port, challenge: pkce.challenge, state: pkce.state }))
        .catch((e) => finish(e));
    });
  });
}

// Access token còn hạn (làm mới bằng refresh token). Refresh token bị thu hồi → đăng xuất cục bộ.
async function getAccessToken() {
  if (access && access.exp > Date.now()) return access.token;
  const saved = store.load();
  if (!saved) throw Object.assign(new Error('Chưa đăng nhập Google'), { code: 'not_signed_in' });
  try {
    const t = await postForm(tokenBody({ refresh_token: saved.refreshToken, grant_type: 'refresh_token' }));
    access = { token: t.access_token, exp: Date.now() + (t.expires_in - 60) * 1000 };
    return access.token;
  } catch (e) {
    if (e.code === 'invalid_grant') { logout(); e.message = 'Phiên Google hết hạn hoặc bị thu hồi – đăng nhập lại'; }
    throw e;
  }
}

function account() { const s = store.load(); return s ? { email: s.email, name: s.name, picture: s.picture } : null; }

function logout() {
  if (pending) pending.cancel(new Error('Đã huỷ đăng nhập'));
  access = null; store.clear();
  events.emit('changed');
}

module.exports = { events, login, getAccessToken, account, logout };
