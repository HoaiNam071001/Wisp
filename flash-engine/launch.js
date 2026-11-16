// Lệnh khởi chạy engine Flash (logic thuần, không require electron).
// Dev: Electron 11 trong node_modules. Bản đóng gói: Electron 11 kèm theo ở Resources/game (bước 04, mục Đóng gói – chưa làm).
const path = require('path');

function launchFor({ electronPath, userData, pluginPath, pluginVersion }) {
  const env = { WISP_USER_DATA: userData };
  if (pluginPath) { env.WISP_FLASH_PLUGIN = pluginPath; env.WISP_FLASH_VERSION = pluginVersion || '32.0.0.0'; }
  return { command: electronPath, args: [path.join(__dirname, 'main.js')], env };
}

module.exports = { launchFor };
