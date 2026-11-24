# 16. 🔄 Riêng tư & an toàn (học Brave / Firefox / Chrome)

**Phụ thuộc:** bước 05, 13. *(người dùng yêu cầu 2026-11-24 – đề xuất, chờ chốt phạm vi)*

**Xong khi:** có công tắc chặn quảng cáo / tracker theo trang; cửa sổ ẩn danh không để lại gì; http tự nâng https khi được; lỗi chứng chỉ có trang cảnh báo rõ.

**Ràng buộc đã chốt phải giữ:** không giả dấu vân tay; trang Flash (engine 11) không bị chặn gì làm hỏng game; cổng Ghosthand không bị chặn request của chính nó.

## Việc
- ✅ **Chặn quảng cáo / tracker** (Brave Shields): `session.webRequest.onBeforeRequest` + danh sách tên miền (nhỏ, nhúng sẵn, cập nhật theo bản phát hành – không tải ngầm). Logic khớp thuần `blocklist.js` + test. Công tắc theo trang trong popover khoá (bước 13), đếm số chặn; **mặc định tắt ở trang cấu hình Flash**. (2026-11-24: `blocklist.js` + test (~40 tên miền quảng cáo / đo lường, chỉ chặn bên thứ ba), `content-blocker.js` nối vào listener duy nhất của `request-log.js`; công tắc toàn cục ở Tuỳ chọn, theo trang ở popover khoá (kèm số đã chặn); engine Flash dùng session riêng nên không bị ảnh hưởng. Chưa thử tay trên trang nhiều quảng cáo)
- ✅ **Cửa sổ ẩn danh**: session `partition` không `persist:`, không ghi lịch sử / dấu trang / session tab / quyền; viền màu phân biệt; đóng là xoá hết. (đổi thành **tab ẩn danh** trong cùng cửa sổ vì `tabs.js` chỉ có một cửa sổ: `incognito.js`, session `partition: 'incognito'` trong bộ nhớ, không vào lịch sử / phiên / tab vừa đóng / favicon, xoá sạch khi đóng tab ẩn danh cuối; Tệp → Tab ẩn danh mới, Shift+Cmd+N; thử app thật: tab mở được, gạch tím. Giới hạn: trang Flash mở ở engine Flash nên không ẩn danh)
- ✅ **HTTPS-first**: gõ domain không scheme thử `https://` trước, lỗi mới rơi về `http://`; http thuần hiện cảnh báo "Không bảo mật" (đã có ở ô địa chỉ). (gõ domain không scheme đã mặc định `https://` từ trước; thêm nút 'Thử bản http' khi https báo lỗi SSL. Không tự hạ http ngầm)
- ✅ **Trang lỗi chứng chỉ / mạng** rõ ràng (kiểu `ERR_CERT_*` của Chrome): giải thích + nút Quay lại, "Tiếp tục (không an toàn)" chỉ khi bấm "Nâng cao". (`error-page.js` + `net-error.js` + test: chứng chỉ / DNS / mất mạng / từ chối kết nối; nút Tải lại, Nâng cao → Vẫn tiếp tục (chỉ host đó, chỉ lần chạy này). Thử app thật với expired.badssl.com. Còn: ô địa chỉ vẫn hiện ổ khoá xanh trên trang lỗi)
- ✅ **Tín hiệu riêng tư**: gửi `Sec-GPC: 1` (tuỳ chọn, mặc định bật) – không đổi gì khác ở dấu vân tay. (`Sec-GPC: 1`, tắt bằng Tuỳ chọn / `config.sendGpc:false`)
- ⬜ **Kiểm tra chính tả** (chưa làm: macOS dùng bộ kiểm tra của hệ thống; Windows cần chọn ngôn ngữ – chưa chắc có 'vi') (Electron `session.setSpellCheckerLanguages`, bật cho ô nhập) + Picture-in-Picture cho video (menu chuột phải).
- ⬜ File mới vào `build.files`; README + `docs/checks.md`.

## Rủi ro
- Chặn quảng cáo làm vỡ vài trang / game web → công tắc theo trang nhớ trong `config`, nút "Trang này lỗi?" tắt nhanh.
- Danh sách chặn lớn tốn RAM → dùng `Set` tên miền, khớp theo hậu tố, giới hạn kích cỡ.
