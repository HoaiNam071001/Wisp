// Nhập dấu trang từ Chrome / file HTML – logic thuần (không require electron).
// Bản đầu chưa có thư mục → làm phẳng; thanh dấu trang Chrome xếp trước, rồi "other", "synced".
const { isBookmarkable } = require('./bookmarks-store');

const ROOT_ORDER = ['bookmark_bar', 'other', 'synced'];

function walk(node, out) {
  if (!node) return;
  if (node.type === 'url' && typeof node.url === 'string') out.push({ url: node.url, title: String(node.name || '') });
  else if (Array.isArray(node.children)) for (const c of node.children) walk(c, out);
}

// json: nội dung file `Bookmarks` của Chrome (đã JSON.parse) → [{url, title}] chỉ http(s)
function fromChromeJson(json) {
  const out = [];
  const roots = (json && json.roots) || {};
  for (const k of ROOT_ORDER) walk(roots[k], out);
  return out.filter(b => isBookmarkable(b.url));
}

function decode(s) {
  return s.replace(/&(amp|lt|gt|quot|#39|#x27);/gi, (_m, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", '#x27': "'" }[e.toLowerCase()]));
}

// File HTML kiểu Netscape (Chrome / Firefox / Edge xuất): <A HREF="…">tên</A>
function fromHtml(html) {
  const out = [];
  const re = /<a\s[^>]*?href\s*=\s*"([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(String(html || '')))) out.push({ url: decode(m[1]), title: decode(m[2].replace(/<[^>]*>/g, '')).trim() });
  return out.filter(b => isBookmarkable(b.url));
}

// Thêm các mục chưa có (theo URL) vào danh sách dấu trang. Giữ thứ tự nguồn: mục đầu nguồn = mới nhất
// (danh sách hiển thị theo addedAt giảm dần). → { list, added }
function mergeImported(list, imported, now, rand = Math.random) {
  const seen = new Set(list.filter(b => !b.deleted).map(b => b.url));
  const fresh = [];
  for (const b of imported) {
    if (seen.has(b.url)) continue;
    seen.add(b.url);
    fresh.push(b);
  }
  const added = fresh.map((b, i) => {
    const t = now - i; // lệch 1 ms mỗi mục để giữ thứ tự khi sắp theo addedAt
    return { id: t.toString(36) + '-' + Math.floor(rand() * 1e9).toString(36), url: b.url, title: b.title.slice(0, 300), addedAt: t, updatedAt: t, order: now + i }; // order tăng dần = đúng thứ tự trên thanh Chrome
  });
  return { list: list.concat(added), added: added.length };
}

module.exports = { fromChromeJson, fromHtml, mergeImported };
