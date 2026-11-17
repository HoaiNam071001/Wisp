// Trang chờ Flash (flash-launcher.html) ↔ cửa sổ engine Flash: nút "Mở game" mở cửa sổ,
// đóng tab thì đóng cửa sổ Flash; đóng cửa sổ Flash thì tab ở lại (đóng app: before-quit lo engine).
const { ipcMain } = require('electron');
const tabs = require('../tabs');
const flashRouter = require('../flash-engine/router');
const { displayUrl, isLauncherUrl } = require('../app-urls');
const siteMenu = require('./site-menu');

let ownerId = null; // tab đã bấm mở game (engine chỉ có một cửa sổ)

// Tab đang có game mở ở cửa sổ engine Flash (Ghosthand: lệnh DOM trên tab này → flash_page, chỉ frameRect)
const isFlashTab = (id) => ownerId !== null && id === ownerId;

ipcMain.handle('flash:launch', (e) => {
  let url = '';
  try { url = e.sender.getURL(); } catch { return; }
  const t = tabs.list().find((x) => x.view.webContents === e.sender);
  if (!t || !isLauncherUrl(url)) return;
  ownerId = t.id;
  return flashRouter.open(displayUrl(url));
});

// Nút "Mở như web thường": tắt Flash cho trang này, tab tải lại thành web thường
ipcMain.handle('flash:normal', (e) => {
  let url = '';
  try { url = e.sender.getURL(); } catch { return; }
  const t = tabs.list().find((x) => x.view.webContents === e.sender);
  if (!t || !isLauncherUrl(url)) return;
  if (t.id === ownerId) { ownerId = null; flashRouter.close(); }
  let host = '';
  try { host = new URL(displayUrl(url)).hostname; } catch { return; }
  siteMenu.apply(host, 'off');
});

tabs.events.on('tab-closed', (t) => {
  if (t.id !== ownerId) return;
  ownerId = null;
  flashRouter.close();
});

// Cửa sổ Flash đóng → chỉ đóng chính nó; tab chủ ở lại (trang chờ vẫn bấm "Mở game" lại được)
flashRouter.events.on('closed', () => { ownerId = null; });

module.exports = { isFlashTab };
