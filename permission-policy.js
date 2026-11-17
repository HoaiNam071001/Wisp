// Chính sách quyền của trang web (logic thuần): cái nào tự cho, cái nào hỏi người dùng, cái nào từ chối.
// Lưu theo domain gốc đang xin: { "meet.google.com": { media: true, geolocation: false } }.
const AUTO_ALLOW = ['fullscreen', 'clipboard-sanitized-write', 'pointerLock', 'keyboardLock', 'window-management', 'idle-detection'];
const ASK = {
  media: 'camera / micro', geolocation: 'vị trí của bạn', notifications: 'gửi thông báo',
  'clipboard-read': 'đọc bộ nhớ tạm', midi: 'thiết bị MIDI', 'display-capture': 'quay màn hình',
};

function originHost(url) { try { return new URL(url).hostname; } catch { return ''; } }

// → 'allow' | 'deny' | 'ask'
function decide(permission, host, saved) {
  if (AUTO_ALLOW.includes(permission)) return 'allow';
  if (!ASK[permission] || !host) return 'deny';
  const v = saved && saved[host] && saved[host][permission];
  return v === true ? 'allow' : v === false ? 'deny' : 'ask';
}

function remember(saved, host, permission, allowed) {
  const out = Object.assign({}, saved);
  out[host] = Object.assign({}, out[host], { [permission]: !!allowed });
  return out;
}

module.exports = { decide, remember, originHost, ASK };
