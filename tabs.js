// Cửa sổ chính + các tab. Mỗi tab là một WebContentsView; chỉ tab đang xem nằm trong vùng nhìn thấy.
// Không gọi ngược lên lịch sử / menu / Bảng kiểm tra – các module đó nghe tabs.events:
//   'visit' (tab, url) · 'title' (tab, title) · 'changed' (vừa vẽ lại thanh tab) · 'window-closed'
//   'opened' (tab mới, tab mở ra nó, url) – popup / target=_blank · 'created' (tab vừa tạo, trước khi tải trang)
const { WebContentsView, Menu } = require('electron');
const path = require('path');
const { EventEmitter } = require('events');
const { loadConfig, saveConfig, homeUrl } = require('./config');
const { FLASH_PATH, FLASH_VERSION } = require('./flash/mode');
const { normalizeQuality } = require('./flash/quality');
const { HISTORY_URL, BOOKMARKS_URL, LAUNCHER_URL, displayUrl, isHistoryUrl, isBookmarksUrl, normalizeUrl, launcherUrlFor } = require('./app-urls');
const { addLog } = require('./inspect/store');
const flashRouter = require('./flash-engine/router');
const { popupFor } = require('./popup-policy');
const { blockedNavigation } = require('./nav-policy');
const { isCrash, crashedPageUrl, isCrashedPage } = require('./tab-crashed');

const TOOLBAR_BASE = 80; // thanh tab (36) + thanh địa chỉ (44)
const BOOKMARK_BAR_H = 32; // thanh dấu trang (bật / tắt được) nằm dưới thanh địa chỉ
let extraTop = 0;
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

// Địa chỉ thật của tab: tab ngủ / vừa khôi phục chưa nạp thì lấy địa chỉ đã nhớ, trang "Tab bị dừng" thì địa chỉ trang hỏng
function rawUrl(t) {
  const w = t.view.webContents;
  if (t.sleeping) return t.sleepUrl || '';
  if (w.isDestroyed()) return '';
  return t.crashedUrl && isCrashedPage(w.getURL()) ? t.crashedUrl : w.getURL();
}
const tabUrl = (t) => displayUrl(rawUrl(t));

function sendState() {
  if (!winOk() || !wc()) return;
  const w = wc();
  win.webContents.send('state', {
    url: tabUrl(activeTab()),
    canBack: w.navigationHistory.canGoBack(),
    canForward: w.navigationHistory.canGoForward(),
    loading: w.isLoading(),
    version: FLASH_VERSION,
    hasPlugin: !!FLASH_PATH,
    swfHint: !!(activeTab() && activeTab().swfHint), // trang có .swf mà chưa bật Flash
  });
}

const isInternalUrl = (u) => isHistoryUrl(u) || isBookmarksUrl(u); // trang nội bộ wisp:// (icon riêng trên thanh tab)

function tabInfo(t) {
  const w = t.view.webContents;
  const url = tabUrl(t);
  return { id: t.id, title: t.title || url || 'Tab mới', url, favicon: t.favicon || '', sleeping: !!t.sleeping,
           loading: !w.isDestroyed() && w.isLoading(), history: isInternalUrl(rawUrl(t)),
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

function toolbarHeight() { return TOOLBAR_BASE + extraTop; }
function setBookmarkBar(on) { extraTop = on ? BOOKMARK_BAR_H : 0; layout(); }

// Mọi tab luôn gắn vào cửa sổ, tab không xem được đẩy ra ngoài vùng nhìn thấy (giữ nguyên kích thước)
// để game / video vẫn chạy và vẽ bình thường, quay lại tab không phải dựng lại bề mặt vẽ.
function layout() {
  if (!winOk()) return;
  const [width, height] = win.getContentSize();
  for (const t of tabs) {
    if (t.view.webContents.isDestroyed()) continue;
    const top = t.htmlFull ? 0 : toolbarHeight(); // trình phát Flash bật toàn màn hình → ẩn thanh công cụ
    const x = t.id === activeId ? 0 : -(width + 100);
    t.view.setBounds({ x, y: top, width, height: height - top });
  }
}

function tabPrefs() {
  const quality = normalizeQuality(loadConfig().flashQuality);
  return {
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: false, // preload cần require('./ghosthand/agent') – chỉ preload, trang web không có Node
    // page-preload.js: cầu nối cho trang Lịch sử / trang chờ Flash + agent Ghosthand
    preload: path.join(__dirname, 'page-preload.js'),
    additionalArguments: ['--wisp-history=' + HISTORY_URL, '--wisp-bookmarks=' + BOOKMARKS_URL, '--wisp-launcher=' + LAUNCHER_URL, ...(quality ? ['--flash-quality=' + quality] : [])],
    // preload chạy trong mọi frame (kể cả iframe): agent Ghosthand ở frame khác nguồn
    nodeIntegrationInSubFrames: true,
  };
}

// Trang cấu hình Flash thật → tab hiện trang chờ có nút mở game ở cửa sổ engine Flash (flash/launcher.js). Còn lại tải ở tab.
function loadInTab(t, url) {
  const w = t.view.webContents;
  w.loadURL(flashRouter.wantsFlash(url) ? launcherUrlFor(url) : url).catch(() => {});
}

// lazy = { title }: tab của phiên cũ, chưa nạp trang tới khi bấm vào (tab-sleep.js)
function createTab(url, { activate = true, index = tabs.length, lazy = null } = {}) {
  const view = new WebContentsView({ webPreferences: tabPrefs() });
  const t = { id: ++tabSeq, view, title: '', favicon: '', htmlFull: false, hist: null, audible: false, muted: false, lastActive: Date.now() };
  if (lazy) { t.sleeping = true; t.sleepUrl = url; t.title = lazy.title || ''; }
  tabs.splice(Math.max(0, Math.min(index, tabs.length)), 0, t);
  // Game ở tab khác vẫn chạy bình thường (không bị Chromium hãm timer khi tab ẩn)
  view.webContents.setBackgroundThrottling(false);
  wireTab(t);
  events.emit('created', t);
  if (winOk()) win.contentView.addChildView(view);
  if (!lazy) loadInTab(t, url);
  if (activate) activateTab(t.id); else { layout(); sendTabs(); }
  return t;
}

// Tải địa chỉ vào webContents của một tab (mọi nơi ngoài tabs.js gọi hàm này, không loadURL trực tiếp – để trang Flash đi đúng engine)
function load(w, url) {
  const t = tabs.find(x => x.view.webContents === w);
  if (t) loadInTab(t, url); else w.loadURL(url).catch(() => {});
}

// Mở tab mới ngay bên phải tab đang xem
function openNextToActive(url) { return createTab(url, { index: tabs.indexOf(activeTab()) + 1 }); }

// Mở địa chỉ (người dùng gõ / từ lịch sử) trong tab đang xem
function openUrl(url) {
  const u = normalizeUrl(url);
  if (!u) return;
  if (activeTab()) loadInTab(activeTab(), u); else createTab(u);
}

function activateTab(id) {
  const t = tabOf(id);
  if (!t || !winOk()) return;
  const prev = activeTab();
  if (prev !== t) {
    if (prev) prev.lastActive = Date.now();
    activeId = t.id;
    win.contentView.addChildView(t.view); // thêm lại = đưa lên trên cùng
  }
  t.lastActive = Date.now();
  events.emit('activated', t); // tab-sleep.js nạp lại tab ngủ
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
  if (rawUrl(t)) {
    closedTabs.push({ url: rawUrl(t), index: i });
    if (closedTabs.length > CLOSED_MAX) closedTabs.shift();
  }
  tabs.splice(i, 1);
  events.emit('tab-closed', t);
  if (activeId === id) activeId = null;
  if (winOk()) win.contentView.removeChildView(t.view);
  try { w.close(); } catch {}
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
    { label: 'Nhân bản tab', click: () => createTab(rawUrl(t), { index: i + 1 }) },
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
  t.view.webContents.on('did-start-navigation', (d) => { if (d.isMainFrame && !d.isSameDocument) t.swfHint = false; }); // gợi ý .swf theo từng trang
  const w = t.view.webContents;
  const isActive = () => activeId === t.id;

  w.on('enter-html-full-screen', () => { t.htmlFull = true; if (isActive()) layout(); });
  w.on('leave-html-full-screen', () => { t.htmlFull = false; if (isActive()) layout(); });

  // Popup (window.open / target=_blank / Cmd+bấm link) → mở tab mới ngay bên phải
  w.setWindowOpenHandler(({ url, disposition, features }) => {
    if (blockedNavigation(w.getURL(), url)) return { action: 'deny' };
    const pop = popupFor({ url, disposition, features });
    if (pop.popup) return { action: 'allow', overrideBrowserWindowOptions: {
      width: pop.width, height: pop.height, autoHideMenuBar: true,
      webPreferences: { sandbox: false }, // cùng mức sandbox với tab (tabPrefs) thì popup mới giữ window.opener
    } };
    events.emit('opened', createTab(url, { index: tabs.indexOf(t) + 1, activate: disposition !== 'background-tab' }), t, url);
    return { action: 'deny' };
  });

  // Cửa sổ popup không tự mở thêm cửa sổ khác
  w.on('did-create-window', (child) => child.webContents.setWindowOpenHandler(() => ({ action: 'deny' })));

  ['did-navigate-in-page', 'did-start-loading', 'did-stop-loading'].forEach(ev => w.on(ev, () => { if (isActive()) sendState(); sendTabs(); }));
  // Bấm link / chuyển hướng sang trang Flash thật → trang chờ Flash trong tab này
  const toFlash = (e, url) => { if (/^https?:/i.test(url) && flashRouter.wantsFlash(url)) { e.preventDefault(); loadInTab(t, url); } };
  const noFile = (e, url) => { if (blockedNavigation(w.getURL(), url)) e.preventDefault(); };
  w.on('will-navigate', noFile);
  w.on('will-redirect', noFile);
  w.on('will-navigate', toFlash);
  w.on('will-redirect', toFlash);
  w.on('did-navigate', (_e, url) => {
    if (t.sleeping) return; // about:blank của tab ngủ
    if (!isCrashedPage(url)) t.crashedUrl = null;
    t.favicon = '';
    events.emit('navigated', t, url); // tải trang thật (khác 'visit': không gồm chuyển trang trong cùng trang)
    events.emit('visit', t, url);
    if (isActive()) sendState();
    sendTabs();
  });
  w.on('did-navigate-in-page', (_e, url, isMain) => { if (isMain) events.emit('visit', t, url); });
  w.on('page-title-updated', (_e, title) => {
    if (t.sleeping) return;
    t.title = title;
    events.emit('title', t, title);
    if (isActive()) updateTitle();
    sendTabs();
  });
  w.on('page-favicon-updated', (_e, favicons) => { t.favicon = favicons[0] || ''; events.emit('favicon', w.getURL(), t.favicon); sendTabs(); });
  w.on('did-fail-load', (_e, code, desc, url, isMain) => {
    if (isMain && code !== -3) console.warn('Lỗi tải trang', code, desc, url);
  });
  w.on('render-process-gone', (_e, d) => {
    if (!isCrash(d.reason) || t.sleeping) return;
    t.crashedUrl = rawUrl(t) || t.crashedUrl;
    w.loadURL(crashedPageUrl(t.crashedUrl || '', d.reason)).catch(() => {});
  });
  logTabEvents(w);
}

// Ghi lại console của trang + các sự kiện đáng chú ý cho Bảng kiểm tra
function logTabEvents(w) {
  // Electron mới: một đối tượng sự kiện mang đủ thông tin (level là chữ)
  w.on('console-message', (e) => {
    const level = e.level === 'warning' || e.level === 'error' ? e.level : e.level === 'debug' ? 'verbose' : 'info';
    addLog(level, 'console', e.message, e.sourceId ? `${e.sourceId}:${e.lineNumber}` : '');
  });
  w.on('did-start-navigation', (d) => { if (d.isMainFrame && !d.isSameDocument) addLog('info', 'event', 'Mở trang ' + displayUrl(d.url)); });
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
    // WebContentsView không tự huỷ theo cửa sổ → DevTools (detach) của tab vẫn còn,
    // Bảng kiểm tra / menu ⋮ cũng là cửa sổ riêng → đóng hết (qua 'window-closed') để app thoát hẳn
    tabs.forEach(t => {
      try { const v = t.view.webContents; if (!v.isDestroyed()) { v.closeDevTools(); v.close(); } } catch {}
    });
    win = null; tabs = []; activeId = null;
    events.emit('window-closed');
  });
}

// ---------- nhớ các tab đang mở để lần sau mở lại ----------
let lastSessionJson = '';
function saveSession(force = false) {
  if (!tabs.length) return;
  const live = tabs.filter(t => tabUrl(t));
  const data = { tabs: live.map(tabUrl), titles: live.map(t => t.title || ''), active: Math.max(0, tabs.indexOf(activeTab())) };
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
    const titles = Array.isArray(cfg.session.titles) ? cfg.session.titles : [];
    const active = Math.min(cfg.session.active || 0, saved.length - 1);
    // Tab không xem chỉ nạp khi bấm (http/https; trang nội bộ / Flash nạp luôn như trước)
    const lazyOk = (u) => /^https?:/i.test(u) && !flashRouter.wantsFlash(u) && cfg.lazyRestore !== false;
    saved.forEach((u, i) => createTab(u, { activate: false, lazy: i !== active && lazyOk(u) ? { title: titles[i] } : null }));
    activateTab(tabs[active].id);
  } else createTab(startUrl);
}

module.exports = {
  rawUrl, toolbarHeight, setBookmarkBar, events,
  winOk, getWin, list, getActiveId, tabOf, activeTab, wc, canReopen, toast,
  sendState, tabInfo, load, sendTabs, createTab, openNextToActive, openUrl, activateTab, closeTab,
  reopenClosedTab, cycleTab, newTab, focusUrlBar, toggleMute, tabMenu,
  attachWindow, saveSession, openStartTabs,
};
