// Trang chờ Flash (flash-launcher.html) ↔ cửa sổ engine Flash: nút "Mở game" mở cửa sổ,
// đóng tab thì đóng cửa sổ Flash và ngược lại (đóng app: before-quit lo engine).
const { ipcMain } = require('electron');
const tabs = require('../tabs');
const flashRouter = require('../flash-engine/router');
const { displayUrl, isLauncherUrl } = require('../app-urls');

let ownerId = null; // tab đã bấm mở game (engine chỉ có một cửa sổ)

ipcMain.handle('flash:launch', (e) => {
  let url = '';
  try { url = e.sender.getURL(); } catch { return; }
  const t = tabs.list().find((x) => x.view.webContents === e.sender);
  if (!t || !isLauncherUrl(url)) return;
  ownerId = t.id;
  return flashRouter.open(displayUrl(url));
});

tabs.events.on('tab-closed', (t) => {
  if (t.id !== ownerId) return;
  ownerId = null;
  flashRouter.close();
});

// Cửa sổ Flash đóng → đóng tab chủ nếu tab còn ở trang chờ (đã đi nơi khác thì để yên)
flashRouter.events.on('closed', () => {
  const t = tabs.list().find((x) => x.id === ownerId);
  ownerId = null;
  if (!t || t.view.webContents.isDestroyed() || !isLauncherUrl(t.view.webContents.getURL())) return;
  tabs.closeTab(t.id);
});
