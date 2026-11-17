// Lịch sử duyệt web (userData/history.json) + IPC cho trang Lịch sử (history.html).
// Phát history.events 'changed' để menu vẽ lại mục Lịch sử.
const { app, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { EventEmitter } = require('events');
const tabs = require('./tabs');
const { HISTORY_URL, displayUrl, isHistoryUrl, normalizeUrl } = require('./app-urls');

const HISTORY_MAX = 5000;
const events = new EventEmitter();
let history = null;   // [{ id, url, title, time }], cũ → mới
let histSeq = 0;
let histSaveTimer = null;

function historyPath() { return path.join(app.getPath('userData'), 'history.json'); }
function loadHistory() {
  if (history) return history;
  try { history = JSON.parse(fs.readFileSync(historyPath(), 'utf8')); } catch {}
  if (!Array.isArray(history)) history = [];
  history = history.filter(h => h && typeof h.url === 'string' && typeof h.time === 'number');
  for (const h of history) if (typeof h.id === 'number') histSeq = Math.max(histSeq, h.id);
  for (const h of history) if (typeof h.id !== 'number') h.id = ++histSeq;
  return history;
}
function saveHistoryNow() {
  clearTimeout(histSaveTimer); histSaveTimer = null;
  if (!history) return;
  try { fs.writeFileSync(historyPath(), JSON.stringify(history)); } catch (e) { console.error('Không lưu được lịch sử:', e); }
}
function historyChanged() {
  if (!histSaveTimer) histSaveTimer = setTimeout(saveHistoryNow, 1000);
  for (const t of tabs.list()) {
    const w = t.view.webContents;
    if (!w.isDestroyed() && isHistoryUrl(w.getURL())) w.send('history:changed');
  }
  events.emit('changed');
}

function recordVisit(t, rawUrl) {
  const url = displayUrl(rawUrl);
  if (!/^(https?|file):/i.test(url) || isHistoryUrl(rawUrl)) return;
  const h = loadHistory();
  const now = Date.now();
  const last = h[h.length - 1];
  // Tải lại / đổi #hash cùng một trang trong vòng 1 phút thì chỉ cập nhật giờ, không thêm dòng mới
  if (last && last.url === url && now - last.time < 60000) {
    last.time = now;
    t.hist = last;
  } else {
    t.hist = { id: ++histSeq, url, title: '', time: now };
    h.push(t.hist);
    if (h.length > HISTORY_MAX) h.splice(0, h.length - HISTORY_MAX);
  }
  historyChanged();
}

tabs.events.on('visit', recordVisit);
tabs.events.on('title', (t, title) => {
  if (t.hist && t.hist.url === displayUrl(t.view.webContents.getURL()) && t.hist.title !== title) { t.hist.title = title; historyChanged(); }
});

// Các trang khác nhau gần đây nhất (menu Lịch sử, menu ⋮)
function recentHistory(n = 15) {
  const recent = [];
  const seen = new Set();
  const hist = loadHistory();
  for (let i = hist.length - 1; i >= 0 && recent.length < n; i--) {
    if (seen.has(hist[i].url)) continue;
    seen.add(hist[i].url);
    recent.push(hist[i]);
  }
  return recent;
}

async function clearHistoryDialog() {
  const { response } = await dialog.showMessageBox(tabs.getWin(), {
    type: 'question', message: 'Xoá lịch sử duyệt web',
    detail: 'Chỉ xoá danh sách trang đã xem. Cookie và đăng nhập vẫn giữ nguyên.',
    buttons: ['Giờ vừa qua', 'Hôm nay', 'Toàn bộ', 'Huỷ'], defaultId: 0, cancelId: 3,
  });
  if (response === 3) return false;
  const since = response === 0 ? Date.now() - 3600e3 : response === 1 ? new Date().setHours(0, 0, 0, 0) : 0;
  history = loadHistory().filter(h => since && h.time < since);
  for (const t of tabs.list()) t.hist = null;
  historyChanged();
  return true;
}

function openHistory() {
  const t = tabs.list().find(x => !x.view.webContents.isDestroyed() && isHistoryUrl(x.view.webContents.getURL()));
  if (t) tabs.activateTab(t.id);
  else tabs.openNextToActive(HISTORY_URL);
}

function fromHistoryPage(e) { try { return isHistoryUrl(e.sender.getURL()); } catch { return false; } }
ipcMain.handle('history:list', (e) => fromHistoryPage(e) ? loadHistory().slice().reverse() : []);
ipcMain.handle('history:open', (e, url, inNewTab) => {
  if (!fromHistoryPage(e) || !/^(https?|file):/i.test(String(url))) return;
  const u = normalizeUrl(url);
  if (!u) return;
  if (inNewTab) {
    const all = tabs.list();
    const t = all.find(x => x.view.webContents === e.sender);
    tabs.createTab(u, { index: t ? all.indexOf(t) + 1 : all.length, activate: false });
  } else tabs.load(e.sender, u);
});
ipcMain.handle('history:remove', (e, ids) => {
  if (!fromHistoryPage(e) || !Array.isArray(ids)) return;
  const del = new Set(ids);
  history = loadHistory().filter(h => !del.has(h.id));
  for (const t of tabs.list()) if (t.hist && del.has(t.hist.id)) t.hist = null;
  historyChanged();
});
ipcMain.handle('history:clear', (e) => fromHistoryPage(e) ? clearHistoryDialog() : false);

module.exports = { events, saveHistoryNow, recentHistory, clearHistoryDialog, openHistory };
