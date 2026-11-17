# 01. 🔄 Cổng Wisp cho Ghosthand

Phụ thuộc: –

**Xong khi:** Script `scripts/ghosthand-client.js` nối cổng, mở google.com, gõ ô tìm kiếm, bấm, đọc tiêu đề kết quả; chạy 20 lần không lỗi.

> 2026-11-15: `node scripts/ghosthand-client.js 20 wiki` (vi.wikipedia.org, cùng luồng) **20/20 ok**, ~2,4 s / lần. Với Google: Chromium 87 nhận trang HTML cũ + `/sorry` (CAPTCHA) sau vài lần tìm → mốc Google chạy lại sau bước 04 (Electron mới). Không né CAPTCHA (nguyên tắc không giả).

Làm trên Electron 11 hiện tại (tab thường) để chốt API sớm; lên Electron mới (bước 04) chỉ đổi phần bên dưới.

**Kết nối**
- ✅ Server trong tiến trình chính, chỉ nghe `127.0.0.1`, cổng ngẫu nhiên. Mỗi lần mở app tạo token mới, ghi `userData/ghosthand.json`: `{"port": 51234, "token": "…", "pid": 123, "version": "3.0.0", "api": 1}` (quyền file 600). Ghosthand đọc file này để nối.
- ✅ Giao thức: **WebSocket JSON** (một kết nối, nhiều lệnh, Wisp đẩy sự kiện được) – `{"id":1,"cmd":"find","args":{…}}` → `{"id":1,"ok":true,"result":{…}}` / `{"id":1,"ok":false,"error":{"code":"not_found","detail":"…"}}`. Token gửi ở header `Authorization: Bearer <token>` khi bắt tay; sai token / có header `Origin` (trang web trong trình duyệt) → 401. Thư viện `ws@7` (chạy được Node 12). Lệnh của một kết nối chạy lần lượt. Bật / tắt tạm bằng `config.json` → `ghosthandPort: false` (mặc định bật).
- ✅ Cài đặt: công tắc **Cổng Ghosthand** trong nhóm *Tuỳ chọn* của menu ⋮ (+ menu hệ thống *Tuỳ chọn*), dòng phụ nói trạng thái (tắt / chờ nối / đang nối); khoá `ghosthandPort` (mặc định bật). Chip tím **Ghosthand** trên toolbar khi có kết nối, bấm = ngắt. Ngắt / tắt cổng đóng WebSocket với mã **4000** → Ghosthand (bước 02) không tự nối lại.

**Lệnh** (mọi lệnh có `tab` tuỳ chọn: id / URL / tiêu đề chứa; trống = tab đang xem)

| Nhóm | Lệnh | Trả về / ghi chú |
|---|---|---|
| Tab | `tabs` | `[{id, url, title, active, engine:"web"\|"flash", loading}]` |
| | `open {url, newTab}` / `navigate {url}` / `back` / `forward` / `reload` / `close` / `activate` | tab id |
| | `waitLoad {until:"load"\|"idle", timeoutMs}` | URL cuối, thời gian |
| Đọc | `outline {root?, maxNodes?, visibleOnly?}` | cây gọn: `{ref, role, name, text, value, state[checked,disabled,expanded,focused], rect}`, bỏ node trang trí; có cờ `truncated` |
| | `find {selectors[], all?, visibleOnly?, scope?:"dialog", brief?}` | `[{ref, selector, role, name, text, rect, frame, covered}]` (`frame` = đường dẫn frame theo `window.frames`: `""` trang chính, `"1.0"`; `covered` = phần tử đè lên tâm, `""` = không); không thấy → `ok:true, found:[], hidden` (số phần tử khớp đang ẩn); `scope dialog` = chỉ trong hộp thoại đang mở trên cùng (không có → `noDialog: true`); `brief` = không tính selector bền (nhanh – Ghosthand chạy kịch bản) |
| | `read {ref\|selector, what:"text"\|"value"\|"html"\|"attrs"\|"table"}` | chữ / giá trị / bảng dạng mảng hàng |
| | `pageText {maxChars}` | chữ chính của trang (bỏ menu / footer) |
| | `screenshot {ref?, fullPage?}` | PNG base64 (cả trang / element) |
| Thao tác | `click {ref\|selector, button, count, offset?}` | cuộn tới element, kiểm tra element ở trên cùng tại điểm bấm (`elementFromPoint`), bấm bằng `sendInputEvent`; trả `{navigated, url, popup}` |
| | `type {ref\|selector?, text, clear, enter}` | focus + kiểm tra focus đúng ô, gõ bằng `insertText` / `char` events; không đích = gõ vào ô đang nhận phím |
| | `focused {ref}` | `{ok, ref, active}` – ô đang nhận phím có phải `ref` (hoặc nằm trong nó); trang thay ô khi bấm → `ref` mới |
| | `select {ref\|selector, value\|label}` / `check {ref, on}` | thao tác như người dùng (mở dropdown nếu cần) |
| | `scroll {ref?\|dir, amount}` / `hover {ref}` / `keys {keys[], mods[]}` | |
| Chờ | `waitFor {selectors[], state:"visible"\|"hidden"\|"enabled", timeoutMs}` | element hoặc `timeout` |
| | `settle {timeoutMs}` | chờ hết điều hướng / mạng / DOM đổi |
| Game | `frameRect {tab}` | khung game trên **màn hình** (toạ độ thật, có tỉ lệ màn hình) để Ghosthand OCR đúng vùng |
| Sự kiện | `subscribe {events:["navigate","dialog","popup","download"]}` | Wisp đẩy sự kiện; hộp thoại `alert/confirm` trả bằng `dialog {accept, text}`; hộp đóng (client trả lời / người dùng tự bấm) → `dialog {tab, closed: true}` |

**Bên trong**
- ✅ `ghosthand/server.js` (WebSocket, token, chia lệnh), `ghosthand/commands/{tabs,read,act,wait}.js`, `ghosthand/agent/` (preload khung chính, thế giới riêng: `dom` / `find` chép từ `autoclicker/internal/web/common.js` + `find.js` – cùng cách so; `outline`, `read`, `elements` = ref + selector), `agent-call.js` (IPC `gh:call` / `gh:reply`), `input.js` (sendInputEvent), `target.js` (tab đích, `screenRect`). Logic thuần có test: `selector.js`, `protocol.js` (kiểm đối số, trần đối số, chỉ http(s)), `keys.js`, `info-file.js`.
- ✅ Trang không thấy dấu vết: đã thử trang so biến `window` với iframe sạch + MutationObserver – không biến lạ, không đổi DOM (pageText chỉ đọc), `navigator.webdriver` không có.
- ✅ `ref` = id element ổn định trong một lần tải trang (WeakMap trong preload ↔ số), tải lại trang → `stale_ref`, Ghosthand tìm lại bằng `selector`. Dạng `"<mã lần tải>.<số>"`. `type`: trang thay ô khi bấm (Wikipedia, Vue / React) → nhận ô đang focus nằm ngay điểm vừa bấm, trả ref mới.
- ✅ Mỗi element trả kèm **selector bền** theo thứ tự: `role=…[name="…"]` → `aria=` → `css=[data-testid=…]` / `#id` không tự sinh → `text=` → CSS đường dẫn ngắn. Logic chung với `StableSelector` của Ghosthand (dữ liệu thử chép từ `autoclicker/testdata` vào `test/data/` – Ghosthand đổi thì chép lại). Mỗi selector đã kiểm tìm lại ra đúng phần tử; trả `selector` + `selectors` (dạng chứa phần cố định đứng trước).
- ✅ iframe khác nguồn: preload chạy mọi frame (`nodeIntegrationInSubFrames`); frame khác nguồn với khung cha cài agent riêng, báo main `gh:frame` (gỡ / chuyển trang → `gh:frame-gone`), main gọi bằng `sendToFrame([pid, fid])`. `ghosthand/page-call.js` ghép: ref → agent sinh ref (mã lần tải); selector → agent khớp selector sớm nhất (`frame-layout.pickFirst`, khung chính trước); gốc toạ độ + vùng nhìn thấy của frame tính từ `frames()` của mọi agent (`frame-layout.compose`, có test) → mọi `rect` theo trang chính; `covered` xét cả lớp che của trang cha (`frameCover`); selector của phần tử frame con bỏ cái frame đứng trước cũng khớp; `outline` / `pageText` ghép (dòng frame con có `frame`), `frameRect` lấy khung lớn nhất. Electron 11 không chuyển `sendInputEvent` vào iframe ở process khác → tắt site isolation (`docs/decisions.md`). Thử trên trang 127.0.0.1 ⊃ iframe localhost ⊃ iframe cháu: find / click / type / cuộn tới nút cuối frame / click cháu (`isTrusted: true`), `covered` qua lớp che trang cha, outline, waitFor, screenshot phần tử.
- ✅ Shadow DOM mở: tìm / outline / bấm / gõ / `covered` đi qua shadow root (cả lồng nhau); XPath không vào shadow root; shadow đóng bỏ qua.
- ✅ Popup (`window.open` / `target=_blank`) mở thành tab mới (`click` trả `popup` = tab id, sự kiện `popup`) → thao tác bằng `tab`.
- ✅ Toạ độ: `rect` theo CSS px trong trang + `screenRect` (cộng vị trí view + cửa sổ, nhân `zoomFactor`) để Ghosthand bấm chuột thật được khi cần. `screenRect` = điểm DIP của màn hình + `scale`; tab không xem có `offscreen: true`.
- ✅ Mã lỗi: `not_found`, `not_visible`, `covered` (element khác đè lên điểm bấm – trả mô tả element đè), `not_focused`, `stale_ref`, `timeout`, `no_tab`, `flash_page` (lệnh DOM trên trang mở bằng engine flash – dùng từ bước 04), `bad_args`, thêm `internal` (lỗi lập trình / Electron ném – không phải lỗi của client).

**Đã làm (2026-11-15):** `tabs`, `open`, `navigate`, `back`, `forward`, `reload`, `close`, `activate`, `waitLoad`, `outline`, `find` (trả `{selectorIndex, found[], more}`), `read`, `pageText`, `screenshot` (phần đang thấy / một phần tử), `click`, `type`, `keys`, `scroll`, `hover`, `waitFor`. Đã thử trên app dev: các lệnh trên, `covered`, `stale_ref`, `not_found`, `no_tab`, token sai / có Origin → 401, `file://` bị chặn.

- ✅ `select` (chỉ `<select>` thật): focus + gõ đoạn đầu ngắn nhất của nhãn theo cách typeahead của Chromium tìm (1 ký tự: từ sau lựa chọn hiện tại, nhiều ký tự: từ chính nó), chờ phiên typeahead cũ hết (~1,1 s) trước lần gõ sau; không bấm mở (menu gốc của hệ điều hành) và không gán `value` bằng JS. Trang nhận `change` có `isTrusted: true`. Danh sách tự dựng → `bad_args` gợi ý dùng `click`.
- ✅ `check {on}`: đọc `checked` / `aria-checked`, khác thì bấm thật, kiểm lại.
- ✅ `settle` (= `waitLoad idle`), `frameRect` (embed / object / canvas / iframe / Ruffle lớn nhất → `rect` + `screenRect`).
- ✅ `subscribe {events}` (thay cả danh sách; `[]` = bỏ): đẩy `{"event": …, "data": …}` – `navigate`, `popup` (`tab`, `opener`, `url`), `download`, `dialog`. Hộp thoại JS: `webContents.debugger` chỉ domain Page, chỉ gắn khi có client subscribe `dialog`; `dialog {accept, text}` trả lời; lệnh chạm trang khi hộp đang mở → `timeout` nói rõ có hộp thoại. Electron không hỗ trợ `prompt()` (trang nhận lỗi) – chỉ `alert` / `confirm` / `beforeunload`.
- ✅ `outline` một lượt (đếm tên cùng vai trò đứng trước như `outline.js` của Ghosthand): Wikipedia 417 node 1,6 s → 162 ms; 810 selector trên Wikipedia / GitHub / Hacker News tìm lại đúng phần tử.
- ✅ Thao tác trên tab không xem: `type` / `click` vào tab nền chạy (`isTrusted: true`), `screenRect.offscreen = true`.

- ✅ Thêm cho Ghosthand (bước 02, 2026-11-15, vẫn `api: 1` – chỉ thêm): `find` `scope` / `brief` / `covered` / `hidden`, `focused`, `type` không đích, sự kiện `dialog closed`.

**Còn lại**
- ⬜ `screenshot fullPage` (Electron 11 `capturePage` chỉ chụp phần đang thấy; cuộn rồi ghép thì trang thấy cuộn) → làm ở bước 04 bằng API của Electron mới.
- ✅ Chạy `scripts/ghosthand-client.js 20 google` sau khi vỏ app lên Electron 45: 20/20 ok (2026-11-17); wiki 20/20.
