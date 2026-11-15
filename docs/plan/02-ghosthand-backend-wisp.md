# 02. ✅ Ghosthand dùng Wisp làm trình duyệt

Phụ thuộc: 01

**Xong khi:** Kịch bản web mẫu của Ghosthand chạy với Wisp, không sửa kịch bản.

Làm ở repo `autoclicker` (Ghosthand) – bước 62 của Ghosthand (`autoclicker/docs/tasks/phase3/62-trinh-duyet-wisp.md`).

> 2026-11-15: 11/11 mẫu web sân thử của Ghosthand (`internal/samples`, `GHOSTHAND_BROWSER=wisp`) chạy qua trên Wisp dev, không sửa kịch bản; `TestRealWisp` (gõ, bấm `isTrusted`, cuộn tới, phạm vi hộp thoại, chỗ thứ N, hộp thoại JS, điều hướng, chụp tab) qua.

Người dùng chốt (2026-11-15): chọn ở **Cài đặt chung** Ghosthand → *Trình duyệt*: Tự động (mặc định – Wisp nếu đang mở + cổng bật) / Chrome của app / Wisp; trên Wisp mọi thao tác **luôn qua cổng** (như chạy nền, không chuột thật); chọn Wisp mà Wisp chưa mở → **tự mở rồi chờ** `ghosthand.json`.

- ✅ **Backend Wisp:** `internal/wisp/` cài interface `web.Browser` (`Open`, `Find`, `Hover`, `Focused`, `BgClick`, `BgType`, `Keys`, `PageOutline`, `Mark`, `Settle`…) bằng cổng Wisp → node web hiện có (`webClick`, `webType`, `webScroll`, `webKey`, chờ element…) chạy với Wisp không phải đổi kịch bản. Thao tác "nền" ánh xạ thẳng lệnh Wisp (đã là sự kiện thật, không cần đưa cửa sổ lên trước).
- ✅ **Chọn trình duyệt:** thiết lập trình duyệt của node web thêm "Wisp" (cạnh Chrome / Edge / Brave của app); Wisp đang mở + cổng bật thì gợi ý mặc định. Wisp chưa mở → mở app rồi chờ `ghosthand.json`.
- ✅ **MCP:** `probe_page`, `read_web_outline`, `suggest_selector`, `describe_screen` dùng được với tab Wisp; primer / `get_step_types topic=web` ghi ngắn "có Wisp thì dùng Wisp". Giữ gọn theo `mcpsrv/budget_test.go`.
- ✅ **Hướng dẫn:** chương web trong `internal/guide/` thêm phần Wisp.
- Cổng Wisp thêm cho việc này (vẫn `api: 1`): `find` `scope` / `brief` / `covered` / `hidden`, `focused {ref}`, `type` không đích, sự kiện `dialog {closed}` – bảng ở bước 01.
- Cách làm: `internal/wisp/` (`ghosthand.json` + WebSocket gorilla, `Browser` cài `web.Browser`, `NativeInput` → engine chạy như chạy nền); `BgClick(x, y)` = `click {ref, offset}` theo phần tử của lần Find gần nhất; sắp bấm thì cuộn tới + đọc lại khung (đứng yên, không bị che) trước khi coi là thấy; `Mark.Doc` = số lần `navigate`. Sân thử của *Mẫu thử* phục vụ qua http `127.0.0.1` khi dùng Wisp (cổng không mở `file://`).
- MCP: `read_web_outline`, chụp tab, *Thử tìm* đi theo Cài đặt; `probe_page` (dò captcha bằng JS trong trang) và *Chọn phần tử trên trang* vẫn trên Chrome của app – chọn trên Wisp là bước 06. `describe_screen` / `suggest_selector` đọc màn hình nên dùng được với cửa sổ Wisp sẵn.
- ⬜ Settle trên Wisp chờ DOM yên 500 ms (`waitLoad idle`) – chậm hơn Chrome của app (100 ms); thêm đối số `quietMs` cho `settle` nếu thấy chậm.
- Làm theo skill dự án (`add-node-type` nếu thêm trường, `test-after-change`, `wrap-up`) và quy tắc trong `autoclicker/CLAUDE.md`.
