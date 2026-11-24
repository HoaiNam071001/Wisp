// Gộp dữ liệu giữa hai máy – logic thuần (Node 12, không require electron). Dùng cho bước 11.
// Mục có `updatedAt`, xoá = mốc `deleted` (tombstone): bên mới hơn thắng; bằng nhau thì xoá thắng (không sống lại nhầm).

// Dấu trang: [{ id, updatedAt, deleted? }] → gộp theo id
function mergeItems(local, remote) {
  const out = new Map();
  for (const it of [].concat(local || [], remote || [])) {
    if (!it || typeof it.id !== 'string' || typeof it.updatedAt !== 'number') continue;
    const cur = out.get(it.id);
    if (!cur || it.updatedAt > cur.updatedAt || (it.updatedAt === cur.updatedAt && it.deleted && !cur.deleted)) out.set(it.id, it);
  }
  return Array.from(out.values());
}

// Lịch sử: [{ url, title, time }] (id cục bộ không đưa lên) → bỏ trùng url + time, giữ `max` mục gần nhất, cũ → mới
function mergeHistory(local, remote, max) {
  const seen = new Set(), all = [];
  for (const h of [].concat(local || [], remote || [])) {
    if (!h || typeof h.url !== 'string' || typeof h.time !== 'number') continue;
    const k = h.time + '|' + h.url;
    if (seen.has(k)) continue;
    seen.add(k);
    all.push({ url: h.url, title: String(h.title || ''), time: h.time });
  }
  all.sort((a, b) => a.time - b.time);
  return max > 0 && all.length > max ? all.slice(all.length - max) : all;
}

// Cấu hình: chỉ các khoá `keys`. Dạng đồng bộ: { khoá: { v: giá trị, t: mốc } } – khoá mới hơn thắng, bằng nhau giữ bản máy này.
function pickConfig(config, keys, stamps, now) {
  const out = {};
  for (const k of keys) {
    if (config[k] === undefined) continue;
    const st = stamps && stamps[k];
    out[k] = { v: config[k], t: st && JSON.stringify(st.v) === JSON.stringify(config[k]) ? st.t : now };
  }
  return out;
}

function mergeConfig(local, remote, keys) {
  const out = {};
  for (const k of keys) {
    const a = local && local[k], b = remote && remote[k];
    const ok = (x) => x && typeof x.t === 'number';
    if (ok(a) && ok(b)) out[k] = b.t > a.t ? b : a;
    else if (ok(a) || ok(b)) out[k] = ok(a) ? a : b;
  }
  return out;
}

module.exports = { mergeItems, mergeHistory, pickConfig, mergeConfig };
