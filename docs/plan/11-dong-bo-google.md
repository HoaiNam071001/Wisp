# 11. 🔄 Đăng nhập Google để đồng bộ giữa các máy

**Phụ thuộc:** – (đăng nhập + đồng bộ cấu hình làm được ngay trên Electron 11; cookie đợi bước 04 để biết engine nào giữ phiên)
**Xong khi:** Đăng nhập Google trên máy A → cấu hình, dấu trang, lịch sử, phiên game hiện ở máy B sau khi đăng nhập; đăng xuất thì dừng đồng bộ, dữ liệu máy vẫn còn.

*(người dùng yêu cầu 2026-11-16)* Chốt: lưu ở **Google Drive appDataFolder** (không server riêng); đăng nhập bằng **trình duyệt hệ thống + loopback (OAuth PKCE)**; đồng bộ cấu hình, lịch sử, dấu trang, cookie game.

## Thiết kế
- Scope chỉ `drive.appdata` + `openid email` (không thấy file Drive khác của người dùng). Token refresh lưu mã hoá bằng `safeStorage` (Keychain / DPAPI), **không** ghi vào `config.json`.
- Mỗi loại dữ liệu một file JSON riêng trong appDataFolder (`config.json`, `bookmarks.json`, `history.json`, `sessions.enc`) – lỗi/lớn một loại không chặn loại khác.
- Gộp theo từng mục có `updatedAt`, xoá bằng mốc `deleted` (tombstone) – không ghi đè cả file. Lịch sử: gộp theo URL + thời gian, giữ N mục gần nhất.
- **Chỉ đồng bộ khoá được liệt kê** của `config.json` (trang bật Flash, allowlist, trang chủ, bảng đổi phím…). Không đồng bộ đường dẫn máy, token Ghosthand, cổng, thông tin cập nhật.
- Cookie / phiên game: **mặc định tắt, bật riêng**; mã hoá đầu-cuối bằng mật khẩu đồng bộ do người dùng đặt (scrypt → AES-256-GCM), Google chỉ thấy bản mã. Quên mật khẩu = mất, nói rõ ở UI. Chỉ cookie của domain người dùng tick (mặc định: domain trong allowlist Flash), không lấy cookie Google.
- Logic gộp + mã hoá là module thuần (`sync-merge.js`, `sync-crypt.js`) có `test/*.test.js`; phần mạng / Drive tách `sync-drive.js`; đăng nhập `google-auth.js`; điều phối `sync.js`. Mã Node 12 (không `fetch` → dùng `https`).

## Việc
- ✅ **Dấu trang** (2026-11-17: `bookmarks-store.js` thuần + test – mục `{id, url, title, addedAt, updatedAt, deleted?}`, xoá = tombstone sẵn cho gộp; `bookmarks.js` lưu `userData/bookmarks.json`, `bookmarks.events 'changed'`; ★ trên thanh địa chỉ + Cmd/Ctrl+D (menu Trang, menu ⋮); trang `wisp://bookmarks` (`bookmarks.html`: tìm, mở / Cmd+bấm tab mới, xoá). Đã thử trang quản lý trên app dev; chưa thử bấm ★ / Cmd+D). Ý gốc: lưu `bookmarks.json` ở userData, nút ★ trên thanh địa chỉ, trang quản lý; sự kiện qua `bookmarks.events`.
- 🔄 **Google Cloud (người dùng làm)** (2026-11-17: project `ghosthand` / `ghosthand-app` đã tạo; OAuth client Desktop có Client ID `413793643993-qa50gkndk565ok0v7ko9s0lei0guulf9.apps.googleusercontent.com` (không phải bí mật, được ghi vào build); còn: bật Drive API, thêm scope `openid` / `email` / `drive.appdata` ở Data Access, thêm email vào Test users; Client secret đọc từ file cấu hình cục bộ không đưa lên git): tạo OAuth client loại *Desktop app*, bật Drive API, điền consent screen; đưa client ID vào build (client secret loại desktop không bí mật). Cần xác minh app nếu muốn dùng ngoài chế độ test (≤100 người thử).
- ⬜ **Đăng nhập:** `google-auth.js` – mở `shell.openExternal`, server `127.0.0.1` cổng ngẫu nhiên nhận mã, PKCE, đổi token, làm mới; trang "đăng nhập xong, quay lại Wisp".
- ⬜ **Lưu token:** `safeStorage`; không có thì từ chối đồng bộ (không lưu thô).
- ⬜ **Drive appData:** `sync-drive.js` – list/get/create/update file theo tên, `If-Match`/`modifiedTime` để phát hiện ghi đè giữa hai máy.
- ⬜ **Gộp:** `sync-merge.js` + test (thêm cả hai máy, sửa cùng mục, xoá ở máy này – sửa ở máy kia).
- ⬜ **Đồng bộ cấu hình + dấu trang + lịch sử:** kéo khi khởi động, đẩy sau thay đổi (debounce ~30 s), không chặn main; lỗi mạng thì thử lại nền.
- ⬜ **Cookie game:** `sync-crypt.js` + test; chọn domain; nhập mật khẩu lần đầu / máy mới; nạp qua `session.cookies.set` trước khi mở trang. Cần chốt sau bước 04: phiên của engine Electron mới hay Electron 11 (hai `userData` khác nhau).
- ⬜ **Nút tài khoản kiểu Chrome** *(người dùng yêu cầu 2026-11-16)*: hình tròn avatar (chữ cái đầu của tên / ảnh Google) ở góc phải thanh công cụ, ngay cạnh nút ⋮ (sau ★ dấu trang), giống Chrome. Chưa đăng nhập: icon người xám → bấm ra *Đăng nhập*; đã đăng nhập: bấm mở popup nhỏ (avatar, tên, email, trạng thái đồng bộ, *Đồng bộ ngay*, *Đăng xuất*). Popup mở tức thì như menu ⋮ (không chặn main); đặt cạnh vòng tiến độ bước 10 không chồng nhau. Sửa `toolbar.html` + preload.
- ⬜ **UI cài đặt:** mục *Tài khoản* trong Cài đặt: Đăng nhập / email / Đăng xuất, chọn loại dữ liệu đồng bộ, "Đồng bộ ngay", giờ lần cuối, lỗi + cách khắc phục. Chữ tiếng Việt, theme tối.
- ⬜ **Đa nền tảng + đóng gói:** thêm file mới vào `build.files`; thử macOS và Windows (loopback bị tường lửa hỏi quyền?).
- ⬜ **Quyền riêng tư:** Đăng xuất = xoá token cục bộ + nút "Xoá dữ liệu đồng bộ trên Drive". Ghi vào README.

## Rủi ro
- Cookie phiên trên Drive dù mã hoá vẫn là dữ liệu nhạy cảm; mật khẩu yếu thì bản mã bị dò → bắt mật khẩu tối thiểu, ghi cảnh báo.
- Lịch sử lớn → giới hạn số mục / dung lượng mỗi file.
- Xung đột hai máy cùng sửa → gộp theo mục; mất mạng lâu rồi đồng bộ lại không được mất dữ liệu.
- OAuth chưa xác minh hiện cảnh báo "ứng dụng chưa xác minh" với người ngoài danh sách thử.
- Điều này mâu thuẫn *không* với `docs/decisions.md` (cổng Ghosthand, không giả dấu vân tay không đổi); đăng nhập Google dùng trình duyệt hệ thống, khớp ghi chú rủi ro ở README.
