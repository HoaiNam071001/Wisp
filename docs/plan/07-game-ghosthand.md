# 07. ✅ Trang Flash với Ghosthand

Phụ thuộc: 04

**Xong khi:** Node tìm chữ của Ghosthand chỉ tìm trong khung game Wisp.

- ✅ Vùng tìm "Khung game Wisp" bên Ghosthand (commit 56d2430, `../autoclicker`, bước 62 W7): `searchArea: "game"` ở Chờ ảnh / Click theo ảnh / Tìm tất cả → hỏi `frameRect` trước mỗi node. Chưa làm cho điều kiện (cond) và Đọc phần tử. Chưa thử tay với Wisp + game thật (checks của Ghosthand mục 62).
- ✅ Cỡ cửa sổ game: `game {action:"resize", width, height}` đặt vùng game (200–4000 px) – kịch bản gọi đầu lượt để ảnh mẫu khớp (không thêm khoá vào `config.json` / UI). `frameRect` của game Flash trả thêm `window {minimized, visible, focused}` + `hidden` (thu nhỏ / ẩn → báo). Bị cửa sổ khác đè thì Electron 11 không cho biết – chưa báo được. Thử engine Flash thật: resize 1100×732 → 1000×600, focus, mute, reload đều chạy.
- ✅ Lệnh `game {action:"reload"|"mute"|"unmute"|"focus"|"resize", tab?}` (`ghosthand/commands/game.js`; tab Flash → engine nhận cmd `game`). Thử trên engine web: đủ 4 action + `bad_args`; engine Flash chưa thử tay (docs/checks.md).
