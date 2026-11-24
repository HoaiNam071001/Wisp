// Thanh dấu trang dưới thanh địa chỉ (engine web): bật / tắt (config `bookmarksBar`, mặc định bật), đẩy danh sách xuống
// thanh công cụ, mở / sắp xếp / xoá / menu chuột phải. Vẽ ở toolbar.html; chiều cao do tabs.setBookmarkBar giữ.
const { ipcMain, Menu } = require('electron');
const tabs = require('./tabs');
const bookmarks = require('./bookmarks');
const { loadConfig, saveConfig } = require('./config');
const { isBookmarkable } = require('./bookmarks-store');
const favicons = require('./favicon-cache');
const { iconFor } = require('./favicon-image');

const enabled = () => loadConfig().bookmarksBar !== false;

function push() {
  const win = tabs.getWin();
  if (win) win.webContents.send('bookmark:bar', { on: enabled(), items: enabled() ? bookmarks.barItems().map(b => ({ ...b, icon: favicons.get(b.url) })) : [] });
}

function apply() { tabs.setBookmarkBar(enabled()); push(); }

function toggle() { saveConfig({ bookmarksBar: !enabled() }); apply(); }

function openItem(url, inNewTab) {
  if (!isBookmarkable(url)) return;
  if (inNewTab) tabs.openNextToActive(url); else { const w = tabs.wc(); if (w) tabs.load(w, url); else tabs.openNextToActive(url); }
}

const fromToolbar = (e) => { const win = tabs.getWin(); return !!win && e.sender === win.webContents; };
ipcMain.on('bar:open', (e, url, inNewTab) => { if (fromToolbar(e) && typeof url === 'string') openItem(url, !!inNewTab); });
ipcMain.on('bar:reorder', (e, id, beforeId) => {
  if (fromToolbar(e) && typeof id === 'string' && (beforeId === null || typeof beforeId === 'string')) bookmarks.reorder(id, beforeId);
});
ipcMain.on('bar:menu', (e, id) => {
  if (!fromToolbar(e)) return;
  const it = bookmarks.barItems().find(b => b.id === id);
  if (!it) return;
  Menu.buildFromTemplate([
    { label: 'Mở', click: () => openItem(it.url, false) },
    { label: 'Mở trong tab mới', click: () => openItem(it.url, true) },
    { type: 'separator' },
    { label: 'Xoá dấu trang', click: () => bookmarks.removeItem(id) },
  ]).popup({ window: tabs.getWin() });
});
// Danh sách bị che bởi nút » → menu hệ thống (cửa sổ HTML của thanh công cụ không đè lên trang web được)
// Thanh báo các mục đang bị che → tải sẵn icon để bấm » là có ngay
ipcMain.on('bar:warm', (e, ids) => {
  if (!fromToolbar(e) || !Array.isArray(ids)) return;
  const byId = new Map(bookmarks.barItems().map(b => [b.id, b]));
  for (const id of ids.slice(0, 200)) { const b = byId.get(id); if (b) iconFor(b.url); }
});
// Menu danh sách dấu trang có icon (lần đầu tải icon song song, tối đa vài giây; sau đó có sẵn trong bộ nhớ)
async function popupList(list, x, y, head) {
  const icons = await Promise.all(list.map(b => iconFor(b.url)));
  const tpl = (head || []).concat(list.map((b, i) => ({ label: (b.title || b.url).slice(0, 60), ...(icons[i] ? { icon: icons[i] } : {}), click: () => openItem(b.url, false) })));
  if (tpl.length) Menu.buildFromTemplate(tpl).popup({ window: tabs.getWin(), x: Math.round(x) || undefined, y: Math.round(y) || undefined });
}
ipcMain.on('bar:overflow', (e, ids, x, y) => {
  if (!fromToolbar(e) || !Array.isArray(ids)) return;
  const byId = new Map(bookmarks.barItems().map(b => [b.id, b]));
  popupList(ids.map(id => byId.get(id)).filter(Boolean).slice(0, 200), x, y);
});
// Nút "Tất cả dấu trang": mở trang quản lý + toàn bộ danh sách
ipcMain.on('bar:all', (e, x, y) => {
  if (!fromToolbar(e)) return;
  popupList(bookmarks.barItems().slice(0, 300), x, y, [
    { label: 'Mở trang quản lý dấu trang', click: bookmarks.openBookmarks }, { type: 'separator' },
  ]);
});

bookmarks.events.on('changed', push);
// Học icon khi mở trang; trang đó đang có dấu trang thì vẽ lại thanh
tabs.events.on('favicon', (url, icon) => {
  if (favicons.set(url, icon) && enabled() && bookmarks.barItems().some(b => favicons.hostOf(b.url) === favicons.hostOf(url))) push();
});
module.exports = { toggle, apply, push, enabled, flushFavicons: favicons.flush };
