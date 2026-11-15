// Cổng Ghosthand: WebSocket JSON chỉ trên 127.0.0.1, cổng ngẫu nhiên, token mới mỗi lần mở app
// (docs/plan/01-cong-ghosthand.md). Không mở cổng CDP – mọi thao tác đi qua lệnh mức cao ở ghosthand/commands.
const { app } = require('electron');
const { EventEmitter } = require('events');
const WebSocket = require('ws');
const tabs = require('../tabs');
const { API, parseRequest, okReply, errorReply } = require('./protocol');
const { newToken, writeInfo, removeInfo, tokenOk } = require('./info-file');
const { addLog } = require('../inspect/store');

const pushEvents = require('./events');

// Lệnh nhận (args, conn); conn.send – đẩy sự kiện cho đúng kết nối (subscribe).
const COMMANDS = Object.assign({}, require('./commands/tabs'), require('./commands/read'), require('./commands/act'),
  require('./commands/form'), require('./commands/wait'), pushEvents.commands);

// Người dùng bấm ngắt (chip trên toolbar / tắt cổng) → đóng với mã này: Ghosthand không tự nối lại.
const CLOSE_BY_USER = 4000;
const events = new EventEmitter(); // 'changed' – bật / tắt cổng, số kết nối đổi (menu ⋮ vẽ lại)
let wss = null;

function state() { return { on: !!wss, clients: wss ? wss.clients.size : 0 }; }

// Thanh công cụ hiện chip "Ghosthand" khi có kết nối.
function notify() {
  const win = tabs.getWin();
  if (win) win.webContents.send('ghosthand', state());
  events.emit('changed');
}

// Lệnh của một kết nối chạy lần lượt: hai thao tác chuột / phím không chen vào nhau.
function serve(ws) {
  const conn = { send: text => send(ws, text) };
  ws.on('close', () => pushEvents.drop(conn));
  let queue = Promise.resolve();
  ws.on('message', raw => {
    queue = queue.then(async () => {
      let id;
      try {
        const req = parseRequest(raw);
        id = req.id;
        const result = await COMMANDS[req.cmd](req.args, conn);
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
    notify();
  });
  wss.on('connection', ws => {
    addLog('info', 'event', 'Ghosthand đã nối');
    ws.on('close', () => { addLog('info', 'event', 'Ghosthand ngắt kết nối'); notify(); });
    serve(ws);
    notify();
  });
  wss.on('error', e => addLog('error', 'event', 'Cổng Ghosthand lỗi: ' + e.message));
}

// Ngắt mọi kết nối đang có (cổng vẫn mở).
function disconnect() {
  if (!wss) return;
  for (const c of wss.clients) c.close(CLOSE_BY_USER, 'nguoi dung ngat');
}

function stop() {
  if (!wss) return;
  disconnect();
  wss.close();
  wss = null;
  removeInfo(app.getPath('userData'), process.pid);
  notify();
}

module.exports = { events, start, stop, disconnect, state };
