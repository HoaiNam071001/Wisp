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

Chia thành từng bước: xem [`docs/plan/README.md`](docs/plan/README.md).

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
