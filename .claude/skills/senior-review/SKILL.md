---
name: senior-review
description: Tự review diff Wisp theo chuẩn senior trước khi commit (hoặc khi người dùng nói "review", "rà code", "kiểm tra chất lượng"). Đúng / an toàn trước, rồi kiến trúc, đơn giản, test, UI. Sửa luôn chỗ rõ ràng, hỏi chỗ cần người dùng chọn.
---

# Review kiểu senior

Phạm vi: `git diff` (+ `--cached`, file mới chưa track). Đọc diff trước, chỉ mở file đầy đủ khi cần. Báo theo mức **phải sửa** → **nên sửa** → **gợi ý**; mỗi ý có `file:dòng` + tình huống cụ thể gây lỗi. Không báo ý "có thể" không có kịch bản lỗi.

## 1. Đúng & an toàn (phải sửa)

- **Cổng Ghosthand**: chỉ nghe `127.0.0.1`; kiểm token trước mọi lệnh; file token quyền 600; tham số từ client được kiểm (kiểu, giới hạn độ dài, URL chỉ `http(s)`); không có lệnh chạy JS tuỳ ý / đọc file máy.
- **Trang không thấy dấu vết**: không gắn biến / hàm vào `window` của trang, không `executeJavaScript` để lại state toàn cục, không bật `--remote-debugging-port` / cờ tự động.
- **Sự kiện thật**: click / gõ bằng `sendInputEvent`, có kiểm `elementFromPoint` trước khi bấm; không `el.click()` giả.
- **Preload**: `contextIsolation: true`, `nodeIntegration: false`; `contextBridge` không đưa `ipcRenderer` nguyên khối ra trang.
- **Lỗi**: promise không bị nuốt (`.catch` rỗng), `webContents` đã huỷ (`isDestroyed()`) trước khi gọi, listener `ipcMain` / `webContents.on` gỡ khi tab đóng, timeout cho mọi lệnh chờ.
- **Node 12** cho mã chạy trên Electron 11: không `fetch`, `structuredClone`, `.at()`, `fs.rm`, `??=`, top-level await.
- **Đóng gói**: file mới có trong `build.files`; đường dẫn qua `path.join` + `__dirname` / `app.getPath`, chạy được trong `app.asar`.
- **Đa nền tảng**: nhánh mac / Windows đủ cả hai; không gọi lệnh chỉ có trên macOS (`ditto`, `codesign`, `hdiutil`) từ mã chung.
- **Dữ liệu người dùng**: khoá mới trong `config.json` có mặc định, đọc `config.json` cũ không lỗi; `updater.js` không làm mất plugin / đăng nhập.
- **Flash**: không đổi `mms.cfg` / `plugins` / gắn-gỡ BrowserView mà không thử lại vào game.

## 2. Kiến trúc (nên sửa)

- Một file một việc; diff đưa file vượt ~300 dòng hoặc nhét tính năng mới vào `main.js` → **phải sửa**: tách module. Hàm > ~60 dòng nhiều nhánh → tách có tên.
- Logic thuần tách khỏi Electron, có test.
- Lệnh cổng Ghosthand: tên lệnh, tham số, mã lỗi đúng bảng ở `docs/plan/01-cong-ghosthand.md`; đổi API → sửa bảng + nhắc phía Ghosthand.
- Không code chết, không TODO vô chủ.

## 3. Đơn giản & hiệu năng (nên sửa)

- Trừu tượng thừa, state trùng lặp suy ra được.
- `outline` / `find` trên trang lớn: giới hạn số node, chỉ phần nhìn thấy khi được yêu cầu; không quét DOM liên tục bằng `setInterval`.
- Không chặn tiến trình main (đọc file đồng bộ lớn, vòng chờ bận) – menu / toolbar phải phản hồi tức thì.

## 4. Test (phải có cho logic mới)

- Logic thuần mới / sửa → `test/*.test.js` có ca biên: rỗng, URL lạ, hết giờ, tham số sai kiểu.
- Sửa bug → test đỏ trước khi sửa (nếu là logic thuần).

## 5. UI & văn bản

- Biến màu CSS + theme tối, không màu cứng; trạng thái rỗng / đang tải / lỗi; phím tắt không đụng nhau.
- Comment tiếng Việt, ngắn, nói *vì sao*; tên biến / hàm tiếng Anh.

## 6. Kết thúc

`npm run check && npm test`. Sửa các ý *phải sửa* / *nên sửa* rõ ràng; ý cần đánh đổi → liệt kê cho người dùng chọn. Báo tóm tắt: đã sửa gì, còn gì.
