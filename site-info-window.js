// Popover thông tin trang (site-info.html): kết nối, quyền đã nhớ (đổi / đặt lại), xoá cookie + dữ liệu của trang.
// Phần tính ở site-info.js (thuần); quyền lưu ở config.sitePermissions (permissions.js hỏi / dùng).
const { ipcMain } = require('electron');
const tabs = require('./tabs');
const popover = require('./popover');
const { loadConfig, saveConfig } = require('./config');
const { describe, listPermissions, setPermission, resetPermissions, cookieMatchesHost } = require('./site-info');

let keepOpen = false;

function current() {
  const w = tabs.wc();
  const url = w && !w.isDestroyed() ? w.getURL() : '';
  return { w, url, info: describe(url) };
}

function view() {
  const { info } = current();
  return { kind: info.kind, host: info.host, perms: info.openable ? listPermissions(loadConfig().sitePermissions, info.host) : [] };
}

function toggleSiteInfo(anchor) {
  if (!current().info.openable) return;
  popover.toggle('siteinfo', anchor, { file: 'site-info.html', preload: 'site-info-preload.js', width: 320, keepOpen: () => keepOpen });
}

// Cookie (kể cả domain cha) + localStorage / IndexedDB… của riêng trang, rồi tải lại
async function clearSiteData(w, url, host) {
  const ses = w.session;
  const cookies = await ses.cookies.get({});
  await Promise.all(cookies.filter(c => cookieMatchesHost(c.domain, host)).map(c =>
    ses.cookies.remove((c.secure ? 'https' : 'http') + '://' + c.domain.replace(/^\./, '') + c.path, c.name).catch(() => {})));
  await ses.clearStorageData({ origin: new URL(url).origin, storages: ['localstorage', 'indexdb', 'cachestorage', 'serviceworkers', 'websql'] });
  w.reload();
}

const fromPopup = (e) => popover.isFrom('siteinfo', e);
ipcMain.handle('siteinfo:get', (e) => fromPopup(e) ? view() : null);
ipcMain.handle('siteinfo:set', (e, key, state) => {
  if (!fromPopup(e)) return null;
  const { info } = current();
  if (!info.openable) return null;
  saveConfig({ sitePermissions: setPermission(loadConfig().sitePermissions, info.host, String(key), String(state)) });
  return view();
});
ipcMain.handle('siteinfo:reset', (e) => {
  if (!fromPopup(e)) return null;
  const { info } = current();
  if (!info.openable) return null;
  saveConfig({ sitePermissions: resetPermissions(loadConfig().sitePermissions, info.host) });
  return view();
});
ipcMain.handle('siteinfo:clear', async (e) => {
  if (!fromPopup(e)) return null;
  const { w, url, info } = current();
  if (!w || !info.openable) return { ok: false };
  keepOpen = true;
  try { await clearSiteData(w, url, info.host); return { ok: true }; } catch (err) { return { ok: false, error: err.message }; } finally { keepOpen = false; }
});

module.exports = { toggleSiteInfo };
