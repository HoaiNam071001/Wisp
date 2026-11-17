// Menu chuột phải trong nội dung tab: link / ảnh / chữ chọn / ô nhập, điều hướng, Flash cho trang, kiểm tra phần tử.
const { Menu, clipboard } = require('electron');
const tabs = require('./tabs');
const siteMenu = require('./flash/site-menu');
const { displayUrl, isLauncherUrl } = require('./app-urls');
const { openInspector } = require('./inspect/window');
const { shorten } = require('./util');

function hostOf(url) { try { return new URL(url).hostname; } catch { return ''; } }
const isWeb = (u) => /^https?:/i.test(u || '');

function linkItems(p, open) {
  if (!p.linkURL) return [];
  return [
    { label: 'Mở link ở tab mới', enabled: isWeb(p.linkURL), click: () => open(p.linkURL) },
    { label: 'Sao chép địa chỉ link', click: () => clipboard.writeText(p.linkURL) },
    { type: 'separator' },
  ];
}

function imageItems(w, p, open) {
  if (p.mediaType !== 'image' || !p.srcURL) return [];
  return [
    { label: 'Mở ảnh ở tab mới', enabled: isWeb(p.srcURL), click: () => open(p.srcURL) },
    { label: 'Sao chép ảnh', click: () => w.copyImageAt(p.x, p.y) },
    { label: 'Sao chép địa chỉ ảnh', click: () => clipboard.writeText(p.srcURL) },
    { type: 'separator' },
  ];
}

function textItems(p, open) {
  const f = p.editFlags;
  if (p.isEditable) {
    return [
      { label: 'Hoàn tác', role: 'undo', enabled: f.canUndo }, { label: 'Làm lại', role: 'redo', enabled: f.canRedo },
      { type: 'separator' },
      { label: 'Cắt', role: 'cut', enabled: f.canCut }, { label: 'Sao chép', role: 'copy', enabled: f.canCopy },
      { label: 'Dán', role: 'paste', enabled: f.canPaste }, { label: 'Chọn tất cả', role: 'selectAll', enabled: f.canSelectAll },
      { type: 'separator' },
    ];
  }
  if (!p.selectionText) return [];
  const q = p.selectionText.trim();
  return [
    { label: 'Sao chép', role: 'copy' },
    { label: `Tìm trên Google "${shorten(q, 24)}"`, click: () => open('https://www.google.com/search?q=' + encodeURIComponent(q)) },
    { type: 'separator' },
  ];
}

function template(t, w, p) {
  const open = (url) => tabs.createTab(url, { index: tabs.list().indexOf(t) + 1, activate: false });
  const nav = w.navigationHistory;
  const url = displayUrl(w.getURL());
  const items = [
    ...linkItems(p, open), ...imageItems(w, p, open), ...textItems(p, open),
    { label: 'Quay lại', enabled: nav.canGoBack(), click: () => nav.goBack() },
    { label: 'Tiến', enabled: nav.canGoForward(), click: () => nav.goForward() },
    { label: 'Tải lại', click: () => w.reload() },
  ];
  if (isWeb(url)) {
    const host = hostOf(url);
    items.push({ type: 'separator' }, siteMenu.menuItem(host));
    if (!isLauncherUrl(w.getURL())) items.push({ label: 'Sao chép địa chỉ trang', click: () => clipboard.writeText(url) });
  }
  items.push(
    { type: 'separator' },
    { label: 'Kiểm tra phần tử', click: () => w.inspectElement(p.x, p.y) },
    { label: 'Bảng kiểm tra Wisp', click: () => openInspector() },
  );
  return items;
}

tabs.events.on('created', (t) => {
  const w = t.view.webContents;
  w.on('context-menu', (_e, params) => {
    const win = tabs.getWin();
    if (!win || w.isDestroyed()) return;
    Menu.buildFromTemplate(template(t, w, params)).popup({ window: win });
  });
});
