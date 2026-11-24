// Lưu bí mật nhỏ bằng safeStorage (Keychain / DPAPI) ở userData/<tên file> – không ghi thô, không vào config.json.
// Mặc định: refresh token Google (google-token.bin); createStore('sync-password.bin') cho mật khẩu mã hoá phiên game.
const { app, safeStorage } = require('electron');
const fs = require('fs');
const path = require('path');

function available() { return safeStorage.isEncryptionAvailable(); }

function createStore(fileName) {
  const file = () => path.join(app.getPath('userData'), fileName);
  return {
    available,
    // → object đã lưu | null
    load() {
      try {
        if (!available()) return null;
        return JSON.parse(safeStorage.decryptString(fs.readFileSync(file())));
      } catch { return null; }
    },
    save(data) {
      if (!available()) throw new Error('Máy chưa có kho khoá hệ thống (Keychain / DPAPI) nên Wisp từ chối lưu bí mật này');
      fs.writeFileSync(file(), safeStorage.encryptString(JSON.stringify(data)), { mode: 0o600 });
    },
    clear() { try { fs.unlinkSync(file()); } catch {} },
  };
}

module.exports = Object.assign({ createStore }, createStore('google-token.bin'));
