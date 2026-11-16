// Phía vỏ app: mở / quản lý tiến trình engine Flash, gửi lệnh theo id, nhận sự kiện.
// Không require electron – nhận lệnh khởi chạy từ ngoài (dev: Electron 11 trong node_modules;
// bản đóng gói: Resources/game, xem bước 04) nên test được bằng tiến trình Node giả.
const { spawn } = require('child_process');
const { EventEmitter } = require('events');
const readline = require('readline');

const TIMEOUT_MS = 15000;

class EngineClient extends EventEmitter {
  // launch: {command, args, env}
  constructor(launch) {
    super();
    this.launch = launch;
    this.child = null;
    this.seq = 0;
    this.pending = new Map();
  }

  get running() { return !!this.child; }

  start() {
    if (this.child) return Promise.resolve();
    const env = Object.assign({}, process.env, this.launch.env);
    delete env.ELECTRON_RUN_AS_NODE; // có biến này Electron chạy như Node, không mở được cửa sổ
    const child = spawn(this.launch.command, this.launch.args || [], { env, stdio: ['pipe', 'pipe', 'inherit'] });
    this.child = child;
    readline.createInterface({ input: child.stdout }).on('line', (l) => this._line(l));
    child.stdin.on('error', () => {}); // engine chết giữa chừng: 'exit' lo phần dọn
    child.on('exit', (code) => this._exit(child, code));
    child.on('error', (e) => this._exit(child, null, e));
    return new Promise((resolve, reject) => {
      this.once('ready', resolve);
      this.once('exit', () => reject(new Error('engine thoát trước khi sẵn sàng')));
    });
  }

  _line(l) {
    let m;
    try { m = JSON.parse(l); } catch { return; }
    if (m.event) { this.emit(m.event, m.data); return; }
    const p = this.pending.get(m.id);
    if (!p) return;
    this.pending.delete(m.id);
    clearTimeout(p.timer);
    if (m.ok) p.resolve(m.result);
    else p.reject(Object.assign(new Error(m.error && m.error.detail || 'lỗi engine'), { code: m.error && m.error.code }));
  }

  _exit(child, code, err) {
    if (this.child !== child) return;
    this.child = null;
    for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(Object.assign(new Error('engine đã thoát'), { code: 'engine_exit' })); }
    this.pending.clear();
    this.emit('exit', { code, error: err && err.message });
  }

  request(cmd, args) {
    if (!this.child) return Promise.reject(Object.assign(new Error('engine chưa chạy'), { code: 'engine_exit' }));
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(Object.assign(new Error('engine không trả lời'), { code: 'timeout' }));
      }, TIMEOUT_MS);
      this.pending.set(id, { resolve, reject, timer });
      this.child.stdin.write(JSON.stringify(Object.assign({ id, cmd }, args)) + '\n');
    });
  }

  async stop() {
    if (!this.child) return;
    const child = this.child;
    const gone = new Promise((r) => child.once('exit', r));
    try { await this.request('quit'); } catch { child.kill(); }
    await Promise.race([gone, new Promise((r) => setTimeout(r, 3000))]);
    if (this.child === child) child.kill('SIGKILL');
  }
}

module.exports = { EngineClient };
