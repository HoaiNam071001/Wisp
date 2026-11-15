// Kết nối TCP của mọi tiến trình Wisp (Flash nối qua tiến trình network) – đọc bằng lsof / netstat.
// DevTools không thấy socket của Flash, nên app tự đọc để hiện ở Bảng kiểm tra và đo ping máy chủ game.
const { app } = require('electron');
const { execFile } = require('child_process');
const { sockets, trimMap, addLog, scheduleFlush, socketChanged, inspectorOpen } = require('./store');
const { getLastProcs } = require('../perf');

const IS_WIN = process.platform === 'win32';
let sockTimer = null;
let sockBusy = false;

function procTypes() {
  const m = new Map();
  // dùng số liệu của perfTick: gọi getAppMetrics ở đây sẽ làm sai % CPU
  const last = getLastProcs();
  const procs = last.length ? last : app.getAppMetrics().map(p => ({ pid: p.pid, name: p.serviceName || p.name, type: p.type }));
  for (const p of procs) if (p.pid !== process.pid) m.set(p.pid, p.name || p.type);
  return m;
}

// Các kết nối TCP (không tính LISTEN) của những tiến trình pids → [{ pid, fd, name: "local->remote", state }]
// macOS: lsof; Windows: netstat -ano (không có fd, mỗi kết nối nhận diện bằng cặp địa chỉ)
function readSockets(pids, cb) {
  if (IS_WIN) {
    execFile('netstat', ['-ano'], { timeout: 4000, windowsHide: true, maxBuffer: 16 << 20 }, (_err, out) => {
      const want = new Set(pids);
      const list = [];
      for (const line of String(out || '').split(/\r?\n/)) {
        const c = line.trim().split(/\s+/);
        if (c.length < 5 || c[0].toUpperCase() !== 'TCP') continue;
        // TCP  <local>  <remote>  <trạng thái>  <PID>
        const pid = Number(c[4]);
        if (!want.has(pid) || /:0$/.test(c[2])) continue; // remote :0 = đang LISTEN
        list.push({ pid, fd: '', name: `${c[1]}->${c[2]}`, state: c[3] });
      }
      cb(list);
    });
    return;
  }
  execFile('lsof', ['-nP', '-a', '-iTCP', '-p', pids.join(','), '-F', 'pfnT'], { timeout: 4000 }, (_err, out) => {
    // lsof thoát mã 1 khi không có kết nối nào → vẫn xử lý như danh sách rỗng
    const list = [];
    let pid = 0, cur = null;
    const commit = () => { if (cur && cur.name && cur.name.includes('->')) list.push({ pid, ...cur }); cur = null; }; // bỏ socket đang LISTEN
    for (const line of String(out || '').split('\n')) {
      const t = line[0], v = line.slice(1);
      if (t === 'p') { commit(); pid = Number(v); }
      else if (t === 'f') { commit(); cur = { fd: v, name: '', state: '' }; }
      else if (t === 'n' && cur) cur.name = v;
      else if (t === 'T' && cur && v.startsWith('ST=')) cur.state = v.slice(3);
    }
    commit();
    cb(list);
  });
}

function isWeb(port) { return port === 443 || port === 80; }

function mergeSockets(list, types) {
  const now = Date.now();
  const seen = new Set();
  for (const cur of list) {
    const pid = cur.pid;
    const key = `${pid}:${cur.fd}:${cur.name}`;
    seen.add(key);
    const [local, remote] = cur.name.split('->');
    const port = Number(remote.slice(remote.lastIndexOf(':') + 1));
    let s = sockets.get(key);
    if (!s) {
      s = { key, pid, proc: types.get(pid) || '', local, remote, port, first: now, last: now, end: 0, states: [] };
      sockets.set(key, s);
      trimMap(sockets);
      if (!isWeb(port)) addLog('info', 'socket', `Mở kết nối TCP tới ${remote} (${cur.state || '?'})`);
    }
    s.last = now;
    if (cur.state && s.states[s.states.length - 1] !== cur.state) s.states.push(cur.state);
    socketChanged(s);
  }
  for (const s of sockets.values()) {
    if (!s.end && !seen.has(s.key)) {
      s.end = now;
      if (!isWeb(s.port)) {
        addLog(s.states.includes('ESTABLISHED') ? 'info' : 'warning', 'socket',
               `Đóng kết nối TCP tới ${s.remote} sau ${((now - s.first) / 1000).toFixed(1)}s (trạng thái: ${s.states.join(' → ') || '?'})`);
      }
      socketChanged(s);
    }
  }
  scheduleFlush();
}

function pollSockets() {
  if (sockBusy) return;
  const types = procTypes();
  const pids = [...types.keys()];
  if (!pids.length) return;
  sockBusy = true;
  readSockets(pids, (list) => { sockBusy = false; mergeSockets(list, types); });
}

// Luôn đọc mỗi 2s (để biết máy chủ game mà đo ping); Bảng kiểm tra đang mở thì đọc mỗi 0,4s.
// Gọi lại khi mở / đóng Bảng kiểm tra để đổi nhịp.
function startSocketWatch() {
  clearInterval(sockTimer);
  pollSockets();
  // netstat trên Windows chậm hơn lsof (đọc cả máy) → 1s khi bảng đang mở
  sockTimer = setInterval(pollSockets, inspectorOpen() ? (IS_WIN ? 1000 : 400) : 2000);
}

module.exports = { startSocketWatch };
