# 15. ⬜ Thanh địa chỉ thông minh & tab nâng cao (học Chrome / Arc / Vivaldi)

**Phụ thuộc:** bước 12 (dấu trang), bước 11 (lịch sử đồng bộ). *(người dùng yêu cầu 2026-11-24 – đề xuất, chờ chốt phạm vi)*

**Xong khi:** gõ vào ô địa chỉ hiện gợi ý từ lịch sử + dấu trang + tìm kiếm; ghim / kéo đổi chỗ được tab; Ctrl+K tìm được tab đang mở; chuột phải trang / link / ảnh có menu đủ dùng.

## Việc
- ⬜ **Gợi ý khi gõ (omnibox)**: logic thuần `omnibox-suggest.js` + test (xếp hạng: khớp đầu domain > tiêu đề > URL, ưu tiên hay vào / mới vào, dấu trang), popover dưới ô địa chỉ dùng `popover.js`; mũi tên chọn, Enter mở, Shift+Del xoá khỏi lịch sử; dòng "Tìm … bằng <công cụ>".
- ⬜ **Công cụ tìm kiếm chọn được** (Google mặc định, DuckDuckGo, Bing…) – khoá `config.searchEngine` có mặc định.
- ⬜ **Menu chuột phải** (hiện kiểm tra lại có chưa): link (mở tab mới, sao chép link), ảnh (lưu, sao chép, mở tab mới), chữ chọn (sao chép, tìm bằng …), trang (quay lại, tải lại, in, xem nguồn, kiểm tra phần tử).
- ⬜ **Kéo thả đổi chỗ tab** + kéo tab ra ngoài tách cửa sổ (tách: để sau nếu nặng).
- ⬜ **Ghim tab** (tab nhỏ chỉ icon, lưu trong phiên, không đóng bằng Ctrl+W nhầm).
- ⬜ **Tìm tab / bảng lệnh Ctrl+K**: tìm tab đang mở + lịch sử + lệnh menu (Arc / Vivaldi). Dùng lại logic xếp hạng của omnibox.
- ⬜ **Thanh trạng thái hiện URL khi rê chuột lên link** (Chrome) – `update-target-url`.
- ⬜ *(để sau, hỏi lại)* Nhóm tab có màu; tab dọc (Edge / Arc); chia đôi màn hình.
- ⬜ File mới vào `build.files`; README + `docs/checks.md`.

## Rủi ro
- Thanh toolbar là HTML tĩnh – thêm kéo thả tab phải giữ menu ⋮ mở tức thì (không chặn main).
- Gợi ý đọc lịch sử lớn: tìm trên bộ nhớ đã lập chỉ mục sẵn, không đọc đĩa mỗi phím.
