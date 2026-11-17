// Xử lý địa chỉ – logic thuần (không require electron) để test được bằng node --test.
// app-urls.js gắn các hàm này với đường dẫn / chế độ thật của app.
const path = require('path');
const { pathToFileURL } = require('url');

// ctx: { historyUrl, launcherUrl, appDir, homeDir(), isWin, exists(path) }
function createUrls(ctx) {
  // Trang Lịch sử nội bộ; thanh địa chỉ hiện "wisp://history"
  function isHistoryUrl(u) { return String(u || '').split(/[?#]/)[0] === ctx.historyUrl; }

  // Trang chờ của trang Flash thật (flash-launcher.html?url=…): tab hiện địa chỉ thật của trang
  function isLauncherUrl(u) { return String(u || '').split(/[?#]/)[0] === ctx.launcherUrl; }
  function launcherUrlFor(url) { return ctx.launcherUrl + '?url=' + encodeURIComponent(url); }

  // Địa chỉ hiển thị trên thanh địa chỉ: bỏ lớp player.html / trang chờ Flash
  function displayUrl(u) {
    if (isHistoryUrl(u)) return 'wisp://history';
    if (isLauncherUrl(u)) {
      try { return new URL(u).searchParams.get('url') || ''; } catch { return ''; }
    }
    const m = String(u || '').match(/player\.html\?src=([^&#]+)/);
    if (m) u = decodeURIComponent(m[1]);
    return u;
  }

  function normalizeUrl(input) {
    let u = String(input || '').trim();
    if (!u) return null;
    if (/^wisp:\/*history\/?$/i.test(u)) return ctx.historyUrl;
    if (u.startsWith('~/')) u = path.join(ctx.homeDir(), u.slice(2));
    if ((u.startsWith('/') || (ctx.isWin && /^[a-z]:[\\/]|^\\\\/i.test(u))) && ctx.exists(u)) u = pathToFileURL(u).href;
    else if (!/^[a-z]+:/i.test(u)) u = (/^(localhost|[\d.]+)(:\d+)?(\/|$)/.test(u) ? 'http://' : 'https://') + u;
    // File .swf mở thẳng → bọc vào trang player.html (<embed> chạy bằng Flash thật)
    if (/\.swf(\?|#|$)/i.test(u)) return pathToFileURL(path.join(ctx.appDir, 'player.html')).href + '?src=' + encodeURIComponent(u);
    return u;
  }

  return { isHistoryUrl, isLauncherUrl, launcherUrlFor, displayUrl, normalizeUrl };
}

module.exports = { createUrls };
