# Việc chờ người dùng thử tay

Mới nhất ở trên, nhóm `## <NN> – <tên bước> · [link](plan/<NN>-<tên>.md)`. Người dùng báo đã thử → tick `[x]` + ghi `log.md`.

## 02 – Ghosthand dùng Wisp · [link](plan/02-ghosthand-backend-wisp.md)

Cần Ghosthand bản mới (`make dev-install` ở `../autoclicker`) + Wisp đang mở, bật Cổng Ghosthand:
- [x] 11/11 mẫu web sân thử chạy trên Wisp dev bằng engine (Claude thử 2026-11-15).
- [ ] Ghosthand → Cài đặt → *Trình duyệt*: ô Wisp báo "Sẵn sàng"; tắt Wisp → *Kiểm tra lại* báo cách sửa.
- [ ] Chọn *Wisp*, mở *Mẫu thử* → mẫu web (vd Web: đăng nhập) → Chạy: chạy trong tab Wisp, chuột không nhúc nhích, chip tím Ghosthand hiện trên Wisp.
- [ ] Chọn *Wisp* khi Wisp đang tắt → Chạy mẫu web: Wisp tự mở rồi chạy.
- [ ] Đang chạy, bấm chip Ghosthand trên Wisp → node báo "đã ngắt Ghosthand trong Wisp".
- [ ] Windows: Ghosthand tìm thấy Wisp đã cài (`%LOCALAPPDATA%\Programs\Wisp`), chạy mẫu web.

## 01 – Cổng Wisp cho Ghosthand · [link](plan/01-cong-ghosthand.md)

Chạy `npm run dev`, rồi ở terminal khác `node scripts/ghosthand-client.js 20 wiki`:
- [x] 20/20 lần ok trên vi.wikipedia.org (Claude thử 2026-11-15).
- [ ] Vào game Flash cf4vn.bar vẫn chạy như trước khi có cổng (agent nằm trong preload mọi trang).
- [ ] Vào game Flash (cf4vn.bar, game nằm trong iframe nếu có) sau khi tắt site isolation + preload chạy mọi frame: game, đăng nhập, âm thanh như cũ.
- [ ] Menu ⋮ → *Tuỳ chọn* → **Cổng Ghosthand**: tắt → `.dev-data/ghosthand.json` biến mất, dòng phụ "Cho Ghosthand…"; bật lại → file mới (token mới), "Đang bật – chờ Ghosthand nối".
- [ ] Đang chạy `node scripts/ghosthand-client.js 20 wiki` → chip tím **Ghosthand** hiện trên toolbar (Claude đã thấy chip); bấm chip → script báo lỗi ngắt, chip ẩn.
- [ ] Windows: cổng mở, `ghosthand.json` tạo trong `%APPDATA%\Wisp\`, script thử chạy được.

## 03 – Tách main.js · [link](plan/03-tach-main-js.md)

Chạy `npm run dev` (dữ liệu `.dev-data/`), thử như bản 2.3.0:
- [x] Tab: Cmd+T, Cmd+W, Cmd+1, Shift+Cmd+T (Claude thử 2026-11-15).
- [ ] Tab: chuột phải tab (nhân bản, tắt tiếng, đóng các tab khác), Ctrl+Tab, link target=_blank mở tab bên phải.
- [x] Menu ⋮ mở tức thì, trạng thái đúng; phóng to giữ menu mở (100 → 110 → 120%); mở Bảng kiểm tra từ menu (Claude thử).
- [ ] Menu ⋮: bật / tắt 3 tuỳ chọn; "Thêm tuỳ chọn Flash…" hiện menu đúng chỗ.
- [ ] Menu hệ thống: Tệp / Trang / Flash / Lịch sử / Tab / Tuỳ chọn – mục Lịch sử hiện trang vừa xem, menu Tab cập nhật tên tab.
- [x] Trang Lịch sử (wisp://history): danh sách, tự cập nhật khi xem trang mới (Claude thử).
- [ ] Trang Lịch sử: mở, xoá một mục, xoá lịch sử.
- [x] Bảng kiểm tra: hiệu năng (nhãn tiến trình đúng), Mạng (request + lỗi), Flash (navigator.plugins có Flash 32, mms.cfg) (Claude thử).
- [ ] Bảng kiểm tra: socket TCP của game, thử TCP, ghi NetLog, lưu báo cáo.
- [x] Vào game Flash cf4vn.bar (người dùng thử bản dev 2026-11-15): vào sảnh, ping 25 ms trên thanh công cụ, icon loa trên tab.
- [ ] "Cho phép Flash trên trang này".
- [x] Cmd+Q → mở lại: khôi phục đúng 2 tab + tab đang xem; menu hệ thống hiện đủ (Claude thử).
- [ ] Chụp màn hình tab (Shift+Cmd+S).
- [ ] Chế độ Ruffle: đổi sang Ruffle, mở lại app, mở file .swf (Cmd+O).
- [ ] Windows (`npm run dist:win`): cài plugin từ bộ cài .exe, socket / ping trong Bảng kiểm tra.
- ⬜ **Đổi phím (bước 09):** menu ⋮ → Đổi phím… → Thêm: nhấn phím game cần (vd S), rồi phím thay (vd B). Vào game Flash bấm B phải ra S (giữ / nhả đúng, không lọt thêm chữ b); ô chat trong game gõ B ra S; thanh địa chỉ vẫn gõ B bình thường; tắt công tắc trả như cũ; thử trong iframe khác nguồn và Windows.
