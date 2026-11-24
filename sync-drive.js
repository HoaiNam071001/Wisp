// Drive appDataFolder qua REST (Node 12: `https`). Mỗi loại dữ liệu một file JSON theo tên.
// transport(method, url, headers, body) → { status, body } – tách ra để test không cần mạng.
const https = require('https');

const API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const MAX_BYTES = 8 * 1024 * 1024; // chặn file đồng bộ phình quá mức

function httpsTransport(method, url, headers, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method, headers, timeout: 30000 }, (res) => {
      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('timeout', () => req.destroy(new Error('Hết thời gian chờ Google Drive – kiểm tra mạng')));
    req.on('error', reject);
    req.end(body);
  });
}

function driveError(res) {
  let msg = '';
  try { msg = JSON.parse(res.body).error.message; } catch {}
  const e = new Error(res.status === 403 ? 'Drive từ chối (kiểm tra đã bật Drive API / cấp quyền dữ liệu ứng dụng): ' + msg
    : res.status === 401 ? 'Phiên Google không hợp lệ – đăng nhập lại' : 'Drive lỗi ' + res.status + (msg ? ': ' + msg : ''));
  e.code = res.status === 401 ? 'unauthorized' : 'drive_' + res.status;
  return e;
}

function createDrive(getToken, transport) {
  const send = transport || httpsTransport;
  async function call(method, url, headers, body) {
    const h = Object.assign({ Authorization: 'Bearer ' + await getToken() }, headers);
    const res = await send(method, url, h, body);
    if (res.status < 200 || res.status >= 300) throw driveError(res);
    return res;
  }

  async function find(name) {
    const q = encodeURIComponent(`name='${name.replace(/'/g, "\\'")}' and trashed=false`);
    const res = await call('GET', `${API}?spaces=appDataFolder&q=${q}&fields=files(id,modifiedTime)&pageSize=1`);
    const f = JSON.parse(res.body).files;
    return f && f[0] ? { id: f[0].id, modifiedTime: f[0].modifiedTime } : null;
  }

  // → { id, modifiedTime, text } | null (chưa có file)
  async function read(name) {
    const f = await find(name);
    if (!f) return null;
    const res = await call('GET', `${API}/${f.id}?alt=media`);
    return Object.assign({}, f, { text: res.body });
  }

  // prev = kết quả read() lần trước (null = chưa có file). File đã bị máy khác ghi từ lúc đọc → lỗi 'conflict' (gọi lại: đọc, gộp, ghi).
  async function write(name, text, prev) {
    if (Buffer.byteLength(text) > MAX_BYTES) throw Object.assign(new Error('Dữ liệu đồng bộ quá lớn: ' + name), { code: 'too_large' });
    const now = await find(name);
    if ((prev && (!now || now.modifiedTime !== prev.modifiedTime)) || (!prev && now)) throw Object.assign(new Error('Máy khác vừa ghi ' + name), { code: 'conflict' });
    if (now) {
      await call('PATCH', `${UPLOAD}/${now.id}?uploadType=media`, { 'Content-Type': 'application/json' }, text);
      return;
    }
    const boundary = 'wisp' + Date.now().toString(36);
    const meta = JSON.stringify({ name, parents: ['appDataFolder'] });
    const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${text}\r\n--${boundary}--`;
    await call('POST', `${UPLOAD}?uploadType=multipart`, { 'Content-Type': 'multipart/related; boundary=' + boundary }, body);
  }

  // Xoá mọi file của app trên Drive (nút "Xoá dữ liệu đồng bộ")
  async function removeAll() {
    const res = await call('GET', `${API}?spaces=appDataFolder&fields=files(id)&pageSize=100`);
    for (const f of JSON.parse(res.body).files || []) await call('DELETE', `${API}/${f.id}`);
  }

  return { read, write, removeAll };
}

module.exports = { createDrive };
