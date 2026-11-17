// Ruffle: giao thức riêng ruffle:// để trang nào cũng tải được file Ruffle đóng gói sẵn.
//   ruffle://local/<file>     → file Ruffle đóng gói sẵn (trang nào cũng tải được)
//   ruffle://file/<đường dẫn> → file .swf trên máy (Ruffle không đọc được file:// trực tiếp)
const { protocol, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { PLAYER_PATH } = require('../urls');
const { engineForHost } = require('./engine-pick');

const IS_WIN = process.platform === 'win32';
const MIME = { '.wasm': 'application/wasm', '.js': 'text/javascript', '.map': 'application/json',
               '.swf': 'application/x-shockwave-flash', '.html': 'text/html', '.xml': 'text/xml',
               '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.txt': 'text/plain' };

// Phải gọi trước app ready
function registerRuffleScheme() {
  protocol.registerSchemesAsPrivileged([
    { scheme: 'ruffle', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, bypassCSP: true } },
  ]);
}

// Gọi sau app ready
function serveRuffle() {
  // preload hỏi từng khung: trang (host của khung trên cùng) có cấu hình Ruffle không
  ipcMain.on('flash:is-ruffle', (e, host) => { e.returnValue = engineForHost(String(host || '')) === 'ruffle'; });
  const ruffleDir = path.dirname(require.resolve('@ruffle-rs/ruffle/ruffle.js'));
  protocol.registerBufferProtocol('ruffle', (req, cb) => {
    try {
      const u = new URL(req.url);
      let file, headers = {};
      if (u.hostname === 'local') {
        file = path.join(ruffleDir, path.basename(u.pathname));
        headers = { 'Access-Control-Allow-Origin': '*' };
      } else if (u.hostname === 'file') {
        // không gắn CORS: trang web bên ngoài không đọc trộm được file trên máy
        file = u.pathname === PLAYER_PATH ? path.join(__dirname, '..', 'player.html') : decodeURIComponent(u.pathname);
        // Windows: /C:/game.swf → C:/game.swf
        if (IS_WIN && /^\/[a-z]:\//i.test(file)) file = file.slice(1);
      }
      if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) return cb({ error: -6 });
      cb({ mimeType: MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', headers, data: fs.readFileSync(file) });
    } catch { cb({ error: -2 }); }
  });
}

module.exports = { registerRuffleScheme, serveRuffle };
