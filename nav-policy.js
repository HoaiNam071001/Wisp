// Chính sách điều hướng (logic thuần): trang web http(s) không được dẫn sang file:// (đọc file máy / lộ đường dẫn).
// Trang nội bộ của app (lịch sử, trang chờ Flash, player) là file: nên file → file vẫn cho; gõ ở thanh địa chỉ không qua đây.
function blockedNavigation(fromUrl, toUrl) {
  const to = String(toUrl || '');
  if (!/^file:/i.test(to)) return false;
  return /^(https?|blob|data|about):/i.test(String(fromUrl || ''));
}

module.exports = { blockedNavigation };
