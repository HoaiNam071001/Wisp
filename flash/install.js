// Cài plugin Flash: tải từ archive.org hoặc từ file người dùng chọn → tách (extract.js) → kiểm tra chữ ký → chép.
// Adobe đã gỡ bản cài khỏi trang của họ; archive.org còn giữ bản cuối (32.0.0.465, PPAPI).
// Windows: bộ cài PPAPI bản đầy đủ (offline) 32.0.0.465; app tách pepflashplayer64 khỏi tài nguyên của .exe.
const { app, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const crypto = require('crypto');
const tabs = require('../tabs');
const { saveConfig } = require('../config');
const { addLog } = require('../inspect/store');
const { FLASH_PATH, FLASH_VERSION } = require('./mode');
const { userPluginPath, verifyFlashPlugin, installFlashPlugin, readFlashVersion } = require('./plugin');
const { findPluginWin, findPluginIn, detachAll } = require('./extract');
const { relaunch } = require('./actions');

const IS_WIN = process.platform === 'win32';
const FLASH_DOWNLOAD = IS_WIN ? {
  url: 'https://archive.org/download/adobe-flash-player-ppapi-32.0.0.465/Adobe%20Flash%20Player%20%28PPAPI%29%2032.0.0.465.exe',
  page: 'https://archive.org/details/adobe-flash-player-ppapi-32.0.0.465',
  md5: '80b45a47f1055a1d1381b708f4c372e1',
  file: 'install_flash_player_32_ppapi.exe',
  size: '~21 MB',
} : {
  url: 'https://archive.org/download/adobe-flash-player-archive_202012/install_flash_player_osx_ppapi.dmg',
  page: 'https://archive.org/details/adobe-flash-player-archive_202012',
  md5: '01276b441efca664141d42dc9680a2be',
  file: 'install_flash_player_osx_ppapi.dmg',
  size: '~15 MB',
};
let flashInstalling = false;

function progress(text, fraction) {
  const win = tabs.getWin();
  if (!win) return;
  tabs.toast(text);
  win.setProgressBar(fraction == null ? -1 : fraction);
}
function clearProgress() { const win = tabs.getWin(); if (win) win.setProgressBar(-1); }

async function askForFlashPlugin() {
  const win = tabs.getWin();
  if (!win || flashInstalling) return;
  const { response } = await dialog.showMessageBox(win, {
    type: FLASH_PATH ? 'question' : 'warning',
    message: FLASH_PATH ? `Cài lại / thay Flash Player (đang dùng ${FLASH_VERSION})` : 'Chưa có Flash Player',
    detail: (FLASH_PATH ? '' : 'App đang chạy tạm bằng Ruffle (không chơi được game online cần socket).\n\n') +
      `• Tải và cài tự động: tải bản 32.0.0.465 (PPAPI) từ archive.org, ${FLASH_DOWNLOAD.size}, rồi tự cài.\n` +
      (IS_WIN
        ? '• Chọn file đã tải: bộ cài Adobe Flash Player PPAPI (.exe), file .zip, hoặc pepflashplayer64_32_0_0_xxx.dll — app tự tách plugin ra và cài.\n\n'
        : '• Chọn file đã tải: file .dmg / .pkg / .zip của bộ cài Adobe, hoặc PepperFlashPlayer.plugin — app tự tách plugin ra và cài.\n\n') +
      'App chỉ nhận plugin có chữ ký hợp lệ của Adobe, và không chạy bộ cài của Adobe.',
    buttons: ['Tải và cài tự động', 'Chọn file đã tải…', 'Mở trang tải', 'Để sau'], defaultId: 0, cancelId: 3,
  });
  if (response === 0) downloadFlashPlugin();
  else if (response === 1) choosePluginFile();
  else if (response === 2) shell.openExternal(FLASH_DOWNLOAD.page);
}

// Tải file (theo chuyển hướng), báo tiến độ, trả về MD5
function downloadFile(url, dest, onProgress, redirects = 0) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Wisp' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        if (redirects > 5) return reject(new Error('Chuyển hướng quá nhiều lần'));
        return resolve(downloadFile(new URL(res.headers.location, url).href, dest, onProgress, redirects + 1));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('Máy chủ trả về HTTP ' + res.statusCode)); }
      const total = Number(res.headers['content-length']) || 0;
      const hash = crypto.createHash('md5');
      const out = fs.createWriteStream(dest);
      let got = 0;
      res.on('data', (c) => { got += c.length; hash.update(c); if (total) onProgress(got / total); });
      res.pipe(out);
      out.on('finish', () => resolve(hash.digest('hex')));
      out.on('error', reject);
      res.on('error', reject);
    });
    req.setTimeout(30000, () => req.destroy(new Error('Hết thời gian chờ (30s)')));
    req.on('error', reject);
  });
}

async function downloadFlashPlugin() {
  if (flashInstalling) return;
  flashInstalling = true;
  const tmp = fs.mkdtempSync(path.join(app.getPath('temp'), 'wisp-flash-'));
  try {
    const file = path.join(tmp, FLASH_DOWNLOAD.file);
    progress('Đang tải Flash Player…', 0);
    let last = 0;
    const md5 = await downloadFile(FLASH_DOWNLOAD.url, file, (f) => {
      const pct = Math.floor(f * 100);
      if (pct >= last + 5) { last = pct; progress(`Đang tải Flash Player… ${pct}%`, f); }
    });
    if (md5 !== FLASH_DOWNLOAD.md5) throw new Error(`File tải về không đúng (MD5 ${md5}, cần ${FLASH_DOWNLOAD.md5}). Thử lại sau, hoặc tải tay rồi chọn file.`);
    addLog('info', 'event', 'Đã tải bộ cài Flash Player, MD5 khớp');
    flashInstalling = false;
    await installFromFile(file);
  } catch (e) {
    clearProgress();
    addLog('error', 'event', 'Tải Flash Player lỗi: ' + e.message);
    const { response } = await dialog.showMessageBox(tabs.getWin(), {
      type: 'error', message: 'Không tải được Flash Player', detail: String(e.message || e),
      buttons: ['Mở trang tải', 'Chọn file đã tải…', 'Đóng'], defaultId: 0, cancelId: 2,
    });
    if (response === 0) shell.openExternal(FLASH_DOWNLOAD.page);
    else if (response === 1) choosePluginFile();
  } finally {
    flashInstalling = false;
    try { fs.rmdirSync(tmp, { recursive: true }); } catch {}
  }
}

async function choosePluginFile() {
  // Windows: hộp thoại không chọn được cả file lẫn thư mục cùng lúc → chỉ chọn file
  const r = await dialog.showOpenDialog(tabs.getWin(), IS_WIN ? {
    title: 'Chọn bộ cài Flash Player (PPAPI) hoặc pepflashplayer64.dll',
    defaultPath: app.getPath('downloads'),
    properties: ['openFile'],
    filters: [{ name: 'Flash Player', extensions: ['exe', 'dll', 'zip'] }],
  } : {
    title: 'Chọn bộ cài Flash Player hoặc PepperFlashPlayer.plugin',
    message: 'Chọn file .dmg / .pkg / .zip của bộ cài Adobe Pepper Flash, hoặc PepperFlashPlayer.plugin',
    defaultPath: app.getPath('downloads'),
    properties: ['openFile', 'openDirectory', 'treatPackageAsDirectory'],
    filters: [{ name: 'Flash Player', extensions: ['plugin', 'dmg', 'pkg', 'zip', 'app', 'lzma'] }],
  });
  if (r.canceled || !r.filePaths[0]) return;
  await installFromFile(r.filePaths[0]);
}

// Từ file người dùng chọn (hoặc vừa tải) → tìm plugin → kiểm tra → cài → hỏi mở lại
async function installFromFile(src) {
  if (flashInstalling) return;
  flashInstalling = true;
  const work = fs.mkdtempSync(path.join(app.getPath('temp'), 'wisp-flash-x-'));
  const mounts = [];
  try {
    progress('Đang tìm Flash Player trong file…');
    const plugin = IS_WIN ? await findPluginWin(src, work, 0, progress) : await findPluginIn(src, work, mounts, 0, progress);
    if (!plugin) {
      throw new Error(IS_WIN
        ? 'Không tìm thấy pepflashplayer64.dll trong file này.\nCần bộ cài "Adobe Flash Player for Opera and Chromium – PPAPI" cho Windows (bản đầy đủ, ~21 MB; bản cài online ~1 MB không dùng được).'
        : 'Không tìm thấy PepperFlashPlayer.plugin trong file này.\nCần bộ cài "Adobe Flash Player for Opera and Chromium – PPAPI" cho macOS (install_flash_player_osx_ppapi.dmg).');
    }
    progress('Đang kiểm tra chữ ký của Adobe…');
    const err = await verifyFlashPlugin(plugin);
    if (err) throw new Error(err);
    if (path.resolve(plugin) !== path.resolve(userPluginPath())) installFlashPlugin(plugin);
  } catch (e) {
    clearProgress();
    addLog('error', 'event', 'Cài Flash Player lỗi: ' + e.message);
    dialog.showMessageBox(tabs.getWin(), { type: 'error', message: 'Không cài được Flash Player', detail: `${src}\n\n${e.message || e}` });
    return;
  } finally {
    await detachAll(mounts);
    try { fs.rmdirSync(work, { recursive: true }); } catch {}
    flashInstalling = false;
  }
  clearProgress();
  saveConfig({ mode: 'flash' });
  const ver = readFlashVersion(userPluginPath());
  addLog('info', 'event', `Đã cài Flash Player ${ver} vào ${userPluginPath()}`);
  const { response } = await dialog.showMessageBox(tabs.getWin(), {
    type: 'info', message: `Đã cài Flash Player ${ver} ✓`,
    detail: `Plugin nằm ở:\n${userPluginPath()}\n\nMở lại app để dùng Flash thật.`,
    buttons: ['Mở lại ngay', 'Để sau'], defaultId: 0, cancelId: 1,
  });
  if (response === 0) relaunch();
}

module.exports = { askForFlashPlugin, choosePluginFile };
