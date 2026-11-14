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

## 2. Plugin Flash (bắt buộc cho chế độ Flash thật)

App **không** kèm sẵn plugin. Đặt `PepperFlashPlayer.plugin` (PPAPI, x64, bản 32.0.0.x) vào một trong hai chỗ:

- `plugins/PepperFlashPlayer.plugin` (trong thư mục này; sẽ được đóng gói vào app)
- `/Library/Internet Plug-Ins/PepperFlashPlayer/PepperFlashPlayer.plugin` (chỗ bộ cài Adobe từng cài)

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

Dữ liệu nằm ở `~/Library/Application Support/Wisp/`. Lần đầu chạy, app tự chuyển thư mục cũ `Flash Browser 2/` sang (giữ đăng nhập); nếu chỉ có bản 1 thì chép trang chủ từ `Flash Browser/config.json` (cookie bản 1 do Electron 45 tạo, Chromium 87 không đọc được).

## 5. Đóng gói `.dmg`

```bash
npm run dist        # electron-builder --mac dmg --x64, kèm thư mục plugins/
```

App không có chữ ký: lần đầu mở thì chuột phải → **Open**, hoặc `xattr -cr "/Applications/Wisp.app"`.
Không phát hành công khai bản `.dmg` có kèm plugin Flash; chỉ dùng cá nhân.

## 6. Lưu ý bảo mật

Electron 11 (Chromium 87) và Flash 32 đều không còn được vá lỗi. Chỉ dùng app này để chơi game, không dùng để duyệt web chung, không đăng nhập tài khoản quan trọng.
