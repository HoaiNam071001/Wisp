# 10. ✅ Vòng tròn tiến độ việc nền

Phụ thuộc: –

**Xong khi:** Cập nhật Wisp / cài Flash hiện vòng tròn tiến độ ở góc phải thanh công cụ (cạnh ⋮); có % khi biết tiến độ, quay khi chưa biết; nhiều việc cùng lúc có số việc; tắt khi xong hoặc lỗi.

Yêu cầu *(người dùng yêu cầu 2026-11-16)*.

- ✅ `progress-tasks.js` (logic thuần) + `test/progress-tasks.test.js`: `set(id, nhãn, tỉ lệ)` / `finish(id)` / `summary()`.
- ✅ `updater.js` (macOS + Windows) và `flash/install.js` báo tiến độ qua `progress-tasks` thay vì gọi thẳng `setProgressBar`; `toolbar-ipc.js` gửi `tasks` cho thanh công cụ và đặt thanh tiến độ Dock / taskbar.
- ✅ `toolbar.html`: nút vòng tròn `#task` (theme tối / sáng theo biến CSS), tooltip = nhãn + %.
- ⬜ Thử tay khi cập nhật thật + cài Flash (docs/checks.md).
