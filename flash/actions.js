// Các thao tác trong menu Flash: đổi chế độ, allowlist, kiểm tra Flash, khởi động lại.
const { app, dialog, shell } = require('electron');
const tabs = require('../tabs');
const { configPath, saveConfig, allowDomains } = require('../config');
const { MODE, FLASH_PATH, FLASH_VERSION, wantedMode } = require('./mode');
const { mmsCfgPath, writeMmsCfg } = require('./mms-cfg');
const { baseDomain } = require('./allowlist');
const { seenSwfHosts } = require('../inspect/store');
const { displayUrl } = require('../app-urls');

function relaunch() { app.relaunch(); app.exit(0); }

async function askRelaunch(message) {
  const { response } = await dialog.showMessageBox(tabs.getWin(), {
    type: 'question', buttons: ['Khởi động lại', 'Để sau'], defaultId: 0, cancelId: 1,
    message, detail: 'Thay đổi có hiệu lực sau khi mở lại app.',
  });
  if (response === 0) relaunch();
}

function setMode(mode) {
  if (mode === wantedMode) return;
  saveConfig({ mode });
  askRelaunch(mode === 'flash' ? 'Chuyển sang Flash Player thật.' : 'Chuyển sang chế độ Ruffle.');
}

async function allowCurrentSite() {
  const w = tabs.wc();
  if (!w) return;
  const hosts = new Set();
  try {
    const h = new URL(displayUrl(w.getURL())).hostname;
    if (h) hosts.add(baseDomain(h));
  } catch {}
  seenSwfHosts.forEach(h => hosts.add(baseDomain(h)));
  const current = allowDomains();
  const added = [...hosts].filter(h => h && !current.includes(h));
  if (!added.length) {
    dialog.showMessageBox(tabs.getWin(), { message: 'Các domain của trang này đã có trong danh sách cho phép.', detail: current.join('\n') });
    return;
  }
  saveConfig({ allowDomains: [...current, ...added] });
  writeMmsCfg();
  askRelaunch('Đã cho phép Flash trên: ' + added.join(', '));
}

async function editAllowList() {
  // Mở config.json để sửa tay "allowDomains"
  saveConfig({ allowDomains: allowDomains() });
  await shell.openPath(configPath());
  dialog.showMessageBox(tabs.getWin(), {
    message: 'Sửa mục "allowDomains" trong config.json rồi lưu, sau đó mở lại app.',
    detail: 'Mỗi domain gốc một dòng, vd. "cmn.vn" (tự gồm cả các subdomain).',
  });
}

// navigator.plugins của tab đang xem ('' nếu không có Flash / không đọc được)
async function pluginInfo(w) {
  if (!w) return '';
  try {
    return await w.executeJavaScript(`(() => { const p = navigator.plugins['Shockwave Flash']; return p ? (p.name + ' — ' + p.description) : ''; })()`);
  } catch { return ''; }
}

async function checkFlash() {
  const w = tabs.wc();
  if (!w) return;
  const info = await pluginInfo(w);
  dialog.showMessageBox(tabs.getWin(), {
    type: info ? 'info' : 'warning',
    message: MODE === 'ruffle' ? 'Đang ở chế độ Ruffle (giả lập Flash)' : (info ? 'Flash Player đã nạp ✓' : 'Không thấy Flash Player trong navigator.plugins'),
    detail: [
      info && `navigator.plugins: ${info}${MODE === 'ruffle' ? ' (Ruffle giả lập)' : ''}`,
      `Chế độ: ${MODE === 'flash' ? 'Flash thật' : 'Ruffle'}`,
      `Plugin: ${FLASH_PATH || '(chưa có)'}`,
      FLASH_VERSION && `Version: ${FLASH_VERSION}`,
      `Kiến trúc Electron: ${process.arch}`,
      `mms.cfg: ${mmsCfgPath()}`,
      `Domain được phép: ${allowDomains().join(', ')}`,
      seenSwfHosts.size ? `Domain .swf đã thấy: ${[...seenSwfHosts].join(', ')}` : '',
    ].filter(Boolean).join('\n'),
  });
}

module.exports = { relaunch, askRelaunch, setMode, allowCurrentSite, editAllowList, pluginInfo, checkFlash };
