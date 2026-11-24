# 14. ⬜ Tối ưu tốc độ & RAM (học Chrome / Edge / Firefox)

**Phụ thuộc:** bước 05 (engine web). *(người dùng yêu cầu 2026-11-24 – đề xuất, chờ chốt phạm vi)*

**Xong khi:** mở Wisp nhanh hơn mốc đo đầu bước; 10 tab để nền không ăn RAM như 10 tab đang xem; tab crash tự báo + tải lại được; không tab Flash / tab đang phát tiếng / tab đang tải nào bị ngủ nhầm.

## Học từ
- Chrome / Edge: **Memory Saver / tab ngủ** (huỷ renderer tab nền lâu, bấm vào nạp lại), **sleeping tabs** mờ đi, trang "Sad tab" khi crash.
- Firefox: nạp tab phục hồi **lười** (chỉ nạp khi bấm).
- Chrome: **khởi động nhanh** – dựng cửa sổ trước, việc nặng (đồng bộ, cập nhật, favicon…) làm sau.

## Việc
- ⬜ **Đo mốc** (không đo thì không biết tối ưu gì): thời gian từ `app.ready` → cửa sổ hiện → trang đầu tải xong, RAM sau mở 1 / 5 / 10 tab; ghi vào `docs/` và `perf.js` / Bảng kiểm tra.
- ⬜ **Khởi động nhanh**: `require` lười các module chưa cần ngay (đồng bộ Google, updater, nhập Chrome, cửa sổ phụ); hoãn việc nền sau khi cửa sổ hiện (`setImmediate` / timer).
- ⬜ **Khôi phục tab lười**: tab của phiên cũ chỉ nạp khi bấm (hiện tiêu đề + favicon từ phiên), tab đang xem nạp ngay. Logic thuần `session-lazy.js` + test.
- ⬜ **Tab ngủ** (`tab-sleep.js`, logic chọn tab ngủ thuần + test): tab nền > N phút (mặc định 30, chỉnh được, có công tắc) → huỷ webContents, giữ URL / tiêu đề / vị trí cuộn. **Không ngủ**: tab Flash (engine 11), tab đang phát tiếng, đang tải file, đang gọi Ghosthand, trang trong danh sách loại trừ, có form đã gõ (`beforeunload`). Tab ngủ vẽ mờ trên thanh tab.
- ⬜ **Tab crash**: `render-process-gone` → trang "Tab bị dừng" có nút Tải lại (hiện chỉ ghi log ở `tabs.js:294`).
- ⬜ **Hiện RAM từng tab** ở tooltip tab (đã có `perf.js` đo theo tiến trình).
- ⬜ File mới vào `build.files`; README + `docs/checks.md`.

## Rủi ro
- Tab ngủ làm game web (không phải Flash) mất kết nối socket → mặc định loại trừ tab đang có socket (đã có `ping.js` / log mạng) và tab có Ghosthand dùng.
- Khôi phục lười đổi hành vi `restoreTabs` đang có → khoá `config` mới có mặc định, `config.json` cũ không hỏng.
