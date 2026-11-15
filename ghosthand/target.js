// Tab đích của lệnh + đổi toạ độ trang → màn hình.
const { screen } = require('electron');
const tabs = require('../tabs');
const { fail } = require('./protocol');

// tab: id (số / chuỗi số), URL hoặc tiêu đề chứa (không phân biệt hoa thường); trống = tab đang xem.
function resolveTab(arg) {
  const all = tabs.list().filter(t => !t.view.webContents.isDestroyed());
  if (arg === undefined || arg === '') {
    const t = tabs.activeTab();
    if (!t || t.view.webContents.isDestroyed()) fail('no_tab', 'không có tab đang xem');
    return t;
  }
  if (typeof arg === 'number' || /^\d+$/.test(arg)) {
    const t = all.find(x => x.id === Number(arg));
    if (!t) fail('no_tab', `không có tab id ${arg} – xem lệnh tabs`);
    return t;
  }
  const q = String(arg).toLowerCase();
  const t = all.find(x => x.view.webContents.getURL().toLowerCase().includes(q)) ||
    all.find(x => (x.title || '').toLowerCase().includes(q));
  if (!t) fail('no_tab', `không có tab nào có URL / tiêu đề chứa “${arg}”`);
  return t;
}

// Khung theo CSS px của trang → toạ độ màn hình (điểm DIP như chuột hệ điều hành) + tỉ lệ màn hình (pixel thật = × scale).
function screenRect(t, rect) {
  const win = tabs.getWin();
  if (!win || !rect) return null;
  const content = win.getContentBounds(), view = t.view.getBounds(), z = t.view.webContents.getZoomFactor();
  const r = { x: Math.round(content.x + view.x + rect.x * z), y: Math.round(content.y + view.y + rect.y * z),
    w: Math.round(rect.w * z), h: Math.round(rect.h * z) };
  // tab không xem nằm ngoài vùng nhìn (tabs.layout) – toạ độ màn hình chưa bấm được, phải activate trước
  if (t.id !== tabs.getActiveId()) r.offscreen = true;
  r.scale = screen.getDisplayMatching({ x: r.x, y: r.y, width: Math.max(1, r.w), height: Math.max(1, r.h) }).scaleFactor;
  return r;
}

module.exports = { resolveTab, screenRect };
