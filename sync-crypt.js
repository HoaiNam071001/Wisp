// Mã hoá đầu-cuối cho dữ liệu nhạy cảm (cookie game) trước khi đưa lên Drive: scrypt → AES-256-GCM. Logic thuần (Node 12).
// Quên mật khẩu = mất dữ liệu (Google chỉ thấy bản mã).
const crypto = require('crypto');

const MIN_PASSWORD = 8;
const b64 = (b) => b.toString('base64');

function checkPassword(pw) {
  if (typeof pw !== 'string' || pw.length < MIN_PASSWORD) return `Mật khẩu đồng bộ cần ít nhất ${MIN_PASSWORD} ký tự`;
  return null;
}

function key(pw, salt) { return crypto.scryptSync(pw, salt, 32, { N: 16384, r: 8, p: 1 }); }

function encrypt(plain, pw) {
  const err = checkPassword(pw);
  if (err) throw new Error(err);
  const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(pw, salt), iv);
  const data = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]);
  return JSON.stringify({ v: 1, salt: b64(salt), iv: b64(iv), tag: b64(c.getAuthTag()), data: b64(data) });
}

// Sai mật khẩu / bản mã bị sửa → ném lỗi nói rõ
function decrypt(blob, pw) {
  let o;
  try { o = JSON.parse(blob); } catch { throw new Error('Dữ liệu mã hoá hỏng'); }
  if (!o || o.v !== 1) throw new Error('Dữ liệu mã hoá không đúng định dạng');
  try {
    const d = crypto.createDecipheriv('aes-256-gcm', key(String(pw), Buffer.from(o.salt, 'base64')), Buffer.from(o.iv, 'base64'));
    d.setAuthTag(Buffer.from(o.tag, 'base64'));
    return Buffer.concat([d.update(Buffer.from(o.data, 'base64')), d.final()]).toString('utf8');
  } catch { throw new Error('Sai mật khẩu đồng bộ hoặc dữ liệu bị sửa'); }
}

module.exports = { MIN_PASSWORD, checkPassword, encrypt, decrypt };
