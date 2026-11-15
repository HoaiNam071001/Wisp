# Wisp (macOS, Windows)

App mở webgame Flash (vd. Bang Bang) bằng **Flash Player thật** (Pepper Flash / PPAPI) chạy trong **Electron 11.5.0 x64**. Flash thật mở được kết nối socket tới máy chủ game, điều mà Ruffle (bản 1) không làm được.
Chế độ dự phòng **Ruffle** vẫn còn, dùng cho nội dung Flash đơn giản không cần socket.

Bản 1 (Electron 45 + Ruffle) được lưu ở `v1-ruffle/`. Kế hoạch chi tiết: `plan.md`.

## Tải và cài (cho người dùng)

Tải bản mới nhất ở trang **[Releases](https://github.com/HoaiNam071001/Wisp/releases/latest)**:

| Máy | File cần tải |
|---|---|
| Windows 10/11 (64-bit) | `Wisp-x.y.z-win-setup.exe` |
| macOS (Intel, hoặc chip M đã cài Rosetta) | `Wisp-x.y.z.dmg` |

### Windows
1. Chạy `Wisp-x.y.z-win-setup.exe`. Nếu Windows báo *"Windows protected your PC"* → bấm **More info** → **Run anyway** (app chưa có chữ ký số).
2. Cài xong Wisp tự mở; có lối tắt ở Desktop và Start Menu.
3. Lần đầu mở, app hỏi cài Flash → bấm **Tải và cài tự động** (chờ khoảng 1 phút) → **Mở lại ngay**.

### macOS
1. Mở file `.dmg`, kéo **Wisp** vào **Applications**.
2. Mở Terminal, chạy `xattr -cr /Applications/Wisp.app` (hoặc mở app, bị chặn thì vào **System Settings → Privacy & Security → Open Anyway**).
3. Mac chip M chưa có Rosetta: `softwareupdate --install-rosetta`.
4. Lần đầu mở, app hỏi cài Flash → bấm **Tải và cài tự động** → **Mở lại ngay**.

### Flash Player
App tự tải Flash. Nếu tải tự động lỗi, tải tay rồi chọn **Chọn file đã tải…** trong hộp thoại cài Flash (hoặc menu **Flash → Cài Flash Player…**):

- Windows: [Adobe Flash Player (PPAPI) 32.0.0.465.exe](https://archive.org/download/adobe-flash-player-ppapi-32.0.0.465/Adobe%20Flash%20Player%20%28PPAPI%29%2032.0.0.465.exe) (~21 MB) — [trang archive.org](https://archive.org/details/adobe-flash-player-ppapi-32.0.0.465)
- macOS: [install_flash_player_osx_ppapi.dmg](https://archive.org/download/adobe-flash-player-archive_202012/install_flash_player_osx_ppapi.dmg) (~15 MB) — [trang archive.org](https://archive.org/details/adobe-flash-player-archive_202012)

Không cần chạy bộ cài của Adobe: chỉ cần chọn file vừa tải, app tự tách plugin ra và kiểm tra chữ ký Adobe.

Sau khi cài, app tự báo khi có bản mới (nút **Cập nhật** màu cam trên thanh công cụ).

---

# Dành cho người phát triển

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
npm run dev                                   # dữ liệu riêng ở .dev-data/, chạy song song được với Wisp.app đã cài
npm run dev -- inspect                        # mở kèm Bảng kiểm tra
npm run dev -- inspect https://cf4vn.bar/     # mở thẳng một địa chỉ (hoặc file .swf)
```

`npm run dev` (`scripts/dev.js`) tự bỏ biến `ELECTRON_RUN_AS_NODE` và đặt `WISP_USER_DATA` = `.dev-data/` trong repo (đã gitignore, không bị đóng gói), nên không đụng cookie / đăng nhập / `config.json` của bản đã cài. Muốn dữ liệu trống để thử: `rm -rf .dev-data` hoặc `WISP_USER_DATA=/tmp/wisp-dev npm run dev`. Muốn thử trên dữ liệu thật: tắt Wisp.app rồi `cp -R ~/Library/Application\ Support/Wisp .dev-data` (chép, không trỏ thẳng vào thư mục thật).

`npm start` chạy thẳng Electron, dùng chung thư mục dữ liệu với bản đã cài (và thoát ngay nếu bản cài đang mở). Biến môi trường dùng được với cả hai lệnh:

| Biến | Tác dụng |
|---|---|
| `WISP_USER_DATA` | Thư mục dữ liệu riêng cho bản dev (không đụng `~/Library/Application Support/Wisp`) |
| `WISP_INSPECT=1` | Tự mở Bảng kiểm tra khi khởi động |
| `FLASH_URL` | Mở thẳng địa chỉ này thay cho trang chủ (cũng nhận đường dẫn file `.swf`) |

- Báo lỗi `Cannot read property 'getPath' of undefined` → terminal (hay gặp trong VS Code) đang có biến `ELECTRON_RUN_AS_NODE`. Dùng `npm run dev` (tự bỏ biến), hoặc thêm `env -u ELECTRON_RUN_AS_NODE` vào đầu lệnh `npm start`.
- App không tự tải lại khi sửa code: tắt app rồi chạy lại lệnh. Trang web thì Cmd+R là đủ.
- Đóng gói: `npm run dist` → `dist/Wisp-<version>.dmg` (xem mục 5).

## 2. Plugin Flash (bắt buộc cho chế độ Flash thật)

Bản phát hành **không** kèm plugin của Adobe. Plugin (`PepperFlashPlayer.plugin`, PPAPI, x64, bản 32.0.0.x) được cài riêng vào
`~/Library/Application Support/Wisp/plugins/`, nên cập nhật hay cài lại `Wisp.app` không làm mất plugin.

Cách cài (chưa có plugin thì app tự hỏi khi mở; hoặc bấm nhãn **RUFFLE · CÀI FLASH** trên thanh công cụ, **⋮ → Tải và cài Flash Player**, menu **Flash → Cài Flash Player…**):

- **Tải và cài tự động**: app tải bộ cài `install_flash_player_osx_ppapi.dmg` (32.0.0.465, ~15 MB) từ [archive.org](https://archive.org/details/adobe-flash-player-archive_202012) — Adobe đã gỡ bản cài khỏi trang của họ — kiểm tra MD5 `01276b441efca664141d42dc9680a2be`, rồi cài như bên dưới.
- **Chọn file đã tải**: chọn file `.dmg` / `.pkg` / `.zip` / `.app` của bộ cài Adobe Pepper Flash (PPAPI), hoặc chính `PepperFlashPlayer.plugin`.
- **Mở trang tải**: mở trang archive.org trong trình duyệt để tải tay.

App **không chạy bộ cài của Adobe**: nó tự mở gói (`hdiutil attach` .dmg → `.app` → `pkgutil --expand-full` .pkg → payload `PepperFlashPlayer.plugin.lzma`), giải nén payload LZMA bằng thư viện `lzma` (JS thuần), dựng lại thư mục plugin. Sau đó kiểm tra chữ ký (`codesign`, phải do *Adobe Inc. (JQ525L2MZD)* ký và có bản x86_64), chép vào thư mục trên rồi mở lại.

Định dạng payload `.lzma` của Adobe: 11 byte đầu riêng (byte 7–10 là kích thước sau giải nén, big-endian), tiếp theo là luồng LZMA (5 byte thuộc tính + dữ liệu). Sau giải nén là cây thư mục, mỗi mục = `[loại][cờ, 0x80 = thư mục][độ dài tên][tên][kích thước nội dung, 4 byte big-endian][nội dung]`.

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
- Sửa mặc định: `DEFAULT_ALLOW` ở đầu `config.js`.

Nếu Flash vẫn bị chặn: bật **Flash → Ghi log allowlist** (thêm `AllowListPreview=1`, `TraceOutputEcho=1`), xem thêm DevTools → Network. Nếu cách trên vẫn không được, chép file vào `/Library/Application Support/Macromedia/mms.cfg` (cần sudo).

## 4. Cách dùng

- **Flash → Kiểm tra Flash Player**: xem `navigator.plugins`, version, kiến trúc, đường dẫn `mms.cfg`.
- **Flash → Chế độ: Flash Player thật / Ruffle**: đổi chế độ (app khởi động lại).
- Huy hiệu trên thanh công cụ: xanh `FLASH 32.0.0.x` là Flash thật, cam `RUFFLE` là đang giả lập.
- Gõ địa chỉ rồi Enter (Cmd+L). Mặc định mở `DEFAULT_URL` trong `config.js`; đổi bằng **⋮ → Đặt trang này làm trang chủ**.
- Mở file `.swf`: Cmd+O, gõ đường dẫn (`~/Downloads/game.swf`), hoặc kéo file vào icon app.
- **Tab**: Cmd+T tab mới, Cmd+W đóng (hoặc chuột giữa), Shift+Cmd+T mở lại tab vừa đóng, Ctrl+Tab / Cmd+1…9 chuyển tab, chuột phải vào tab để nhân bản / đóng tab khác. Popup và link mở cửa sổ mới mở thành tab mới. Tab đang phát tiếng có 🔊, bấm để tắt tiếng (Shift+Cmd+M).
- **Lịch sử**: Cmd+Y hoặc `wisp://history`; tìm kiếm, xoá từng trang, xoá theo giờ qua / hôm nay / toàn bộ. Lưu ở `history.json`.
- **Nút ⋮** (góc phải): lịch sử, thu phóng, chụp màn hình tab (Shift+Cmd+S, lưu vào `~/Pictures/Wisp` và clipboard), Bảng kiểm tra, xoá cache và tải lại, menu Flash, tuỳ chọn.
- **Ô hiệu năng** trên thanh công cụ: ping tới máy chủ game (chấm xanh < 80ms, vàng < 150ms, đỏ: cao / mất gói) và CPU. Bấm để mở bảng Hiệu năng.
- **Tuỳ chọn** (menu Tuỳ chọn hoặc ⋮ → Tuỳ chọn), mặc định đều bật:
  - Mở lại các tab lần trước khi mở app.
  - Chống App Nap: macOS không hãm game khi cửa sổ bị che / thu nhỏ.
  - Theo dõi ping máy chủ game.
- Phím tắt: Cmd+R tải lại, Shift+Cmd+R tải lại không dùng cache, Ctrl+Cmd+F toàn màn hình, Cmd+= / Cmd+- / Cmd+0 zoom, Alt+Cmd+I DevTools.
- **Bảng kiểm tra** (bấm ô hiệu năng, ⋮, hoặc Shift+Cmd+I):
  - **Hiệu năng**: ping, mất gói, dao động ping của máy chủ game; CPU / RAM của Wisp, của Flash và từng tab; biểu đồ vài phút gần nhất. Cảnh báo vào Console khi Flash ăn CPU ≥ 90% liên tục, tab dùng > 1,5 GB RAM, hoặc mất ≥ 50% gói ping. Ping đo bằng ICMP; máy chủ chặn ICMP thì đo thời gian mở kết nối TCP tới cổng game (10 giây / lần).
  - **Mạng**: mọi request HTTP của trang, kể cả request do Flash gửi (lọc, chỉ lỗi, xem header, sao chép cURL).
  - **Socket TCP**: các kết nối TCP của Wisp, đọc bằng `lsof` (mỗi 2s, mỗi 0,4s khi bảng đang mở; kết nối quá ngắn có thể bị sót nên **mở bảng trước khi vào game** nếu cần soi kỹ). `SYN_SENT` mãi hoặc "đóng, chưa nối được" là bị chặn; `ESTABLISHED` rồi đóng là máy chủ ngắt. Ô **Thử kết nối** nối thẳng tới host:port, có thể kèm xin policy Flash. Nút **NetLog** ghi log mạng chi tiết của Chromium vào Downloads (mở bằng netlog-viewer.appspot.com).
  - **Console & sự kiện**: console của trang, lỗi tải trang, plugin crash, mở/đóng socket.
  - **Flash**: plugin, version, User-Agent, nội dung `mms.cfg`.
  - **Lưu báo cáo**: lưu toàn bộ log ra file JSON để gửi người khác xem.

Dữ liệu nằm ở `~/Library/Application Support/Wisp/`. Lần đầu chạy, app tự chuyển thư mục cũ `Flash Browser 2/` sang (giữ đăng nhập); nếu chỉ có bản 1 thì chép trang chủ từ `Flash Browser/config.json` (cookie bản 1 do Electron 45 tạo, Chromium 87 không đọc được).

### Cổng Ghosthand (đang làm – bước 01)

Mỗi lần mở, Wisp mở cổng WebSocket chỉ trên `127.0.0.1` (cổng ngẫu nhiên, token mới) và ghi `ghosthand.json` (`port`, `token`, `pid`, `version`, `api`; chỉ người dùng này đọc được) vào thư mục dữ liệu. Ghosthand đọc file đó để nối, đọc trang và bấm / gõ bằng sự kiện thật. Không mở cổng CDP. Bật / tắt: menu ⋮ → *Tuỳ chọn* → **Cổng Ghosthand** (lưu `ghosthandPort` trong `config.json`). Khi Ghosthand đang nối, thanh công cụ hiện chip tím **Ghosthand** – bấm để ngắt. Lệnh và mã lỗi: `docs/plan/01-cong-ghosthand.md`. Thử: `npm run dev`, rồi ở terminal khác `node scripts/ghosthand-client.js 20 wiki`.

## 4b. Cập nhật app

App tự kiểm tra bản mới trên GitHub Releases (10 giây sau khi mở, rồi mỗi 6 giờ). Có bản mới thì thanh công cụ hiện nút **Cập nhật x.y.z** màu cam (và chấm cam trên ⋮). Bấm → xem ghi chú phát hành → **Cập nhật ngay**: app tải `Wisp-x.y.z-mac.zip`, kiểm tra `sha256`, giải nén, thoát, thay `Wisp.app` rồi tự mở lại. Plugin Flash, đăng nhập, lịch sử, tab đang mở được giữ nguyên (nằm ở thư mục dữ liệu, không nằm trong app).

Kiểm tra bằng tay: menu **Wisp → Kiểm tra cập nhật…** hoặc **⋮ → Kiểm tra cập nhật**. Bản cũ hơn 2.2.0 chưa có bộ cập nhật, phải cài tay một lần.

Phát hành bản mới (để app nhận được): release trên GitHub phải đính kèm `Wisp-x.y.z-mac.zip` và `Wisp-x.y.z-mac.zip.sha256` (`shasum -a 256 Wisp-x.y.z-mac.zip > Wisp-x.y.z-mac.zip.sha256`), tag dạng `vx.y.z`, không phải bản nháp / pre-release.

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

## 7. Windows

Bản Windows (x64, Windows 10/11) dùng chung mã nguồn với bản macOS. Build ngay trên máy Mac (electron-builder tự tải Electron win32 và Wine để gắn thông tin vào file .exe):

```bash
npm run dist:win            # dist/Wisp-<version>-win-setup.exe, KHÔNG kèm plugin Flash
npm run dist:win:personal   # dist/Wisp-<version>-win-personal-setup.exe, kèm plugins/pepflashplayer.dll
```

Bản cá nhân cần `plugins/pepflashplayer.dll` (bản **64-bit** pepflashplayer64 32.0.0.x, đổi tên). Không phát hành công khai bản `-personal`.

**Cài**: chạy file `-win-setup.exe`. Bộ cài cài cho người dùng hiện tại vào `%LOCALAPPDATA%\Programs\Wisp`, không cần quyền admin, tạo lối tắt ở Desktop và Start Menu. App không có chữ ký số nên SmartScreen báo "Windows protected your PC" → **More info → Run anyway**.

**Khác với macOS**:
- Dữ liệu (cookie, `config.json`, lịch sử, plugin) nằm ở `%APPDATA%\Wisp\`. `mms.cfg` ở `%APPDATA%\Wisp\Pepper Data\Shockwave Flash\System\mms.cfg`.
- Plugin: `%APPDATA%\Wisp\plugins\pepflashplayer.dll`. App tìm theo thứ tự: thư mục đó → plugin kèm trong app → `C:\Windows\System32\Macromed\Flash\pepflashplayer64_*.dll` (máy đã cài Flash PPAPI của Adobe).
- **Tải và cài tự động**: tải bộ cài đầy đủ `Adobe Flash Player (PPAPI) 32.0.0.465.exe` (~21 MB) từ [archive.org](https://archive.org/details/adobe-flash-player-ppapi-32.0.0.465), kiểm tra MD5 `80b45a47f1055a1d1381b708f4c372e1`. App **không chạy bộ cài**: bộ cài giữ file trong tài nguyên RCDATA, nén cùng định dạng LZMA với payload macOS; bản x64 nằm trong một .exe x64 lồng bên trong (.exe x86 → RCDATA → .exe x64 → RCDATA → `pepflashplayer64.dll`). Việc tách chạy ở tiến trình riêng (`flash-win.js` bằng Node của Electron), mất khoảng 20–60 giây và vài GB RAM tạm thời.
- **Chọn file đã tải**: bộ cài `.exe` PPAPI bản đầy đủ (bản cài online ~1 MB không dùng được), `.zip`, hoặc `pepflashplayer64_32_0_0_xxx.dll`.
- Kiểm tra plugin: phải là DLL PPAPI 64-bit, chữ ký Authenticode hợp lệ của Adobe (`Get-AuthenticodeSignature` trong PowerShell). DLL 32.0.0.465 tách từ bộ cài trên có sha256 `c022429e…561a`, khớp thì không cần gọi PowerShell.
- Phím tắt dùng Ctrl thay Cmd; thêm F11 toàn màn hình, Alt+← / Alt+→ quay lại / tiến tới, Ctrl+H lịch sử, Ctrl+Shift+Delete xoá lịch sử. Thanh menu ẩn, bấm Alt để hiện.
- Socket TCP đọc bằng `netstat -ano` (mỗi 2s, mỗi 1s khi Bảng kiểm tra đang mở). Ping dùng `ping -n 1`.
- "Chống App Nap" trên Windows là "Không cho máy ngủ" (giữ máy thức khi đang mở Wisp).
- Mở file `.swf` khi Wisp đang chạy → mở thành tab mới trong cửa sổ đang mở (app chỉ chạy một bản).

**Cập nhật**: release trên GitHub đính kèm thêm `Wisp-x.y.z-win-setup.exe` và `Wisp-x.y.z-win-setup.exe.sha256` (`shasum -a 256 Wisp-x.y.z-win-setup.exe > Wisp-x.y.z-win-setup.exe.sha256`). App tải bộ cài, so sha256 (bắt buộc), thoát, chạy bộ cài im lặng (`--updated /S --force-run`) rồi tự mở lại.

Nếu Flash vẫn bị chặn trên Windows: chép `mms.cfg` vào `C:\Windows\System32\Macromed\Flash\mms.cfg` (cần quyền admin).

## 8. Lưu ý bảo mật

Electron 11 (Chromium 87) và Flash 32 đều không còn được vá lỗi. Chỉ dùng app này để chơi game, không dùng để duyệt web chung, không đăng nhập tài khoản quan trọng.
