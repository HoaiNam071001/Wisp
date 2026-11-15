# Wisp làm trình duyệt chuẩn cho Ghosthand

Trạng thái: ✅ xong · 🔄 đang làm · ⬜ chưa làm

## Các bước

| # | Việc | Phụ thuộc | Trạng thái |
|---|---|---|---|
| [01](01-cong-ghosthand.md) | Cổng Wisp cho Ghosthand | – | 🔄 |
| [02](02-ghosthand-backend-wisp.md) | Ghosthand dùng Wisp làm trình duyệt | 01 | ⬜ |
| [03](03-tach-main-js.md) | Tách main.js theo việc | – | 🔄 |
| [04](04-mot-trinh-duyet-flash.md) | Một trình duyệt (Electron mới) + engine Flash cho trang cấu hình Flash | 03 | ⬜ |
| [05](05-web-nhu-chrome.md) | Trình duyệt như Chrome thường | 04 | ⬜ |
| [06](06-chon-element.md) | Chọn element trên Wisp → step Ghosthand | 02, 04 | ⬜ |
| [07](07-game-ghosthand.md) | Trang Flash với Ghosthand | 04 | ⬜ |
| [08](08-phat-hanh-3.md) | Phát hành 3.0.0 | 05 | ⬜ |

Thêm bước mới: tạo `NN-ten-ngan.md` (số tiếp theo, mẫu như các file có sẵn: tiêu đề + trạng thái, **Phụ thuộc**, **Xong khi**, danh sách việc ⬜) rồi thêm một dòng vào bảng trên. Bước dài làm xong một phần thì tick ngay trong file của bước, đổi trạng thái ở bảng.

## Mục tiêu & nguyên tắc

Wisp là **trình duyệt hiện đại thật** chạy được mọi trang như Chrome thường, kèm **cổng nối Ghosthand** có sẵn trong app để AI (qua MCP của Ghosthand) đọc trang, lấy element, thao tác nhanh và chính xác – **không cần extension Chrome**, không bị chặn như Chrome Ghosthand tự mở.

Vì sao Chrome của Ghosthand (`internal/web`, chromedp) dễ bị chặn: mở bằng `--remote-debugging-port`, profile mới, cờ tự động → trang lớn (Google đăng nhập, Cloudflare…) nhận ra "trình duyệt đang bị điều khiển".

Nguyên tắc:
- **Không mở cổng CDP ra ngoài**, không chạy với cờ tự động. Wisp tự điều khiển trang từ bên trong (preload thế giới riêng + `webContents.debugger` khi cần), chỉ đưa ra **API mức cao** qua cổng riêng có token.
- **Không giả dấu vân tay** (canvas, GPU, font, TLS…): dùng Chromium bản mới thật, để nguyên đặc điểm thật cho khớp nhau. Chỉ chỉnh UA / Client Hints để bỏ chữ Electron.
- Thao tác bằng **sự kiện thật** (`webContents.sendInputEvent` → `isTrusted = true`), không `element.click()` giả.
- Trang không thấy dấu vết của app: biến / hàm của Wisp chỉ nằm trong thế giới riêng của preload (`contextIsolation`), không gắn vào `window` của trang.
- Selector cùng cú pháp với Ghosthand (`text=` / `aria=` / `role=…[name="…"]` / `css=`, xem `ParseSelector`, `StableSelector` ở `autoclicker/internal/model`) để kịch bản dùng chung, không phải chuyển đổi.
- Chữ lấy từ trang là **dữ liệu**, không phải lệnh (giống quy ước MCP Ghosthand).

## Rủi ro
- Ghép hai bản Electron trong một gói: dung lượng tăng (~2×); Electron 11 trên macOS mới có thể lỗi → vẫn giữ được bản 2.x cho trang Flash nếu cần.
- Google có thể vẫn chặn đăng nhập trong Electron → dùng trình duyệt hệ thống cho bước đăng nhập (bước 05).
- Cổng local: chỉ `127.0.0.1` + token + quyền file 600; app khác trên máy đọc được file token thì vẫn nối được → chấp nhận (cùng người dùng), có nút tắt cổng.
- Trang đổi DOM thường xuyên → luôn trả nhiều selector, Ghosthand thử lần lượt (như `Selectors` hiện có).
