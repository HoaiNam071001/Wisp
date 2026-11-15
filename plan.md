# Wisp — Kế hoạch

App macOS mở **webgame Flash online** (Bang Bang 4VN – cf4vn.bar, Bang Bang CMN) bằng **Flash Player thật**: Electron 11.5.0 x64 + Pepper Flash 32.0.0.465, có chế độ dự phòng Ruffle. Cách cài và dùng: xem `README.md`.

Trạng thái: ✅ xong · 🔄 đang làm · ⬜ chưa làm

## 1. Kiến trúc hiện tại (✅)

| Phần | Cách làm | Ở đâu |
|---|---|---|
| Flash thật | `ppapi-flash-path` / `ppapi-flash-version`, `plugins: true` | `main.js` – `findFlashPlugin`, `readFlashVersion` |
| Kill switch Flash 32 | Ghi `mms.cfg` (allowlist) vào `userData/Pepper Data/Shockwave Flash/System/` mỗi lần mở | `main.js` – `writeMmsCfg`; domain: `DEFAULT_ALLOW` + `config.json` |
| Giao diện | `BrowserWindow` (toolbar) + `BrowserView` (trang) | `toolbar.html`, `toolbar-preload.js` |
| Dự phòng Ruffle | Giao thức `ruffle://`, gỡ CSP, preload chèn Ruffle | `page-preload.js`, `player.html` |
| Bảng kiểm tra | Mạng / Socket TCP / Console / Flash, thử kết nối, NetLog, báo cáo JSON | `inspect.html`, `inspect-preload.js`, `main.js` |
| Chạy thử dev | `WISP_USER_DATA` (dữ liệu riêng), `WISP_INSPECT=1` (mở sẵn bảng) | `main.js` |

## 2. ✅ Lỗi đăng nhập cf4vn.bar (`登陆超时，请稍后再试`)

Người khác vào được, Wisp thì báo "đăng nhập quá thời gian chờ".

Nguyên nhân: allowlist của Flash 32 (`mms.cfg`, `EnableAllowList=1`) mặc định kiểm tra **mọi** URL Flash tải / nối tới, kể cả socket. Mẫu `AllowListUrlPattern=*://*.cf4vn.bar/` **không khớp URL có cổng** (`game.cf4vn.bar:49119`), nên Flash lặng lẽ không mở socket tới máy chủ game (không có lsof, không có trong NetLog) rồi game báo hết thời gian đăng nhập. Flash vẫn tự báo lỗi về `offline.html?...msg=connect login svr overtime game.cf4vn.bar49119`.

Sửa: thêm `AllowListRootMovieOnly=1` vào `mms.cfg` (chỉ kiểm tra SWF gốc). Đã thử bản dev: vào được game, socket `103.116.39.95:49119` ESTABLISHED.

Ghi chú khi gỡ lỗi:
- `AllowListPreview=1` (menu "Ghi log allowlist") **không** tắt việc chặn.
- Chạy dev từ terminal VS Code phải `env -u ELECTRON_RUN_AS_NODE`.

## 3. 🟡 Cập nhật app (tự động + bằng tay)

Không dùng `electron-updater`: trên macOS nó chỉ tự cài khi app có chữ ký Apple (app đang `identity: null`). Tự viết bộ cập nhật (`updater.js`) dựa trên **GitHub Releases** của repo public `HoaiNam071001/Wisp` (gọi API không cần token).

### 3.1 Tách plugin Flash khỏi app (✅)
Lý do: bản phát hành công khai không được kèm plugin của Adobe, và cập nhật thay cả `Wisp.app` thì plugin không được mất.
- ✅ Vị trí tìm plugin `~/Library/Application Support/Wisp/plugins/PepperFlashPlayer.plugin` đứng đầu danh sách trong `findFlashPlugin`.
- ✅ Lần đầu chạy: plugin đang nằm trong app (`resources/plugins`, hoặc `plugins/` khi dev) mà chưa có ở `userData/plugins` → chép ra bằng `ditto`.
- ✅ Chưa có plugin → hộp thoại: **Tải và cài tự động** (archive.org, kiểm tra MD5) / **Chọn file đã tải…** (.dmg / .pkg / .zip / .app / .plugin, app tự tách plugin, không chạy bộ cài Adobe) / **Mở trang tải**. Kiểm tra `codesign --verify --deep --strict`, Team ID Adobe `JQ525L2MZD`, có x86_64; chép vào `userData/plugins` rồi mời mở lại app.
- ✅ Bỏ `extraResources` khỏi `package.json`; bản cá nhân kèm plugin: `npm run dist:personal` (`electron-builder.personal.js`, ra `Wisp-<version>-personal.dmg`).

### 3.2 Phát hành
- 🟡 Đang làm tay: `npm version minor --no-git-tag-version` → `electron-builder --mac zip dmg --x64` → `shasum -a 256` file zip → `gh release create vX.Y.Z` đính kèm `Wisp-X.Y.Z-mac.zip`, `.sha256`, `.dmg`.
- ⬜ Gói thành `npm run release`; thêm target `zip` vào `build.mac.target`.

### 3.3 Kiểm tra bản mới (✅)
- ✅ `GET https://api.github.com/repos/HoaiNam071001/Wisp/releases/latest`, so `tag_name` với `app.getVersion()`, bỏ qua bản nháp / pre-release.
- ✅ Tự kiểm tra 10 giây sau khi mở app, sau đó mỗi 6 giờ; lưu `updateLastCheck`, `updateSkip` trong `config.json`.
- ✅ Bằng tay: menu **Wisp → Kiểm tra cập nhật…** hoặc **⋮ → Kiểm tra cập nhật** (luôn báo kết quả).
- ✅ Có bản mới: nút **Cập nhật x.y.z** màu cam trên toolbar + chấm trên ⋮; hộp thoại có ghi chú phát hành, nút **Cập nhật ngay** / **Để sau** / **Bỏ qua bản này** / **Xem trên GitHub**.
- ⬜ Cài đặt: bật / tắt "Tự kiểm tra cập nhật".

### 3.4 Cài bản mới (✅, chưa thử thật end-to-end)
- ✅ Tải zip vào thư mục tạm (tiến độ trên toolbar + Dock), so `sha256`.
- ✅ Giải nén bằng `ditto -x -k`, kiểm tra `Info.plist` đúng version.
- ✅ Script shell: chờ PID của Wisp thoát → đổi tên app cũ thành `.old` → `ditto` app mới vào đúng chỗ (lỗi thì trả app cũ về) → `xattr -cr` → `open`.
- ✅ Không ghi được vào thư mục chứa app / đang chạy dev → mở trang Release để tải tay.
- ✅ Lỗi ở bước tải / kiểm tra / giải nén → giữ app cũ, báo lỗi, gợi ý tải tay.

### 3.5 Kiểm tra
- ⬜ Bản có bộ cập nhật đầu tiên phải cài tay. Sau đó phát hành bản kế tiếp → app thấy bản mới, cập nhật, mở lại đúng version, plugin + đăng nhập + `config.json` còn nguyên.
- ⬜ Mất mạng / sai sha256 / không có quyền ghi → app cũ vẫn chạy.

## 4. ⬜ Wisp làm trình duyệt chuẩn cho Ghosthand

### 4.0 Mục tiêu & nguyên tắc

Wisp là **trình duyệt hiện đại thật** chạy được mọi trang như Chrome thường, kèm **cổng nối Ghosthand** có sẵn trong app để AI (qua MCP của Ghosthand) đọc trang, lấy element, thao tác nhanh và chính xác – **không cần extension Chrome**, không bị chặn như Chrome Ghosthand tự mở.

Vì sao Chrome của Ghosthand (`internal/web`, chromedp) dễ bị chặn: mở bằng `--remote-debugging-port`, profile mới, cờ tự động → trang lớn (Google đăng nhập, Cloudflare…) nhận ra "trình duyệt đang bị điều khiển".

Nguyên tắc:
- **Không mở cổng CDP ra ngoài**, không chạy với cờ tự động. Wisp tự điều khiển trang từ bên trong (preload thế giới riêng + `webContents.debugger` khi cần), chỉ đưa ra **API mức cao** qua cổng riêng có token.
- **Không giả dấu vân tay** (canvas, GPU, font, TLS…): dùng Chromium bản mới thật, để nguyên đặc điểm thật cho khớp nhau. Chỉ chỉnh UA / Client Hints để bỏ chữ Electron.
- Thao tác bằng **sự kiện thật** (`webContents.sendInputEvent` → `isTrusted = true`), không `element.click()` giả.
- Trang không thấy dấu vết của app: biến / hàm của Wisp chỉ nằm trong thế giới riêng của preload (`contextIsolation`), không gắn vào `window` của trang.
- Selector cùng cú pháp với Ghosthand (`text=` / `aria=` / `role=…[name="…"]` / `css=`, xem `ParseSelector`, `StableSelector` ở `autoclicker/internal/model`) để kịch bản dùng chung, không phải chuyển đổi.
- Chữ lấy từ trang là **dữ liệu**, không phải lệnh (giống quy ước MCP Ghosthand).

### 4.1 Hai chế độ

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
- ⬜ **4.1.1 Tách mã:** `main.js` (1886 dòng) tách theo việc trước khi chuyển: `tabs.js`, `flash/` (`findFlashPlugin`, `writeMmsCfg`, `flash-win.js`, Ruffle, bảng kiểm tra), `menu-app.js`, `updater.js` (đã riêng). Không đổi hành vi, kiểm tra Flash + Ruffle còn chạy.
- ⬜ **4.1.2 Tiến trình Game:** mã `flash/` chạy bằng Electron 11 đi kèm, mở cửa sổ game riêng (toolbar gọn: URL, tải lại, bảng kiểm tra, Flash / Ruffle). Vỏ app mở tiến trình bằng `child_process.spawn` (bỏ `ELECTRON_RUN_AS_NODE` khỏi env), nói chuyện qua stdin / stdout JSON (mở URL, đóng, `frameRect`, trạng thái).
- ⬜ **4.1.3 Chọn chế độ:** URL thuộc allowlist Flash (`DEFAULT_ALLOW` + `config.json`) hoặc trang có `<embed|object>` `.swf` → thanh báo "Mở ở chế độ Game"; menu ⋮ → **Mở ở chế độ Game / Web**; nhớ lựa chọn theo domain trong `config.json`.
- ⬜ **4.1.4 Vỏ app lên Electron mới:** đổi `package.json`, sửa API đã bỏ: `new-window` → `setWindowOpenHandler`, `BrowserView` → `WebContentsView` (nếu bản mới đã bỏ `BrowserView`), `worldSafeExecuteJavaScript`, `remote`… Bỏ `plugins: true`, `ppapi-flash-*` khỏi tiến trình Web.
- ⬜ **4.1.5 Đóng gói:** electron-builder chép Electron 11 vào `Resources/game` (`extraResources`), mac x64 (Game chạy Rosetta trên Apple Silicon) – thử luôn bản arm64 cho vỏ app; Windows nsis tương tự. `updater.js` vẫn thay cả app (zip lớn hơn), plugin Flash vẫn ở `userData/plugins`.
- Xong khi: mở cf4vn.bar → Game đăng nhập vào được game như bản 2.3.0; mở youtube.com → chế độ Web, phát video được.

### 4.2 Chế độ Web như Chrome thường

- ⬜ **UA:** `app.userAgentFallback` = UA Chrome cùng số bản Chromium đang chạy (`process.versions.chrome`), bỏ `Electron/…`, `wisp/…`. Client Hints (`Sec-CH-UA`, `navigator.userAgentData.brands`) có "Google Chrome" / "Chromium" đúng số bản – kiểm tra trên https://browserleaks.com/client-hints không lệch với UA.
- ⬜ **Popup / OAuth:** `setWindowOpenHandler` – `window.open` có `features` (popup đăng nhập) → cửa sổ thật giữ `opener` và `postMessage`; link `target=_blank` → tab mới. Thử "Đăng nhập bằng Google / Facebook" trên vài trang.
- ⬜ **Quyền:** `setPermissionRequestHandler` hỏi người dùng (camera, mic, thông báo, vị trí, clipboard), nhớ theo domain; trang chưa hỏi thì từ chối.
- ⬜ **Session:** `persist:web` lưu cookie / localStorage / cache lâu dài; tách khỏi session Game. Menu xoá dữ liệu duyệt web.
- ⬜ **Tải file:** `will-download` → hỏi chỗ lưu / mặc định Downloads, tiến độ trên toolbar, mở thư mục.
- ⬜ **Khác:** PDF viewer, in, zoom theo trang, tìm trong trang (Cmd/Ctrl+F), chặn mở `file://` từ trang web.
- ⬜ **Đăng nhập Google:** thử trực tiếp trên bản mới. Google báo "Trình duyệt này hoặc ứng dụng có thể không an toàn" → không cố vượt: nút **Đăng nhập bằng trình duyệt hệ thống** (mở `shell.openExternal`), ghi chú cho người dùng.
- ⬜ **Bộ trang thử** (`test/sites.json` + script chạy Wisp mở lần lượt, chụp ảnh, ghi lỗi console / trạng thái): google.com, accounts.google.com, youtube.com, facebook.com, github.com, một trang Cloudflare, một trang có reCAPTCHA, cf4vn.bar (phải chuyển Game). Chạy trước mỗi bản phát hành.
- Xong khi: các trang trên mở, dùng được như Chrome; không có trang nào báo trình duyệt cũ / không hỗ trợ.

### 4.3 Cổng Wisp cho Ghosthand

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
- Xong khi: script Node nhỏ (`test/ghosthand-client.js`) nối cổng, mở google.com, `type` ô tìm kiếm, `click`, đọc tiêu đề kết quả; chạy lại 20 lần không lỗi.

### 4.4 Phía Ghosthand (repo `autoclicker`)

- ⬜ **Backend Wisp:** `internal/wisp/` cài interface `web.Browser` (`Open`, `Find`, `Hover`, `Focused`, `BgClick`, `BgType`, `Keys`, `PageOutline`, `Mark`, `Settle`…) bằng cổng Wisp → node web hiện có (`webClick`, `webType`, `webScroll`, `webKey`, chờ element…) chạy với Wisp không phải đổi kịch bản. Thao tác "nền" ánh xạ thẳng lệnh Wisp (đã là sự kiện thật, không cần đưa cửa sổ lên trước).
- ⬜ **Chọn trình duyệt:** thiết lập trình duyệt của node web thêm "Wisp" (cạnh Chrome / Edge / Brave của app); Wisp đang mở + cổng bật thì gợi ý mặc định. Wisp chưa mở → mở app rồi chờ `ghosthand.json`.
- ⬜ **MCP:** `probe_page`, `read_web_outline`, `suggest_selector`, `describe_screen` dùng được với tab Wisp; primer / `get_step_types topic=web` ghi ngắn "có Wisp thì dùng Wisp". Giữ gọn theo `mcpsrv/budget_test.go`.
- ⬜ **Hướng dẫn:** chương web trong `internal/guide/` thêm phần Wisp.
- Làm theo skill dự án (`add-node-type` nếu thêm trường, `test-after-change`, `wrap-up`) và quy tắc trong `autoclicker/CLAUDE.md`.

### 4.5 Chọn element trên Wisp → step Ghosthand

- ⬜ Nút **Chọn element** (icon ngắm) trên toolbar, phím tắt Cmd/Ctrl+Shift+E: rê chuột → tô khung + nhãn `role "tên"`; Esc thoát; phím ↑ / ↓ chọn cha / con.
- ⬜ Bấm → bảng nhỏ: selector bền (có thể sửa / chọn selector khác), số element khớp (phải = 1, không thì cảnh báo), chữ / giá trị hiện tại, nút **Click** / **Gõ chữ** / **Chờ thấy** / **Đọc giá trị** / **Chép**.
- ⬜ Chọn nút → gửi sang Ghosthand qua cổng (sự kiện `pick`) → Ghosthand thêm step vào kịch bản đang mở (hoặc vào nháp `draft`), báo lại "Đã thêm n5".
- ⬜ Chế độ **Ghi lại** (sau): bật ghi → mỗi click / gõ của người dùng thành một step.

### 4.6 Chế độ Game với Ghosthand

- ⬜ `frameRect` trả khung `<embed>` / canvas Ruffle trên màn hình; Ghosthand node tìm ảnh / chữ có tuỳ chọn "trong khung game Wisp" → giới hạn vùng tìm (nhanh hơn, ít nhầm).
- ⬜ Cửa sổ game: tuỳ chọn khoá kích thước (ví dụ 1000×600) để ảnh mẫu khớp mọi lần chạy; không thu nhỏ / che khi đang chạy kịch bản (báo nếu bị che).
- ⬜ Lệnh `game {action:"reload"|"mute"|"focus"}` cho kịch bản tự xử lý game treo.

### 4.7 Thứ tự làm & kiểm tra

| # | Việc | Phụ thuộc | Kiểm tra |
|---|---|---|---|
| 1 | 4.3 cổng Wisp trên Electron 11 hiện tại (tab thường), `test/ghosthand-client.js` | – | client chạy 20 lần ổn |
| 2 | 4.4 backend Wisp trong Ghosthand, node web chạy với Wisp | 1 | kịch bản web mẫu chạy với Wisp |
| 3 | 4.1.1 tách `main.js` | – | Flash + Ruffle như cũ |
| 4 | 4.1.2–4.1.5 tách Game, vỏ lên Electron mới | 3 | cf4vn.bar vào game; youtube phát video |
| 5 | 4.2 Web như Chrome + bộ trang thử | 4 | bộ trang thử qua hết |
| 6 | 4.5 Chọn element → step | 2, 4 | chọn ô tìm kiếm Google → step `webType` chạy được |
| 7 | 4.6 Game + Ghosthand | 4 | node tìm chữ chỉ trong khung game |
| 8 | Phát hành 3.0.0 (đổi số lớn vì đổi engine) | 5 | cập nhật từ 2.3.0 giữ plugin + `config.json` |

Rủi ro riêng mục 4:
- Ghép hai bản Electron trong một gói: dung lượng tăng (~2×); Electron 11 trên macOS mới có thể lỗi → vẫn giữ được bản 2.x cho Game nếu cần.
- Google có thể vẫn chặn đăng nhập trong Electron → dùng trình duyệt hệ thống cho bước đăng nhập (4.2).
- Cổng local: chỉ `127.0.0.1` + token + quyền file 600; app khác trên máy đọc được file token thì vẫn nối được → chấp nhận (cùng người dùng), có nút tắt cổng.
- Trang đổi DOM thường xuyên → luôn trả nhiều selector, Ghosthand thử lần lượt (như `Selectors` hiện có).

## 5. Rủi ro & lưu ý

- **Bảo mật:** Electron 11 (Chromium 87) và Flash 32 không còn được vá. Chỉ dùng cho trang game, không đăng nhập tài khoản quan trọng.
- **Bản quyền:** không phát hành công khai plugin Flash (vì vậy cần mục 3.1).
- **macOS mới:** Electron 11 chạy qua Rosetta, có thể lỗi vặt; phương án B là máy ảo Windows + client chính thức.
- **Chạy từ terminal VS Code:** biến `ELECTRON_RUN_AS_NODE` làm `require('electron')` hỏng → `env -u ELECTRON_RUN_AS_NODE npm start`.

## 6. Tham khảo

- Pepper Flash trong Electron (tài liệu cũ): https://github.com/electron/electron/blob/v1.1.3/docs/tutorial/using-pepper-flash-plugin.md
- Flash Player 32 Admin Guide (`mms.cfg`, allowlist): https://open-flash.github.io/mirrors/flash-player-admin-32.pdf
- GitHub API – latest release: https://docs.github.com/rest/releases/releases#get-the-latest-release
- NetLog viewer: https://netlog-viewer.appspot.com
- Ruffle: https://ruffle.rs
