// Dấu trang: lưu userData/bookmarks.json, nút ★ trên thanh địa chỉ, IPC cho trang Dấu trang (bookmarks.html).
// Dữ liệu và gộp ở bookmarks-store.js (thuần); đây chỉ lo file + IPC. Phát bookmarks.events 'changed' cho đồng bộ (bước 11).
const { app, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { EventEmitter } = require('events');
const tabs = require('./tabs');
const store = require('./bookmarks-store');
const favicons = require('./favicon-cache');
const { BOOKMARKS_URL, isBookmarksUrl, normalizeUrl } = require('./app-urls');

const events = new EventEmitter();
let items = null;
let saveTimer = null;

function filePath() { return path.join(app.getPath('userData'), 'bookmarks.json'); }
function load() {
  if (items) return items;
  try { items = store.clean(JSON.parse(fs.readFileSync(filePath(), 'utf8'))); } catch { items = []; }
  return items;
}
function saveNow() {
  clearTimeout(saveTimer); saveTimer = null;
  if (!items) return;
  try { fs.writeFileSync(filePath(), JSON.stringify(items)); } catch (e) { console.error('Không lưu được dấu trang:', e); }
}

function changed() {
  if (!saveTimer) saveTimer = setTimeout(saveNow, 500);
  for (const t of tabs.list()) {
    const w = t.view.webContents;
    if (!w.isDestroyed() && isBookmarksUrl(w.getURL())) w.send('bookmarks:changed');
  }
  pushStar();
  events.emit('changed');
}

// Báo thanh công cụ ★ đã bật chưa (tabs không biết dấu trang nên thanh công cụ nhận riêng)
function pushStar() {
  const win = tabs.getWin(), w = tabs.wc();
  if (!win) return;
  const url = w ? w.getURL() : '';
  win.webContents.send('bookmark:state', { can: store.isBookmarkable(url), starred: store.has(load(), url) });
}
tabs.events.on('changed', pushStar);

function toggleActive() {
  const w = tabs.wc();
  if (!w || !store.isBookmarkable(w.getURL())) { tabs.toast('Chỉ đánh dấu được trang http / https'); return; }
  const before = store.has(load(), w.getURL());
  items = store.toggle(load(), w.getURL(), w.getTitle(), Date.now());
  tabs.toast(before ? 'Đã bỏ dấu trang' : 'Đã thêm dấu trang');
  changed();
}

function openBookmarks() {
  const t = tabs.list().find(x => !x.view.webContents.isDestroyed() && isBookmarksUrl(x.view.webContents.getURL()));
  if (t) tabs.activateTab(t.id); else tabs.openNextToActive(BOOKMARKS_URL);
}

function fromPage(e) { try { return isBookmarksUrl(e.sender.getURL()); } catch { return false; } }
function fromToolbar(e) { const win = tabs.getWin(); return !!win && e.sender === win.webContents; }
ipcMain.on('bookmark:toggle', (e) => { if (fromToolbar(e)) toggleActive(); });
ipcMain.handle('bookmarks:list', (e) => fromPage(e) ? store.sorted(load()).map(b => ({ ...b, icon: favicons.get(b.url) })) : []);
ipcMain.handle('bookmarks:open', (e, url, inNewTab) => {
  if (!fromPage(e) || !store.isBookmarkable(url)) return;
  const u = normalizeUrl(url);
  if (!u) return;
  if (inNewTab) {
    const all = tabs.list();
    const t = all.find(x => x.view.webContents === e.sender);
    tabs.createTab(u, { index: t ? all.indexOf(t) + 1 : all.length, activate: false });
  } else tabs.load(e.sender, u);
});
ipcMain.handle('bookmarks:remove', (e, id) => {
  if (!fromPage(e) || typeof id !== 'string') return;
  items = store.remove(load(), id, Date.now());
  changed();
});

// Thanh dấu trang (bookmarks-bar.js)
function barItems() { return store.barSorted(load()).map(b => ({ id: b.id, url: b.url, title: b.title })); }
function reorder(id, beforeId) { items = store.reorder(load(), id, beforeId, Date.now()); changed(); }
function removeItem(id) { items = store.remove(load(), id, Date.now()); changed(); }

// Đồng bộ (sync.js): đọc toàn bộ (kèm tombstone) / thay bằng bản đã gộp
function snapshot() { return load().slice(); }
function replaceAll(list) { items = store.prune(store.clean(list)); changed(); }

module.exports = { fromPage, barItems, reorder, removeItem, events, toggleActive, openBookmarks, saveNow, pushStar, snapshot, replaceAll };
