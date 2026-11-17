// Theo dõi hiệu năng: mỗi 2 giây CPU / RAM của từng tiến trình (tab, Flash, GPU…),
// gửi lên thanh công cụ và Bảng kiểm tra; mỗi 1 giây xem tab nào đang phát tiếng.
// Kèm chống App Nap (macOS hãm app bị che / thu nhỏ → game giật, rớt kết nối).
const { app, powerSaveBlocker } = require('electron');
const tabs = require('./tabs');
const { loadConfig } = require('./config');
const { addLog, inspector } = require('./inspect/store');
const { pingTick, pingSummary, pingList } = require('./ping');
const { shorten } = require('./util');

const PERF_EVERY = 2000;
const PERF_KEEP = 180;            // 6 phút
const perfHist = [];              // { t, cpu, mem, flashCpu, flashMem, tabCpu, tabMem }
let lastProcs = [];
let perfTimer = null;
let perfTicks = 0;
const warned = { flashCpu: 0, mem: 0, ping: 0 };

function getLastProcs() { return lastProcs; }

function collectProcs() {
  const byPid = new Map();
  for (const t of tabs.list()) {
    const w = t.view.webContents;
    if (!w.isDestroyed()) { const pid = w.getOSProcessId(); if (pid) byPid.set(pid, t); }
  }
  const ownPids = new Map();
  const win = tabs.getWin();
  if (win) ownPids.set(win.webContents.getOSProcessId(), 'Thanh công cụ');
  const insp = inspector();
  if (insp) ownPids.set(insp.getOSProcessId(), 'Bảng kiểm tra');
  return app.getAppMetrics().map(m => {
    const t = byPid.get(m.pid);
    let kind = m.type;
    if (m.type === 'Pepper Plugin') kind = 'Flash';
    else if (m.type === 'Browser') kind = 'Tiến trình chính';
    else if (t) kind = 'Tab';
    else if (ownPids.has(m.pid)) kind = ownPids.get(m.pid);
    else if (m.type === 'Utility' && /network/i.test(m.serviceName || m.name || '')) kind = 'Mạng';
    return {
      pid: m.pid, type: m.type, kind, name: m.serviceName || m.name || '',
      tabId: t ? t.id : null, tab: t ? tabs.tabInfo(t).title : '',
      cpu: Math.round((m.cpu.percentCPUUsage || 0) * 10) / 10,
      mem: Math.round((m.memory.workingSetSize || 0) / 1024), // MB
    };
  });
}

function checkAudio() {
  let changed = false;
  for (const t of tabs.list()) {
    const w = t.view.webContents;
    if (w.isDestroyed()) continue;
    const a = w.isCurrentlyAudible();
    if (a !== t.audible) { t.audible = a; changed = true; }
  }
  if (changed) tabs.sendTabs();
}

// cảnh báo (mỗi loại tối đa 1 lần / 5 phút)
function warnHeavy(point, procs, now) {
  const recent = perfHist.slice(-5);
  if (recent.length === 5 && recent.every(p => p.flashCpu >= 90) && now - warned.flashCpu > 300000) {
    warned.flashCpu = now;
    addLog('warning', 'perf', `Flash dùng ${point.flashCpu}% CPU liên tục 10 giây — máy có thể nóng / giật. Thử tắt bớt tab game hoặc giảm chất lượng trong game.`);
  }
  for (const p of procs) {
    if (p.kind === 'Tab' && p.mem > 1500 && now - warned.mem > 300000) {
      warned.mem = now;
      addLog('warning', 'perf', `Tab "${shorten(p.tab, 40)}" dùng ${p.mem} MB RAM — nếu game chậm dần, tải lại tab (Cmd+R).`);
    }
  }
}

function perfTick() {
  perfTicks++;
  checkAudio();
  if (perfTicks % 2) return;

  const procs = collectProcs();
  lastProcs = procs;
  const sum = (list, k) => list.reduce((a, p) => a + p[k], 0);
  const flash = procs.filter(p => p.kind === 'Flash');
  const active = tabs.activeTab();
  const tabProcs = procs.filter(p => active && p.tabId === active.id);
  const point = {
    t: Date.now(),
    cpu: Math.round(sum(procs, 'cpu')), mem: sum(procs, 'mem'),
    flashCpu: Math.round(sum(flash, 'cpu')), flashMem: sum(flash, 'mem'),
    tabCpu: Math.round(sum(tabProcs, 'cpu')), tabMem: sum(tabProcs, 'mem'),
  };
  perfHist.push(point);
  if (perfHist.length > PERF_KEEP) perfHist.shift();

  const now = Date.now();
  warnHeavy(point, procs, now);
  if (loadConfig().pingGame !== false) pingTick();
  const ping = pingSummary();
  if (ping && ping.loss >= 50 && now - warned.ping > 120000) {
    warned.ping = now;
    addLog('warning', 'perf', `Mất ${ping.loss}% gói ping tới máy chủ game ${ping.host} — mạng chập chờn, game dễ bị lag / rớt kết nối.`);
  }

  const insp = inspector();
  if (insp) insp.send('inspect:perf', perfPayload());
}

function perfPayload() {
  return { procs: lastProcs, hist: perfHist, pings: pingList(), appNap: napBlocker !== null };
}

function startPerf() {
  if (perfTimer) return;
  perfTimer = setInterval(perfTick, PERF_EVERY / 2);
}

// ---------- chống App Nap ----------
let napBlocker = null;
function applyAppNap() {
  const on = loadConfig().preventAppNap !== false;
  if (on && napBlocker === null) napBlocker = powerSaveBlocker.start('prevent-app-suspension');
  else if (!on && napBlocker !== null) { powerSaveBlocker.stop(napBlocker); napBlocker = null; }
}

module.exports = { startPerf, perfPayload, getLastProcs, applyAppNap };
