// Bật / tắt Flash cho trang (domain gốc) đang xem.
const tabs = require('../tabs');
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
  // Qua tabs.load: Flash thật → trang chờ Flash; Tắt → tải lại như web thường
  tabs.load(w, displayUrl(w.getURL()));
  tabs.sendState();
}

// Mục menu chuột phải: bật / tắt Flash cho host (một mục đánh dấu, không cần menu con)
function menuItem(host) {
  const on = choiceFor(host) === 'flash';
  return {
    label: 'Chạy bằng Flash', type: 'checkbox', checked: on,
    click: () => {
      if (!on && !FLASH_PATH) { askForFlashPlugin(); return; }
      apply(host, on ? 'off' : 'flash');
    },
  };
}

module.exports = { menuItem, apply };
