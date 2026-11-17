# 05. 🔄 Trình duyệt như Chrome thường

Phụ thuộc: 04

**Xong khi:** Bộ trang thử qua hết; không trang nào báo trình duyệt cũ / không hỗ trợ.

- ✅ **UA** (2026-11-17: `ua.js` + test – bỏ `Electron/` / `wisp/`, rút gọn `Chrome/156.0.0.0` như Chrome thật; Client Hints brands `Chromium 156` (Electron không có brand "Google Chrome") khớp số bản; thử bằng trang local in UA / `userAgentData`; chưa so trên browserleaks): `app.userAgentFallback` = UA Chrome cùng số bản Chromium đang chạy (`process.versions.chrome`), bỏ `Electron/…`, `wisp/…`. Client Hints (`Sec-CH-UA`, `navigator.userAgentData.brands`) có "Google Chrome" / "Chromium" đúng số bản – kiểm tra trên https://browserleaks.com/client-hints không lệch với UA.
- 🔄 **Popup / OAuth** (2026-11-17: `popup-policy.js` + test; popup có `width` / `height` / `popup` → cửa sổ thật `sandbox:false` giữ `opener`, thử `postMessage` về trang gốc OK; popup không tự mở thêm cửa sổ; link thường vẫn tab mới. Còn: thử đăng nhập Google / Facebook thật): `setWindowOpenHandler` – `window.open` có `features` (popup đăng nhập) → cửa sổ thật giữ `opener` và `postMessage`; link `target=_blank` → tab mới. Thử "Đăng nhập bằng Google / Facebook" trên vài trang.
- 🔄 **Quyền** (2026-11-17: `permission-policy.js` + test, `permissions.js` – hộp hỏi Cho phép / Chặn, nhớ theo domain ở `config.sitePermissions`; quyền an toàn (toàn màn hình, clipboard ghi…) tự cho, quyền lạ từ chối. Còn: thử tay hộp hỏi, màn hình xoá / sửa quyền đã nhớ): `setPermissionRequestHandler` hỏi người dùng (camera, mic, thông báo, vị trí, clipboard), nhớ theo domain; trang chưa hỏi thì từ chối.
- ⬜ **Session:** `persist:web` lưu cookie / localStorage / cache lâu dài; engine flash dùng dữ liệu riêng (Chromium 87 không đọc được cookie bản mới). Menu xoá dữ liệu duyệt web.
- 🔄 **Tải file** (2026-11-17: `downloads.js` + `download-name.js` + test – lưu vào Downloads không đè file có sẵn, tiến độ ở vòng tròn toolbar, toast khi xong; thử tải 5000 byte OK. Chọn: không hỏi chỗ lưu (mặc định Downloads). Còn: mục menu "Mở thư mục Tải về"): `will-download` → hỏi chỗ lưu / mặc định Downloads, tiến độ trên toolbar, mở thư mục.
- ⬜ **Khác:** PDF viewer, in, zoom theo trang, tìm trong trang (Cmd/Ctrl+F), chặn mở `file://` từ trang web.
- ⬜ **Đăng nhập Google:** thử trực tiếp trên bản mới. Google báo "Trình duyệt này hoặc ứng dụng có thể không an toàn" → không cố vượt: nút **Đăng nhập bằng trình duyệt hệ thống** (mở `shell.openExternal`), ghi chú cho người dùng.
- ⬜ **Bộ trang thử** (`test/sites.json` + script chạy Wisp mở lần lượt, chụp ảnh, ghi lỗi console / trạng thái): google.com, accounts.google.com, youtube.com, facebook.com, github.com, một trang Cloudflare, một trang có reCAPTCHA, cf4vn.bar (đã bật Flash → phải mở bằng engine flash). Chạy trước mỗi bản phát hành.
