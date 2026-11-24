# 13. 🔄 Thông tin trang (bấm khoá) như Chrome

**Phụ thuộc:** bước 05 (quyền theo trang `permissions.js` + `permission-policy.js`) – xong phần hỏi / nhớ; bước này thêm chỗ xem và sửa.

*(người dùng yêu cầu 2026-11-24, chọn làm đủ)* Bấm biểu tượng khoá / "Không bảo mật" trong ô địa chỉ → popover dưới ô: **kết nối** (an toàn / không an toàn + tên miền), **quyền của trang** (camera, micro, vị trí… đã cho / chặn, đổi được), **xoá cookie và dữ liệu của trang này**.

**Xong khi:** bấm khoá trên trang https hiện popover đúng host; quyền đã nhớ hiện thành dòng có công tắc Cho phép / Chặn / Hỏi lại, đổi xong có hiệu lực cho lần xin sau; "Đặt lại quyền" xoá hết quyền của trang; "Xoá cookie và dữ liệu trang" xoá cookie + localStorage / IndexedDB… của riêng trang đó rồi tải lại; popover đóng khi bấm ra ngoài / Esc.

## Việc
- ✅ **Logic thuần** `site-info.js` + `test/site-info.test.js`: mô tả URL (https / http / file / wisp), liệt kê quyền đã nhớ theo host, đổi quyền (`ask` = xoá khoá), đặt lại.
- ✅ **Popover dùng chung** `popover.js` (cửa sổ không viền dưới một nút, đóng khi mất focus, tự co theo nội dung) – tách từ popover Tài khoản để hai nơi dùng chung.
- ✅ **UI** `site-info.html` + `site-info-preload.js` + `site-info-window.js` (IPC kiểm nguồn gửi).
- ✅ **Nối thanh địa chỉ:** bấm `#sec` (chỉ http / https) mở popover.
- ✅ **Xoá dữ liệu trang:** cookie theo host (kể cả domain cha) + `clearStorageData({origin})`, rồi tải lại tab.
- ✅ File mới vào `build.files`; README + `docs/checks.md`.
- ⬜ Mục "Cookie và dữ liệu trang" xem chi tiết từng cookie (Chrome có) – chưa làm; "Cài đặt trang" tổng (danh sách mọi trang) – chưa làm.

## Rủi ro
- Quyền camera / micro đã cấp cho trang đang mở: đổi sang Chặn chỉ có hiệu lực từ lần xin sau (trang phải tải lại) → popover ghi chú "Tải lại trang để áp dụng".
- Xoá dữ liệu trang làm trang đăng xuất; có nút xác nhận hai bước (bấm một lần đổi chữ "Bấm lần nữa để xoá").
