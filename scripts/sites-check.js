// Bộ trang thử – phần kiểm tra thuần (không cần Electron): chữ "trình duyệt cũ / không hỗ trợ" và engine mong đợi.
const BAD_PATTERNS = [
  /unsupported browser/i, /browser (is )?(not|no longer) supported/i, /outdated browser/i, /update your browser/i,
  /this browser or app may not be secure/i, /trình duyệt (này )?(cũ|không được hỗ trợ|không an toàn)/i,
  /your browser is (out of date|not supported)/i, /please enable (javascript|cookies)/i,
];

// → mảng lý do lỗi (rỗng = đạt). site: {expectEngine?, expectUrl?}; got: {engine, url, title, text}
function checkSite(site, got) {
  const errs = [];
  if (site.expectEngine && got.engine !== site.expectEngine) errs.push(`engine ${got.engine || '?'} ≠ ${site.expectEngine}`);
  if (site.expectUrl && !new RegExp(site.expectUrl, 'i').test(got.url || '')) errs.push(`địa chỉ cuối “${got.url}” không khớp ${site.expectUrl}`);
  if (!got.title && !got.text) errs.push('trang trống (không có tiêu đề lẫn chữ)');
  const hay = `${got.title || ''}\n${got.text || ''}`;
  for (const re of BAD_PATTERNS) if (re.test(hay)) errs.push('báo trình duyệt không hợp: ' + re.source);
  return errs;
}

module.exports = { checkSite, BAD_PATTERNS };
