// Popover "Sửa tên" dấu trang (bookmark-rename.html): ô nhập một dòng, Enter lưu, Esc đóng.
// Dùng popover HTML vì Electron không có hộp nhập chữ.
const { ipcMain } = require('electron');
const popover = require('./popover');
const bookmarks = require('./bookmarks');

let target = null; // id mục đang sửa

function openRename(id, anchor) {
  if (!bookmarks.barItems().some(b => b.id === id)) return;
  target = id;
  popover.close('bmrename');
  popover.toggle('bmrename', anchor, { file: 'bookmark-rename.html', preload: 'bookmark-rename-preload.js', width: 300 });
}

const from = (e) => popover.isFrom('bmrename', e);

ipcMain.handle('bmrename:get', (e) => {
  if (!from(e)) return null;
  const b = bookmarks.barItems().find(x => x.id === target);
  return b ? { title: b.title, url: b.url } : null;
});
ipcMain.on('bmrename:save', (e, title) => {
  if (!from(e) || typeof title !== 'string') return;
  bookmarks.renameItem(target, title);
  popover.close('bmrename');
});

module.exports = { openRename };
