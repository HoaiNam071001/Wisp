// IPC từ thanh công cụ (toolbar.html): điều hướng, thanh tab, mở menu ⋮ / Bảng kiểm tra.
const { ipcMain } = require('electron');
const updater = require('./updater');
const tabs = require('./tabs');
const { openHistory } = require('./history');
const { saveConfig, homeUrl } = require('./config');
const { normalizeUrl } = require('./app-urls');
const { openInspector } = require('./inspect/window');
const { showMainMenu } = require('./menu-popup');
const ghosthand = require('./ghosthand/server');
const tasks = require('./progress-tasks');

// Vòng tiến độ ở thanh công cụ + thanh tiến độ trên Dock / taskbar (fraction null = chưa biết → quay, 2 = không xác định)
tasks.events.on('changed', (sum) => {
  const win = tabs.getWin();
  if (!win) return;
  win.webContents.send('tasks', sum);
  win.setProgressBar(!sum ? -1 : sum.fraction == null ? 2 : sum.fraction);
});

function fromToolbar(e) { const win = tabs.getWin(); return !!win && e.sender === win.webContents; }

ipcMain.on('nav', (_e, action, arg) => {
  const w = tabs.wc();
  if (!w) return;
  if (action === 'go') { const u = normalizeUrl(arg); if (u) tabs.load(w, u); }
  else if (action === 'back') { if (w.navigationHistory.canGoBack()) w.navigationHistory.goBack(); }
  else if (action === 'forward') { if (w.navigationHistory.canGoForward()) w.navigationHistory.goForward(); }
  else if (action === 'reload') { w.isLoading() ? w.stop() : w.reload(); }
  else if (action === 'home') { tabs.load(w, homeUrl()); }
  else if (action === 'sethome') { saveConfig({ url: w.getURL() }); }
  else if (action === 'inspect') { openInspector(); }
  else if (action === 'history') { openHistory(); }
  else if (action === 'update') { updater.promptUpdate(true); }
});
ipcMain.on('menu', (e, x, y) => { if (fromToolbar(e)) showMainMenu(x, y); });
ipcMain.on('ghosthand-disconnect', (e) => { if (fromToolbar(e)) ghosthand.disconnect(); });
ipcMain.on('tab', (e, action, id) => {
  if (!fromToolbar(e)) return;
  if (action === 'new') tabs.newTab();
  else if (action === 'close') tabs.closeTab(id);
  else if (action === 'switch') tabs.activateTab(id);
  else if (action === 'menu') tabs.tabMenu(id);
  else if (action === 'mute') tabs.toggleMute(id);
});
ipcMain.on('ready', () => {
  tabs.sendState(); tabs.sendTabs();
  const win = tabs.getWin();
  if (win) { win.webContents.send('update', updater.state()); win.webContents.send('ghosthand', ghosthand.state()); win.webContents.send('tasks', tasks.summary()); }
});
