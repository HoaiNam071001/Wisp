# 07. ⬜ Trang Flash với Ghosthand

Phụ thuộc: 04

**Xong khi:** Node tìm chữ của Ghosthand chỉ tìm trong khung game Wisp.

- ⬜ `frameRect` trả khung `<embed>` / canvas trên màn hình; Ghosthand node tìm ảnh / chữ có tuỳ chọn "trong khung game Wisp" → giới hạn vùng tìm (nhanh hơn, ít nhầm).
- ⬜ Cửa sổ game: tuỳ chọn khoá kích thước (ví dụ 1000×600) để ảnh mẫu khớp mọi lần chạy; không thu nhỏ / che khi đang chạy kịch bản (báo nếu bị che).
- ⬜ Lệnh `game {action:"reload"|"mute"|"focus"}` cho kịch bản tự xử lý game treo.
