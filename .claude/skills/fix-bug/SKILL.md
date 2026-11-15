---
name: fix-bug
description: Sửa lỗi Wisp người dùng báo (vd "bị lỗi", "không vào được game", "trang trắng", "bị chặn", "Ghosthand không thấy element", kiểm tra tay thất bại trong docs/checks.md). Lỗi vặt đi đường nhanh; lỗi thường thì tìm nguyên nhân gốc, tái hiện trước, sửa, rà chỗ cùng kiểu, ghi lại.
---

# Sửa bug

## 0. Lỗi vặt hay lỗi thường

**Lỗi vặt** = đủ cả 3: nhìn là thấy chỗ sai (UI lệch / sai chữ / nút không ăn), sửa gọn 1–2 file, không đổi `config.json` / API cổng Ghosthand / đóng gói. Làm nhanh: sửa tận gốc, `grep` chỗ cùng mẫu, `npm run check && npm test`, chạy app xem lại, một dòng `docs/log.md` (`>>`), commit `fix: <triệu chứng> – <nguyên nhân>`. Bỏ qua senior-review / wrap-up đầy đủ.

Thấy lỗi sâu hơn → đường thường dưới đây.

## 1. Hiểu đúng lỗi

- Ghi: làm gì → mong gì → thấy gì; engine web hay Flash; Flash hay Ruffle; macOS / Windows; bản cài hay dev; trang nào (URL).
- Thiếu thông tin quyết định hướng sửa → hỏi một lần (gom câu hỏi); còn lại tự tra.
- Nguồn tra: **Bảng kiểm tra** (`WISP_INSPECT=1`: Mạng / Socket TCP / Console / Flash, NetLog, báo cáo JSON), console DevTools của tab, log terminal khi chạy dev, `config.json` + `Pepper Data/Shockwave Flash/System/mms.cfg` trong `userData`.

## 2. Tìm nguyên nhân gốc

Nghi vấn hay gặp:
- **Flash không nối / không chạy**: allowlist `mms.cfg` (cổng trong URL, `AllowListRootMovieOnly`), plugin chưa cài / sai kiến trúc, `plugins: true` thiếu ở tab.
- **Trang bị chặn / báo trình duyệt cũ**: UA còn chữ Electron / lệch Client Hints, Chromium 87 thiếu API, popup OAuth mất `opener`.
- **BrowserView**: gỡ / gắn lại view làm Flash mất bề mặt vẽ (commit 6b04625), throttling tab ẩn.
- **Cổng Ghosthand**: `ref` cũ sau khi tải lại trang, iframe khác domain, toạ độ lệch do `zoomFactor` / tỉ lệ màn hình, element bị đè (`covered`), token sai.
- **Chạy dev**: `ELECTRON_RUN_AS_NODE` trong env → `env -u ELECTRON_RUN_AS_NODE`.
- **Chỉ lỗi ở bản đóng gói**: file mới thiếu trong `build.files`, đường dẫn `__dirname` khác trong `app.asar`.

Không chắc → thêm log / test nhỏ để chứng minh, không đoán. Nói nguyên nhân cho người dùng bằng 1–2 câu.

## 3. Tái hiện trước khi sửa

- Logic thuần → `test/<tên>.test.js` **đỏ** trước, **xanh** sau.
- Còn lại → cách tái hiện cụ thể trên app (URL, thao tác, client cổng `test/ghosthand-client.js` nếu đã có); không tái hiện được ở máy → ghi `docs/checks.md` cho người dùng thử.

## 4. Sửa

- Sửa nhỏ nhất đúng chỗ gốc; không kèm refactor không liên quan (ghi thành việc riêng).
- `grep` cùng mẫu ở chỗ khác (bản mac / Windows, engine web / Flash) và sửa luôn.
- Thông báo lỗi cho người dùng nói được cách khắc phục.

## 5. Kiểm tra + ghi lại

- `npm run check && npm test`, rồi `test-after-change`.
- File bước liên quan: thêm `- ✅ Sửa: <triệu chứng> – <nguyên nhân>`; lỗi từ `docs/checks.md` → để mục đó `[ ]` cho người dùng thử lại.
- `docs/log.md` một dòng (ngày tuyệt đối, nguyên nhân, kết quả). Commit `fix: …` qua skill `wrap-up`.
