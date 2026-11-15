// Tách plugin Flash khỏi file người dùng chọn / vừa tải – không chạy bộ cài của Adobe.
// macOS: .dmg → .app → .pkg → payload LZMA → PepperFlashPlayer.plugin.
// Windows: bộ cài .exe / .zip / thư mục → pepflashplayer64.dll.
// progress(text, fraction) báo tiến độ lên cửa sổ chính.
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const { promisify } = require('util');
const flashWin = require('../flash-win');
const { PLUGIN_NAME } = require('./plugin');

const execFileP = promisify(execFile);
const FLASH_WIN_JS = path.join(__dirname, '..', 'flash-win.js');

// Windows: tìm pepflashplayer64.dll trong file .dll / bộ cài .exe của Adobe / .zip / thư mục
const WIN_DLL = /^pepflashplayer(64)?(_[\d_]+)?\.dll$/i; // không nhận pepflashplayer32_… (bản 32-bit)
async function findPluginWin(p, work, depth, progress) {
  if (depth > 4 || !fs.existsSync(p)) return null;
  const st = fs.statSync(p);
  const ext = path.extname(p).toLowerCase();
  if (st.isFile() && ext === '.dll') return p;
  if (st.isFile() && ext === '.exe') {
    // fraction 2 (> 1) = thanh tiến độ chạy không xác định
    progress('Đang tách Flash Player khỏi bộ cài (khoảng 20–60 giây)…', 2);
    const out = path.join(fs.mkdtempSync(path.join(work, 'x')), PLUGIN_NAME);
    const r = await extractWinInstaller(p, out);
    if (r.error === 'notfound') return null;
    if (r.error) throw new Error(r.error);
    if (r.version) fs.writeFileSync(out.replace(/\.dll$/i, '.json'), JSON.stringify({ version: r.version }));
    return out;
  }
  if (st.isFile() && ext === '.zip') {
    const out = fs.mkdtempSync(path.join(work, 'x'));
    await flashWin.unzip(p, out);
    return findPluginWin(out, work, depth + 1, progress);
  }
  if (!st.isDirectory()) return null;
  const found = { dll: [], nested: [] };
  const walk = (dir, d) => {
    if (d > 6) return;
    let list = [];
    try { list = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of list) {
      const f = path.join(dir, e.name);
      if (e.isFile() && WIN_DLL.test(e.name)) found.dll.push(f);
      else if (e.isFile() && /\.(exe|zip)$/i.test(e.name)) found.nested.push(f);
      else if (e.isDirectory()) walk(f, d + 1);
    }
  };
  walk(p, 0);
  found.dll.sort((a, b) => /64/.test(path.basename(b)) - /64/.test(path.basename(a)));
  for (const f of [...found.dll, ...found.nested]) {
    const r = await findPluginWin(f, work, depth + 1, progress);
    if (r) return r;
  }
  return null;
}

// Tách DLL trong tiến trình riêng (flash-win.js chạy bằng Node của Electron): tốn vài GB RAM tạm thời
function extractWinInstaller(src, dest) {
  return new Promise((resolve) => {
    execFile(process.execPath, [FLASH_WIN_JS, src, dest],
      { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, timeout: 5 * 60000, maxBuffer: 1 << 20, windowsHide: true },
      (err, out) => {
        try { return resolve(JSON.parse(String(out))); } catch {}
        resolve({ error: 'Tách plugin lỗi: ' + (err ? err.message : 'không rõ') });
      });
  });
}

// Tìm PepperFlashPlayer.plugin: mở .dmg, giải nén .pkg / .zip, giải mã payload .lzma của Adobe.
// mounts: các ổ .dmg đã mở – người gọi tự tháo khi xong.
async function findPluginIn(p, work, mounts, depth, progress) {
  if (depth > 6 || !fs.existsSync(p)) return null;
  const base = path.basename(p);
  const ext = path.extname(p).toLowerCase();
  const st = fs.statSync(p);
  const sub = () => fs.mkdtempSync(path.join(work, 'x'));
  const next = (q) => findPluginIn(q, work, mounts, depth + 1, progress);

  if (base === PLUGIN_NAME && st.isDirectory()) return p;
  if (base === PLUGIN_NAME + '.lzma' && st.isFile()) {
    progress('Đang giải nén Flash Player (khoảng 10 giây)…');
    return extractAdobeLzma(p, path.join(sub(), PLUGIN_NAME));
  }
  if (st.isFile() && ext === '.dmg') {
    const mnt = sub();
    await execFileP('/usr/bin/hdiutil', ['attach', p, '-nobrowse', '-readonly', '-noautoopen', '-mountpoint', mnt]);
    mounts.push(mnt);
    return next(mnt);
  }
  if (st.isFile() && ext === '.pkg') {
    // pkgutil chỉ giải nén, không chạy script cài đặt
    const out = path.join(sub(), 'pkg');
    await execFileP('/usr/sbin/pkgutil', ['--expand-full', p, out]);
    return next(out);
  }
  if (st.isFile() && ext === '.zip') {
    const out = sub();
    await execFileP('/usr/bin/ditto', ['-x', '-k', p, out]);
    return next(out);
  }
  if (!st.isDirectory()) return null;

  // duyệt thư mục: ưu tiên plugin có sẵn, rồi tới payload .lzma, rồi tới gói lồng bên trong
  const found = { plugin: [], lzma: [], nested: [] };
  const walk = (dir, d) => {
    if (d > 8) return;
    let list = [];
    try { list = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of list) {
      const f = path.join(dir, e.name);
      if (e.isSymbolicLink()) continue;
      if (e.name === PLUGIN_NAME && e.isDirectory()) { found.plugin.push(f); continue; }
      if (e.name === PLUGIN_NAME + '.lzma') { found.lzma.push(f); continue; }
      const x = path.extname(e.name).toLowerCase();
      // .pkg dạng file thì cần giải nén; dạng thư mục (gói đã mở sẵn) thì duyệt vào như thư mục thường
      if (e.isFile() && ['.pkg', '.dmg', '.zip'].includes(x)) { found.nested.push(f); continue; }
      if (e.isDirectory()) walk(f, d + 1);
    }
  };
  walk(p, 0);
  for (const f of [...found.plugin, ...found.lzma, ...found.nested]) {
    const r = await next(f);
    if (r) return r;
  }
  return null;
}

// Tháo các ổ .dmg mà findPluginIn đã mở
async function detachAll(mounts) {
  for (const m of mounts.reverse()) { try { await execFileP('/usr/bin/hdiutil', ['detach', m, '-quiet', '-force']); } catch {} }
}

// Payload của bộ cài Adobe: 11 byte đầu riêng (byte 7–10: kích thước sau giải nén, big-endian),
// tiếp theo là luồng LZMA (5 byte thuộc tính + dữ liệu). Sau giải nén là cây thư mục:
// mỗi mục = [loại][cờ: 0x80 = thư mục][độ dài tên][tên][kích thước nội dung, 4 byte big-endian][nội dung].
async function extractAdobeLzma(file, dest) {
  const b = await flashWin.decodeAdobeLzma(fs.readFileSync(file));
  const writeTree = (pos, end, dir) => {
    while (pos < end) {
      const flag = b[pos + 1], nlen = b[pos + 2];
      const name = b.toString('utf8', pos + 3, pos + 3 + nlen);
      if (name.includes('/') || name === '..' || name === '.') throw new Error('Tên mục không hợp lệ: ' + name);
      const len = b.readUInt32BE(pos + 3 + nlen);
      const body = pos + 3 + nlen + 4;
      if (body + len > end) throw new Error('Payload bị cắt cụt');
      const target = name ? path.join(dir, name) : dir;
      if (flag & 0x80) {
        fs.mkdirSync(target, { recursive: true });
        writeTree(body, body + len, target);
      } else {
        fs.writeFileSync(target, b.subarray(body, body + len));
        // file chạy được nằm trong Contents/MacOS
        fs.chmodSync(target, path.basename(dir) === 'MacOS' ? 0o755 : 0o644);
      }
      pos = body + len;
    }
  };
  writeTree(0, b.length, dest);
  return dest;
}

module.exports = { findPluginWin, findPluginIn, detachAll };
