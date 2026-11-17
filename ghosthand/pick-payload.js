// Chọn element (bước 06): kiểm tin nhắn từ agent trong trang trước khi đẩy sang Ghosthand. Logic thuần, không require('electron').
// Tin đến từ preload của tab nhưng vẫn kiểm: kiểu, độ dài, hành động hợp lệ – Ghosthand không phải tin dữ liệu lạ.
const ACTIONS = ['click', 'type', 'waitFor', 'read', 'copy'];
const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');

// Nhãn khi rê chuột: role "tên" (thiếu tên thì chỉ role, thiếu cả hai thì thẻ).
function hoverLabel(role, name, tag) {
  const n = String(name || '').trim().slice(0, 40);
  if (role && n) return `${role} “${n}”`;
  return role || String(tag || '').toLowerCase() || 'phần tử';
}

// Tin 'gh:pick' → dữ liệu sự kiện `pick` (chưa có tab / url – main thêm); null = bỏ.
function normalize(raw) {
  if (!raw || typeof raw !== 'object' || !ACTIONS.includes(raw.action)) return null;
  const selector = str(raw.selector, 2000).trim();
  if (!selector) return null;
  const selectors = Array.isArray(raw.selectors) ? raw.selectors.map(s => str(s, 2000)).filter(Boolean).slice(0, 8) : [];
  if (!selectors.includes(selector)) selectors.unshift(selector);
  const out = {
    action: raw.action, selector, selectors,
    count: Number.isInteger(raw.count) && raw.count >= 0 ? raw.count : 0,
    role: str(raw.role, 40), name: str(raw.name, 200), text: str(raw.text, 500), value: str(raw.value, 500),
  };
  if (raw.action === 'type') out.input = str(raw.input, 10000);
  return out;
}

module.exports = { ACTIONS, hoverLabel, normalize };
