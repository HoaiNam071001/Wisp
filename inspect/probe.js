// Thử kết nối TCP từ app (tiến trình chính) – tách lỗi mạng khỏi lỗi của Flash.
// policy = gửi <policy-file-request/> như Flash làm trước khi mở socket.
const net = require('net');
const { addLog } = require('./store');

function probeTcp(host, port, policy) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const res = { host, port, policy, ok: false, ms: 0, ip: '', response: '', error: '' };
    const sock = net.connect({ host, port: Number(port) });
    let done = false;
    const finish = (patch) => {
      if (done) return;
      done = true;
      Object.assign(res, patch);
      sock.destroy();
      addLog(res.ok ? 'info' : 'error', 'probe',
             `Thử ${host}:${port}${policy ? ' (policy)' : ''}: ${res.ok ? 'OK ' + res.ms + 'ms' : res.error}`);
      resolve(res);
    };
    sock.setTimeout(8000, () => finish({ error: res.ms ? 'Không nhận được trả lời policy sau 8s' : 'Hết thời gian kết nối (8s)' }));
    sock.on('connect', () => {
      res.ms = Date.now() - t0;
      res.ip = sock.remoteAddress || '';
      if (!policy) return finish({ ok: true });
      sock.write('<policy-file-request/>\0');
    });
    sock.on('data', (buf) => {
      res.response += buf.toString('utf8');
      if (res.response.includes('\0') || res.response.includes('</cross-domain-policy>')) {
        finish({ ok: true, response: res.response.replace(/\0/g, '') });
      }
    });
    sock.on('end', () => finish(res.response ? { ok: true } : { error: 'Máy chủ đóng kết nối, không gửi gì' }));
    sock.on('error', (e) => finish({ error: `${e.code || ''} ${e.message}`.trim() }));
  });
}

module.exports = { probeTcp };
