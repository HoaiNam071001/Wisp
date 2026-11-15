// Các thao tác trên trang / cửa sổ hiện tại (menu ⋮, menu hệ thống, Bảng kiểm tra).
const { app, session, dialog, shell, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const tabs = require('./tabs');
const { saveConfig } = require('./config');
const { addLog } = require('./inspect/store');
const { normalizeUrl } = require('./app-urls');
const { pad2 } = require('./util');

function zoomBy(step) { const w = tabs.wc(); if (w) w.setZoomLevel(step === 0 ? 0 : w.getZoomLevel() + step); }
function zoomPercent() { const w = tabs.wc(); return w ? Math.round(100 * Math.pow(1.2, w.getZoomLevel())) : 100; }
function toggleFullScreen() { const win = tabs.getWin(); if (win) win.setFullScreen(!win.isFullScreen()); }
function hardReload() { const w = tabs.wc(); if (w) w.reloadIgnoringCache(); }
async function clearCacheReload() {
  await session.defaultSession.clearCache();
  addLog('info', 'event', 'Đã xoá cache HTTP, tải lại trang không dùng cache');
  hardReload();
  tabs.toast('Đã xoá cache, đang tải lại');
}
function setHomeHere() {
  const w = tabs.wc();
  if (!w) return;
  saveConfig({ url: w.getURL() });
  tabs.toast('Đã đặt trang này làm trang chủ');
}

function shotsDir() { return path.join(app.getPath('pictures'), 'Wisp'); }
function openShotsDir() { fs.mkdirSync(shotsDir(), { recursive: true }); return shell.openPath(shotsDir()); }
async function screenshotTab() {
  const w = tabs.wc();
  if (!w) return;
  try {
    const img = await w.capturePage();
    const d = new Date();
    const stamp = `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
    fs.mkdirSync(shotsDir(), { recursive: true });
    const file = path.join(shotsDir(), `wisp-${stamp}.png`);
    fs.writeFileSync(file, img.toPNG());
    clipboard.writeImage(img);
    addLog('info', 'event', 'Đã chụp màn hình: ' + file);
    tabs.toast('Đã lưu ảnh vào Ảnh/Wisp và chép vào clipboard');
  } catch (e) { tabs.toast('Không chụp được: ' + e.message); }
}

async function openSwfFile() {
  const r = await dialog.showOpenDialog(tabs.getWin(), { properties: ['openFile'], filters: [{ name: 'Flash', extensions: ['swf'] }] });
  if (!r.canceled && r.filePaths[0]) tabs.openNextToActive(normalizeUrl(r.filePaths[0]));
}

module.exports = { zoomBy, zoomPercent, toggleFullScreen, hardReload, clearCacheReload, setHomeHere, openShotsDir, screenshotTab, openSwfFile };
