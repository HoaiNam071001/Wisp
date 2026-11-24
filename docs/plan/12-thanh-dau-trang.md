# 12. 🔄 Thanh dấu trang như Chrome

**Phụ thuộc:** bước 11 phần Dấu trang (`bookmarks.js`, `bookmarks-store.js`, `wisp://bookmarks`) – đã ✅.

*(người dùng yêu cầu 2026-11-24)* Chốt: thanh dấu trang **luôn hiện** dưới thanh địa chỉ, bật / tắt bằng Cmd/Ctrl+Shift+B (lưu `config.json`, mặc định bật); **bản đầu chưa có thư mục** (thanh phẳng); **chỉ engine web** – cửa sổ Flash (Electron 11) giữ nguyên, không mất chiều cao game.

**Xong khi:** dấu trang đã thêm bằng ★ hiện thành nút (biểu tượng trang + tên) trên thanh dưới địa chỉ; bấm mở trong tab hiện tại, Cmd/Ctrl+bấm hoặc bấm giữa mở tab mới; chuột phải: mở tab mới / sửa tên / xoá; kéo thả đổi thứ tự; thừa chỗ thì gom vào nút `»`; Cmd/Ctrl+Shift+B ẩn / hiện; dấu trang đồng bộ Drive vẫn dùng được trên thanh (cả thứ tự).

## Việc
- ✅ **Nhập dấu trang từ Chrome** *(người dùng yêu cầu 2026-11-24; làm trước thanh để có dữ liệu dùng thử)*: Wisp đọc file `Bookmarks` (JSON) của hồ sơ Chrome trên máy – macOS `~/Library/Application Support/Google/Chrome/<hồ sơ>/Bookmarks`, Windows `%LOCALAPPDATA%\Google\Chrome\User Data\<hồ sơ>\Bookmarks` (đường dẫn bằng `path.join`); nhiều hồ sơ (`Default`, `Profile 1`…) thì hỏi chọn (tên lấy từ `Local State`); chỉ đọc, không sửa Chrome. Phần phân tích thuần `chrome-bookmarks.js` + `test/chrome-bookmarks.test.js`: duyệt cây `roots` (bookmark_bar, other, synced), làm phẳng thư mục (bản đầu chưa có thư mục), chỉ lấy `http` / `https`, bỏ trùng URL với dấu trang có sẵn, giữ thứ tự thanh dấu trang trước. Nút "Nhập từ Chrome" ở `wisp://bookmarks`; xong báo "Đã nhập n dấu trang"; kết quả tự đồng bộ Drive. Chrome đang mở thì file vẫn đọc được. Cũng cho "Nhập từ file HTML" (xuất từ Chrome / Firefox / Edge) cho máy không có Chrome.
- ✅ **Bố cục:** `TOOLBAR_HEIGHT` (tabs.js:17) hiện 80 = tab 36 + địa chỉ 44 → thêm chiều cao thanh dấu trang (~32) khi bật; `layoutActive` và mọi chỗ dùng hằng này (vd `find-window.js:28`, popup menu / tài khoản đặt theo toolbar) đọc chiều cao hiện tại thay vì hằng; trang Flash toàn màn hình vẫn ẩn cả thanh.
- ✅ **UI** (có favicon thật) `bookmarks-bar.html` + preload riêng (hoặc một vùng trong `toolbar.html` nếu không làm chậm vẽ thanh tab): màu bằng biến CSS + theme tối; favicon từ cache favicon của tab / chữ cái đầu khi chưa có; tên rút gọn bằng `…`; nút `»` xổ danh sách phần bị che; trạng thái trống: dòng gợi ý "Bấm ★ để thêm dấu trang".
- ✅ **Logic thuần** `bookmarks-bar.js` (không `require('electron')`) + `test/bookmarks-bar.test.js`: chọn mục vừa chiều rộng / mục tràn vào `»`, đổi thứ tự (cập nhật `order` / `updatedAt`), rút gọn tên.
- ✅ **Dữ liệu:** thêm `order` (số) cho mục dấu trang, mục cũ chưa có `order` xếp theo `addedAt`; đổi thứ tự là sửa mục → đi qua `mergeItems` của `sync-merge.js` (mốc `updatedAt` từng mục), không làm hỏng `bookmarks.json` cũ / bản đã đồng bộ.
- ✅ **Thao tác:** mở (hiện tại / tab mới), chuột phải (mở tab mới, sửa tên, xoá), kéo thả đổi thứ tự; thay đổi từ ★ / `wisp://bookmarks` / đồng bộ cập nhật thanh qua `bookmarks.events 'changed'`.
- ✅ **Bật / tắt:** Cmd/Ctrl+Shift+B + mục trong menu ⋮ (có dấu ✓); khoá `config.json` `bookmarksBar` (mặc định `true`, `config.json` cũ không hỏng); cân nhắc đồng bộ khoá này qua Drive (đang chỉ `url`, `flashSites`, `keyRemap`).
- ✅ File mới (`bookmarks-bar.js`, `.html`, preload) thêm vào `build.files`.
- ✅ README (mục dấu trang) + `docs/checks.md` (thử tay: thêm / mở / kéo thả / xoá, thu nhỏ cửa sổ thấy `»`, bật / tắt, theme tối, đồng bộ sang máy thứ hai, tab Flash toàn màn hình không lòi thanh).

## Rủi ro
- Đổi chiều cao vùng trang khi bật / tắt → tab đang mở phải layout lại; Ghosthand `frameRect` / `screenRect` đã tính theo `TOOLBAR_HEIGHT` thì phải dùng cùng giá trị mới (kiểm lại bước 01 / 07).
- Cửa sổ Flash (Electron 11) không có thanh → tab game không thấy dấu trang; chấp nhận (đã chốt).
- Thư mục dấu trang để bước sau (cần đổi cấu trúc `bookmarks.json` + luật gộp Drive).
- Không mâu thuẫn `docs/decisions.md`; không đụng cổng Ghosthand (không cần sửa phía `../autoclicker`).

## Ghi chú làm (2026-11-24)
- Làm: `chrome-bookmarks.js` (+test), `bookmarks-import.js` (đọc `Local State` + `Bookmarks`, nút "Nhập…" ở `wisp://bookmarks`), `bookmarks-store.js` thêm `order` / `barSorted` / `reorder` (chỉ sửa một mục khi kéo thả), `bookmarks-bar.js` (bật / tắt, IPC, menu chuột phải + `»` bằng menu hệ thống vì HTML của thanh công cụ không đè lên trang web được), `tabs.toolbarHeight()` thay hằng `TOOLBAR_HEIGHT` (Ghosthand `screenRect` dùng `view.getBounds()` nên tự đúng).
- Khác kế hoạch: chưa có **sửa tên** dấu trang (Electron không có hộp nhập chữ; cần cửa sổ riêng → ⬜ bước sau); icon: dùng favicon thật – `favicon-cache.js` học khi mở trang (userData/favicons.json, theo host, chỉ cục bộ), chưa mở thì thử `/favicon.ico` của trang, không tải được thì chữ cái đầu màu theo domain; khoá `bookmarksBar` chưa đồng bộ Drive (cài đặt theo máy); hàm "vừa chiều rộng" đo bằng DOM ở `toolbar.html`, không có test thuần.
- ✅ Sửa tên dấu trang (chuột phải → *Sửa tên…*, popover `bookmark-rename-window.js`; `store.rename` chỉ sửa một mục nên gộp Drive đúng); ⬜ thư mục dấu trang (bước sau).
- ✅ *(người dùng yêu cầu 2026-11-24)* Nút `»` và nút **Tất cả dấu trang** (cuối thanh) mở dropdown HTML nhỏ gọn (`bookmarks-list-window.js` + `bookmarks-list.html`, dùng `popover.js`; thay menu hệ thống vì dòng cao cố định / không theo theme tối; icon bằng `<img>`); chỉ hiện tối đa 10 mục, nhiều hơn thì dòng cuối "Hiện tất cả (n)" mở `wisp://bookmarks` (nút Tất cả dấu trang luôn có dòng cuối "Quản lý dấu trang"; chưa có thư mục). Nút chọn element (bước 06) đổi màu cam khi tab đang ở chế độ chọn (`gh:pick-state` từ agent; tắt khi trang tải lại / đóng tab).
