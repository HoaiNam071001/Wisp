// Plugin Flash trên Windows (pepflashplayer.dll, PPAPI, x64).
// App không chạy bộ cài của Adobe: bộ cài Windows (install_flash_player_32_ppapi.exe) giữ các file
// trong tài nguyên RCDATA của file .exe, nén bằng đúng định dạng LZMA của payload macOS (11 byte đầu
// riêng, byte 7–10 là kích thước sau giải nén, big-endian, tiếp theo là luồng LZMA). Bản x64 nằm
// trong một file .exe x64 lồng bên trong: .exe (x86) → RCDATA → .exe (x64) → RCDATA → pepflashplayer64.dll.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');

const PLUGIN_FILE = 'pepflashplayer.dll';
const ADOBE_SUBJECT = /\bO="?Adobe (Inc\.|Systems Incorporated)/;
// pepflashplayer64 32.0.0.465 lấy từ bộ cài trên archive.org (MD5 bộ cài 80b45a47…): khớp thì khỏi gọi PowerShell
const KNOWN_SHA256 = new Set(['c022429effec49522867196dafa259af0843aeae355be0366d7321ac854f561a']);

// ----- đọc file PE (.exe / .dll) -----
function peHeader(b) {
  if (b.length < 0x40 || b[0] !== 0x4d || b[1] !== 0x5a) return null;
  const e = b.readUInt32LE(0x3c);
  if (e + 24 > b.length || b.readUInt32LE(e) !== 0x4550) return null;
  const machine = b.readUInt16LE(e + 4);
  const nsec = b.readUInt16LE(e + 6);
  const optSize = b.readUInt16LE(e + 20);
  const chars = b.readUInt16LE(e + 22);
  const opt = e + 24;
  const pe32plus = b.readUInt16LE(opt) === 0x20b;
  const dirs = opt + (pe32plus ? 112 : 96);
  const sections = [];
  for (let i = 0; i < nsec; i++) {
    const s = opt + optSize + 40 * i;
    sections.push({ vsize: b.readUInt32LE(s + 8), va: b.readUInt32LE(s + 12), rsize: b.readUInt32LE(s + 16), raw: b.readUInt32LE(s + 20) });
  }
  const dir = (i) => ({ va: b.readUInt32LE(dirs + 8 * i), size: b.readUInt32LE(dirs + 8 * i + 4) });
  const off = (rva) => {
    for (const s of sections) if (rva >= s.va && rva < s.va + Math.max(s.vsize, s.rsize)) return rva - s.va + s.raw;
    return -1;
  };
  return { machine, x64: machine === 0x8664, dll: !!(chars & 0x2000), dir, off };
}

function peInfo(b) {
  const h = peHeader(b);
  if (!h) return null;
  return { x64: h.x64, dll: h.dll, ppapi: h.dll && b.includes('PPP_GetInterface') };
}

// Tài nguyên RCDATA (type 10) của file PE: [{ name, data }]
function rcdata(b) {
  const h = peHeader(b);
  if (!h) return [];
  const rsrc = h.dir(2);
  if (!rsrc.size) return [];
  const base = h.off(rsrc.va);
  if (base < 0) return [];
  const out = [];
  const walk = (o, depth, pathIds) => {
    if (depth > 3 || o + 16 > b.length) return;
    const n = b.readUInt16LE(o + 12) + b.readUInt16LE(o + 14);
    for (let k = 0; k < n; k++) {
      const id = b.readUInt32LE(o + 16 + 8 * k);
      const ofs = b.readUInt32LE(o + 16 + 8 * k + 4);
      const ids = [...pathIds, id & 0x80000000 ? -1 : id];
      if (depth === 0 && ids[0] !== 10) continue;
      if (ofs & 0x80000000) walk(base + (ofs & 0x7fffffff), depth + 1, ids);
      else {
        const rva = b.readUInt32LE(base + ofs), size = b.readUInt32LE(base + ofs + 4);
        const fo = h.off(rva);
        if (fo >= 0 && fo + size <= b.length) out.push({ name: ids[1], data: b.subarray(fo, fo + size) });
      }
    }
  };
  walk(base, 0, []);
  return out;
}

// Version của file PE (VS_FIXEDFILEINFO, chữ ký 0xFEEF04BD) → "32.0.0.465"
function peVersion(b) {
  const sig = Buffer.from([0xbd, 0x04, 0xef, 0xfe]);
  let i = b.lastIndexOf(sig);
  if (i < 0 || i + 16 > b.length) return null;
  const ms = b.readUInt32LE(i + 8), ls = b.readUInt32LE(i + 12);
  return [ms >>> 16, ms & 0xffff, ls >>> 16, ls & 0xffff].join('.');
}

// ----- payload LZMA của Adobe (dùng chung cho macOS và Windows) -----
function isAdobeLzma(b) { return b.length > 32 && b[11] === 0x5d; }
function decodeAdobeLzma(d) {
  const lzma = require('lzma');
  if (!isAdobeLzma(d)) return Promise.reject(new Error('Payload Flash không đúng định dạng của Adobe'));
  const size = d.readUInt32BE(7);
  const hdr = Buffer.alloc(13);
  d.copy(hdr, 0, 11, 16);
  hdr.writeUInt32LE(size, 5);
  return new Promise((resolve, reject) => {
    lzma.decompress(Buffer.concat([hdr, d.subarray(16)]), (res, err) => {
      if (err) return reject(new Error('Giải nén LZMA lỗi: ' + err));
      const b = typeof res === 'string' ? Buffer.from(res, 'utf8') : Buffer.from(res);
      if (b.length !== size) return reject(new Error(`Giải nén ra ${b.length} byte, cần ${size}`));
      resolve(b);
    });
  });
}

// Bộ cài Windows của Adobe → { dll: Buffer, version }. Giải nén tài nguyên lớn trước:
// .exe x64 lồng bên trong chứa bản x64, bỏ qua bản x86 (pepflashplayer32).
async function extractFromInstaller(exe, onStep, depth = 0) {
  if (depth > 2) return null;
  const items = rcdata(exe).filter(r => isAdobeLzma(r.data)).sort((a, b) => b.data.length - a.data.length);
  for (const r of items) {
    if (r.data.length < 100000) continue; // manifest, giấy phép…
    if (onStep) onStep(depth);
    const b = await decodeAdobeLzma(r.data);
    const info = peInfo(b);
    if (!info) continue;
    if (info.ppapi && info.x64) return { dll: b, version: peVersion(b) };
    if (!info.dll) {
      const found = await extractFromInstaller(b, onStep, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

// ----- kiểm tra plugin -----
function ps(command, env) {
  return new Promise((resolve) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', command],
      { env: { ...process.env, ...env }, timeout: 30000, windowsHide: true }, (err, out, errOut) => resolve({ err, out: String(out || ''), errOut: String(errOut || '') }));
  });
}

// null = hợp lệ; chuỗi = lý do từ chối
async function verifyDll(p) {
  let b;
  try { b = fs.readFileSync(p); } catch (e) { return 'Không đọc được file: ' + e.message; }
  const info = peInfo(b);
  if (!info || !info.dll) return 'Không phải file .dll';
  if (!info.ppapi) return 'Không phải plugin Pepper Flash (PPAPI). Cần pepflashplayer64_32_0_0_xxx.dll, không phải bản NPAPI / ActiveX.';
  if (!info.x64) return 'Đây là bản 32-bit (pepflashplayer32). Wisp cần bản 64-bit (pepflashplayer64).';
  if (KNOWN_SHA256.has(crypto.createHash('sha256').update(b).digest('hex'))) return null;
  const r = await ps('$s = Get-AuthenticodeSignature -LiteralPath $env:WISP_DLL; $s.Status.ToString(); $s.SignerCertificate.Subject', { WISP_DLL: p });
  const [status = '', subject = ''] = r.out.split(/\r?\n/).map(s => s.trim());
  if (r.err && !status) return 'Không kiểm tra được chữ ký (PowerShell lỗi): ' + (r.errOut || r.err.message).trim();
  if (status !== 'Valid') return `Chữ ký không hợp lệ (${status || 'không có chữ ký'}): file đã bị sửa hoặc không phải bản của Adobe`;
  if (!ADOBE_SUBJECT.test(subject)) return 'Plugin không do Adobe ký: ' + subject;
  return null;
}

function versionOf(p) {
  try { const v = JSON.parse(fs.readFileSync(p.replace(/\.dll$/i, '.json'), 'utf8')).version; if (v) return v; } catch {}
  const m = /pepflashplayer(?:64)?_(\d+)_(\d+)_(\d+)_(\d+)\.dll$/i.exec(p);
  if (m) return m.slice(1).join('.');
  try { const v = peVersion(fs.readFileSync(p)); if (v) return v; } catch {}
  return null;
}

// Plugin cài sẵn trên máy (bộ cài PPAPI của Adobe cài vào System32\Macromed\Flash)
function systemPlugins() {
  const dirs = [path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'Macromed', 'Flash')];
  const out = [];
  for (const d of dirs) {
    try {
      for (const n of fs.readdirSync(d)) if (/^pepflashplayer64_[\d_]+\.dll$/i.test(n)) out.push(path.join(d, n));
    } catch {}
  }
  return out.sort().reverse();
}

// Giải nén .zip bằng PowerShell (có sẵn trên Windows 10/11)
async function unzip(zip, dest) {
  const r = await ps('Expand-Archive -LiteralPath $env:WISP_ZIP -DestinationPath $env:WISP_OUT -Force', { WISP_ZIP: zip, WISP_OUT: dest });
  if (r.err) throw new Error('Giải nén zip lỗi: ' + (r.errOut || r.err.message).trim());
}

module.exports = { PLUGIN_FILE, peInfo, peVersion, rcdata, decodeAdobeLzma, extractFromInstaller, verifyDll, versionOf, systemPlugins, unzip };

// Chạy riêng một tiến trình (ELECTRON_RUN_AS_NODE) để tách DLL: giải nén LZMA bằng JS thuần
// tốn ~20 giây và vài GB RAM tạm thời, không để tiến trình chính bị đứng.
//   electron flash-win.js <bộ cài .exe> <file .dll ra>  → in {"version": "..."}
if (require.main === module) {
  const [src, dest] = process.argv.slice(2);
  extractFromInstaller(fs.readFileSync(src), (d) => process.stderr.write(`step ${d}\n`)).then((r) => {
    if (!r) { process.stdout.write(JSON.stringify({ error: 'notfound' })); return; }
    fs.writeFileSync(dest, r.dll);
    process.stdout.write(JSON.stringify({ version: r.version }));
  }).catch((e) => { process.stdout.write(JSON.stringify({ error: String(e && e.message || e) })); });
}
