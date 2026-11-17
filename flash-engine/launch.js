// Lệnh khởi chạy engine Flash (logic thuần, không require electron).
// electronPath do router.js chọn: dev = gói electron-flash (Electron 11), bản đóng gói = Resources/game.
const path = require('path');

function launchFor({ electronPath, userData, pluginPath, pluginVersion }) {
  const env = { WISP_USER_DATA: userData };
  if (pluginPath) { env.WISP_FLASH_PLUGIN = pluginPath; env.WISP_FLASH_VERSION = pluginVersion || '32.0.0.0'; }
  return { command: electronPath, args: [path.join(__dirname, 'main.js')], env };
}

module.exports = { launchFor };
