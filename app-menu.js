// Menu hệ thống của app (thanh menu macOS / Alt trên Windows) + phím tắt; tuỳ chọn chung với menu ⋮.
const { app, Menu, dialog } = require('electron');
const updater = require('./updater');
const tabs = require('./tabs');
const history = require('./history');
const keyremap = require('./keyremap-main');
const page = require('./page-actions');
const flash = require('./flash/actions');
const { openSettings: openFlashSettings } = require('./flash/settings-window');
const { FLASH_PATH, FLASH_VERSION } = require('./flash/mode');
const { loadConfig, saveConfig } = require('./config');
const { QUALITIES, normalizeQuality } = require('./flash/quality');
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

// Hạ chất lượng giúp game nhẹ hơn trên cửa sổ lớn; chỉ áp cho tab mở sau khi đổi (đã tạo plugin thì không đổi được)
function qualitySubmenu() {
  const cur = normalizeQuality(loadConfig().flashQuality);
  const set = (v) => { saveConfig({ flashQuality: v }); scheduleMenu(); };
  return [
    { label: 'Theo game (mặc định)', type: 'radio', checked: !cur, click: () => set(null) },
    ...QUALITIES.map(q => ({ label: q.label, type: 'radio', checked: cur === q.value, click: () => set(q.value) })),
  ];
}

function flashSubmenu() {
  return [
    { label: 'Cài đặt Flash…', click: openFlashSettings },
    { label: 'Kiểm tra Flash Player', click: flash.checkFlash },
    { type: 'separator' },
    { label: 'Chất lượng vẽ Flash (cho tab mới)', submenu: qualitySubmenu() },
    { type: 'separator' },
    { label: 'Cho phép Flash trên trang này', accelerator: 'Shift+CmdOrCtrl+A', enabled: !!FLASH_PATH, click: flash.allowCurrentSite },
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
    detail: `Electron ${process.versions.electron} · Chromium ${process.versions.chrome} · ${process.arch}\nFlash: ${FLASH_VERSION || 'chưa cài'}` });
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
    { label: 'Quay lại', accelerator: IS_MAC ? 'Cmd+[' : 'Alt+Left', click: () => w() && w().navigationHistory.canGoBack() && w().navigationHistory.goBack() },
    { label: 'Tiến tới', accelerator: IS_MAC ? 'Cmd+]' : 'Alt+Right', click: () => w() && w().navigationHistory.canGoForward() && w().navigationHistory.goForward() },
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

module.exports = { OPTION_KEYS, scheduleMenu, buildMenu, setOption, checkUpdate };
