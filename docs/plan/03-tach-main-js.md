# 03. 🔄 Tách main.js theo việc

Phụ thuộc: –

**Xong khi:** Flash + Ruffle, tab, cập nhật, bảng kiểm tra chạy như bản 2.3.0.

- ✅ `main.js` (1886 dòng → 102) tách theo việc trước khi chuyển: `tabs.js`, `flash/` (`findFlashPlugin`, `writeMmsCfg`, `flash-win.js`, Ruffle, bảng kiểm tra), `menu-app.js`, `updater.js` (đã riêng). Không đổi hành vi, kiểm tra Flash + Ruffle còn chạy.
- ✅ Mỗi file ≤ ~300 dòng (lớn nhất `tabs.js` 304), một file một việc.

**Cách tách** (lớp dưới không `require` lớp trên → không có require vòng)
- Lớp dưới: `user-data.js` (chọn / chuyển thư mục dữ liệu), `config.js`, `urls.js` + `flash/allowlist.js` (logic thuần, có test), `app-urls.js` (gắn `urls.js` với app), `flash/plugin.js`, `flash/mode.js` (chọn Flash / Ruffle lúc khởi động), `flash/mms-cfg.js`, `inspect/store.js` (log, request, socket + chỗ gửi tới Bảng kiểm tra), `util.js`.
- `tabs.js`: cửa sổ + tab + nhớ tab. Không gọi ngược lên lịch sử / menu: phát `tabs.events` (`visit`, `title`, `changed`, `window-closed`), module trên tự nghe.
- Lớp trên: `history.js`, `perf.js` + `ping.js`, `inspect/{sockets,request-log,probe,window}.js`, `page-actions.js`, `flash/{actions,install,extract,ruffle}.js`, `app-menu.js` (menu hệ thống), `menu-popup.js` (menu ⋮), `toolbar-ipc.js`.
- `main.js` chỉ còn khởi động: thư mục dữ liệu → khoá một bản → tạo cửa sổ → sự kiện app.
- `flash-win.js` giữ nguyên chỗ (đang được gọi như script con bằng đường dẫn, Windows không thử được ở máy này).
- ⬜ Người dùng thử tay như bản 2.3.0 (`docs/checks.md` mục 03) → xong thì đổi bước thành ✅.
- Lỗi có sẵn, chưa sửa (bước này không đổi hành vi): gõ `localhost:8080` vào thanh địa chỉ bị coi `localhost:` là giao thức → không mở được; cần gõ `http://localhost:8080`.
