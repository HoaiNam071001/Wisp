// Danh sách gợi ý dưới ô địa chỉ: cửa sổ con không nhận focus (ô địa chỉ vẫn nhận phím).
// Toolbar gửi chữ đang gõ + phím mũi tên qua IPC; cửa sổ này chỉ vẽ và báo dòng được bấm.
const { BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const tabs = require('./tabs');
const bookmarks = require('./bookmarks');
const bookmarksStore = require('./bookmarks-store');
const history = require('./history');
const { loadConfig } = require('./config');
const { normalizeUrl, displayUrl } = require('./app-urls');
const { ENGINES, engineOf, looksLikeUrl, searchUrl, suggest } = require('./omnibox');

const ROW_H = 40;
let win = null;
let items = [];
let selected = 0;
let lastQuery = '';

const fromToolbar = (e) => { const m = tabs.getWin(); return !!m && e.sender === m.webContents; };

function ensureWin() {
  if (win && !win.isDestroyed()) return win;
  const main = tabs.getWin();
  win = new BrowserWindow({
    parent: main, width: 600, height: 100, show: false, frame: false, focusable: false, resizable: false, movable: false,
    minimizable: false, maximizable: false, skipTaskbar: true, hasShadow: true, roundedCorners: true,
    webPreferences: { preload: path.join(__dirname, 'omnibox-preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false },
  });
  win.loadFile(path.join(__dirname, 'omnibox.html'));
  win.on('closed', () => { win = null; });
  return win;
}

function firstRow(text) {
  const engine = ENGINES[engineOf(loadConfig().searchEngine)];
  return looksLikeUrl(text)
    ? { type: 'go', title: text, url: normalizeUrl(text) }
    : { type: 'search', title: text, url: searchUrl(loadConfig().searchEngine, text), engine: engine.name };
}

function build(text) {
  const sources = {
    tabs: tabs.list().map(t => ({ id: t.id, url: displayUrl(tabs.rawUrl(t)), title: t.title })),
    bookmarks: bookmarksStore.live(bookmarks.snapshot()),
    history: history.snapshot(),
  };
  return [firstRow(text), ...suggest(text, sources, Date.now())].filter(r => r.url);
}

function hide() { if (win && !win.isDestroyed() && win.isVisible()) win.hide(); items = []; }

function show(text, rect) {
  const main = tabs.getWin();
  if (!main || !text.trim()) return hide();
  lastQuery = text;
  items = build(text);
  selected = 0;
  const w = ensureWin();
  const cb = main.getContentBounds();
  const r = rect || { x: 80, y: 40, w: 600, h: 34 };
  w.setBounds({ x: Math.round(cb.x + r.x), y: Math.round(cb.y + r.y + r.h + 2), width: Math.round(r.w), height: items.length * ROW_H + 8 });
  push();
  if (!w.isVisible()) w.showInactive();
}

function push() { if (win && !win.isDestroyed()) win.webContents.send('omni:items', { items, selected }); }

function open(item) {
  hide();
  if (item.type === 'tab' && tabs.tabOf(item.tabId)) tabs.activateTab(item.tabId);
  else if (tabs.wc()) tabs.load(tabs.wc(), item.url);
}

// Enter trong ô địa chỉ: chọn dòng gợi ý nếu danh sách còn khớp chữ đang gõ, không thì mở như thường
function go(text) {
  const row = items.length && text === lastQuery ? items[selected] : null;
  if (row) return open(row);
  hide();
  const w = tabs.wc();
  const row0 = text.trim() ? firstRow(text) : null;
  if (w && row0 && row0.url) tabs.load(w, row0.url);
}

ipcMain.on('omni:query', (e, text, rect) => { if (fromToolbar(e)) show(String(text || ''), rect); });
ipcMain.on('omni:hide', (e) => { if (fromToolbar(e)) hide(); });
ipcMain.on('omni:go', (e, text) => { if (fromToolbar(e)) go(String(text || '')); });
ipcMain.on('omni:key', (e, key) => {
  if (!fromToolbar(e) || !items.length) return;
  if (key === 'down') selected = (selected + 1) % items.length;
  else if (key === 'up') selected = (selected - 1 + items.length) % items.length;
  push();
});
ipcMain.on('omni:pick', (e, i) => {
  if (!win || win.isDestroyed() || e.sender !== win.webContents) return;
  if (items[i]) open(items[i]);
});

module.exports = { hide };
