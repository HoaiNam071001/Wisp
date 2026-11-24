// Nhập dấu trang từ Chrome (đọc file Bookmarks của hồ sơ, chỉ đọc) hoặc từ file HTML. Phần phân tích ở chrome-bookmarks.js.
const { app, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const tabs = require('./tabs');
const bookmarks = require('./bookmarks');
const { fromChromeJson, fromHtml, mergeImported } = require('./chrome-bookmarks');

function chromeDir() {
  if (process.platform === 'darwin') return path.join(app.getPath('home'), 'Library', 'Application Support', 'Google', 'Chrome');
  if (process.platform === 'win32') return path.join(process.env.LOCALAPPDATA || path.join(app.getPath('home'), 'AppData', 'Local'), 'Google', 'Chrome', 'User Data');
  return path.join(app.getPath('home'), '.config', 'google-chrome');
}

function readJson(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } }

// → [{ dir, name, count }] các hồ sơ Chrome có dấu trang http(s)
function chromeProfiles() {
  const base = chromeDir();
  const names = ((readJson(path.join(base, 'Local State')) || {}).profile || {}).info_cache || {};
  const out = [];
  for (const dir of Object.keys(names)) {
    if (!/^(Default|Profile \d+)$/.test(dir)) continue; // chặn tên lạ → không thoát khỏi thư mục Chrome
    const j = readJson(path.join(base, dir, 'Bookmarks'));
    const count = j ? fromChromeJson(j).length : 0;
    if (count) out.push({ dir, name: String(names[dir].name || dir), count });
  }
  return out;
}

function addImported(imported) {
  const r = mergeImported(bookmarks.snapshot(), imported, Date.now());
  if (r.added) bookmarks.replaceAll(r.list);
  return { ok: true, added: r.added, skipped: imported.length - r.added };
}

function importChrome(dir) {
  if (!chromeProfiles().some(p => p.dir === dir)) return { ok: false, error: 'Không đọc được dấu trang của hồ sơ Chrome này.' };
  return addImported(fromChromeJson(readJson(path.join(chromeDir(), dir, 'Bookmarks'))));
}

async function importHtml() {
  const r = await dialog.showOpenDialog(tabs.getWin() || undefined, {
    title: 'Chọn file dấu trang (HTML)', properties: ['openFile'], filters: [{ name: 'Dấu trang HTML', extensions: ['html', 'htm'] }],
  });
  if (r.canceled || !r.filePaths[0]) return { ok: false, canceled: true };
  let html;
  try { html = fs.readFileSync(r.filePaths[0], 'utf8'); } catch (e) { return { ok: false, error: 'Không đọc được file: ' + e.message }; }
  const imported = fromHtml(html);
  if (!imported.length) return { ok: false, error: 'File không có dấu trang http / https nào.' };
  return addImported(imported);
}

ipcMain.handle('bookmarks:chrome-profiles', (e) => bookmarks.fromPage(e) ? chromeProfiles() : []);
ipcMain.handle('bookmarks:import-chrome', (e, dir) => bookmarks.fromPage(e) && typeof dir === 'string' ? importChrome(dir) : null);
ipcMain.handle('bookmarks:import-html', (e) => bookmarks.fromPage(e) ? importHtml() : null);
