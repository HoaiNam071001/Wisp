// UA như Chrome thường (logic thuần): bỏ Electron/ + tên app, và rút gọn số bản như Chrome thật (UA reduction:
// Chrome/156.0.0.0 – số đầy đủ chỉ có ở Client Hints). Không đổi nền tảng / WebKit – chỉ khớp bản Chromium đang chạy.
function chromeUserAgent(ua) {
  return String(ua)
    .replace(/\s?(Electron|wisp|flash-browser)\/\S+/gi, '')
    .replace(/(Chrome\/\d+)\.\d+\.\d+\.\d+/, '$1.0.0.0');
}

module.exports = { chromeUserAgent };
