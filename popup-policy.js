// Chính sách window.open (logic thuần): popup có "features" (đăng nhập Google / Facebook, thanh toán) phải là
// cửa sổ thật giữ opener để postMessage / window.close chạy; link thường / target=_blank → tab mới.
function parseFeatures(features) {
  const o = {};
  for (const part of String(features || '').split(',')) {
    const [k, v] = part.split('=').map((s) => s.trim().toLowerCase());
    if (k) o[k] = v === undefined ? 'yes' : v;
  }
  return o;
}

// → { popup: bool, width?, height? }
function popupFor({ url, disposition, features }) {
  if (!/^https?:|^about:blank$/i.test(String(url || ''))) return { popup: false };
  const f = parseFeatures(features);
  const sized = Number(f.width) > 0 || Number(f.height) > 0 || f.popup === 'yes' || f.popup === '1' || f.popup === 'true';
  if (disposition !== 'new-window' || !sized) return { popup: false };
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  return { popup: true, width: clamp(Number(f.width) || 500, 300, 1600), height: clamp(Number(f.height) || 650, 300, 1200) };
}

module.exports = { popupFor, parseFeatures };
