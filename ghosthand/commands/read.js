// Lệnh nhóm đọc: find, outline, read, pageText, screenshot.
const { fail } = require('../protocol');
const { resolveTab, screenRect } = require('../target');
const { callPage } = require('../page-call');

const pick = (a, keys) => { const o = {}; for (const k of keys) if (a[k] !== undefined) o[k] = a[k]; return o; };
const targetArgs = a => pick(a, ['ref', 'sels']);

module.exports = {
  async find(a) {
    const t = resolveTab(a.tab);
    const r = await callPage(t.view.webContents, 'find', pick(a, ['sels', 'all', 'visibleOnly', 'scope', 'brief']));
    for (const f of r.found) f.screenRect = screenRect(t, f.rect);
    return r;
  },
  outline(a) {
    const t = resolveTab(a.tab);
    return callPage(t.view.webContents, 'outline', pick(a, ['root', 'maxNodes', 'visibleOnly']), 15000);
  },
  read(a) {
    const t = resolveTab(a.tab);
    return callPage(t.view.webContents, 'read', Object.assign(targetArgs(a), pick(a, ['what'])));
  },
  pageText(a) {
    const t = resolveTab(a.tab);
    return callPage(t.view.webContents, 'pageText', pick(a, ['maxChars']));
  },
  // Khung game trên màn hình (Ghosthand OCR / bấm chuột thật đúng vùng). Bước 04: trang Flash ở engine riêng → đổi cách lấy.
  async frameRect(a) {
    const t = resolveTab(a.tab);
    const r = await callPage(t.view.webContents, 'gameRect', {});
    return { tag: r.tag, rect: r.rect, screenRect: screenRect(t, r.rect) };
  },
  // PNG base64 phần đang thấy của trang, hoặc khung một phần tử (ref / selector).
  async screenshot(a) {
    if (a.fullPage) fail('bad_args', 'fullPage chưa hỗ trợ – chụp phần đang thấy hoặc một phần tử');
    const t = resolveTab(a.tab), w = t.view.webContents;
    let area;
    if (a.ref || a.sels) {
      const { rect } = await callPage(w, 'rect', targetArgs(a));
      const z = w.getZoomFactor();
      area = { x: Math.max(0, Math.round(rect.x * z)), y: Math.max(0, Math.round(rect.y * z)),
        width: Math.max(1, Math.round(rect.w * z)), height: Math.max(1, Math.round(rect.h * z)) };
    }
    const img = await (area ? w.capturePage(area) : w.capturePage());
    const size = img.getSize();
    return { png: img.toPNG().toString('base64'), w: size.width, h: size.height };
  },
};
