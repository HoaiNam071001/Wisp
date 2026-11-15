// Hàm chữ nhỏ dùng chung (logic thuần).
function shorten(s, n = 60) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
function pad2(n) { return String(n).padStart(2, '0'); }

module.exports = { shorten, pad2 };
