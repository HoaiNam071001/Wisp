// Ghép kết quả agent của nhiều frame (frame khác nguồn có agent riêng – docs/plan/01). Logic thuần, không require('electron').
//   compose: gốc toạ độ + vùng nhìn thấy của từng frame trong trang chính, từ báo cáo frames() của mọi agent.
//   pickFirst: agent có selector khớp sớm nhất (cùng thứ tự selector như khi chỉ có một trang).

const cut = (a, b) => {
  const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);
  return { x, y, w: Math.max(0, Math.min(a.x + a.w, b.x + b.w) - x), h: Math.max(0, Math.min(a.y + a.h, b.y + b.h) - y) };
};

// reports: [{key, self, frames: [{path, box, clip}]}] – self = đường dẫn frame của agent ("" = trang chính); box / clip
// của frame con theo toạ độ của agent đó. Trả Map key → {x, y, clip, path, owner}: gốc của frame trong trang chính,
// clip = phần nhìn thấy (null = khung chính, dùng viewport của nó), owner = key agent chứa thẻ iframe.
// Agent không tìm thấy thẻ iframe của mình (iframe ẩn / đã gỡ) → không có trong kết quả.
function compose(reports) {
  const owner = new Map();
  for (const r of reports) for (const f of r.frames || []) owner.set(f.path, { r, f });
  const out = new Map();
  const resolve = r => {
    if (out.has(r.key)) return out.get(r.key);
    let v = null;
    if (r.self === '') v = { x: 0, y: 0, clip: null, path: '', owner: null };
    else {
      const o = owner.get(r.self);
      // thẻ iframe phải nằm ở frame cha (đường dẫn ngắn hơn) – chặn vòng lặp khi báo cáo lệch
      const p = o && o.r !== r && r.self.startsWith(o.r.self) ? resolve(o.r) : null;
      if (p) {
        const shifted = { x: o.f.clip.x + p.x, y: o.f.clip.y + p.y, w: o.f.clip.w, h: o.f.clip.h };
        v = { x: p.x + o.f.box.x, y: p.y + o.f.box.y, clip: p.clip ? cut(shifted, p.clip) : shifted, path: r.self, owner: o.r.key };
      }
    }
    out.set(r.key, v);
    return v;
  };
  for (const r of reports) resolve(r);
  for (const [k, v] of out) if (!v) out.delete(k);
  return out;
}

// results: kết quả firstIndex {index, hidden} theo thứ tự agent (null = agent không trả lời). Chọn index nhỏ nhất,
// bằng nhau thì agent đứng trước (khung chính trước). Không agent nào khớp → {agent: -1, hidden: nhiều nhất}.
function pickFirst(results) {
  let agent = -1, index = -1, hidden = 0;
  results.forEach((r, i) => {
    if (!r) return;
    hidden = Math.max(hidden, r.hidden || 0);
    if (r.index >= 0 && (index < 0 || r.index < index)) { agent = i; index = r.index; }
  });
  return { agent, index, hidden };
}

// So đường dẫn frame theo thứ tự trang ("" < "0" < "0.1" < "1" < "10").
function pathOrder(a, b) {
  const x = a ? a.split('.').map(Number) : [], y = b ? b.split('.').map(Number) : [];
  for (let i = 0; i < Math.min(x.length, y.length); i++) if (x[i] !== y[i]) return x[i] - y[i];
  return x.length - y.length;
}

module.exports = { compose, pickFirst, pathOrder };
