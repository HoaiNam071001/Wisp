// Dấu trang – logic thuần (không require electron). Mỗi mục { id, url, title, addedAt, updatedAt, deleted? }:
// xoá = đặt mốc `deleted` (tombstone) để bước 11 (đồng bộ Google) gộp được giữa hai máy, không mất / sống lại nhầm.
const MAX_ITEMS = 5000;

function clean(list) {
  if (!Array.isArray(list)) return [];
  return list.filter(b => b && typeof b.id === 'string' && typeof b.url === 'string' && typeof b.updatedAt === 'number')
    .map(b => ({ id: b.id, url: b.url, title: String(b.title || ''), addedAt: Number(b.addedAt) || b.updatedAt,
                 updatedAt: b.updatedAt, ...(typeof b.deleted === 'number' ? { deleted: b.deleted } : {}) }));
}

function isBookmarkable(url) { return /^https?:\/\//i.test(String(url || '')); }

function live(list) { return list.filter(b => !b.deleted); }
function find(list, url) { return live(list).find(b => b.url === url) || null; }
function has(list, url) { return !!find(list, url); }

// Mới → cũ, bỏ mục đã xoá
function sorted(list) { return live(list).sort((a, b) => b.addedAt - a.addedAt); }

function newId(now, rand) { return now.toString(36) + '-' + Math.floor(rand * 1e9).toString(36); }

// → danh sách mới; đã có thì xoá (tombstone), chưa có thì thêm. URL không phải http(s) → giữ nguyên.
function toggle(list, url, title, now, rand = Math.random()) {
  if (!isBookmarkable(url)) return list;
  const cur = find(list, url);
  if (cur) return list.map(b => b.id === cur.id ? { ...b, deleted: now, updatedAt: now } : b);
  const next = list.concat({ id: newId(now, rand), url, title: String(title || '').slice(0, 300), addedAt: now, updatedAt: now });
  return next.length > MAX_ITEMS ? prune(next) : next;
}

function remove(list, id, now) {
  return list.map(b => b.id === id && !b.deleted ? { ...b, deleted: now, updatedAt: now } : b);
}

// Quá giới hạn: bỏ tombstone cũ trước, rồi mục sống cũ nhất
function prune(list) {
  if (list.length <= MAX_ITEMS) return list;
  const keep = list.slice().sort((a, b) => (a.deleted ? 1 : 0) - (b.deleted ? 1 : 0) || b.updatedAt - a.updatedAt);
  return keep.slice(0, MAX_ITEMS);
}

module.exports = { clean, isBookmarkable, live, find, has, sorted, toggle, remove, prune, MAX_ITEMS };
