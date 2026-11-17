// Gợi ý "Cần Flash – Bật" trên thanh địa chỉ: trang đang xem có .swf mà domain chưa cấu hình Flash.
const { ipcMain } = require('electron');
const tabs = require('../tabs');
const flashRouter = require('../flash-engine/router');
const siteMenu = require('./site-menu');
const { displayUrl } = require('../app-urls');

ipcMain.on('flash:swf', (e) => {
  const t = tabs.list().find((x) => x.view.webContents === e.sender);
  if (!t || flashRouter.wantsFlash(e.sender.getURL())) return;
  t.swfHint = true;
  if (t.id === tabs.getActiveId()) tabs.sendState();
});

ipcMain.on('flash:enable', (e) => {
  const win = tabs.getWin();
  if (!win || e.sender !== win.webContents || !tabs.wc()) return;
  try { siteMenu.enable(new URL(displayUrl(tabs.wc().getURL())).hostname); } catch { /* url lạ */ }
});
