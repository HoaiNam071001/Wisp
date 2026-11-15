# 05. ⬜ Chế độ Web như Chrome thường

Phụ thuộc: 04

**Xong khi:** Bộ trang thử qua hết; không trang nào báo trình duyệt cũ / không hỗ trợ.

- ⬜ **UA:** `app.userAgentFallback` = UA Chrome cùng số bản Chromium đang chạy (`process.versions.chrome`), bỏ `Electron/…`, `wisp/…`. Client Hints (`Sec-CH-UA`, `navigator.userAgentData.brands`) có "Google Chrome" / "Chromium" đúng số bản – kiểm tra trên https://browserleaks.com/client-hints không lệch với UA.
- ⬜ **Popup / OAuth:** `setWindowOpenHandler` – `window.open` có `features` (popup đăng nhập) → cửa sổ thật giữ `opener` và `postMessage`; link `target=_blank` → tab mới. Thử "Đăng nhập bằng Google / Facebook" trên vài trang.
- ⬜ **Quyền:** `setPermissionRequestHandler` hỏi người dùng (camera, mic, thông báo, vị trí, clipboard), nhớ theo domain; trang chưa hỏi thì từ chối.
- ⬜ **Session:** `persist:web` lưu cookie / localStorage / cache lâu dài; tách khỏi session Game. Menu xoá dữ liệu duyệt web.
- ⬜ **Tải file:** `will-download` → hỏi chỗ lưu / mặc định Downloads, tiến độ trên toolbar, mở thư mục.
- ⬜ **Khác:** PDF viewer, in, zoom theo trang, tìm trong trang (Cmd/Ctrl+F), chặn mở `file://` từ trang web.
- ⬜ **Đăng nhập Google:** thử trực tiếp trên bản mới. Google báo "Trình duyệt này hoặc ứng dụng có thể không an toàn" → không cố vượt: nút **Đăng nhập bằng trình duyệt hệ thống** (mở `shell.openExternal`), ghi chú cho người dùng.
- ⬜ **Bộ trang thử** (`test/sites.json` + script chạy Wisp mở lần lượt, chụp ảnh, ghi lỗi console / trạng thái): google.com, accounts.google.com, youtube.com, facebook.com, github.com, một trang Cloudflare, một trang có reCAPTCHA, cf4vn.bar (phải chuyển Game). Chạy trước mỗi bản phát hành.
