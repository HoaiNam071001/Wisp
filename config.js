// Cấu hình người dùng (userData/config.json) + trang chủ / allowlist mặc định.
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const siteConfig = require('./flash/site-config');

// ====== ĐỔI ĐỊA CHỈ TRANG MẶC ĐỊNH Ở ĐÂY (hoặc bấm "★ Đặt làm trang chủ") ======
const DEFAULT_URL = 'https://bangbang.cmn.vn/';
// Domain được phép chạy Flash thật (ghi vào mms.cfg). Thêm domain của game ở đây
// hoặc dùng menu Flash → "Cho phép Flash trên trang này".
const DEFAULT_ALLOW = ['cmn.vn', 'cf4vn.bar'];
// =================================================================================

function configPath() { return path.join(app.getPath('userData'), 'config.json'); }
function loadConfig() {
  try { return JSON.parse(fs.readFileSync(configPath(), 'utf8')); } catch { return {}; }
}
function saveConfig(patch) {
  const cfg = { ...loadConfig(), ...patch };
  try {
    fs.mkdirSync(path.dirname(configPath()), { recursive: true });
    fs.writeFileSync(configPath(), JSON.stringify(cfg, null, 2));
  } catch (e) { console.error('Không lưu được config:', e); }
  return cfg;
}
// flashSites (bước 04) suy từ config 2.x khi chưa có khoá riêng
function flashSites() { return siteConfig.migrate(loadConfig(), DEFAULT_ALLOW); }
// Ghi flashSites + phản chiếu allowDomains để bản 2.x quay lại vẫn thấy danh sách
function saveFlashSites(sites) {
  const list = siteConfig.normalize(sites);
  saveConfig({ flashSites: list, allowDomains: siteConfig.allowDomainsOf(list) });
  return list;
}
function allowDomains() { return siteConfig.allowDomainsOf(flashSites()); }
function homeUrl() { return loadConfig().url || DEFAULT_URL; }

module.exports = { configPath, loadConfig, saveConfig, allowDomains, flashSites, saveFlashSites, homeUrl };
