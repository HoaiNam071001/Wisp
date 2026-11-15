# Quyết định đã chốt

Không bàn lại điều đã chốt; muốn đổi → skill `new-request` (ghi *thay bởi*, không xoá dòng cũ).

- **2026-11-15** – Web game Flash chạy ở **chế độ Game riêng** (tiến trình + cửa sổ riêng, Electron 11 + Pepper Flash); mọi trang khác chạy ở chế độ **Web** (Electron mới). Lý do: Pepper Flash chỉ chạy tới Electron 11, còn Chromium 87 bị trang lớn chặn.
- **2026-11-15** – Ghosthand nối Wisp qua **cổng riêng của Wisp** (`127.0.0.1` + token, lệnh mức cao), không qua extension Chrome, không mở cổng CDP. Lý do: Chrome mở bằng CDP / cờ tự động bị trang lớn nhận ra và chặn.
- **2026-11-15** – **Không giả dấu vân tay**; chỉ chỉnh UA / Client Hints cho khớp bản Chromium thật. Lý do: mục tiêu là trình duyệt thật, không phải né hệ thống chống bot.
