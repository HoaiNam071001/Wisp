// Tìm / kiểm tra / chép plugin Pepper Flash.
// Plugin nằm ngoài app, ở userData/plugins, để cập nhật (thay cả Wisp.app) không làm mất plugin
// và bản phát hành công khai không phải kèm phần mềm của Adobe.
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFileSync, spawnSync } = require('child_process');
const flashWin = require('../flash-win');

const IS_WIN = process.platform === 'win32';
// macOS: thư mục PepperFlashPlayer.plugin; Windows: một file pepflashplayer.dll (bản 64-bit)
const PLUGIN_NAME = IS_WIN ? flashWin.PLUGIN_FILE : 'PepperFlashPlayer.plugin';
const ADOBE_TEAM_ID = 'JQ525L2MZD'; // "Developer ID Application: Adobe Inc."
const APP_DIR = path.join(__dirname, '..');

function userPluginPath() { return path.join(app.getPath('userData'), 'plugins', PLUGIN_NAME); }
// Plugin đóng gói sẵn trong app (bản build cá nhân: npm run dist:personal) hoặc thư mục plugins/ khi chạy dev
function bundledPluginPath() {
  return app.isPackaged ? path.join(process.resourcesPath, 'plugins', PLUGIN_NAME) : path.join(APP_DIR, 'plugins', PLUGIN_NAME);
}

function findFlashPlugin() {
  const candidates = IS_WIN ? [
    userPluginPath(),
    bundledPluginPath(),
    ...flashWin.systemPlugins(),
  ] : [
    userPluginPath(),
    bundledPluginPath(),
    path.join('/Library/Internet Plug-Ins/PepperFlashPlayer', PLUGIN_NAME),
    path.join(app.getPath('home'), 'Library/Internet Plug-Ins/PepperFlashPlayer', PLUGIN_NAME),
  ];
  return candidates.find(p => fs.existsSync(p)) || null;
}

// Kiểm tra plugin là bản thật của Adobe: chữ ký hợp lệ + đúng Team ID của Adobe + có bản x86_64
// (Windows: chữ ký Authenticode của Adobe + bản 64-bit, xem flash-win.js). Trả về Promise.
async function verifyFlashPlugin(p) {
  if (IS_WIN) return flashWin.verifyDll(p);
  if (path.basename(p) !== PLUGIN_NAME) return `Tên phải là ${PLUGIN_NAME}`;
  const bin = path.join(p, 'Contents', 'MacOS', 'PepperFlashPlayer');
  if (!fs.existsSync(bin)) return 'Không phải plugin Pepper Flash (thiếu Contents/MacOS/PepperFlashPlayer)';
  try { execFileSync('/usr/bin/codesign', ['--verify', '--deep', '--strict', p], { stdio: 'pipe' }); }
  catch (e) { return 'Chữ ký không hợp lệ (file đã bị sửa hoặc không phải bản của Adobe):\n' + String(e.stderr || e.message).trim(); }
  const r = spawnSync('/usr/bin/codesign', ['-dv', p], { encoding: 'utf8' });
  if (!new RegExp(`TeamIdentifier=${ADOBE_TEAM_ID}\\b`).test(r.stderr || '')) return 'Plugin không do Adobe ký';
  const arch = spawnSync('/usr/bin/lipo', ['-archs', bin], { encoding: 'utf8' }).stdout || '';
  if (!/x86_64/.test(arch)) return `Plugin không có bản x86_64 (đang là: ${arch.trim() || 'không rõ'})`;
  return null;
}

// Chép plugin vào userData/plugins (ditto giữ nguyên symlink + chữ ký); chép ra chỗ tạm rồi đổi tên
function installFlashPlugin(src, version) {
  const dest = userPluginPath();
  const tmp = dest + '.tmp';
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (IS_WIN) {
    fs.copyFileSync(src, tmp);
    fs.renameSync(tmp, dest);
    // ghi version cạnh plugin để lúc khởi động khỏi đọc cả file .dll 32 MB
    const v = version || flashWin.versionOf(src);
    if (v) fs.writeFileSync(dest.replace(/\.dll$/i, '.json'), JSON.stringify({ version: v }));
    return dest;
  }
  if (fs.existsSync(tmp)) fs.rmdirSync(tmp, { recursive: true });
  execFileSync('/usr/bin/ditto', [src, tmp]);
  if (fs.existsSync(dest)) fs.rmdirSync(dest, { recursive: true });
  fs.renameSync(tmp, dest);
  return dest;
}

// Đọc version của plugin (manifest.json hoặc Info.plist) để truyền cho ppapi-flash-version
function readFlashVersion(pluginPath) {
  if (IS_WIN) return flashWin.versionOf(pluginPath) || '32.0.0.465';
  try {
    const m = JSON.parse(fs.readFileSync(path.join(pluginPath, 'Contents/Resources/manifest.json'), 'utf8'));
    if (m.version) return m.version;
  } catch {}
  try {
    const plist = fs.readFileSync(path.join(pluginPath, 'Contents/Info.plist'), 'utf8');
    const v = plist.match(/<key>CFBundleVersion<\/key>\s*<string>([^<]+)<\/string>/)
           || plist.match(/<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/);
    if (v) return v[1].trim();
  } catch {}
  return '32.0.0.465';
}

module.exports = { PLUGIN_NAME, userPluginPath, bundledPluginPath, findFlashPlugin, verifyFlashPlugin, installFlashPlugin, readFlashVersion };
