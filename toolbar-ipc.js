// IPC từ thanh công cụ (toolbar.html): điều hướng, thanh tab, mở menu ⋮ / Bảng kiểm tra.
const { ipcMain } = require('electron');
const updater = require('./updater');
const tabs = require('./tabs');
const { openHistory } = require('./history');
const { saveConfig, homeUrl } = require('./config');
const { normalizeUrl } = require('./app-urls');
const { MODE } = require('./flash/mode');
const { checkFlash } = require('./flash/actions');
const { askForFlashPlugin } = require('./flash/install');
const { openInspector } = require('./inspect/window');
const { showMainMenu } = require('./menu-popup');

function fromToolbar(e) { const win = tabs.getWin(); return !!win && e.sender === win.webContents; }

ipcMain.on('nav', (_e, action, arg) => {
  const w = tabs.wc();
  if (!w) return;
  if (action === 'go') { const u = normalizeUrl(arg); if (u) w.loadURL(u).catch(() => {}); }
  else if (action === 'back') { if (w.canGoBack()) w.goBack(); }
  else if (action === 'forward') { if (w.canGoForward()) w.goForward(); }
  else if (action === 'reload') { w.isLoading() ? w.stop() : w.reload(); }
  else if (action === 'home') { w.loadURL(homeUrl()).catch(() => {}); }
  else if (action === 'sethome') { saveConfig({ url: w.getURL() }); }
  else if (action === 'inspect') { openInspector(); }
  else if (action === 'history') { openHistory(); }
  else if (action === 'update') { updater.promptUpdate(true); }
  else if (action === 'flash') { if (MODE !== 'flash') askForFlashPlugin(); else checkFlash(); }
});
ipcMain.on('menu', (e, x, y) => { if (fromToolbar(e)) showMainMenu(x, y); });
ipcMain.on('open-inspector', (e, tab) => { if (fromToolbar(e)) openInspector(tab); });
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
  if (win) win.webContents.send('update', updater.state());
});
