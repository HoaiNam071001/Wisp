// Cổng Ghosthand: WebSocket JSON chỉ trên 127.0.0.1, cổng ngẫu nhiên, token mới mỗi lần mở app
// (docs/plan/01-cong-ghosthand.md). Không mở cổng CDP – mọi thao tác đi qua lệnh mức cao ở ghosthand/commands.
const { app } = require('electron');
const WebSocket = require('ws');
const { API, parseRequest, okReply, errorReply } = require('./protocol');
const { newToken, writeInfo, removeInfo, tokenOk } = require('./info-file');
const { addLog } = require('../inspect/store');

const COMMANDS = Object.assign({},
  require('./commands/tabs'), require('./commands/read'), require('./commands/act'), require('./commands/wait'));

let wss = null;

// Lệnh của một kết nối chạy lần lượt: hai thao tác chuột / phím không chen vào nhau.
function serve(ws) {
  let queue = Promise.resolve();
  ws.on('message', raw => {
    queue = queue.then(async () => {
      let id;
      try {
        const req = parseRequest(raw);
        id = req.id;
        const result = await COMMANDS[req.cmd](req.args);
        send(ws, okReply(id, result));
      } catch (e) {
        if (!e.code) addLog('error', 'event', 'Ghosthand: lỗi lệnh – ' + (e.stack || e.message));
        send(ws, errorReply(id === undefined ? e.id : id, e));
      }
    });
  });
}

function send(ws, text) { if (ws.readyState === WebSocket.OPEN) ws.send(text); }

function start() {
  if (wss) return;
  const token = newToken();
  wss = new WebSocket.Server({
    host: '127.0.0.1', port: 0, maxPayload: 4 * 1024 * 1024,
    // Sai / thiếu token → từ chối bắt tay. Có Origin = trang web trong trình duyệt nào đó thử nối → từ chối luôn.
    verifyClient: ({ req }) => !req.headers.origin && tokenOk(req.headers.authorization, token),
  });
  wss.on('listening', () => {
    const { port } = wss.address();
    writeInfo(app.getPath('userData'), { port, token, pid: process.pid, version: app.getVersion(), api: API });
    addLog('info', 'event', `Cổng Ghosthand mở ở 127.0.0.1:${port}`);
  });
  wss.on('connection', ws => {
    addLog('info', 'event', 'Ghosthand đã nối');
    ws.on('close', () => addLog('info', 'event', 'Ghosthand ngắt kết nối'));
    serve(ws);
  });
  wss.on('error', e => addLog('error', 'event', 'Cổng Ghosthand lỗi: ' + e.message));
}

function stop() {
  if (!wss) return;
  for (const c of wss.clients) c.terminate();
  wss.close();
  wss = null;
  removeInfo(app.getPath('userData'), process.pid);
}

module.exports = { start, stop };
