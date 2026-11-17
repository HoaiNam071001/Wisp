// Chọn chế độ lúc khởi động: 'flash' (Flash thật) | 'ruffle'. Không có plugin thì tự rơi về Ruffle.
// Vỏ app (Electron mới) không nạp Pepper Flash – plugin chỉ để engine Flash (Electron 11) dùng.
// Chạy một lần khi được require lần đầu, sau user-data.js (đọc config.json trong userData).
const fs = require('fs');
const { loadConfig } = require('../config');
const plugin = require('./plugin');

// Lần đầu chạy: plugin đang nằm trong app mà chưa có ở userData → chép ra
if (!fs.existsSync(plugin.userPluginPath()) && fs.existsSync(plugin.bundledPluginPath())) {
  try { plugin.installFlashPlugin(plugin.bundledPluginPath()); } catch (e) { console.error('Không chép được plugin Flash:', e); }
}

const FLASH_PATH = plugin.findFlashPlugin();
const FLASH_VERSION = FLASH_PATH ? plugin.readFlashVersion(FLASH_PATH) : null;
const wantedMode = loadConfig().mode === 'ruffle' ? 'ruffle' : 'flash';
const MODE = wantedMode === 'flash' && FLASH_PATH ? 'flash' : 'ruffle';

module.exports = { FLASH_PATH, FLASH_VERSION, wantedMode, MODE };
