// Ghi mms.cfg của Flash 32 (nội dung tạo ở allowlist.js) vào thư mục dữ liệu Pepper Flash.
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const { loadConfig, allowDomains } = require('../config');
const { mmsCfgContent } = require('./allowlist');

function mmsCfgPath() {
  return path.join(app.getPath('userData'), 'Pepper Data', 'Shockwave Flash', 'System', 'mms.cfg');
}
function writeMmsCfg() {
  try {
    fs.mkdirSync(path.dirname(mmsCfgPath()), { recursive: true });
    fs.writeFileSync(mmsCfgPath(), mmsCfgContent(allowDomains(), loadConfig().flashDebug));
  } catch (e) { console.error('Không ghi được mms.cfg:', e); }
}

module.exports = { mmsCfgPath, writeMmsCfg };
