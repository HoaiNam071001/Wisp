# Quyết định đã chốt

Không bàn lại điều đã chốt; muốn đổi → skill `new-request` (ghi *thay bởi*, không xoá dòng cũ).

- **2026-11-15** – *(thay bởi dòng 2026-11-15 "Một trình duyệt, Flash theo trang" bên dưới – phần engine giữ nguyên, bỏ khái niệm hai chế độ với người dùng)* Web game Flash chạy ở **chế độ Game riêng** (tiến trình + cửa sổ riêng, Electron 11 + Pepper Flash); mọi trang khác chạy ở chế độ **Web** (Electron mới). Lý do: Pepper Flash chỉ chạy tới Electron 11, còn Chromium 87 bị trang lớn chặn.
- **2026-11-15** – Ghosthand nối Wisp qua **cổng riêng của Wisp** (`127.0.0.1` + token, lệnh mức cao), không qua extension Chrome, không mở cổng CDP. Lý do: Chrome mở bằng CDP / cờ tự động bị trang lớn nhận ra và chặn.
- **2026-11-15** – **Không giả dấu vân tay**; chỉ chỉnh UA / Client Hints cho khớp bản Chromium thật. Lý do: mục tiêu là trình duyệt thật, không phải né hệ thống chống bot.
- **2026-11-15** – **Một trình duyệt, Flash theo trang** (người dùng yêu cầu): Wisp là trình duyệt thường, một chế độ, chạy Electron mới cho mọi trang; không có nút / khái niệm "chế độ Web / Game". Trang được cấu hình Flash (icon Flash trên thanh địa chỉ + Cài đặt → Flash; chọn Flash thật / Ruffle) tự mở bằng engine Flash đi kèm (Electron 11 + Pepper Flash 32, tiến trình riêng) trong cửa sổ Wisp gọn – Electron không nhúng được tab của tiến trình khác. Lý do: Flash thật chỉ chạy tới Electron 11, Chromium 87 bị trang lớn chặn; người dùng chỉ muốn cấu hình trang nào cần Flash.
