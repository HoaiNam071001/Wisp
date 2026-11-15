// userData/ghosthand.json – Ghosthand đọc để biết cổng + token: {port, token, pid, version, api}.
// Không require('electron') (test được bằng thư mục tạm).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = 'ghosthand.json';

function newToken() { return crypto.randomBytes(24).toString('hex'); }

// Ghi qua file tạm rồi đổi tên: Ghosthand không đọc phải file ghi dở. Quyền 600 (chỉ người dùng này đọc được).
function writeInfo(dir, info) {
  const file = path.join(dir, FILE), tmp = file + '.tmp';
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(info, null, 2), { mode: 0o600 });
  fs.chmodSync(tmp, 0o600); // mode của writeFileSync bị umask cắt / không đổi file đã có
  fs.renameSync(tmp, file);
  return file;
}

// Chỉ xoá file của chính tiến trình này (bản Wisp khác cùng thư mục dữ liệu có thể đã ghi đè).
function removeInfo(dir, pid) {
  const file = path.join(dir, FILE);
  try {
    const cur = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (cur.pid === pid) fs.unlinkSync(file);
  } catch (e) { /* không có file / hỏng – bỏ qua */ }
}

// Token đúng không – so thời gian hằng (không lộ token qua thời gian trả lời).
function tokenOk(header, token) {
  const m = /^Bearer\s+(\S+)$/i.exec(String(header || ''));
  if (!m) return false;
  const a = Buffer.from(m[1]), b = Buffer.from(token);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { FILE, newToken, writeInfo, removeInfo, tokenOk };
