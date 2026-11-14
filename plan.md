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

## 2. 🔄 Lỗi đăng nhập cf4vn.bar (`登陆超时，请稍后再试`)

Người khác vào được, Wisp thì báo "đăng nhập quá thời gian chờ".

Đã biết:
- Máy chủ game `game.cf4vn.bar` (103.116.39.95): cổng game **49119**, policy Flash **41843** (từ `https://cf4vn.bar/rez/server.cub`).
- Từ máy này hai cổng đều mở; policy cho phép `cf4vn.bar` → mạng không bị chặn.
- Máy chủ có hàng chờ (133/133 người); chưa lần nào bắt được lúc Flash nối tới 49119.

Việc tiếp:
1. ⬜ Build lại app có Bảng kiểm tra (hoặc chạy bản dev).
2. ⬜ Mở Bảng kiểm tra **trước khi** bấm Vào game, chờ tới lượt, đọc tab Socket TCP:
   - không có dòng `:49119` → Flash không nối (lỗi phía Wisp/Flash);
   - `SYN_SENT` / "đóng, chưa nối được" → bị chặn;
   - `ESTABLISHED` rồi đóng → máy chủ ngắt / không trả lời (so với Mạng + Console).
3. ⬜ Nếu lsof không thấy gì: bật NetLog, làm lại, mở file bằng netlog-viewer.

## 3. ⬜ Cập nhật app (tự động + bằng tay)

Không dùng `electron-updater`: trên macOS nó chỉ tự cài khi app có chữ ký Apple (app đang `identity: null`). Tự viết bộ cập nhật dựa trên **GitHub Releases** của repo public `HoaiNam071001/Wisp` (gọi API không cần token).

### 3.1 Tách plugin Flash khỏi app (✅)
Lý do: bản phát hành công khai không được kèm plugin của Adobe, và cập nhật thay cả `Wisp.app` thì plugin không được mất.
- ✅ Vị trí tìm plugin `~/Library/Application Support/Wisp/plugins/PepperFlashPlayer.plugin` đứng đầu danh sách trong `findFlashPlugin`.
- ✅ Lần đầu chạy: plugin đang nằm trong app (`resources/plugins`, hoặc `plugins/` khi dev) mà chưa có ở `userData/plugins` → chép ra bằng `ditto`.
- ✅ Chưa có plugin → hộp thoại "Chọn plugin…" (cũng có ở menu Flash → Cài / Thay plugin Flash…). Kiểm tra `codesign --verify --deep --strict`, Team ID Adobe `JQ525L2MZD`, có x86_64; chép vào `userData/plugins` rồi mời mở lại app.
- ✅ Bỏ `extraResources` khỏi `package.json`; bản cá nhân kèm plugin: `npm run dist:personal` (`electron-builder.personal.js`, ra `Wisp-<version>-personal.dmg`).

### 3.2 Phát hành
- ⬜ `npm run release`: tăng version (`npm version patch|minor`), `electron-builder --mac zip dmg --x64`, tính `sha256` của file zip, `gh release create vX.Y.Z` đính kèm `Wisp-X.Y.Z-mac.zip`, `.sha256`, `.dmg`, ghi chú phát hành lấy từ commit.
- ⬜ Thêm target `zip` vào `build.mac.target` (bộ cập nhật dùng zip, người mới tải dmg).

### 3.3 Kiểm tra bản mới
- ⬜ `updater.js` (tiến trình chính): `GET https://api.github.com/repos/HoaiNam071001/Wisp/releases/latest`, so `tag_name` với `app.getVersion()` (semver), bỏ qua bản nháp / pre-release.
- ⬜ Tự kiểm tra: 10 giây sau khi mở app, sau đó mỗi 6 giờ; lưu `lastCheck`, `skipVersion` trong `config.json`.
- ⬜ Bằng tay: menu **Wisp → Kiểm tra cập nhật…** (luôn báo kết quả, kể cả "đang là bản mới nhất").
- ⬜ Có bản mới: chấm báo trên toolbar + hộp thoại có ghi chú phát hành, nút **Cập nhật** / **Để sau** / **Bỏ qua bản này**.
- ⬜ Cài đặt: bật / tắt "Tự kiểm tra cập nhật".

### 3.4 Cài bản mới
- ⬜ Tải zip vào `os.tmpdir()/wisp-update/` (hiện tiến độ), so `sha256`.
- ⬜ Giải nén bằng `ditto -x -k`, kiểm tra `Wisp.app/Contents/Info.plist` đúng version.
- ⬜ Ghi script shell nhỏ: chờ PID của Wisp thoát → đổi tên app cũ thành bản dự phòng → chuyển app mới vào đúng chỗ (`path.dirname(app.getAppPath())` lên tới `.app`) → `xattr -cr` → `open` app mới → xoá bản dự phòng khi app mới chạy được.
- ⬜ Không ghi được vào `/Applications` (thiếu quyền) → mở trang Release để tải tay.
- ⬜ Lỗi ở bất kỳ bước nào → giữ app cũ, báo lỗi, gợi ý tải tay.

### 3.5 Kiểm tra
- ⬜ Tạo release thử `v2.0.1` → app `2.0.0` thấy bản mới, cập nhật, mở lại đúng `2.0.1`, plugin + đăng nhập + `config.json` còn nguyên.
- ⬜ Mất mạng / sai sha256 / không có quyền ghi → app cũ vẫn chạy.

## 4. ⬜ Wisp làm trình duyệt cho Ghosthand

Ghosthand điều khiển web qua CDP. Electron mở được bằng `remote-debugging-port` (chỉ 127.0.0.1), nhưng Chromium 87 có thể thiếu lệnh → cần thử. Nếu không đủ: tách chế độ **Web** (Electron mới) và **Flash** (Electron 11, Ghosthand điều khiển bằng ảnh/chữ vì Flash không có DOM). Đặt tiêu đề cửa sổ / bundle id rõ ràng để Ghosthand nhận ra app.

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
