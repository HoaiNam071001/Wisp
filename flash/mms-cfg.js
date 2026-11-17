// Ghi mms.cfg của Flash 32 (nội dung tạo ở allowlist.js) vào thư mục dữ liệu Pepper Flash của engine Flash
// (userData/flash-engine – tách khỏi dữ liệu Chromium mới của vỏ app, hai bản Chromium không dùng chung profile).
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const { loadConfig, allowDomains } = require('../config');
const { mmsCfgContent } = require('./allowlist');

function engineUserData() { return path.join(app.getPath('userData'), 'flash-engine'); }
function mmsCfgPath() {
  return path.join(engineUserData(), 'Pepper Data', 'Shockwave Flash', 'System', 'mms.cfg');
}
function writeMmsCfg() {
  try {
    fs.mkdirSync(path.dirname(mmsCfgPath()), { recursive: true });
    fs.writeFileSync(mmsCfgPath(), mmsCfgContent(allowDomains(), loadConfig().flashDebug));
  } catch (e) { console.error('Không ghi được mms.cfg:', e); }
}

module.exports = { engineUserData, mmsCfgPath, writeMmsCfg };
