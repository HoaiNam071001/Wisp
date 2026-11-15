# Nhật ký

Chỉ thêm dòng bằng `>>`: `- **YYYY-MM-DD** – <việc>. <kết quả kiểm tra>.`

- **2026-11-15** – Lập plan Wisp làm trình duyệt chuẩn cho Ghosthand (docs/plan/), thêm CLAUDE.md + skill dự án.
- **2026-11-15** – Thêm `npm run dev` (scripts/dev.js): tự bỏ ELECTRON_RUN_AS_NODE, dữ liệu riêng `.dev-data/` để không đụng Wisp.app đã cài; cập nhật README, CLAUDE.md, skill test-after-change. npm run check / npm test OK; đã chạy thử `npm run dev` trên macOS (dữ liệu vào .dev-data/), chưa thử Windows.
- **2026-11-15** – Kế hoạch (người dùng yêu cầu): Wisp là một trình duyệt, một chế độ; Flash cấu hình theo trang (icon thanh địa chỉ + Cài đặt → Flash), trang Flash tự mở bằng engine Flash (Electron 11) đi kèm. Sửa decisions, bước 01/04/05/07/08, CLAUDE.md, skill.
- **2026-11-15** – Bước 03 (đang làm): tách main.js (1886 → 102 dòng) thành module theo việc, test urls / allowlist; chờ người dùng thử tay (checks.md mục 03).
- **2026-11-15** – Bước 03: Claude tự thử app dev (tab, menu ⋮ + zoom, lịch sử, Bảng kiểm tra, Flash nạp, khôi phục tab) – qua; còn game / Ruffle / Windows chờ người dùng.
- **2026-11-15** – Bước 03: người dùng vào game cf4vn.bar trên bản dev mới – Flash, ping, âm thanh tab chạy.
- **2026-11-15** – Bước 01 (đang làm): cổng Ghosthand – server WebSocket 127.0.0.1 + token (ghosthand.json 600), agent trong preload (chép cách tìm của Ghosthand), 20 lệnh tab / đọc / thao tác / chờ; test selector (dữ liệu chung Ghosthand) / protocol / keys / info-file; npm run check + test OK; scripts/ghosthand-client.js 20 wiki 20/20; Google bị CAPTCHA trên Chromium 87 → chờ bước 04.
- **2026-11-15** – Bước 01: công tắc Cổng Ghosthand (menu ⋮ + menu hệ thống) + chip toolbar / ngắt (mã 4000); lệnh select (typeahead thật), check, settle, frameRect, subscribe (navigate / popup / download / dialog qua debugger domain Page) + dialog; outline một lượt (1,6 s → 162 ms, 810 selector đúng); thao tác tab nền chạy. npm run check + test OK, thử trên app dev; còn screenshot fullPage + Google 20 lần → bước 04; chờ thử tay công tắc / chip.
- **2026-11-15** – Bước 01: iframe khác nguồn (agent mỗi frame, page-call ghép, frame-layout có test), shadow DOM mở, popup = tab; tắt site isolation Electron 11. npm run check + npm test OK; thử trang iframe lồng 3 tầng + shadow trên app dev OK, wiki 5/5 ok; chưa thử tay game Flash.
