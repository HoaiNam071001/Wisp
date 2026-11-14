// Tự cập nhật Wisp từ GitHub Releases (repo public, gọi API không cần token).
// Không dùng electron-updater: trên macOS nó chỉ tự cài khi app có chữ ký Apple.
// Quy trình: so tag bản mới nhất với app.getVersion() → tải Wisp-<ver>-mac.zip + .sha256 → kiểm tra
// sha256 → giải nén (ditto) → kiểm tra Info.plist đúng version → app thoát, script nền thay Wisp.app rồi mở lại.
// Plugin Flash, cookie, config.json nằm ở userData nên không bị ảnh hưởng.
const { app, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const crypto = require('crypto');
const { execFile, spawn } = require('child_process');

const REPO = 'HoaiNam071001/Wisp';
const CHECK_DELAY = 10 * 1000;
const CHECK_EVERY = 6 * 3600 * 1000;

let ctx = null;          // { getWin, toast, addLog, loadConfig, saveConfig, notify }
let latest = null;       // { version, tag, notes, url, zip, sha }
let busy = false;

// "2.10.0" > "2.9.1"; bỏ tiền tố v và phần -beta
function cmpVer(a, b) {
  const pa = String(a).replace(/^v/, '').split('-')[0].split('.').map(Number);
  const pb = String(b).replace(/^v/, '').split('-')[0].split('.').map(Number);
  for (let i = 0; i < 3; i++) { const d = (pa[i] || 0) - (pb[i] || 0); if (d) return d; }
  return 0;
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Wisp-updater', Accept: 'application/vnd.github+json' } }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`GitHub trả về HTTP ${res.statusCode}`));
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    });
    req.setTimeout(15000, () => req.destroy(new Error('Hết thời gian chờ GitHub (15s)')));
    req.on('error', reject);
  });
}

function download(url, dest, onProgress, redirects = 0) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Wisp-updater' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        if (redirects > 5) return reject(new Error('Chuyển hướng quá nhiều lần'));
        return resolve(download(new URL(res.headers.location, url).href, dest, onProgress, redirects + 1));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('Tải lỗi: HTTP ' + res.statusCode)); }
      const total = Number(res.headers['content-length']) || 0;
      const hash = crypto.createHash('sha256');
      const out = fs.createWriteStream(dest);
      let got = 0;
      res.on('data', (c) => { got += c.length; hash.update(c); if (total && onProgress) onProgress(got / total); });
      res.pipe(out);
      out.on('finish', () => resolve(hash.digest('hex')));
      out.on('error', reject);
      res.on('error', reject);
    });
    req.setTimeout(30000, () => req.destroy(new Error('Hết thời gian chờ (30s)')));
    req.on('error', reject);
  });
}

function getText(url) {
  const tmp = path.join(app.getPath('temp'), `wisp-sha-${Date.now()}.txt`);
  return download(url, tmp).then(() => { const t = fs.readFileSync(tmp, 'utf8'); fs.unlinkSync(tmp); return t; });
}

// Wisp.app đang chạy (null khi chạy dev bằng electron .)
function appBundle() {
  if (!app.isPackaged) return null;
  const p = path.resolve(process.execPath, '..', '..', '..');
  return p.endsWith('.app') ? p : null;
}

async function check({ manual = false } = {}) {
  if (busy) return latest;
  try {
    const r = await getJson(`https://api.github.com/repos/${REPO}/releases/latest`);
    if (r.draft || r.prerelease) throw new Error('Bản mới nhất là bản nháp / thử nghiệm');
    const version = String(r.tag_name || '').replace(/^v/, '');
    const zip = (r.assets || []).find(a => /-mac\.zip$/.test(a.name));
    const sha = (r.assets || []).find(a => /-mac\.zip\.sha256$/.test(a.name));
    ctx.saveConfig({ updateLastCheck: Date.now() });
    if (version && cmpVer(version, app.getVersion()) > 0 && zip) {
      latest = { version, tag: r.tag_name, notes: r.body || '', url: r.html_url, zip: zip.browser_download_url, zipName: zip.name, size: zip.size,
                 sha: sha ? sha.browser_download_url : null };
    } else latest = null;
    ctx.notify(state());
    if (manual) {
      if (latest) promptUpdate(true);
      else dialog.showMessageBox(ctx.getWin(), { type: 'info', message: `Wisp ${app.getVersion()} là bản mới nhất ✓`, detail: version ? `Bản mới nhất trên GitHub: ${version}` : '' });
    } else if (latest && ctx.loadConfig().updateSkip !== latest.version) {
      ctx.addLog('info', 'event', `Có bản Wisp mới: ${latest.version} (đang dùng ${app.getVersion()})`);
    }
  } catch (e) {
    ctx.addLog('warning', 'event', 'Kiểm tra cập nhật lỗi: ' + e.message);
    if (manual) dialog.showMessageBox(ctx.getWin(), { type: 'warning', message: 'Không kiểm tra được bản mới', detail: e.message });
  }
  return latest;
}

function state() {
  return {
    current: app.getVersion(),
    available: latest && ctx.loadConfig().updateSkip !== latest.version ? latest.version : null,
    latest: latest ? latest.version : null,
    busy,
  };
}

async function promptUpdate(manual = false) {
  if (!latest || busy) return;
  const notes = latest.notes.replace(/\r/g, '').replace(/^#+\s*/gm, '').trim();
  const { response } = await dialog.showMessageBox(ctx.getWin(), {
    type: 'info',
    message: `Có bản Wisp mới: ${latest.version}`,
    detail: `Đang dùng: ${app.getVersion()}\n\n${notes.slice(0, 1500)}${notes.length > 1500 ? '…' : ''}\n\n` +
      'Plugin Flash, đăng nhập, lịch sử và tab đang mở được giữ nguyên. App sẽ tự mở lại sau khi cập nhật.',
    buttons: ['Cập nhật ngay', 'Để sau', 'Bỏ qua bản này', 'Xem trên GitHub'], defaultId: 0, cancelId: 1,
  });
  if (response === 0) install();
  else if (response === 2) { ctx.saveConfig({ updateSkip: latest.version }); ctx.notify(state()); }
  else if (response === 3) shell.openExternal(latest.url);
}

async function install() {
  if (!latest || busy) return;
  const bundle = appBundle();
  if (!bundle) {
    dialog.showMessageBox(ctx.getWin(), { type: 'info', message: 'Đang chạy bản dev', detail: 'Chỉ bản đã đóng gói (Wisp.app) mới tự cập nhật được. Mở trang phát hành để tải tay.' });
    shell.openExternal(latest.url);
    return;
  }
  try { fs.accessSync(path.dirname(bundle), fs.constants.W_OK); } catch {
    dialog.showMessageBox(ctx.getWin(), { type: 'warning', message: 'Không có quyền ghi vào ' + path.dirname(bundle), detail: 'Tải bản mới trên trang phát hành rồi kéo vào Applications.' });
    shell.openExternal(latest.url);
    return;
  }
  busy = true;
  ctx.notify(state());
  const win = ctx.getWin();
  const work = fs.mkdtempSync(path.join(app.getPath('temp'), 'wisp-update-'));
  try {
    const zip = path.join(work, latest.zipName);
    ctx.toast(`Đang tải Wisp ${latest.version}…`);
    let last = 0;
    const sum = await download(latest.zip, zip, (f) => {
      if (win && !win.isDestroyed()) win.setProgressBar(f);
      const pct = Math.floor(f * 100);
      if (pct >= last + 10) { last = pct; ctx.toast(`Đang tải Wisp ${latest.version}… ${pct}%`); }
    });
    if (latest.sha) {
      const want = (await getText(latest.sha)).trim().split(/\s+/)[0].toLowerCase();
      if (want !== sum) throw new Error(`File tải về sai sha256 (${sum.slice(0, 12)}…, cần ${want.slice(0, 12)}…)`);
    }
    ctx.toast('Đang giải nén…');
    if (win && !win.isDestroyed()) win.setProgressBar(2); // thanh tiến độ không xác định
    const out = path.join(work, 'x');
    await new Promise((res, rej) => execFile('/usr/bin/ditto', ['-x', '-k', zip, out], (e) => e ? rej(e) : res()));
    const newApp = fs.readdirSync(out).map(n => path.join(out, n)).find(p => p.endsWith('.app'));
    if (!newApp) throw new Error('Không thấy Wisp.app trong file zip');
    const plist = fs.readFileSync(path.join(newApp, 'Contents', 'Info.plist'), 'utf8');
    const v = (plist.match(/<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/) || [])[1];
    if (v !== latest.version) throw new Error(`Bản trong zip là ${v || '?'}, không phải ${latest.version}`);

    // Script nền: chờ Wisp thoát hẳn → thay app → bỏ cờ quarantine → mở lại
    const script = path.join(work, 'apply.sh');
    fs.writeFileSync(script, [
      '#!/bin/sh',
      `PID=${process.pid}`,
      'for i in $(seq 1 120); do kill -0 "$PID" 2>/dev/null || break; sleep 0.5; done',
      `OLD=${JSON.stringify(bundle)}`,
      `NEW=${JSON.stringify(newApp)}`,
      // giữ bản cũ ở $OLD.old cho tới khi chép xong bản mới; chép lỗi thì trả bản cũ về chỗ cũ
      'rm -rf "$OLD.old"',
      'if mv "$OLD" "$OLD.old"; then',
      '  if /usr/bin/ditto "$NEW" "$OLD"; then rm -rf "$OLD.old"; else rm -rf "$OLD"; mv "$OLD.old" "$OLD"; fi',
      'fi',
      '/usr/bin/xattr -cr "$OLD" 2>/dev/null',
      '/usr/bin/open "$OLD"',
      `rm -rf ${JSON.stringify(work)}`,
    ].join('\n') + '\n', { mode: 0o755 });
    ctx.addLog('info', 'event', `Cập nhật lên ${latest.version}: khởi động lại để thay app`);
    spawn('/bin/sh', [script], { detached: true, stdio: 'ignore' }).unref();
    app.quit();
  } catch (e) {
    busy = false;
    if (win && !win.isDestroyed()) win.setProgressBar(-1);
    ctx.notify(state());
    try { fs.rmdirSync(work, { recursive: true }); } catch {}
    ctx.addLog('error', 'event', 'Cập nhật lỗi: ' + e.message);
    const { response } = await dialog.showMessageBox(ctx.getWin(), {
      type: 'error', message: 'Cập nhật không thành công', detail: e.message, buttons: ['Tải tay trên GitHub', 'Đóng'], defaultId: 0, cancelId: 1,
    });
    if (response === 0) shell.openExternal(latest.url);
  }
}

function init(c) {
  ctx = c;
  setTimeout(() => check(), CHECK_DELAY);
  setInterval(() => check(), CHECK_EVERY);
}

module.exports = { init, check, promptUpdate, install, state };
