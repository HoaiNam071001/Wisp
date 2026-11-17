// Cửa sổ Cài đặt → Flash: danh sách trang cấu hình Flash, plugin, mms.cfg, log allowlist.
const { BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { loadConfig, saveConfig, flashSites, saveFlashSites } = require('../config');
const { FLASH_PATH, FLASH_VERSION } = require('./mode');
const { userPluginPath } = require('./plugin');
const { mmsCfgPath, writeMmsCfg } = require('./mms-cfg');
const { askForFlashPlugin, choosePluginFile } = require('./install');
const siteConfig = require('./site-config');

const ROOT = path.join(__dirname, '..');
let win = null;

function openSettings() {
  if (win && !win.isDestroyed()) { win.show(); win.focus(); return; }
  win = new BrowserWindow({
    width: 560, height: 640, minWidth: 420, minHeight: 440, title: 'Cài đặt Flash',
    webPreferences: { preload: path.join(ROOT, 'flash-settings-preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(ROOT, 'flash-settings.html'));
}

const from = (e) => win && !win.isDestroyed() && e.sender === win.webContents;

function state() {
  return {
    sites: flashSites(),
    plugin: { path: FLASH_PATH || '', version: FLASH_VERSION || '' },
    debug: !!loadConfig().flashDebug,
  };
}

// Danh sách / log đổi → ghi lại mms.cfg (engine Flash đọc lúc nạp plugin → có hiệu lực khi mở lại tab Flash)
ipcMain.handle('fset:get', (e) => from(e) ? state() : null);
ipcMain.handle('fset:set', (e, { domain, engine }) => {
  if (!from(e)) return null;
  saveFlashSites(siteConfig.setSite(flashSites(), String(domain || ''), String(engine)));
  writeMmsCfg();
  return state();
});
ipcMain.handle('fset:debug', (e, on) => {
  if (!from(e)) return null;
  saveConfig({ flashDebug: !!on });
  writeMmsCfg();
  return state();
});
ipcMain.handle('fset:do', async (e, action) => {
  if (!from(e)) return null;
  if (action === 'install') await askForFlashPlugin();
  else if (action === 'choose') await choosePluginFile();
  else if (action === 'pluginDir') { const d = path.dirname(userPluginPath()); fs.mkdirSync(d, { recursive: true }); shell.openPath(d); }
  else if (action === 'mms') shell.showItemInFolder(mmsCfgPath());
  return state();
});

module.exports = { openSettings };
