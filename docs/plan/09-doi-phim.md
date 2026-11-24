# 09. ✅ Đổi phím (key remap)

Phụ thuộc: – (làm được ngay trên Electron 11; sau bước 04 phải chạy ở cả hai engine)

**Xong khi:** Đặt B → S trong Cài đặt; vào game Flash bấm B thì game nhận S (giữ / nhả đúng); thanh địa chỉ và ô nhập của app vẫn gõ B bình thường; tắt công tắc thì trả về như cũ; `config.json` cũ không lỗi.

Yêu cầu *(người dùng yêu cầu 2026-11-16)*: có phím bị hư, cần bấm phím khác thay thế. Đã chốt: **áp dụng toàn cục** (mọi trang), cấu hình **qua giao diện trong Cài đặt**, **chỉ đổi trong nội dung trang / game, không đổi ở thanh địa chỉ** và UI của app.

- ✅ **Logic thuần** `keyremap.js` (không `require('electron')`) + `test/keyremap.test.js`: chuẩn hoá bảng `{ từ: đến }` (bỏ cặp trùng / phím không hỗ trợ; hoán đổi B↔S hợp lệ vì sự kiện gửi lại không bị đổi tiếp), tra phím, ánh xạ tên phím → `keyCode` cho `sendInputEvent`; bỏ qua khi có Ctrl / Cmd / Alt.
- ✅ **Chặn + gửi lại:** `before-input-event` trên `webContents` của tab nội dung: phím có trong bảng → `preventDefault()` rồi `sendInputEvent` `keyDown` → `char` → `keyUp` với phím đích (giữ `isAutoRepeat`, nhớ phím đang giữ để nhả đúng phím đích dù đổi cấu hình giữa chừng). Chặn vòng lặp nếu sự kiện gửi lại lại kích hoạt `before-input-event`. Đã thử: `sendInputEvent` kích hoạt lại `before-input-event` (đồng bộ) nên cần cờ `sending`; sự kiện `char` không qua `before-input-event`, Chromium tự bỏ `char` của phím đã chặn với bàn phím thật (chưa thử tay, xem docs/checks.md).
- ✅ **Phạm vi:** chỉ gắn vào tab nội dung, không gắn vào toolbar / menu / thanh địa chỉ; ô nhập trong trang web vẫn đổi (phím hỏng thì ô chat cũng cần phím thay).
- ✅ **Config:** khoá `keyRemap: { enabled: false, map: {} }` mặc định trong `config.js`; đọc khi tạo tab và nghe thay đổi để áp dụng ngay, không cần khởi động lại.
- ✅ **Giao diện Cài đặt:** cửa sổ riêng `keys.html` mở từ menu ⋮ / Tuỳ chọn → Đổi phím… (app chưa có trang Cài đặt): công tắc bật / tắt, danh sách cặp, nút **Thêm** (nhấn phím hỏng → nhấn phím thay thế), nút xoá từng cặp. Màu theo biến CSS + theme tối; chữ tiếng Việt, báo cách khắc phục khi phím trùng / vòng. File mới thêm vào `build.files`.
- ✅ **Engine Flash (sau bước 04):** `keyremap.js` dùng chung (`attach(webContents, remapper)`); engine Flash (Electron 11, tiến trình riêng) gắn vào BrowserView game, không gắn vào thanh công cụ. Cấu hình đi qua giao thức: `open {keyRemap}` khi mở + lệnh `keyRemap {keyRemap}` khi người dùng đổi (`router.syncKeyRemap`), nên đổi xong áp dụng ngay không cần mở lại game. Chưa thử tay vào game Flash thật (docs/checks.md).
