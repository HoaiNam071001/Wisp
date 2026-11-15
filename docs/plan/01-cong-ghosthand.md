# 01. 🔄 Cổng Wisp cho Ghosthand

Phụ thuộc: –

**Xong khi:** Script `scripts/ghosthand-client.js` nối cổng, mở google.com, gõ ô tìm kiếm, bấm, đọc tiêu đề kết quả; chạy 20 lần không lỗi.

> 2026-11-15: `node scripts/ghosthand-client.js 20 wiki` (vi.wikipedia.org, cùng luồng) **20/20 ok**, ~2,4 s / lần. Với Google: Chromium 87 nhận trang HTML cũ + `/sorry` (CAPTCHA) sau vài lần tìm → mốc Google chạy lại sau bước 04 (Electron mới). Không né CAPTCHA (nguyên tắc không giả).

Làm trên Electron 11 hiện tại (tab thường) để chốt API sớm; lên Electron mới (bước 04) chỉ đổi phần bên dưới.

**Kết nối**
- ✅ Server trong tiến trình chính, chỉ nghe `127.0.0.1`, cổng ngẫu nhiên. Mỗi lần mở app tạo token mới, ghi `userData/ghosthand.json`: `{"port": 51234, "token": "…", "pid": 123, "version": "3.0.0", "api": 1}` (quyền file 600). Ghosthand đọc file này để nối.
- ✅ Giao thức: **WebSocket JSON** (một kết nối, nhiều lệnh, Wisp đẩy sự kiện được) – `{"id":1,"cmd":"find","args":{…}}` → `{"id":1,"ok":true,"result":{…}}` / `{"id":1,"ok":false,"error":{"code":"not_found","detail":"…"}}`. Token gửi ở header `Authorization: Bearer <token>` khi bắt tay; sai token / có header `Origin` (trang web trong trình duyệt) → 401. Thư viện `ws@7` (chạy được Node 12). Lệnh của một kết nối chạy lần lượt. Bật / tắt tạm bằng `config.json` → `ghosthandPort: false` (mặc định bật).
- ⬜ Cài đặt (menu ⋮ → Cài đặt – chưa có trang Cài đặt): bật / tắt cổng Ghosthand (mặc định bật), chấm trạng thái "Ghosthand đang nối" trên toolbar, nút ngắt.

**Lệnh** (mọi lệnh có `tab` tuỳ chọn: id / URL / tiêu đề chứa; trống = tab đang xem)

| Nhóm | Lệnh | Trả về / ghi chú |
|---|---|---|
| Tab | `tabs` | `[{id, url, title, active, engine:"web"\|"flash", loading}]` |
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
- ✅ `ghosthand/server.js` (WebSocket, token, chia lệnh), `ghosthand/commands/{tabs,read,act,wait}.js`, `ghosthand/agent/` (preload khung chính, thế giới riêng: `dom` / `find` chép từ `autoclicker/internal/web/common.js` + `find.js` – cùng cách so; `outline`, `read`, `elements` = ref + selector), `agent-call.js` (IPC `gh:call` / `gh:reply`), `input.js` (sendInputEvent), `target.js` (tab đích, `screenRect`). Logic thuần có test: `selector.js`, `protocol.js` (kiểm đối số, trần đối số, chỉ http(s)), `keys.js`, `info-file.js`.
- ✅ Trang không thấy dấu vết: đã thử trang so biến `window` với iframe sạch + MutationObserver – không biến lạ, không đổi DOM (pageText chỉ đọc), `navigator.webdriver` không có.
- ✅ `ref` = id element ổn định trong một lần tải trang (WeakMap trong preload ↔ số), tải lại trang → `stale_ref`, Ghosthand tìm lại bằng `selector`. Dạng `"<mã lần tải>.<số>"`. `type`: trang thay ô khi bấm (Wikipedia, Vue / React) → nhận ô đang focus nằm ngay điểm vừa bấm, trả ref mới.
- ✅ Mỗi element trả kèm **selector bền** theo thứ tự: `role=…[name="…"]` → `aria=` → `css=[data-testid=…]` / `#id` không tự sinh → `text=` → CSS đường dẫn ngắn. Logic chung với `StableSelector` của Ghosthand (dữ liệu thử chép từ `autoclicker/testdata` vào `test/data/` – Ghosthand đổi thì chép lại). Mỗi selector đã kiểm tìm lại ra đúng phần tử; trả `selector` + `selectors` (dạng chứa phần cố định đứng trước).
- ⬜ iframe khác domain (preload chạy mọi frame qua `nodeIntegrationInSubFrames`, giao tiếp qua IPC chính), shadow DOM mở, element trong cửa sổ popup. Iframe cùng nguồn đã tìm / bấm được (như Ghosthand).
- ✅ Toạ độ: `rect` theo CSS px trong trang + `screenRect` (cộng vị trí view + cửa sổ, nhân `zoomFactor`) để Ghosthand bấm chuột thật được khi cần. `screenRect` = điểm DIP của màn hình + `scale`; tab không xem có `offscreen: true`.
- ✅ Mã lỗi: `not_found`, `not_visible`, `covered` (element khác đè lên điểm bấm – trả mô tả element đè), `not_focused`, `stale_ref`, `timeout`, `no_tab`, `flash_page` (lệnh DOM trên trang mở bằng engine flash – dùng từ bước 04), `bad_args`, thêm `internal` (lỗi lập trình / Electron ném – không phải lỗi của client).

**Đã làm (2026-11-15):** `tabs`, `open`, `navigate`, `back`, `forward`, `reload`, `close`, `activate`, `waitLoad`, `outline`, `find` (trả `{selectorIndex, found[], more}`), `read`, `pageText`, `screenshot` (phần đang thấy / một phần tử), `click`, `type`, `keys`, `scroll`, `hover`, `waitFor`. Đã thử trên app dev: các lệnh trên, `covered`, `stale_ref`, `not_found`, `no_tab`, token sai / có Origin → 401, `file://` bị chặn.

**Còn lại**
- ⬜ Lệnh `select`, `check`, `settle`, `frameRect`, `subscribe` + `dialog`.
- ⬜ `screenshot fullPage`.
- ⬜ Thao tác trên tab không xem (BrowserView ngoài vùng nhìn): chưa thử click / gõ.
- ⬜ `outline` nhanh hơn trên trang lớn: kiểm từng selector ứng viên bằng tìm cả trang (300 node / Wikipedia ≈ 1,6 s) → đếm tên trùng một lượt như `outline.js` của Ghosthand.
- ⬜ Chạy `scripts/ghosthand-client.js 20 google` sau bước 04.
