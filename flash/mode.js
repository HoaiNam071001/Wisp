// Chọn chế độ lúc khởi động: 'flash' (Flash thật) | 'ruffle'. Không có plugin thì tự rơi về Ruffle.
// Chạy một lần khi được require lần đầu – phải trước app ready (switch ppapi-flash-* gắn lúc này)
// và sau user-data.js (đọc config.json trong userData).
const { app } = require('electron');
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

if (MODE === 'flash') {
  app.commandLine.appendSwitch('ppapi-flash-path', FLASH_PATH);
  app.commandLine.appendSwitch('ppapi-flash-version', FLASH_VERSION);
}

module.exports = { FLASH_PATH, FLASH_VERSION, wantedMode, MODE };
