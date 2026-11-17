// Lệnh nhóm đọc: find, outline, read, pageText, screenshot.
const { fail } = require('../protocol');
const { resolveTab, screenRect, flashScreenRect } = require('../target');
const flashRouter = require('../../flash-engine/router');
const launcher = require('../../flash/launcher');
const { captureFullPage } = require('../fullpage');
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
  // Khung game trên màn hình (Ghosthand OCR / bấm chuột thật đúng vùng). Game Flash: hỏi engine Flash (không có DOM).
  async frameRect(a) {
    const t = resolveTab(a.tab, { flashOk: true });
    if (launcher.isFlashTab(t.id)) return { tag: 'flash', rect: null, screenRect: flashScreenRect(await flashRouter.frameRect()) };
    const r = await callPage(t.view.webContents, 'gameRect', {});
    return { tag: r.tag, rect: r.rect, screenRect: screenRect(t, r.rect) };
  },
  // PNG base64 phần đang thấy của trang, hoặc khung một phần tử (ref / selector).
  async screenshot(a) {
    const t = resolveTab(a.tab), w = t.view.webContents;
    if (a.fullPage) {
      if (a.ref || a.sels) fail('bad_args', 'fullPage không đi cùng ref / selector');
      return captureFullPage(w);
    }
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
