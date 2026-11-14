# Wisp (macOS)

App mở webgame Flash (vd. Bang Bang) bằng **Flash Player thật** (Pepper Flash / PPAPI) chạy trong **Electron 11.5.0 x64**. Flash thật mở được kết nối socket tới máy chủ game, điều mà Ruffle (bản 1) không làm được.
Chế độ dự phòng **Ruffle** vẫn còn, dùng cho nội dung Flash đơn giản không cần socket.

Bản 1 (Electron 45 + Ruffle) được lưu ở `v1-ruffle/`. Kế hoạch chi tiết: `plan.md`.

## 1. Cài đặt

Mac chip M cần Rosetta: `softwareupdate --install-rosetta`

```bash
cd flash-app
npm_config_arch=x64 npm install     # .npmrc đã đặt arch=x64; biến môi trường để chắc chắn
npm start
```

Kiểm tra Electron đúng bản x64: `file node_modules/electron/dist/Electron.app/Contents/MacOS/Electron` phải ra `x86_64`.

### Chạy dev

```bash
npm start
```

Đang mở sẵn `Wisp.app` bản đã cài thì chạy bản dev với thư mục dữ liệu riêng để hai bản không dùng chung cookie / đăng nhập:

```bash
WISP_USER_DATA=/tmp/wisp-dev WISP_INSPECT=1 FLASH_URL=https://cf4vn.bar/ npm start
```

| Biến | Tác dụng |
|---|---|
| `WISP_USER_DATA` | Thư mục dữ liệu riêng cho bản dev (không đụng `~/Library/Application Support/Wisp`) |
| `WISP_INSPECT=1` | Tự mở Bảng kiểm tra khi khởi động |
| `FLASH_URL` | Mở thẳng địa chỉ này thay cho trang chủ (cũng nhận đường dẫn file `.swf`) |

- Báo lỗi `Cannot read property 'getPath' of undefined` → terminal (hay gặp trong VS Code) đang có biến `ELECTRON_RUN_AS_NODE`. Thêm `env -u ELECTRON_RUN_AS_NODE` vào đầu lệnh, vd. `env -u ELECTRON_RUN_AS_NODE npm start`.
- App không tự tải lại khi sửa code: tắt app rồi chạy lại lệnh. Trang web thì Cmd+R là đủ.
- Đóng gói: `npm run dist` → `dist/Wisp-<version>.dmg` (xem mục 5).

## 2. Plugin Flash (bắt buộc cho chế độ Flash thật)

Bản phát hành **không** kèm plugin của Adobe. Plugin (`PepperFlashPlayer.plugin`, PPAPI, x64, bản 32.0.0.x) được cài riêng vào
`~/Library/Application Support/Wisp/plugins/`, nên cập nhật hay cài lại `Wisp.app` không làm mất plugin.

Cách cài:

- **Chọn file**: chưa có plugin thì app hỏi "Chọn plugin…" ngay khi mở (hoặc menu **Flash → Cài plugin Flash…**). App kiểm tra chữ ký (`codesign`, phải do *Adobe Inc. (JQ525L2MZD)* ký và có bản x86_64), chép vào thư mục trên rồi mở lại.
- **Tự chép lần đầu**: bản build cá nhân (`npm run dist:personal`) hoặc chạy dev có `plugins/PepperFlashPlayer.plugin` → lần đầu chạy app tự chép plugin sang thư mục trên.

App tìm plugin theo thứ tự: `userData/plugins/` → plugin kèm trong app / `plugins/` khi chạy dev → `/Library/Internet Plug-Ins/PepperFlashPlayer/` → `~/Library/Internet Plug-Ins/PepperFlashPlayer/`.

Version được đọc tự động từ `Info.plist` / `manifest.json` của plugin. Chưa có plugin thì app báo lỗi và chạy tạm bằng Ruffle.
⚠️ Chỉ lấy plugin từ nguồn tin cậy. Flash không còn được vá lỗi và hay bị phát tán kèm mã độc.

## 3. Allowlist (`mms.cfg`): mở khoá kill switch của Flash 32

Mỗi lần khởi động, app tự ghi `mms.cfg` vào
`~/Library/Application Support/Wisp/Pepper Data/Shockwave Flash/System/mms.cfg`.
Mặc định cho phép `cmn.vn`, `cf4vn.bar` (cùng mọi subdomain) và `file:*`; domain thêm trong `config.json` được cộng vào danh sách này.

Thêm domain của game:
- Mở trang game, chờ Flash tải xong → menu **Flash → Cho phép Flash trên trang này** (Shift+Cmd+A). App tự thêm domain của trang và của các file `.swf` nó vừa tải, rồi hỏi để khởi động lại.
- Hoặc **Flash → Sửa danh sách domain cho phép…** để sửa tay `allowDomains` trong `config.json`.
- Sửa mặc định: `DEFAULT_ALLOW` ở đầu `main.js`.

Nếu Flash vẫn bị chặn: bật **Flash → Ghi log allowlist** (thêm `AllowListPreview=1`, `TraceOutputEcho=1`), xem thêm DevTools → Network. Nếu cách trên vẫn không được, chép file vào `/Library/Application Support/Macromedia/mms.cfg` (cần sudo).

## 4. Cách dùng

- **Flash → Kiểm tra Flash Player**: xem `navigator.plugins`, version, kiến trúc, đường dẫn `mms.cfg`.
- **Flash → Chế độ: Flash Player thật / Ruffle**: đổi chế độ (app khởi động lại).
- Huy hiệu trên thanh công cụ: xanh `FLASH 32.0.0.x` là Flash thật, cam `RUFFLE` là đang giả lập.
- Gõ địa chỉ rồi Enter (Cmd+L). **★ Đặt làm trang chủ** để lần sau mở vào thẳng trang đó. Mặc định là `DEFAULT_URL` trong `main.js`.
- Mở file `.swf`: Cmd+O, gõ đường dẫn (`~/Downloads/game.swf`), hoặc kéo file vào icon app.
- Phím tắt: Cmd+R tải lại, Ctrl+Cmd+F toàn màn hình, Cmd+= / Cmd+- / Cmd+0 zoom, Alt+Cmd+I DevTools.
- **Bảng kiểm tra** (nút 🔍 trên thanh công cụ, hoặc Shift+Cmd+I) để gỡ lỗi game không vào được:
  - **Mạng**: mọi request HTTP của trang, kể cả request do Flash gửi (lọc, chỉ lỗi, xem header, sao chép cURL).
  - **Socket TCP**: các kết nối TCP của Wisp, đọc bằng `lsof` khi bảng đang mở, nên **mở bảng trước khi vào game**. `SYN_SENT` mãi hoặc "đóng, chưa nối được" là bị chặn; `ESTABLISHED` rồi đóng là máy chủ ngắt. Ô **Thử kết nối** nối thẳng tới host:port, có thể kèm xin policy Flash. Nút **NetLog** ghi log mạng chi tiết của Chromium vào Downloads (mở bằng netlog-viewer.appspot.com).
  - **Console & sự kiện**: console của trang, lỗi tải trang, plugin crash, mở/đóng socket.
  - **Flash**: plugin, version, User-Agent, nội dung `mms.cfg`.
  - **Lưu báo cáo**: lưu toàn bộ log ra file JSON để gửi người khác xem.

Dữ liệu nằm ở `~/Library/Application Support/Wisp/`. Lần đầu chạy, app tự chuyển thư mục cũ `Flash Browser 2/` sang (giữ đăng nhập); nếu chỉ có bản 1 thì chép trang chủ từ `Flash Browser/config.json` (cookie bản 1 do Electron 45 tạo, Chromium 87 không đọc được).

## 5. Đóng gói `.dmg`

```bash
npm run dist            # bản phát hành: dist/Wisp-<version>.dmg, KHÔNG kèm plugin Flash
npm run dist:personal   # bản cá nhân: dist/Wisp-<version>-personal.dmg, kèm plugins/PepperFlashPlayer.plugin
```

Cấu hình bản cá nhân ở `electron-builder.personal.js` (lấy `build` trong `package.json`, thêm plugin).

App không có chữ ký: lần đầu mở thì chuột phải → **Open**, hoặc `xattr -cr "/Applications/Wisp.app"`.
Không phát hành công khai bản `-personal.dmg` (có kèm plugin Flash); chỉ dùng cá nhân.

## 6. Cài lên máy khác

Máy mới cần macOS chạy được app x64: máy Intel, hoặc máy chip M đã cài Rosetta (`softwareupdate --install-rosetta`).

### Cách 1: bản cá nhân (có sẵn Flash)

Trên máy build:

1. `npm run dist:personal` → `dist/Wisp-<version>-personal.dmg`.
2. Gửi file `.dmg` sang máy mới (AirDrop, USB, Drive…).

Trên máy mới:

1. Mở `.dmg`, kéo **Wisp** vào **Applications**.
2. Bỏ chặn của Gatekeeper (app không có chữ ký Apple): `xattr -cr /Applications/Wisp.app`. Hoặc mở app một lần, bị chặn thì vào **System Settings → Privacy & Security** → **Open Anyway**.
3. Mở Wisp: app tự chép plugin ra `~/Library/Application Support/Wisp/plugins/` và chạy Flash luôn.

### Cách 2: bản phát hành + gửi plugin riêng

Trên máy build:

1. `npm run dist` → `dist/Wisp-<version>.dmg` (không kèm plugin).
2. Nén plugin bằng `ditto` (giữ nguyên symlink + chữ ký; nén bằng Finder hay chép qua USB FAT có thể làm hỏng chữ ký, app sẽ từ chối):
   ```bash
   ditto -c -k --keepParent plugins/PepperFlashPlayer.plugin ~/Desktop/PepperFlash.zip
   ```
3. Gửi cả `.dmg` và `PepperFlash.zip` sang máy mới.

Trên máy mới:

1. Cài app như bước 1–2 của cách 1.
2. Bấm đúp `PepperFlash.zip` để giải nén ra `PepperFlashPlayer.plugin`.
3. Mở Wisp → hộp thoại báo chưa có Flash → **Chọn plugin…** → chọn file vừa giải nén → **Mở lại ngay**. (Sau này vẫn cài / thay được ở menu **Flash → Cài plugin Flash…**.)

### Lưu ý

- Đăng nhập (cookie) không đi theo: máy mới phải đăng nhập game lại.
- Domain đã thêm vào allowlist nằm trong `~/Library/Application Support/Wisp/config.json`. Muốn mang sang thì chép file này vào đúng chỗ đó trên máy mới **trước** khi mở app lần đầu (`cmn.vn`, `cf4vn.bar` thì có sẵn).
- Kiểm tra: menu **Flash → Kiểm tra Flash Player** phải báo "Flash Player đã nạp ✓", plugin nằm trong `Application Support/Wisp/plugins`.

## 7. Lưu ý bảo mật

Electron 11 (Chromium 87) và Flash 32 đều không còn được vá lỗi. Chỉ dùng app này để chơi game, không dùng để duyệt web chung, không đăng nhập tài khoản quan trọng.
