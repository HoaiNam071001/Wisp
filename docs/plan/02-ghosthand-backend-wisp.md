# 02. ⬜ Ghosthand dùng Wisp làm trình duyệt

Phụ thuộc: 01

**Xong khi:** Kịch bản web mẫu của Ghosthand chạy với Wisp, không sửa kịch bản.

Làm ở repo `autoclicker` (Ghosthand).

- ⬜ **Backend Wisp:** `internal/wisp/` cài interface `web.Browser` (`Open`, `Find`, `Hover`, `Focused`, `BgClick`, `BgType`, `Keys`, `PageOutline`, `Mark`, `Settle`…) bằng cổng Wisp → node web hiện có (`webClick`, `webType`, `webScroll`, `webKey`, chờ element…) chạy với Wisp không phải đổi kịch bản. Thao tác "nền" ánh xạ thẳng lệnh Wisp (đã là sự kiện thật, không cần đưa cửa sổ lên trước).
- ⬜ **Chọn trình duyệt:** thiết lập trình duyệt của node web thêm "Wisp" (cạnh Chrome / Edge / Brave của app); Wisp đang mở + cổng bật thì gợi ý mặc định. Wisp chưa mở → mở app rồi chờ `ghosthand.json`.
- ⬜ **MCP:** `probe_page`, `read_web_outline`, `suggest_selector`, `describe_screen` dùng được với tab Wisp; primer / `get_step_types topic=web` ghi ngắn "có Wisp thì dùng Wisp". Giữ gọn theo `mcpsrv/budget_test.go`.
- ⬜ **Hướng dẫn:** chương web trong `internal/guide/` thêm phần Wisp.
- Làm theo skill dự án (`add-node-type` nếu thêm trường, `test-after-change`, `wrap-up`) và quy tắc trong `autoclicker/CLAUDE.md`.
