// Cửa sổ chính + các tab. Mỗi tab là một BrowserView; chỉ tab đang xem nằm trong vùng nhìn thấy.
// Không gọi ngược lên lịch sử / menu / Bảng kiểm tra – các module đó nghe tabs.events:
//   'visit' (tab, url) · 'title' (tab, title) · 'changed' (vừa vẽ lại thanh tab) · 'window-closed'
//   'opened' (tab mới, tab mở ra nó, url) – popup / target=_blank · 'created' (tab vừa tạo, trước khi tải trang)
const { BrowserView, Menu, dialog } = require('electron');
const path = require('path');
const { EventEmitter } = require('events');
const { loadConfig, saveConfig, homeUrl } = require('./config');
const { MODE, FLASH_VERSION, wantedMode } = require('./flash/mode');
const { HISTORY_URL, displayUrl, isHistoryUrl, normalizeUrl } = require('./app-urls');
const { addLog } = require('./inspect/store');

const TOOLBAR_HEIGHT = 80; // thanh tab (36) + thanh địa chỉ (44)
const CLOSED_MAX = 25;
const events = new EventEmitter();
let win = null;
let tabs = [];                  // { id, view, title, favicon, htmlFull, hist, audible, muted }
let activeId = null;
let tabSeq = 0;
const closedTabs = [];          // tab vừa đóng, để Shift+Cmd+T mở lại

function winOk() { return win && !win.isDestroyed(); }
function getWin() { return winOk() ? win : null; }
function list() { return tabs; }
function getActiveId() { return activeId; }
function tabOf(id) { return tabs.find(t => t.id === id) || null; }
function activeTab() { return tabOf(activeId); }
function wc() {
  const t = activeTab();
  return t && !t.view.webContents.isDestroyed() ? t.view.webContents : null;
}
function canReopen() { return closedTabs.length > 0; }
function toast(text) { if (winOk()) win.webContents.send('toast', text); }

function sendState() {
  if (!winOk() || !wc()) return;
  const w = wc();
  win.webContents.send('state', {
    url: displayUrl(w.getURL()),
    canBack: w.canGoBack(),
    canForward: w.canGoForward(),
    loading: w.isLoading(),
    mode: MODE,
    version: FLASH_VERSION,
    wantedFlash: wantedMode === 'flash',
  });
}

function tabInfo(t) {
  const w = t.view.webContents;
  const url = w.isDestroyed() ? '' : displayUrl(w.getURL());
  return { id: t.id, title: t.title || url || 'Tab mới', url, favicon: t.favicon || '',
           loading: !w.isDestroyed() && w.isLoading(), history: isHistoryUrl(w.isDestroyed() ? '' : w.getURL()),
           audible: !!t.audible, muted: !!t.muted };
}

// Gom nhiều thay đổi (đang tải, đổi tiêu đề…) rồi mới vẽ lại thanh tab + menu Tab
let tabsTimer = null;
function sendTabs() {
  if (tabsTimer) return;
  tabsTimer = setTimeout(() => {
    tabsTimer = null;
    if (!winOk()) return;
    win.webContents.send('tabs', { tabs: tabs.map(tabInfo), active: activeId });
    events.emit('changed');
    if (loadConfig().restoreTabs !== false) saveSession();
  }, 30);
}

function updateTitle() {
  const t = activeTab();
  if (winOk()) win.setTitle((t && t.title ? t.title + ' — ' : '') + 'Wisp');
}

// Mọi tab luôn gắn vào cửa sổ: gỡ BrowserView ra rồi gắn lại làm Pepper Flash mất bề mặt vẽ
// (quay lại tab chỉ thấy màn hình trống). Tab không xem được đẩy ra ngoài vùng nhìn thấy,
// giữ nguyên kích thước để game vẫn chạy và vẽ bình thường.
function layout() {
  if (!winOk()) return;
  const [width, height] = win.getContentSize();
  for (const t of tabs) {
    if (t.view.webContents.isDestroyed()) continue;
    const top = t.htmlFull ? 0 : TOOLBAR_HEIGHT; // trình phát Flash bật toàn màn hình → ẩn thanh công cụ
    const x = t.id === activeId ? 0 : -(width + 100);
    t.view.setBounds({ x, y: top, width, height: height - top });
  }
}

function tabPrefs() {
  return {
    plugins: MODE === 'flash',
    contextIsolation: true,
    nodeIntegration: false,
    worldSafeExecuteJavaScript: true,
    // page-preload.js: chèn Ruffle (chế độ Ruffle) + cầu nối cho trang Lịch sử
    preload: path.join(__dirname, 'page-preload.js'),
    additionalArguments: ['--wisp-history=' + HISTORY_URL, ...(MODE === 'ruffle' ? ['--flash-mode=ruffle'] : [])],
    // preload chạy trong mọi frame (kể cả iframe): chèn Ruffle (chế độ Ruffle) + agent Ghosthand ở frame khác nguồn
    nodeIntegrationInSubFrames: true,
  };
}

function createTab(url, { activate = true, index = tabs.length } = {}) {
  const view = new BrowserView({ webPreferences: tabPrefs() });
  const t = { id: ++tabSeq, view, title: '', favicon: '', htmlFull: false, hist: null, audible: false, muted: false };
  tabs.splice(Math.max(0, Math.min(index, tabs.length)), 0, t);
  // Game ở tab khác vẫn chạy bình thường (không bị Chromium hãm timer khi tab ẩn)
  view.webContents.setBackgroundThrottling(false);
  wireTab(t);
  events.emit('created', t);
  if (winOk()) win.addBrowserView(view);
  view.webContents.loadURL(url).catch(() => {});
  if (activate) activateTab(t.id); else { layout(); sendTabs(); }
  return t;
}

// Mở tab mới ngay bên phải tab đang xem
function openNextToActive(url) { return createTab(url, { index: tabs.indexOf(activeTab()) + 1 }); }

// Mở địa chỉ (người dùng gõ / từ lịch sử) trong tab đang xem
function openUrl(url) {
  const u = normalizeUrl(url);
  if (!u) return;
  if (wc()) wc().loadURL(u).catch(() => {}); else createTab(u);
}

function activateTab(id) {
  const t = tabOf(id);
  if (!t || !winOk()) return;
  const prev = activeTab();
  if (prev !== t) {
    activeId = t.id;
    win.setTopBrowserView(t.view);
  }
  layout();
  t.view.webContents.focus();
  updateTitle();
  sendState();
  sendTabs();
}

function closeTab(id) {
  const i = tabs.findIndex(t => t.id === id);
  if (i < 0) return;
  const t = tabs[i];
  const w = t.view.webContents;
  if (!w.isDestroyed() && w.getURL()) {
    closedTabs.push({ url: w.getURL(), index: i });
    if (closedTabs.length > CLOSED_MAX) closedTabs.shift();
  }
  tabs.splice(i, 1);
  if (activeId === id) activeId = null;
  if (winOk()) win.removeBrowserView(t.view);
  try { w.destroy(); } catch {}
  // Đóng tab cuối cùng thì mở tab trang chủ thay vì tắt app (tránh lỡ tay thoát game)
  if (!tabs.length) { createTab(homeUrl()); return; }
  if (activeId === null) activateTab(tabs[Math.min(i, tabs.length - 1)].id);
  else sendTabs();
}

function reopenClosedTab() {
  const c = closedTabs.pop();
  if (c) createTab(c.url, { index: c.index });
}

function cycleTab(step) {
  if (tabs.length < 2) return;
  const i = tabs.findIndex(t => t.id === activeId);
  activateTab(tabs[(i + step + tabs.length) % tabs.length].id);
}

function newTab() {
  createTab(homeUrl());
  focusUrlBar();
}

function focusUrlBar() {
  if (!winOk()) return;
  win.webContents.focus();
  win.webContents.executeJavaScript("document.getElementById('url').select()").catch(() => {});
}

function toggleMute(id) {
  const t = tabOf(id);
  if (!t) return;
  t.muted = !t.muted;
  t.view.webContents.setAudioMuted(t.muted);
  sendTabs();
}

function tabMenu(id) {
  const t = tabOf(id);
  if (!t) return;
  const i = tabs.indexOf(t);
  Menu.buildFromTemplate([
    { label: 'Tải lại', click: () => t.view.webContents.reload() },
    { label: 'Nhân bản tab', click: () => createTab(t.view.webContents.getURL(), { index: i + 1 }) },
    { label: t.muted ? 'Bật tiếng tab' : 'Tắt tiếng tab', click: () => toggleMute(id) },
    { type: 'separator' },
    { label: 'Đóng tab', click: () => closeTab(id) },
    { label: 'Đóng các tab khác', enabled: tabs.length > 1, click: () => tabs.filter(x => x !== t).forEach(x => closeTab(x.id)) },
    { label: 'Đóng các tab bên phải', enabled: i < tabs.length - 1, click: () => tabs.slice(i + 1).forEach(x => closeTab(x.id)) },
    { type: 'separator' },
    { label: 'Mở lại tab vừa đóng', enabled: closedTabs.length > 0, click: reopenClosedTab },
  ]).popup({ window: win });
}

function wireTab(t) {
  const w = t.view.webContents;
  const isActive = () => activeId === t.id;

  w.on('enter-html-full-screen', () => { t.htmlFull = true; if (isActive()) layout(); });
  w.on('leave-html-full-screen', () => { t.htmlFull = false; if (isActive()) layout(); });

  // Popup (window.open / target=_blank / Cmd+bấm link) → mở tab mới ngay bên phải
  w.on('new-window', (e, url, _name, disposition) => {
    e.preventDefault();
    events.emit('opened', createTab(url, { index: tabs.indexOf(t) + 1, activate: disposition !== 'background-tab' }), t, url);
  });

  ['did-navigate-in-page', 'did-start-loading', 'did-stop-loading'].forEach(ev => w.on(ev, () => { if (isActive()) sendState(); sendTabs(); }));
  w.on('did-navigate', (_e, url) => {
    t.favicon = '';
    events.emit('visit', t, url);
    if (isActive()) sendState();
    sendTabs();
  });
  w.on('did-navigate-in-page', (_e, url, isMain) => { if (isMain) events.emit('visit', t, url); });
  w.on('page-title-updated', (_e, title) => {
    t.title = title;
    events.emit('title', t, title);
    if (isActive()) updateTitle();
    sendTabs();
  });
  w.on('page-favicon-updated', (_e, favicons) => { t.favicon = favicons[0] || ''; sendTabs(); });
  w.on('did-fail-load', (_e, code, desc, url, isMain) => {
    if (isMain && code !== -3) console.warn('Lỗi tải trang', code, desc, url);
  });
  w.on('plugin-crashed', (_e, name, version) => {
    addLog('error', 'event', `Plugin ${name} ${version} bị crash`);
    dialog.showMessageBox(win, { type: 'warning', message: `Plugin ${name} ${version} bị lỗi và đã dừng.`, detail: 'Bấm Tải lại (Cmd+R) để thử lại.' });
  });
  logTabEvents(w);
}

// Ghi lại console của trang + các sự kiện đáng chú ý cho Bảng kiểm tra
const LEVELS = ['verbose', 'info', 'warning', 'error'];
function logTabEvents(w) {
  w.on('console-message', (_e, level, message, line, sourceId) => {
    addLog(LEVELS[level] || 'info', 'console', message, sourceId ? `${sourceId}:${line}` : '');
  });
  w.on('did-start-navigation', (_e, url, inPage, isMain) => { if (isMain && !inPage) addLog('info', 'event', 'Mở trang ' + displayUrl(url)); });
  w.on('did-fail-load', (_e, code, desc, url, isMain) => {
    if (code !== -3) addLog('error', 'event', `Tải ${isMain ? 'trang' : 'frame'} lỗi ${code} ${desc}`, url);
  });
  w.on('render-process-gone', (_e, d) => addLog('error', 'event', `Tiến trình trang bị dừng: ${d.reason} (exit ${d.exitCode})`));
  w.on('unresponsive', () => addLog('warning', 'event', 'Trang bị treo (không phản hồi)'));
  w.on('responsive', () => addLog('info', 'event', 'Trang phản hồi lại'));
}

// Gắn cửa sổ chính (main.js tạo) vào phần quản lý tab
function attachWindow(w) {
  win = w;
  win.on('resize', layout);
  // Nhớ tab trước khi cửa sổ đóng (sau 'closed' danh sách tab đã bị xoá)
  win.on('close', () => { if (loadConfig().restoreTabs !== false) saveSession(); });
  win.on('closed', () => {
    // BrowserView không tự huỷ theo cửa sổ → DevTools (detach) của tab vẫn còn,
    // Bảng kiểm tra / menu ⋮ cũng là cửa sổ riêng → đóng hết (qua 'window-closed') để app thoát hẳn
    tabs.forEach(t => {
      try { const v = t.view.webContents; if (!v.isDestroyed()) { v.closeDevTools(); v.destroy(); } } catch {}
    });
    win = null; tabs = []; activeId = null;
    events.emit('window-closed');
  });
}

// ---------- nhớ các tab đang mở để lần sau mở lại ----------
let lastSessionJson = '';
function saveSession(force = false) {
  if (!tabs.length) return;
  const urls = tabs.map(t => t.view.webContents.isDestroyed() ? '' : displayUrl(t.view.webContents.getURL())).filter(Boolean);
  const data = { tabs: urls, active: Math.max(0, tabs.indexOf(activeTab())) };
  const json = JSON.stringify(data);
  if (!force && json === lastSessionJson) return;
  lastSessionJson = json;
  saveConfig({ session: data });
}

// Tab lúc mở app: địa chỉ được chỉ định (explicit) thì mở nó, không thì mở lại các tab lần trước
function openStartTabs(startUrl, explicit) {
  const cfg = loadConfig();
  const saved = cfg.session && Array.isArray(cfg.session.tabs) ? cfg.session.tabs.map(normalizeUrl).filter(Boolean) : [];
  if (!explicit && cfg.restoreTabs !== false && saved.length) {
    saved.forEach((u) => createTab(u, { activate: false }));
    activateTab(tabs[Math.min(cfg.session.active || 0, tabs.length - 1)].id);
  } else createTab(startUrl);
}

module.exports = {
  TOOLBAR_HEIGHT, events,
  winOk, getWin, list, getActiveId, tabOf, activeTab, wc, canReopen, toast,
  sendState, tabInfo, sendTabs, createTab, openNextToActive, openUrl, activateTab, closeTab,
  reopenClosedTab, cycleTab, newTab, focusUrlBar, toggleMute, tabMenu,
  attachWindow, saveSession, openStartTabs,
};
