// Phía vỏ app: trang cấu hình Flash thật → mở ở engine Flash (Electron 11, tiến trình riêng).
// Không require tabs: engine báo 'leave' (trang đi ra ngoài trang Flash) qua events, main.js nối sang tabs.
const { app } = require('electron');
const path = require('path');
const { EventEmitter } = require('events');
const { EngineClient } = require('./client');
const { launchFor } = require('./launch');
const { engineUserData, writeMmsCfg } = require('../flash/mms-cfg');
const { flashSites, loadConfig } = require('../config');
const { FLASH_PATH, FLASH_VERSION } = require('../flash/mode');
const { engineForUrl } = require('../flash/engine-pick');
const { addLog } = require('../inspect/store');

const events = new EventEmitter(); // 'closed' (cửa sổ Flash đóng), 'leave' (url)
let client = null;
let stopping = false; // đang thoát app: không báo 'closed' (tab không bị đóng theo)

// Dev: Electron 11 cài như gói electron-flash. Bản đóng gói: Resources/game (extraResources).
function engineElectronPath() {
  if (!app.isPackaged) return require('electron-flash');
  const dir = path.join(process.resourcesPath, 'game');
  return process.platform === 'darwin' ? path.join(dir, 'Electron.app', 'Contents', 'MacOS', 'Electron') : path.join(dir, 'electron.exe');
}

function wantsFlash(url) { return engineForUrl(url) === 'flash'; }

function domains() { return flashSites().filter((s) => s.engine === 'flash').map((s) => s.domain); }

async function ensure() {
  if (client && client.running) return client;
  writeMmsCfg();
  client = new EngineClient(launchFor({
    electronPath: engineElectronPath(), userData: engineUserData(), pluginPath: FLASH_PATH, pluginVersion: FLASH_VERSION,
  }));
  client.on('leave', (d) => events.emit('leave', d.url));
  client.on('closed', () => { if (!stopping) events.emit('closed'); });
  client.on('flash', (d) => addLog('info', 'event', 'Engine Flash: ' + (d.plugin || 'không thấy plugin Flash')));
  client.on('exit', () => addLog('warning', 'event', 'Engine Flash đã thoát'));
  await client.start();
  if (pendingCookies) { const l = pendingCookies; pendingCookies = null; await client.request('setCookies', { cookies: l }).catch(() => {}); }
  return client;
}

async function open(url) {
  try {
    const c = await ensure();
    await c.request('open', { url, domains: domains(), keyRemap: loadConfig().keyRemap });
  } catch (e) {
    addLog('error', 'event', 'Không mở được engine Flash: ' + e.message);
    events.emit('leave', url); // dự phòng: mở ở engine web (Flash không chạy nhưng thấy trang)
  }
}

// Khung game trên màn hình ({screenRect: {x, y, width, height}, state}) – engine trừ thanh công cụ. Chưa mở cửa sổ → no_tab.
function frameRect() {
  if (!client || !client.running) return Promise.reject(Object.assign(new Error('chưa mở cửa sổ engine Flash'), { code: 'no_tab' }));
  return client.request('frameRect');
}

function game(action, size) {
  if (!client || !client.running) return Promise.reject(Object.assign(new Error('chưa mở cửa sổ engine Flash'), { code: 'no_tab' }));
  return client.request('game', Object.assign({ action }, size));
}

// Cấu hình đổi phím vừa lưu → báo engine đang chạy (engine mới mở nhận qua 'open')
function syncKeyRemap() {
  if (client && client.running) client.request('keyRemap', { keyRemap: loadConfig().keyRemap }).catch(() => {});
}

// Phiên game (đồng bộ Drive): đọc cookie khi engine đang chạy (chưa chạy → null, vỏ app bỏ qua phần này);
// nạp: engine chưa chạy thì giữ lại, nạp ngay sau khi engine khởi động (ensure)
let pendingCookies = null;
function cookies(domains) {
  if (!client || !client.running) return Promise.resolve(null);
  return client.request('cookies', { domains }).then((r) => r.cookies);
}
function setCookies(list) {
  if (!client || !client.running) { pendingCookies = list; return Promise.resolve(); }
  return client.request('setCookies', { cookies: list }).then(() => {});
}

function close() { return client && client.running ? client.request('close').catch(() => {}) : Promise.resolve(); }

function stop() { stopping = true; return client ? client.stop() : Promise.resolve(); }

module.exports = { events, wantsFlash, open, frameRect, game, cookies, setCookies, syncKeyRemap, close, stop };
