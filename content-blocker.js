// Chặn quảng cáo / theo dõi bên thứ ba + tín hiệu Sec-GPC cho session web (không đụng engine Flash – session riêng).
// request-log.js giữ listener onBeforeRequest duy nhất, gọi decide() ở đây để huỷ request.
const { webContents } = require('electron');
const tabs = require('./tabs');
const { loadConfig } = require('./config');
const { shouldBlock } = require('./blocklist');

// Trả true = huỷ request. Đếm theo tab để popover thông tin trang hiện "đã chặn N".
function decide(d) {
  const w = d.webContentsId != null ? webContents.fromId(d.webContentsId) : null;
  if (!w || w.isDestroyed()) return false;
  const block = shouldBlock({ url: d.url, resourceType: d.resourceType, pageUrl: w.getURL() }, loadConfig());
  if (block) {
    const t = tabs.list().find(x => x.view.webContents === w);
    if (t) t.blocked = (t.blocked || 0) + 1;
  }
  return block;
}

// Global Privacy Control: bảo trang đừng bán / chia sẻ dữ liệu (không đổi gì ở dấu vân tay)
function installGpc(ses) {
  ses.webRequest.onBeforeSendHeaders({ urls: ['http://*/*', 'https://*/*'] }, (d, cb) => {
    if (loadConfig().sendGpc === false) return cb({});
    cb({ requestHeaders: { ...d.requestHeaders, 'Sec-GPC': '1' } });
  });
}

tabs.events.on('navigated', (t) => { t.blocked = 0; });

module.exports = { decide, installGpc };
