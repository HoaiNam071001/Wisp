// Các việc nền có tiến độ (cập nhật Wisp, cài Flash…) – logic thuần, không require electron.
// toolbar-ipc.js nghe 'changed' để vẽ vòng tròn tiến độ ở góc phải thanh công cụ + thanh tiến độ trên Dock / taskbar.
const { EventEmitter } = require('events');

const events = new EventEmitter();
const tasks = new Map(); // id → { label, fraction }; fraction null = chưa biết (vòng quay)

function clamp(f) { return f == null || isNaN(f) ? null : Math.max(0, Math.min(1, f)); }

// Việc mới nhất đang chạy; count > 1 khi chạy song song
function summary() {
  if (!tasks.size) return null;
  const last = [...tasks.values()].pop();
  return { count: tasks.size, label: last.label, fraction: last.fraction };
}

// Tạo mới hoặc cập nhật; bỏ qua cập nhật nhỏ hơn 1% cùng nhãn để không làm ồn giao diện
function set(id, label, fraction) {
  const f = clamp(fraction);
  const cur = tasks.get(id);
  if (cur && cur.label === label && (cur.fraction === f || (cur.fraction != null && f != null && Math.abs(cur.fraction - f) < 0.01))) return;
  tasks.delete(id); // xoá rồi thêm lại để việc vừa cập nhật nằm cuối = việc được hiển thị
  tasks.set(id, { label, fraction: f });
  events.emit('changed', summary());
}

function finish(id) {
  if (tasks.delete(id)) events.emit('changed', summary());
}

module.exports = { events, set, finish, summary };
