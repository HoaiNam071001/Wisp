// Cửa sổ Bảng kiểm tra (inspect.html): HTTP, socket TCP, console, hiệu năng, thông tin Flash + IPC của nó.
const { app, BrowserWindow, session, ipcMain, dialog, shell, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const tabs = require('../tabs');
const store = require('./store');
const { startSocketWatch } = require('./sockets');
const { probeTcp } = require('./probe');
const { perfPayload } = require('../perf');
const { openShotsDir } = require('../page-actions');
const { allowDomains } = require('../config');
const { FLASH_PATH, FLASH_VERSION } = require('../flash/mode');
const { mmsCfgPath } = require('../flash/mms-cfg');
const { pluginInfo } = require('../flash/actions');
const { displayUrl } = require('../app-urls');

const APP_DIR = path.join(__dirname, '..');
let inspectWin = null;
let netLogFile = null;
let netLogActive = false;

function inspectorOpen() { return inspectWin && !inspectWin.isDestroyed(); }

function openInspector(tab) {
  if (inspectorOpen()) {
    inspectWin.show(); inspectWin.focus();
    if (tab) inspectWin.webContents.send('inspect:tab', tab);
    return;
  }
  inspectWin = new BrowserWindow({
    width: 1100, height: 700, minWidth: 720, minHeight: 420, title: 'Bảng kiểm tra — Wisp', backgroundColor: '#1e1f22',
    webPreferences: { preload: path.join(APP_DIR, 'inspect-preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false },
  });
  store.setInspector(inspectWin.webContents);
  inspectWin.loadFile(path.join(APP_DIR, 'inspect.html'), tab ? { hash: tab } : undefined);
  inspectWin.on('closed', () => { inspectWin = null; store.setInspector(null); startSocketWatch(); });
  startSocketWatch();
}

tabs.events.on('window-closed', () => { if (inspectorOpen()) inspectWin.close(); });

async function flashInfo() {
  const w = tabs.wc();
  const plugin = await pluginInfo(w);
  let mms = '';
  try { mms = fs.readFileSync(mmsCfgPath(), 'utf8'); } catch (e) { mms = '(không đọc được: ' + e.message + ')'; }
  return {
    flashPath: FLASH_PATH, flashVersion: FLASH_VERSION, plugin,
    arch: process.arch, electron: process.versions.electron, chrome: process.versions.chrome,
    userAgent: w ? w.getUserAgent() : '', pageUrl: w ? displayUrl(w.getURL()) : '',
    mmsCfgPath: mmsCfgPath(), mmsCfg: mms, allowDomains: allowDomains(), seenSwfHosts: [...store.seenSwfHosts],
    netLogFile, netLogging: !!netLogFile && netLogActive,
  };
}

function netLogApi() { return session.defaultSession.netLog || require('electron').netLog; }
async function setNetLog(on) {
  const api = netLogApi();
  if (on && !netLogActive) {
    netLogFile = path.join(app.getPath('downloads'), `wisp-netlog-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    await api.startLogging(netLogFile, { captureMode: 'includeSensitive' });
    netLogActive = true;
    store.addLog('info', 'event', 'Bắt đầu ghi NetLog: ' + netLogFile);
  } else if (!on && netLogActive) {
    await api.stopLogging();
    netLogActive = false;
    store.addLog('info', 'event', 'Đã lưu NetLog: ' + netLogFile);
  }
  return { active: netLogActive, file: netLogFile };
}

async function saveReport() {
  const r = await dialog.showSaveDialog(inspectWin || tabs.getWin(), {
    defaultPath: path.join(app.getPath('downloads'), `wisp-bao-cao-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`),
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (r.canceled || !r.filePath) return null;
  const report = { createdAt: new Date().toISOString(), info: await flashInfo(), perf: perfPayload(),
                   http: [...store.httpLog.values()], sockets: [...store.sockets.values()], log: store.appLog };
  fs.writeFileSync(r.filePath, JSON.stringify(report, null, 2));
  shell.showItemInFolder(r.filePath);
  return r.filePath;
}

ipcMain.handle('inspect:snapshot', () => ({
  http: [...store.httpLog.values()], log: store.appLog, sock: [...store.sockets.values()],
}));
ipcMain.handle('inspect:clear', (_e, kind) => {
  if (kind === 'http') store.httpLog.clear();
  if (kind === 'log') store.appLog.length = 0;
  if (kind === 'sock') { for (const [k, s] of store.sockets) if (s.end) store.sockets.delete(k); }
});
ipcMain.handle('inspect:info', () => flashInfo());
ipcMain.handle('inspect:perf', () => perfPayload());
ipcMain.handle('inspect:shots', () => openShotsDir());
ipcMain.handle('inspect:probe', (_e, host, port, policy) => probeTcp(String(host || '').trim(), port, !!policy));
ipcMain.handle('inspect:devtools', () => { const w = tabs.wc(); if (w) w.openDevTools({ mode: 'detach' }); });
ipcMain.handle('inspect:copy', (_e, text) => clipboard.writeText(String(text)));
ipcMain.handle('inspect:reveal', (_e, p) => { if (p) shell.showItemInFolder(p); });
ipcMain.handle('inspect:netlog', (_e, on) => setNetLog(on));
ipcMain.handle('inspect:report', () => saveReport());

module.exports = { openInspector };
