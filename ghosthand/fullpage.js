// Chụp cả trang (không cuộn, trang không thấy): CDP Page.captureScreenshot + captureBeyondViewport qua webContents.debugger.
// Không mở cổng gỡ lỗi. Debugger có thể đã do dialogs.js gắn → dùng chung, không gỡ của người khác.
const { fail } = require('./protocol');

const MAX_PX = 16000; // cạnh dài nhất (CSS px) – trang vô tận / rất dài không làm nổ bộ nhớ

async function captureFullPage(w) {
  const d = w.debugger;
  const own = !d.isAttached();
  if (own) {
    try { d.attach('1.3'); } catch (e) { fail('internal', 'không gắn được debugger để chụp cả trang – ' + e.message); }
  }
  try {
    const m = await d.sendCommand('Page.getLayoutMetrics');
    const size = m.cssContentSize || m.contentSize;
    const width = Math.min(Math.ceil(size.width), MAX_PX), height = Math.min(Math.ceil(size.height), MAX_PX);
    const r = await d.sendCommand('Page.captureScreenshot', {
      format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width, height, scale: 1 },
    });
    return { png: r.data, w: width, h: height, truncated: size.width > MAX_PX || size.height > MAX_PX };
  } finally {
    if (own && !w.isDestroyed()) { try { d.detach(); } catch { /* đã tách */ } }
  }
}

module.exports = { captureFullPage };
