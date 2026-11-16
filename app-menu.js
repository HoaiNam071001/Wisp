// Menu hệ thống của app (thanh menu macOS / Alt trên Windows) + phím tắt; tuỳ chọn chung với menu ⋮.
const { app, Menu, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const updater = require('./updater');
const tabs = require('./tabs');
const history = require('./history');
const keyremap = require('./keyremap-main');
const page = require('./page-actions');
const flash = require('./flash/actions');
const { askForFlashPlugin, choosePluginFile } = require('./flash/install');
const { MODE, FLASH_PATH, FLASH_VERSION, wantedMode } = require('./flash/mode');
const { userPluginPath } = require('./flash/plugin');
const { mmsCfgPath, writeMmsCfg } = require('./flash/mms-cfg');
const { loadConfig, saveConfig } = require('./config');
const { applyAppNap } = require('./perf');
const { clearPings } = require('./ping');
const { openInspector } = require('./inspect/window');
const { shorten } = require('./util');
const ghosthand = require('./ghosthand/server');

const IS_MAC = process.platform === 'darwin';
const OPTION_KEYS = ['restoreTabs', 'preventAppNap', 'pingGame', 'ghosthandPort'];

let menuTimer = null;
function scheduleMenu() {
  if (menuTimer) return;
  menuTimer = setTimeout(() => { menuTimer = null; if (tabs.winOk()) buildMenu(); }, 300);
}
tabs.events.on('changed', scheduleMenu);
history.events.on('changed', scheduleMenu);

// Bật / tắt một tuỳ chọn (mặc định đều bật) + áp dụng ngay
function setOption(key, on) {
  if (!OPTION_KEYS.includes(key)) return;
  saveConfig({ [key]: on });
  if (key === 'preventAppNap') applyAppNap();
  if (key === 'restoreTabs') tabs.saveSession(true);
  if (key === 'pingGame' && !on) clearPings();
  if (key === 'ghosthandPort') { if (on) ghosthand.start(); else ghosthand.stop(); }
}

function updateItem() {
  return { label: updater.state().available ? `Cập nhật lên ${updater.state().available}…` : 'Kiểm tra cập nhật…', click: checkUpdate };
}
function checkUpdate() { return updater.state().available ? updater.promptUpdate(true) : updater.check({ manual: true }); }

function historySubmenu() {
  const recent = history.recentHistory();
  return [
    { label: 'Hiện toàn bộ lịch sử', accelerator: IS_MAC ? 'Cmd+Y' : 'Ctrl+H', click: history.openHistory },
    { label: 'Xoá lịch sử…', accelerator: IS_MAC ? 'Shift+Cmd+Backspace' : 'Ctrl+Shift+Delete', click: history.clearHistoryDialog },
    { type: 'separator' },
    { label: recent.length ? 'Xem gần đây' : 'Chưa có lịch sử', enabled: false },
    ...recent.map(h => ({ label: shorten(h.title || h.url), click: () => tabs.openUrl(h.url) })),
  ];
}

function flashSubmenu() {
  const cfg = loadConfig();
  return [
    { label: 'Kiểm tra Flash Player', click: flash.checkFlash },
    { label: FLASH_PATH ? 'Cài lại / thay Flash Player…' : 'Cài Flash Player…', click: askForFlashPlugin },
    { label: 'Chọn file Flash Player đã tải…', click: choosePluginFile },
    { label: 'Mở thư mục plugin', click: () => { const d = path.dirname(userPluginPath()); fs.mkdirSync(d, { recursive: true }); shell.openPath(d); } },
    { type: 'separator' },
    { label: 'Chế độ: Flash Player thật', type: 'radio', checked: wantedMode === 'flash', enabled: !!FLASH_PATH || wantedMode === 'flash', click: () => flash.setMode('flash') },
    { label: 'Chế độ: Ruffle (dự phòng)', type: 'radio', checked: wantedMode === 'ruffle', click: () => flash.setMode('ruffle') },
    { type: 'separator' },
    { label: 'Cho phép Flash trên trang này', accelerator: 'Shift+CmdOrCtrl+A', enabled: MODE === 'flash', click: flash.allowCurrentSite },
    { label: 'Sửa danh sách domain cho phép…', click: flash.editAllowList },
    { label: 'Ghi log allowlist (gỡ lỗi)', type: 'checkbox', checked: !!cfg.flashDebug, click: (item) => { saveConfig({ flashDebug: item.checked }); writeMmsCfg(); flash.askRelaunch(item.checked ? 'Đã bật log allowlist.' : 'Đã tắt log allowlist.'); } },
    { label: 'Mở thư mục mms.cfg', click: () => shell.showItemInFolder(mmsCfgPath()) },
  ];
}

function optionsSubmenu() {
  const cfg = loadConfig();
  const item = (key, label) => ({ label, type: 'checkbox', checked: cfg[key] !== false, click: (it) => setOption(key, it.checked) });
  return [
    item('restoreTabs', 'Mở lại các tab lần trước khi mở app'),
    item('preventAppNap', IS_MAC ? 'Chống App Nap (game không bị chậm khi ẩn cửa sổ)' : 'Không cho máy ngủ khi đang mở Wisp'),
    item('pingGame', 'Theo dõi ping máy chủ game'),
    item('ghosthandPort', 'Cổng Ghosthand (cho Ghosthand điều khiển trang)'),
    { type: 'separator' },
    { label: 'Đổi phím…', click: keyremap.openKeysWindow },
  ];
}

function aboutWin() {
  dialog.showMessageBox(tabs.getWin(), { type: 'info', message: `Wisp ${app.getVersion()}`,
    detail: `Electron ${process.versions.electron} · Chromium ${process.versions.chrome} · ${process.arch}\nFlash: ${FLASH_VERSION || 'chưa cài'} (${MODE})` });
}

function fileSubmenu() {
  return [
    { label: 'Tab mới', accelerator: 'CmdOrCtrl+T', click: tabs.newTab },
    { label: 'Mở file .swf…', accelerator: 'CmdOrCtrl+O', click: page.openSwfFile },
    { type: 'separator' },
    { label: 'Đóng tab', accelerator: 'CmdOrCtrl+W', click: () => tabs.activeTab() && tabs.closeTab(tabs.getActiveId()) },
    { label: 'Mở lại tab vừa đóng', accelerator: 'Shift+CmdOrCtrl+T', click: tabs.reopenClosedTab },
    { type: 'separator' },
    { label: 'Chụp màn hình tab', accelerator: 'Shift+CmdOrCtrl+S', click: page.screenshotTab },
    ...(IS_MAC ? [] : [
      { type: 'separator' },
      updateItem(),
      { label: `Giới thiệu Wisp ${app.getVersion()}`, click: aboutWin },
      { type: 'separator' },
      { role: 'quit', label: 'Thoát Wisp', accelerator: 'Alt+F4' },
    ]),
  ];
}

function pageSubmenu() {
  const w = () => tabs.wc();
  return [
    { label: 'Mở địa chỉ…', accelerator: 'CmdOrCtrl+L', click: tabs.focusUrlBar },
    { label: 'Quay lại', accelerator: IS_MAC ? 'Cmd+[' : 'Alt+Left', click: () => w() && w().canGoBack() && w().goBack() },
    { label: 'Tiến tới', accelerator: IS_MAC ? 'Cmd+]' : 'Alt+Right', click: () => w() && w().canGoForward() && w().goForward() },
    { label: 'Tải lại', accelerator: 'CmdOrCtrl+R', click: () => w() && w().reload() },
    { label: 'Tải lại không dùng cache', accelerator: 'Shift+CmdOrCtrl+R', click: page.hardReload },
    { label: 'Xoá cache và tải lại', click: page.clearCacheReload },
    { type: 'separator' },
    { label: 'Toàn màn hình', accelerator: IS_MAC ? 'Ctrl+Cmd+F' : 'F11', click: page.toggleFullScreen },
    { label: 'Phóng to', accelerator: 'CmdOrCtrl+=', click: () => page.zoomBy(0.5) },
    { label: 'Thu nhỏ', accelerator: 'CmdOrCtrl+-', click: () => page.zoomBy(-0.5) },
    { label: 'Cỡ gốc', accelerator: 'CmdOrCtrl+0', click: () => page.zoomBy(0) },
    { type: 'separator' },
    { label: 'Bảng kiểm tra (hiệu năng, mạng, socket)', accelerator: 'Shift+CmdOrCtrl+I', click: () => openInspector() },
    { label: 'Công cụ nhà phát triển', accelerator: IS_MAC ? 'Alt+Cmd+I' : 'Ctrl+Alt+I', click: () => w() && w().toggleDevTools() },
  ];
}

function tabSubmenu() {
  const all = tabs.list();
  return [
    { label: 'Tab tiếp theo', accelerator: 'Ctrl+Tab', click: () => tabs.cycleTab(1) },
    { label: 'Tab trước', accelerator: 'Ctrl+Shift+Tab', click: () => tabs.cycleTab(-1) },
    { label: 'Tắt / bật tiếng tab', accelerator: 'Shift+CmdOrCtrl+M', click: () => tabs.activeTab() && tabs.toggleMute(tabs.getActiveId()) },
    { type: 'separator' },
    ...all.map((t, i) => ({
      label: shorten(tabs.tabInfo(t).title, 50), type: 'radio', checked: t.id === tabs.getActiveId(),
      accelerator: i < 8 ? `CmdOrCtrl+${i + 1}` : undefined, click: () => tabs.activateTab(t.id),
    })),
    ...(all.length > 8 ? [{ label: 'Tab cuối', accelerator: 'CmdOrCtrl+9', click: () => tabs.activateTab(all[all.length - 1].id) }] : []),
  ];
}

function buildMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(!IS_MAC ? [] : [{ label: app.name, submenu: [
      { role: 'about', label: 'Giới thiệu Wisp' },
      updateItem(),
      { type: 'separator' },
      { role: 'hide', label: 'Ẩn Wisp' },
      { role: 'hideOthers', label: 'Ẩn ứng dụng khác' },
      { type: 'separator' },
      { role: 'quit', label: 'Thoát Wisp' },
    ]}]),
    { label: 'Tệp', submenu: fileSubmenu() },
    { label: 'Sửa', submenu: [
      { role: 'undo', label: 'Hoàn tác' }, { role: 'redo', label: 'Làm lại' }, { type: 'separator' },
      { role: 'cut', label: 'Cắt' }, { role: 'copy', label: 'Sao chép' }, { role: 'paste', label: 'Dán' },
      { role: 'selectAll', label: 'Chọn tất cả' },
    ]},
    { label: 'Trang', submenu: pageSubmenu() },
    { label: 'Flash', submenu: flashSubmenu() },
    { label: 'Lịch sử', submenu: historySubmenu() },
    { label: 'Tab', submenu: tabSubmenu() },
    { label: 'Tuỳ chọn', submenu: optionsSubmenu() },
    { role: 'windowMenu', label: 'Cửa sổ' },
  ]));
}

module.exports = { OPTION_KEYS, scheduleMenu, buildMenu, setOption, flashSubmenu, checkUpdate };
