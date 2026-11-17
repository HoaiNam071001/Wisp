// Ghi mọi request HTTP của phiên (cả request do Flash gửi) cho Bảng kiểm tra.
// Mỗi sự kiện webRequest chỉ gắn được một listener, nên ghi log HTTP, gom domain .swf
// (gợi ý allowlist) và gỡ CSP cho Ruffle đều nằm chung ở đây.
const path = require('path');
const { pathToFileURL } = require('url');
const { httpLog, seenSwfHosts, trimMap, httpUpdate, inspector } = require('./store');
const { getWin } = require('../tabs');
const { engineForUrl } = require('../flash/engine-pick');

const APP_FILE_URL = pathToFileURL(path.join(__dirname, '..')).href + '/';

// Request của chính toolbar / Bảng kiểm tra / DevTools thì bỏ qua
function ownWebContents(id) {
  if (id == null) return false;
  const win = getWin();
  const insp = inspector();
  return (win && win.webContents.id === id) || (insp && insp.id === id);
}

function installRequestLog(ses) {
  const wr = ses.webRequest;
  wr.onBeforeRequest((d, cb) => {
    cb({});
    if (/^(devtools|chrome-extension|data|blob):/i.test(d.url) || ownWebContents(d.webContentsId)) return;
    // file giao diện của chính app (toolbar.html, inspect.html…), trừ player.html bọc file .swf
    if (d.url.startsWith(APP_FILE_URL) && !d.url.startsWith(APP_FILE_URL + 'player.html')) return;
    httpLog.set(d.id, { id: d.id, start: Date.now(), method: d.method, url: d.url, type: d.resourceType,
                        status: 0, state: 'pending', error: '', ip: '', fromCache: false, end: 0,
                        reqHeaders: null, resHeaders: null, redirects: [] });
    trimMap(httpLog);
    httpUpdate(d.id, {});
  });
  wr.onSendHeaders((d) => httpUpdate(d.id, { reqHeaders: d.requestHeaders }));
  wr.onHeadersReceived((d, cb) => {
    const h = { ...d.responseHeaders };
    if (engineForUrl(d.url) === 'ruffle') {
      // Gỡ Content-Security-Policy để script Ruffle chạy được trên trang cấu hình Ruffle
      for (const k of Object.keys(h)) if (/^content-security-policy/i.test(k)) delete h[k];
      cb({ responseHeaders: h });
    } else cb({});
    httpUpdate(d.id, { status: d.statusCode, resHeaders: d.responseHeaders, statusLine: d.statusLine });
  });
  wr.onBeforeRedirect((d) => {
    const r = httpLog.get(d.id);
    if (r) httpUpdate(d.id, { redirects: [...r.redirects, `${d.statusCode} → ${d.redirectURL}`], status: d.statusCode });
  });
  wr.onCompleted((d) => {
    if (/\.swf(\?|#|$)/i.test(d.url) || d.resourceType === 'object') {
      try { seenSwfHosts.add(new URL(d.url).hostname); } catch {}
    }
    httpUpdate(d.id, { state: 'done', status: d.statusCode, ip: d.ip || '', fromCache: d.fromCache, end: Date.now() });
  });
  wr.onErrorOccurred((d) => {
    httpUpdate(d.id, { state: 'error', error: d.error, ip: d.ip || '', end: Date.now() });
  });
}

module.exports = { installRequestLog };
