# 04. ⬜ Hai chế độ: Web (Electron mới) + Game (Electron 11)

Phụ thuộc: 03

**Xong khi:** cf4vn.bar vào được game như bản 2.3.0; youtube.com mở ở chế độ Web, phát được video.

| Chế độ | Engine | Dùng cho | Ghosthand điều khiển bằng |
|---|---|---|---|
| **Web** (mặc định) | Electron ổn định mới nhất lúc làm | Mọi trang thường | Cổng Wisp (DOM, sự kiện thật) |
| **Game** | Electron 11.5.0 + Pepper Flash 32 (hoặc Ruffle), tiến trình + cửa sổ riêng | Web game Flash | Ảnh / chữ (OCR) trong khung game Wisp báo |

Cấu trúc gói sau khi tách:
```
Wisp.app
  Contents/MacOS/Wisp                 ← Electron mới: vỏ app, tab, chế độ Web, cổng Ghosthand
  Contents/Resources/game/            ← Electron 11 đi kèm (Electron.app rút gọn) + mã chế độ Game
```

Việc:
- ⬜ **Tiến trình Game:** mã `flash/` chạy bằng Electron 11 đi kèm, mở cửa sổ game riêng (toolbar gọn: URL, tải lại, bảng kiểm tra, Flash / Ruffle). Vỏ app mở tiến trình bằng `child_process.spawn` (bỏ `ELECTRON_RUN_AS_NODE` khỏi env), nói chuyện qua stdin / stdout JSON (mở URL, đóng, `frameRect`, trạng thái).
- ⬜ **Chọn chế độ:** URL thuộc allowlist Flash (`DEFAULT_ALLOW` + `config.json`) hoặc trang có `<embed|object>` `.swf` → thanh báo "Mở ở chế độ Game"; menu ⋮ → **Mở ở chế độ Game / Web**; nhớ lựa chọn theo domain trong `config.json`.
- ⬜ **Vỏ app lên Electron mới:** đổi `package.json`, sửa API đã bỏ: `new-window` → `setWindowOpenHandler`, `BrowserView` → `WebContentsView` (nếu bản mới đã bỏ `BrowserView`), `worldSafeExecuteJavaScript`, `remote`… Bỏ `plugins: true`, `ppapi-flash-*` khỏi tiến trình Web.
- ⬜ **Đóng gói:** electron-builder chép Electron 11 vào `Resources/game` (`extraResources`), mac x64 (Game chạy Rosetta trên Apple Silicon) – thử luôn bản arm64 cho vỏ app; Windows nsis tương tự. `updater.js` vẫn thay cả app (zip lớn hơn), plugin Flash vẫn ở `userData/plugins`.
