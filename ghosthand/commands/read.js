// Lệnh nhóm đọc: find, outline, read, pageText, screenshot.
const { fail } = require('../protocol');
const { resolveTab, screenRect } = require('../target');
const { callAgent } = require('../agent-call');

const pick = (a, keys) => { const o = {}; for (const k of keys) if (a[k] !== undefined) o[k] = a[k]; return o; };
const targetArgs = a => pick(a, ['ref', 'sels']);

module.exports = {
  async find(a) {
    const t = resolveTab(a.tab);
    const r = await callAgent(t.view.webContents, 'find', pick(a, ['sels', 'all', 'visibleOnly']));
    for (const f of r.found) f.screenRect = screenRect(t, f.rect);
    return r;
  },
  outline(a) {
    const t = resolveTab(a.tab);
    return callAgent(t.view.webContents, 'outline', pick(a, ['root', 'maxNodes', 'visibleOnly']), 15000);
  },
  read(a) {
    const t = resolveTab(a.tab);
    return callAgent(t.view.webContents, 'read', Object.assign(targetArgs(a), pick(a, ['what'])));
  },
  pageText(a) {
    const t = resolveTab(a.tab);
    return callAgent(t.view.webContents, 'pageText', pick(a, ['maxChars']));
  },
  // PNG base64 phần đang thấy của trang, hoặc khung một phần tử (ref / selector).
  async screenshot(a) {
    if (a.fullPage) fail('bad_args', 'fullPage chưa hỗ trợ – chụp phần đang thấy hoặc một phần tử');
    const t = resolveTab(a.tab), w = t.view.webContents;
    let area;
    if (a.ref || a.sels) {
      const { rect } = await callAgent(w, 'rect', targetArgs(a));
      const z = w.getZoomFactor();
      area = { x: Math.max(0, Math.round(rect.x * z)), y: Math.max(0, Math.round(rect.y * z)),
        width: Math.max(1, Math.round(rect.w * z)), height: Math.max(1, Math.round(rect.h * z)) };
    }
    const img = await (area ? w.capturePage(area) : w.capturePage());
    const size = img.getSize();
    return { png: img.toPNG().toString('base64'), w: size.width, h: size.height };
  },
};
