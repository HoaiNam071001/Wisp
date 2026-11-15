// Ping máy chủ game: lấy các kết nối TCP của game (không phải cổng 80/443) rồi đo ping ICMP;
// máy chủ chặn ICMP thì đo thời gian mở kết nối TCP tới đúng cổng game (thưa hơn, 10 giây / lần).
const net = require('net');
const { execFile } = require('child_process');
const { sockets, addLog } = require('./inspect/store');

const IS_WIN = process.platform === 'win32';
const SAMPLES_KEEP = 180;
const pingTargets = new Map();    // "host:port" → { key, host, port, mode, icmpOk, fails, samples, busy, next, lastLive, live }

function splitHostPort(addr) {
  const i = addr.lastIndexOf(':');
  return [addr.slice(0, i).replace(/^\[|\]$/g, ''), Number(addr.slice(i + 1))];
}

function clearPings() { pingTargets.clear(); }

function pingSummary() {
  // máy chủ game đang kết nối, mẫu ping gần nhất
  let best = null;
  for (const p of pingTargets.values()) {
    if (!p.live || !p.samples.length) continue;
    if (!best || p.lastLive > best.lastLive) best = p;
  }
  if (!best) return null;
  const recent = best.samples.slice(-15);
  const ok = recent.filter(s => s.ms != null);
  return {
    host: best.host, port: best.port, mode: best.mode,
    ms: recent[recent.length - 1].ms,
    avg: ok.length ? Math.round(ok.reduce((a, s) => a + s.ms, 0) / ok.length) : null,
    loss: Math.round(100 * (recent.length - ok.length) / recent.length),
  };
}

function pingList() {
  return [...pingTargets.values()].map(p => ({ key: p.key, host: p.host, port: p.port, mode: p.mode, live: p.live, samples: p.samples }));
}

function updatePingTargets() {
  const now = Date.now();
  for (const s of sockets.values()) {
    if (s.end || s.port === 80 || s.port === 443 || !s.states.includes('ESTABLISHED')) continue;
    const [host, port] = splitHostPort(s.remote);
    if (!host || /^(127\.|::1$|localhost)/.test(host)) continue;
    const key = `${host}:${port}`;
    let p = pingTargets.get(key);
    if (!p) {
      p = { key, host, port, mode: 'icmp', icmpOk: false, fails: 0, samples: [], busy: false, next: 0, lastLive: now, live: true };
      pingTargets.set(key, p);
      addLog('info', 'perf', `Theo dõi ping máy chủ game ${key}`);
    }
    p.lastLive = now;
  }
  for (const [k, p] of pingTargets) {
    p.live = now - p.lastLive < 5000;
    if (now - p.lastLive > 10 * 60000) pingTargets.delete(k);
  }
}

function pingOnce(p) {
  if (p.busy) return;
  p.busy = true;
  const record = (ms) => {
    p.busy = false;
    p.samples.push({ t: Date.now(), ms });
    if (p.samples.length > SAMPLES_KEEP) p.samples.shift();
  };
  if (p.mode === 'icmp') {
    p.next = Date.now() + 2000;
    const [cmd, args] = IS_WIN ? ['ping', ['-n', '1', '-w', '1500', p.host]] : ['/sbin/ping', ['-n', '-c', '1', '-W', '1500', p.host]];
    execFile(cmd, args, { timeout: 3000, windowsHide: true }, (_err, out) => {
      // Windows có thể in tiếng địa phương ("thời gian=12ms") → chỉ dựa vào "=12ms" / "<1ms"
      const m = (IS_WIN ? /[=<]\s*([\d.]+)\s*ms\b/i : /time[=<]([\d.]+)\s*ms/).exec(String(out || ''));
      if (m) { p.icmpOk = true; p.fails = 0; return record(Math.round(Number(m[1]))); }
      if (!p.icmpOk && ++p.fails >= 2) {
        // máy chủ chặn ICMP → đo bằng thời gian mở kết nối TCP tới cổng game
        p.busy = false; p.mode = 'tcp'; p.next = 0;
        addLog('info', 'perf', `${p.host} không trả lời ping ICMP → đo bằng thời gian nối TCP tới cổng ${p.port} (10 giây / lần)`);
        return;
      }
      if (p.icmpOk) record(null); else p.busy = false;
    });
  } else {
    p.next = Date.now() + 10000;
    const t0 = Date.now();
    const sock = net.connect({ host: p.host, port: p.port });
    let done = false;
    const fin = (ms) => { if (done) return; done = true; sock.destroy(); record(ms); };
    sock.setTimeout(3000, () => fin(null));
    sock.on('connect', () => fin(Date.now() - t0));
    sock.on('error', () => fin(null));
  }
}

// Gọi mỗi 2 giây từ perf.js
function pingTick() {
  const now = Date.now();
  updatePingTargets();
  for (const p of pingTargets.values()) if (p.live && now >= p.next) pingOnce(p);
}

module.exports = { pingTick, pingSummary, pingList, clearPings };
