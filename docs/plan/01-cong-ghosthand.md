# 01. ⬜ Cổng Wisp cho Ghosthand

Phụ thuộc: –

**Xong khi:** Script `test/ghosthand-client.js` nối cổng, mở google.com, gõ ô tìm kiếm, bấm, đọc tiêu đề kết quả; chạy 20 lần không lỗi.

Làm trên Electron 11 hiện tại (tab thường) để chốt API sớm; lên Electron mới (bước 04) chỉ đổi phần bên dưới.

**Kết nối**
- ⬜ Server trong tiến trình chính, chỉ nghe `127.0.0.1`, cổng ngẫu nhiên. Mỗi lần mở app tạo token mới, ghi `userData/ghosthand.json`: `{"port": 51234, "token": "…", "pid": 123, "version": "3.0.0", "api": 1}` (quyền file 600). Ghosthand đọc file này để nối.
- ⬜ Giao thức: **WebSocket JSON** (một kết nối, nhiều lệnh, Wisp đẩy sự kiện được) – `{"id":1,"cmd":"find","args":{…}}` → `{"id":1,"ok":true,"result":{…}}` / `{"id":1,"ok":false,"error":{"code":"not_found","detail":"…"}}`. Token gửi ở header `Authorization` khi bắt tay; sai token → đóng kết nối.
- ⬜ Cài đặt (menu ⋮ → Cài đặt): bật / tắt cổng Ghosthand (mặc định bật), chấm trạng thái "Ghosthand đang nối" trên toolbar, nút ngắt.

**Lệnh** (mọi lệnh có `tab` tuỳ chọn: id / URL / tiêu đề chứa; trống = tab đang xem)

| Nhóm | Lệnh | Trả về / ghi chú |
|---|---|---|
| Tab | `tabs` | `[{id, url, title, active, mode:"web"\|"game", loading}]` |
| | `open {url, newTab}` / `navigate {url}` / `back` / `forward` / `reload` / `close` / `activate` | tab id |
| | `waitLoad {until:"load"\|"idle", timeoutMs}` | URL cuối, thời gian |
| Đọc | `outline {root?, maxNodes?, visibleOnly?}` | cây gọn: `{ref, role, name, text, value, state[checked,disabled,expanded,focused], rect}`, bỏ node trang trí; có cờ `truncated` |
| | `find {selectors[], all?, visibleOnly?}` | `[{ref, selector, role, name, text, rect, frame}]`; không thấy → `ok:true, found:[]` |
| | `read {ref\|selector, what:"text"\|"value"\|"html"\|"attrs"\|"table"}` | chữ / giá trị / bảng dạng mảng hàng |
| | `pageText {maxChars}` | chữ chính của trang (bỏ menu / footer) |
| | `screenshot {ref?, fullPage?}` | PNG base64 (cả trang / element) |
| Thao tác | `click {ref\|selector, button, count, offset?}` | cuộn tới element, kiểm tra element ở trên cùng tại điểm bấm (`elementFromPoint`), bấm bằng `sendInputEvent`; trả `{navigated, url, popup}` |
| | `type {ref\|selector, text, clear, enter}` | focus + kiểm tra focus đúng ô, gõ bằng `insertText` / `char` events |
| | `select {ref\|selector, value\|label}` / `check {ref, on}` | thao tác như người dùng (mở dropdown nếu cần) |
| | `scroll {ref?\|dir, amount}` / `hover {ref}` / `keys {keys[], mods[]}` | |
| Chờ | `waitFor {selectors[], state:"visible"\|"hidden"\|"enabled", timeoutMs}` | element hoặc `timeout` |
| | `settle {timeoutMs}` | chờ hết điều hướng / mạng / DOM đổi |
| Game | `frameRect {tab}` | khung game trên **màn hình** (toạ độ thật, có tỉ lệ màn hình) để Ghosthand OCR đúng vùng |
| Sự kiện | `subscribe {events:["navigate","dialog","popup","download"]}` | Wisp đẩy sự kiện; hộp thoại `alert/confirm` trả bằng `dialog {accept, text}` |

**Bên trong**
- ⬜ `ghosthand/server.js` (WebSocket, token, chia lệnh), `ghosthand/commands/*.js` (một nhóm lệnh một file), `ghosthand/agent.js` (chạy trong preload thế giới riêng của mọi frame: outline, find, read, kiểm tra điểm bấm).
- ⬜ `ref` = id element ổn định trong một lần tải trang (WeakMap trong preload ↔ số), tải lại trang → `stale_ref`, Ghosthand tìm lại bằng `selector`.
- ⬜ Mỗi element trả kèm **selector bền** theo thứ tự: `role=…[name="…"]` → `aria=` → `css=[data-testid=…]` / `#id` không tự sinh → `text=` → CSS đường dẫn ngắn. Logic chung với `StableSelector` của Ghosthand (dùng chung dữ liệu thử ở `testdata/`).
- ⬜ iframe (cả khác domain – preload chạy mọi frame qua `nodeIntegrationInSubFrames`, giao tiếp qua IPC chính), shadow DOM mở, element trong cửa sổ popup.
- ⬜ Toạ độ: `rect` theo CSS px trong trang + `screenRect` (cộng vị trí view + cửa sổ, nhân `zoomFactor`) để Ghosthand bấm chuột thật được khi cần.
- ⬜ Mã lỗi: `not_found`, `not_visible`, `covered` (element khác đè lên điểm bấm – trả mô tả element đè), `not_focused`, `stale_ref`, `timeout`, `no_tab`, `game_mode` (lệnh DOM trên tab Game), `bad_args`.
