// Thanh dấu trang dưới thanh địa chỉ (engine web): bật / tắt (config `bookmarksBar`, mặc định bật), đẩy danh sách xuống
// thanh công cụ, mở / sắp xếp / xoá / menu chuột phải. Vẽ ở toolbar.html; chiều cao do tabs.setBookmarkBar giữ.
const { ipcMain, Menu } = require('electron');
const tabs = require('./tabs');
const bookmarks = require('./bookmarks');
const { loadConfig, saveConfig } = require('./config');
const { isBookmarkable } = require('./bookmarks-store');

const enabled = () => loadConfig().bookmarksBar !== false;

function push() {
  const win = tabs.getWin();
  if (win) win.webContents.send('bookmark:bar', { on: enabled(), items: enabled() ? bookmarks.barItems() : [] });
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
ipcMain.on('bar:overflow', (e, ids, x, y) => {
  if (!fromToolbar(e) || !Array.isArray(ids)) return;
  const byId = new Map(bookmarks.barItems().map(b => [b.id, b]));
  const tpl = ids.map(id => byId.get(id)).filter(Boolean).slice(0, 200)
    .map(b => ({ label: (b.title || b.url).slice(0, 60), click: () => openItem(b.url, false) }));
  if (tpl.length) Menu.buildFromTemplate(tpl).popup({ window: tabs.getWin(), x: Math.round(x) || undefined, y: Math.round(y) || undefined });
});

bookmarks.events.on('changed', push);
module.exports = { toggle, apply, push, enabled };
