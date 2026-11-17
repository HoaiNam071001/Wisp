// Chạy trong trang (preload, thế giới riêng): trang có <embed|object> .swf thì gọi notify một lần.
// Không gắn gì vào window / DOM của trang. Quét lúc tải xong rồi quét lại một lần cho nội dung dựng muộn.
const SEL = 'embed[src*=".swf" i], object[data*=".swf" i], object param[value*=".swf" i]';

function install(notify) {
  let sent = false;
  const scan = () => {
    if (sent) return;
    try { if (document.querySelector(SEL)) { sent = true; notify(); } } catch { /* trang đang huỷ */ }
  };
  window.addEventListener('DOMContentLoaded', scan);
  window.addEventListener('load', () => { scan(); setTimeout(scan, 2000); });
}

module.exports = { install };
