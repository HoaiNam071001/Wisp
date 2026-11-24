// Dropdown dấu trang (nút » và nút "Tất cả dấu trang") – popover HTML nhỏ gọn kiểu Chrome, vẽ ở bookmarks-list.html.
// Dùng HTML thay menu hệ thống để dòng thấp, nền tối cùng theme, hiện icon trang bằng <img> (không phải tải ảnh ở main).
const { ipcMain } = require('electron');
const tabs = require('./tabs');
const popover = require('./popover');
const bookmarks = require('./bookmarks');
const favicons = require('./favicon-cache');
const { isBookmarkable } = require('./bookmarks-store');

let mode = { all: false, ids: null };

// all = true: toàn bộ + mục mở trang quản lý; ngược lại chỉ các mục `ids` (bị nút » che)
function toggleList(anchor, all, ids) {
  mode = { all: !!all, ids: Array.isArray(ids) ? ids.slice(0, 300).filter(x => typeof x === 'string') : null };
  popover.toggle('bmlist', anchor, { file: 'bookmarks-list.html', preload: 'bookmarks-list-preload.js', width: 340 });
}

const from = (e) => popover.isFrom('bmlist', e);

ipcMain.handle('bmlist:get', (e) => {
  if (!from(e)) return null;
  let items = bookmarks.barItems();
  if (!mode.all && mode.ids) { const by = new Map(items.map(b => [b.id, b])); items = mode.ids.map(id => by.get(id)).filter(Boolean); }
  return { all: mode.all, items: items.slice(0, 300).map(b => ({ id: b.id, url: b.url, title: b.title, icon: favicons.get(b.url) })) };
});

ipcMain.on('bmlist:open', (e, id, inNewTab) => {
  if (!from(e) || typeof id !== 'string') return;
  const b = bookmarks.barItems().find(x => x.id === id);
  if (!b || !isBookmarkable(b.url)) return;
  popover.close('bmlist');
  if (inNewTab) tabs.openNextToActive(b.url); else { const w = tabs.wc(); if (w) tabs.load(w, b.url); else tabs.openNextToActive(b.url); }
});

ipcMain.on('bmlist:manage', (e) => { if (from(e)) { popover.close('bmlist'); bookmarks.openBookmarks(); } });

module.exports = { toggleList };
