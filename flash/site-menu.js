// Menu chọn Tắt / Flash thật / Ruffle cho trang (domain gốc) đang xem.
const tabs = require('../tabs');
const flashRouter = require('../flash-engine/router');
const { flashSites, saveFlashSites } = require('../config');
const { FLASH_PATH } = require('./mode');
const { writeMmsCfg } = require('./mms-cfg');
const { askForFlashPlugin } = require('./install');
const { siteFor, setSite } = require('./site-config');
const { displayUrl } = require('../app-urls');

function choiceFor(host) {
  const s = siteFor(flashSites(), host);
  return s ? s.engine : 'off';
}

function apply(host, engine) {
  saveFlashSites(setSite(flashSites(), host, engine));
  writeMmsCfg();
  const w = tabs.wc();
  if (!w) return;
  // Qua tabs.load: Flash thật → trang chờ Flash; Tắt / Ruffle → tải lại để preload chèn (hoặc thôi chèn) Ruffle
  tabs.load(w, displayUrl(w.getURL()));
  tabs.sendState();
}

// Mục menu chọn engine Flash cho host (menu chuột phải)
function menuItems(host) {
  const cur = choiceFor(host);
  const radio = (label, engine, extra) => ({ label, type: 'radio', checked: cur === engine, click: () => apply(host, engine), ...extra });
  return [
    radio('Tắt', 'off'),
    radio('Flash thật (cửa sổ riêng)', 'flash', FLASH_PATH ? {} : { enabled: false }),
    radio('Ruffle (giả lập, game online cần socket không chạy)', 'ruffle'),
    ...(FLASH_PATH ? [] : [{ type: 'separator' }, { label: 'Cài Flash Player…', click: askForFlashPlugin }]),
  ];
}

// Chọn từ thanh của cửa sổ engine Flash: đổi cấu hình, đóng cửa sổ Flash, mở lại trang ở cửa sổ chính
function applyFromEngine(url, engine) {
  let host = '';
  try { host = new URL(url).hostname; } catch { return; }
  saveFlashSites(setSite(flashSites(), host, engine));
  writeMmsCfg();
  flashRouter.close();
  tabs.openNextToActive(url);
}

module.exports = { applyFromEngine, menuItems };
