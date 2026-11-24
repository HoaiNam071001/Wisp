# 16. ⬜ Riêng tư & an toàn (học Brave / Firefox / Chrome)

**Phụ thuộc:** bước 05, 13. *(người dùng yêu cầu 2026-11-24 – đề xuất, chờ chốt phạm vi)*

**Xong khi:** có công tắc chặn quảng cáo / tracker theo trang; cửa sổ ẩn danh không để lại gì; http tự nâng https khi được; lỗi chứng chỉ có trang cảnh báo rõ.

**Ràng buộc đã chốt phải giữ:** không giả dấu vân tay; trang Flash (engine 11) không bị chặn gì làm hỏng game; cổng Ghosthand không bị chặn request của chính nó.

## Việc
- ⬜ **Chặn quảng cáo / tracker** (Brave Shields): `session.webRequest.onBeforeRequest` + danh sách tên miền (nhỏ, nhúng sẵn, cập nhật theo bản phát hành – không tải ngầm). Logic khớp thuần `blocklist.js` + test. Công tắc theo trang trong popover khoá (bước 13), đếm số chặn; **mặc định tắt ở trang cấu hình Flash**.
- ⬜ **Cửa sổ ẩn danh**: session `partition` không `persist:`, không ghi lịch sử / dấu trang / session tab / quyền; viền màu phân biệt; đóng là xoá hết.
- ⬜ **HTTPS-first**: gõ domain không scheme thử `https://` trước, lỗi mới rơi về `http://`; http thuần hiện cảnh báo "Không bảo mật" (đã có ở ô địa chỉ).
- ⬜ **Trang lỗi chứng chỉ / mạng** rõ ràng (kiểu `ERR_CERT_*` của Chrome): giải thích + nút Quay lại, "Tiếp tục (không an toàn)" chỉ khi bấm "Nâng cao".
- ⬜ **Tín hiệu riêng tư**: gửi `Sec-GPC: 1` (tuỳ chọn, mặc định bật) – không đổi gì khác ở dấu vân tay.
- ⬜ **Kiểm tra chính tả** (Electron `session.setSpellCheckerLanguages`, bật cho ô nhập) + Picture-in-Picture cho video (menu chuột phải).
- ⬜ File mới vào `build.files`; README + `docs/checks.md`.

## Rủi ro
- Chặn quảng cáo làm vỡ vài trang / game web → công tắc theo trang nhớ trong `config`, nút "Trang này lỗi?" tắt nhanh.
- Danh sách chặn lớn tốn RAM → dùng `Set` tên miền, khớp theo hậu tố, giới hạn kích cỡ.
