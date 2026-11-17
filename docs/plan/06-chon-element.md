# 06. 🔄 Chọn element trên Wisp → step Ghosthand

Phụ thuộc: 02, 04

**Xong khi:** Chọn ô tìm kiếm Google → Ghosthand thêm step `webType` chạy được.

- 🔄 (2026-11-17: `ghosthand/agent/pick.js` – lớp phủ shadow root đóng, chỉ có khi đang chọn, gỡ sạch khi thoát; nút ngắm trên toolbar (hiện khi cổng Ghosthand bật) + menu Trang + Cmd/Ctrl+Shift+E + lệnh cổng `pick {on}`; thử trên vi.wikipedia: bấm ô tìm kiếm → khung + bảng, Esc thoát, sau đó trang bấm bình thường. Chưa thử tay rê chuột / ↑ ↓, iframe cùng nguồn) Nút **Chọn element** (icon ngắm) trên toolbar, phím tắt Cmd/Ctrl+Shift+E: rê chuột → tô khung + nhãn `role "tên"`; Esc thoát; phím ↑ / ↓ chọn cha / con.
- 🔄 (bảng nằm trong lớp phủ của trang: dropdown selector ứng viên + ô sửa selector, đếm khớp xanh / vàng / đỏ, chữ hiện tại, ô "Chữ để gõ"; nút Chép làm ở main bằng `clipboard`) Bấm → bảng nhỏ: selector bền (có thể sửa / chọn selector khác), số element khớp (phải = 1, không thì cảnh báo), chữ / giá trị hiện tại, nút **Click** / **Gõ chữ** / **Chờ thấy** / **Đọc giá trị** / **Chép**.
- 🔄 (phía Wisp xong: tin `gh:pick` kiểm bởi `pick-payload.js` + test → sự kiện `pick` {tab, url, action, selector, selectors, count, role, name, text, value, input?}; thêm `pick` vào `subscribe`; lệnh `pickDone {message}` hiện toast trên Wisp. **Còn phía Ghosthand** (`../autoclicker`, làm theo skill repo đó): subscribe `pick`, đổi sự kiện thành step `webClick` / `webType` / `webWait` / `webRead` và thêm vào kịch bản đang mở, rồi gọi `pickDone`) Chọn nút → gửi sang Ghosthand qua cổng (sự kiện `pick`) → Ghosthand thêm step vào kịch bản đang mở (hoặc vào nháp `draft`), báo lại "Đã thêm n5".
- ⬜ Chế độ **Ghi lại** (sau): bật ghi → mỗi click / gõ của người dùng thành một step.
