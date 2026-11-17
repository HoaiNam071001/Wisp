// Tên file tải về (logic thuần): bỏ ký tự nguy hiểm, không đè file có sẵn ("a (1).zip", "a (2).zip"…).
const path = require('path');

function safeName(name) {
  const n = path.basename(String(name || '')).replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').replace(/^\.+/, '').trim();
  return n || 'tai-ve';
}

function uniquePath(dir, name, exists) {
  const base = safeName(name);
  const ext = path.extname(base), stem = base.slice(0, base.length - ext.length);
  let p = path.join(dir, base);
  for (let i = 1; exists(p); i++) p = path.join(dir, `${stem} (${i})${ext}`);
  return p;
}

module.exports = { safeName, uniquePath };
