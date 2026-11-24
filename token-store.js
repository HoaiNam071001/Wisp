// Lưu refresh token Google bằng safeStorage (Keychain / DPAPI) ở userData/google-token.bin – không ghi thô, không vào config.json.
const { app, safeStorage } = require('electron');
const fs = require('fs');
const path = require('path');

const file = () => path.join(app.getPath('userData'), 'google-token.bin');

function available() { return safeStorage.isEncryptionAvailable(); }

// → { refreshToken, email, name, picture } | null
function load() {
  try {
    if (!available()) return null;
    return JSON.parse(safeStorage.decryptString(fs.readFileSync(file())));
  } catch { return null; }
}

function save(data) {
  if (!available()) throw new Error('Máy chưa có kho khoá hệ thống (Keychain / DPAPI) nên Wisp từ chối lưu đăng nhập Google');
  fs.writeFileSync(file(), safeStorage.encryptString(JSON.stringify(data)), { mode: 0o600 });
}

function clear() { try { fs.unlinkSync(file()); } catch {} }

module.exports = { available, load, save, clear };
