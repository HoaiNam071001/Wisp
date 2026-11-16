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
- **2026-11-15** – Bước 02: cổng Wisp thêm find scope/brief/covered/hidden, focused, type không đích, sự kiện dialog closed; Ghosthand (bước 62) backend internal/wisp + Cài đặt Trình duyệt. npm run check + npm test OK; 11/11 mẫu web sân thử chạy trên Wisp dev; chưa thử tay trong app Ghosthand.
- **2026-11-15** – Phát hành Wisp 2.3.0 (tag v2.3.0 từ main): mac zip + sha256, dmg, Windows setup.exe + sha256 (build trên mac). Bản đóng gói chạy thử: cổng mở, ghosthand-client 3/3 ok.
- **2026-11-16** – Kế hoạch (người dùng yêu cầu): bước 09 đổi phím (key remap) toàn cục, cấu hình trong Cài đặt, không đổi ở thanh địa chỉ.
- **2026-11-16** – Bước 09 đổi phím: keyremap.js (thuần + test), keyremap-main.js, cửa sổ keys.html; chờ thử tay với bàn phím thật.
- **2026-11-16** – Phát hành 2.4.0 (đổi phím, bước 09): dmg + mac.zip + win-setup.exe kèm sha256.
