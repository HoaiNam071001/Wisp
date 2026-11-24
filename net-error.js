// Trang lỗi khi không tải được trang chính (mất mạng, sai tên miền, chứng chỉ hỏng…) + cho phép tiếp tục có chủ ý.
// Chỉ "vẫn tiếp tục" mới bỏ qua lỗi chứng chỉ, theo từng host và chỉ trong lần chạy này (không lưu).
const { app } = require('electron');
const tabs = require('./tabs');
const { errorPageUrl, parseAction } = require('./error-page');

const allowedHosts = new Set();
const hostOf = (u) => { try { return new URL(u).host; } catch { return ''; } };

app.on('certificate-error', (e, _wc, url, _error, _cert, callback) => {
  e.preventDefault();
  callback(allowedHosts.has(hostOf(url)));
});

tabs.events.on('load-failed', (t, { code, desc, url }) => {
  if (!/^https?:/i.test(url)) return;
  const page = errorPageUrl(url, code, desc);
  if (!page) return;
  t.crashedUrl = url; // thanh địa chỉ vẫn hiện địa chỉ gõ, không phải data: URL
  t.view.webContents.loadURL(page).catch(() => {});
});

tabs.events.on('error-action', (t, link) => {
  const a = parseAction(link);
  if (!a) return;
  const w = t.view.webContents;
  if (a.action === 'proceed') allowedHosts.add(hostOf(a.url));
  tabs.load(w, a.action === 'http' ? a.url.replace(/^https:/i, 'http:') : a.url);
});
