# 04. 🔄 Một trình duyệt (Electron mới) + engine Flash cho trang cấu hình Flash

Phụ thuộc: 03

**Xong khi:** Bật Flash cho cf4vn.bar bằng icon trên thanh địa chỉ → vào được game như bản 2.3.0; youtube.com mở bình thường, phát được video; người dùng không phải chọn "chế độ" nào.

Đổi 2026-11-15 (người dùng yêu cầu): một chế độ duy nhất với người dùng, Flash là cấu hình theo trang – xem `docs/decisions.md`. Bên dưới vẫn hai engine; trong code / tài liệu gọi là engine **web** / **flash**, không hiện chữ "chế độ" trên UI.

| Engine | Bản | Dùng cho | Ghosthand điều khiển bằng |
|---|---|---|---|
| **web** (mặc định) | Electron ổn định mới nhất lúc làm | Mọi trang | Cổng Wisp (DOM, sự kiện thật) |
| **flash** | Electron 11.5.0 + Pepper Flash 32 (hoặc Ruffle), tiến trình + cửa sổ riêng | Trang đã cấu hình Flash | Ảnh / chữ (OCR) trong khung game Wisp báo |

Cấu trúc gói sau khi tách:
```
Wisp.app
  Contents/MacOS/Wisp                 ← Electron mới: vỏ app, tab, mọi trang, cổng Ghosthand
  Contents/Resources/game/            ← Electron 11 đi kèm (Electron.app rút gọn) + mã engine Flash
```

Việc:
- 🔄 **Engine Flash** (2026-11-16: spike xong – `flash-engine/main.js` + `protocol.js` (có test), thử bằng `node scripts/flash-engine-try.js [url]`: Electron 11 mở cửa sổ, nhận `open` / `frameRect` / `close` / `quit` qua stdin, báo `ready` / `url` / `title` / `closed` qua stdout. Plugin thật nạp được trong engine (cf4vn.bar: sự kiện `flash` báo `Shockwave Flash 32.0 r0`; thử `WISP_FLASH_PLUGIN=… WISP_FLASH_VERSION=… HOLD_MS=4000 node scripts/flash-engine-try.js https://cf4vn.bar/`) – chưa thử tay vào game. Còn: vỏ app spawn + quản lý tiến trình, toolbar / điều hướng ra ngoài, Ruffle, `webContents` do Ghosthand đọc): mã `flash/` chạy bằng Electron 11 đi kèm, mở cửa sổ Wisp gọn cho trang Flash (cùng giao diện toolbar: URL, tải lại, bảng kiểm tra, icon Flash). Điều hướng ra trang không cấu hình Flash → mở lại ở cửa sổ chính (engine web). Vỏ app mở tiến trình bằng `child_process.spawn` (bỏ `ELECTRON_RUN_AS_NODE` khỏi env), nói chuyện qua stdin / stdout JSON (mở URL, đóng, `frameRect`, trạng thái).
- ⬜ **Chọn engine tự động:** domain có cấu hình Flash → mở bằng engine flash; còn lại engine web. Logic thuần (`flash/site-config.js` + test): khớp domain gốc / subdomain, mặc định Flash thật, thiếu plugin → Ruffle.
- ⬜ **Icon Flash trên thanh địa chỉ:** bấm → bảng nhỏ: Flash cho trang này Tắt / Flash thật / Ruffle (Ruffle: game online cần socket không chạy – ghi rõ); đổi → mở lại trang bằng engine đúng. Trang có `<embed|object>` `.swf` mà chưa bật → icon gợi ý (chấm) + một dòng "Trang này cần Flash – Bật".
- ⬜ **Cài đặt → Flash:** danh sách trang đã cấu hình (domain, Flash thật / Ruffle, xoá), cài / thay plugin, mở thư mục plugin / mms.cfg, ghi log allowlist. Thay mục menu Flash cũ (menu hệ thống + ⋮ → "Flash…").
- 🔄 **Chuyển `config.json`** (2026-11-16: đã có `flash/site-config.js` + test – `migrate`, `siteFor`, `engineFor`, `setSite`; `config.flashSites()` suy từ khoá 2.x, `allowDomains()` lấy từ đó. `config.saveFlashSites` ghi `flashSites` + phản chiếu `allowDomains`; "Cho phép Flash trên trang này" / sửa danh sách đã dùng khoá mới. Còn: UI Cài đặt → Flash, icon thanh địa chỉ): `allowDomains` + `DEFAULT_ALLOW` cũ → `flashSites: [{domain, engine:"flash"|"ruffle"}]`; `mode: 'ruffle'` cũ → mọi trang cũ dùng Ruffle. Giữ đọc được `config.json` 2.x, không xoá khoá cũ ngay (bản 2.x quay lại vẫn chạy). `mms.cfg` sinh từ `flashSites`.
- ⬜ **Vỏ app lên Electron mới:** đổi `package.json`, sửa API đã bỏ: `new-window` → `setWindowOpenHandler`, `BrowserView` → `WebContentsView` (nếu bản mới đã bỏ `BrowserView`), `worldSafeExecuteJavaScript`, `remote`… Bỏ `plugins: true`, `ppapi-flash-*` khỏi tiến trình Web.
- ⬜ **Đóng gói:** electron-builder chép Electron 11 vào `Resources/game` (`extraResources`), mac x64 (engine Flash chạy Rosetta trên Apple Silicon) – thử luôn bản arm64 cho vỏ app; Windows nsis tương tự. `updater.js` vẫn thay cả app (zip lớn hơn), plugin Flash vẫn ở `userData/plugins`.
