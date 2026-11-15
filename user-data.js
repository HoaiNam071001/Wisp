// Thư mục dữ liệu: ~/Library/Application Support/Wisp (WISP_USER_DATA để chạy dev riêng).
// Phải gọi trước mọi chỗ đọc config.json / app.getPath('userData').
const { app } = require('electron');
const path = require('path');
const fs = require('fs');

// Lần đầu chạy bản Wisp: chuyển nguyên thư mục cũ "Flash Browser 2" sang (giữ cookie, đăng nhập).
// Không có thì chép config.json của bản 1 ("Flash Browser"). Bản 1 (Electron 45) để lại cookie
// định dạng mới mà Chromium 87 không đọc được, nên chỉ chép config.json.
function setupUserData() {
  const appData = app.getPath('appData');
  // WISP_USER_DATA: chạy thử bản dev với thư mục dữ liệu riêng, không đụng bản đang dùng
  const newDir = process.env.WISP_USER_DATA || path.join(appData, 'Wisp');
  app.setPath('userData', newDir);
  if (process.env.WISP_USER_DATA) return;
  try {
    const v2Dir = path.join(appData, 'Flash Browser 2');
    const v1Cfg = path.join(appData, 'Flash Browser', 'config.json');
    // Electron có thể đã tự tạo thư mục Wisp (rỗng) trước khi code này chạy,
    // nên xét "chưa có config.json" thay vì "chưa có thư mục".
    const fresh = !fs.existsSync(path.join(newDir, 'config.json'));
    if (fresh && fs.existsSync(v2Dir)) {
      if (fs.existsSync(newDir)) fs.rmdirSync(newDir, { recursive: true });
      fs.renameSync(v2Dir, newDir);
    } else if (fresh && fs.existsSync(v1Cfg)) {
      fs.mkdirSync(newDir, { recursive: true });
      fs.copyFileSync(v1Cfg, path.join(newDir, 'config.json'));
    }
  } catch {}
}

module.exports = { setupUserData };
