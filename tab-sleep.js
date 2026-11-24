// Tab ngủ (như Memory Saver của Chrome / Edge): tab nền lâu không dùng thì bỏ trang đang nạp để trả RAM,
// bấm vào thì nạp lại đúng địa chỉ. Cũng nạp tab "lười" của phiên cũ (tabs.createTab lazy).
// Tab chỉ đổi địa chỉ về about:blank – view giữ nguyên nên không đổi gì ở layout / cổng Ghosthand.
const tabs = require('./tabs');
const flashRouter = require('./flash-engine/router');
const { loadConfig } = require('./config');
const { addLog } = require('./inspect/store');
const { pickSleepers } = require('./tab-sleep-policy');

const CHECK_EVERY = 60000;
let timer = null;

function wake(t) {
  if (!t.sleeping) return;
  t.sleeping = false;
  t.lastActive = Date.now();
  tabs.load(t.view.webContents, t.sleepUrl);
  tabs.sendTabs();
}

function sleep(t) {
  const w = t.view.webContents;
  const url = tabs.rawUrl(t);
  t.sleeping = true;
  t.sleepUrl = url;
  w.loadURL('about:blank').catch(() => {});
  // Trang có beforeunload chưa lưu (form đang gõ…) từ chối rời đi → không coi là ngủ
  setTimeout(() => {
    if (!t.sleeping || w.isDestroyed() || w.getURL() === 'about:blank') return;
    t.sleeping = false;
    t.lastActive = Date.now();
  }, 2000);
  addLog('info', 'perf', 'Cho tab ngủ để trả RAM: ' + url);
  tabs.sendTabs();
}

function snapshot(t) {
  const w = t.view.webContents;
  const url = tabs.rawUrl(t);
  return {
    id: t.id, url, lastActive: t.lastActive, active: t.id === tabs.getActiveId(), audible: !!t.audible,
    loading: !w.isDestroyed() && w.isLoading(), sleeping: !!t.sleeping, htmlFull: !!t.htmlFull,
    devtools: !w.isDestroyed() && w.isDevToolsOpened(), wantsFlash: flashRouter.wantsFlash(url),
  };
}

function check() {
  const now = Date.now();
  const ids = pickSleepers(tabs.list().map(t => snapshot(t)), now, loadConfig());
  for (const id of ids) { const t = tabs.tabOf(id); if (t && !t.view.webContents.isDestroyed()) sleep(t); }
}

function init() {
  tabs.events.on('activated', wake);
  if (!timer) timer = setInterval(check, CHECK_EVERY);
}

module.exports = { init };
