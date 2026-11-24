# 07. ⬜ Trang Flash với Ghosthand

Phụ thuộc: 04

**Xong khi:** Node tìm chữ của Ghosthand chỉ tìm trong khung game Wisp.

- ⬜ (phía Ghosthand `../autoclicker`, làm bằng skill của repo đó – thêm vùng tìm "khung game Wisp" ở node tìm ảnh / chữ, gọi `frameRect`; Wisp đã sẵn sàng) `frameRect` trả khung `<embed>` / canvas trên màn hình; Ghosthand node tìm ảnh / chữ có tuỳ chọn "trong khung game Wisp" → giới hạn vùng tìm (nhanh hơn, ít nhầm).
- ✅ Cỡ cửa sổ game: `game {action:"resize", width, height}` đặt vùng game (200–4000 px) – kịch bản gọi đầu lượt để ảnh mẫu khớp (không thêm khoá vào `config.json` / UI). `frameRect` của game Flash trả thêm `window {minimized, visible, focused}` + `hidden` (thu nhỏ / ẩn → báo). Bị cửa sổ khác đè thì Electron 11 không cho biết – chưa báo được. Thử engine Flash thật: resize 1100×732 → 1000×600, focus, mute, reload đều chạy.
- ✅ Lệnh `game {action:"reload"|"mute"|"unmute"|"focus"|"resize", tab?}` (`ghosthand/commands/game.js`; tab Flash → engine nhận cmd `game`). Thử trên engine web: đủ 4 action + `bad_args`; engine Flash chưa thử tay (docs/checks.md).
