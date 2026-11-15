---
name: test-after-change
description: Chạy Wisp bản dev vừa sửa rồi tự thử trên app thật (vd "test thử trên app", "chạy thử", sau khi sửa tab / cổng Ghosthand / chế độ Web / Game / UI). Chạy dev với dữ liệu riêng → thử đúng phần vừa sửa (client cổng, Ghosthand MCP xem màn hình) → báo kết quả, lỗi thì sửa và lặp.
---

# Chạy bản vừa sửa rồi thử

`npm run check && npm test` phải xanh trước – skill này không thay chúng.

## 1. Chạy

- Chạy nền, dữ liệu riêng (không đụng `Wisp.app` người dùng đang dùng / đăng nhập của họ):
  ```bash
  WISP_USER_DATA=/tmp/wisp-dev npm run dev -- inspect [url]      # bỏ inspect nếu không cần Bảng kiểm tra
  ```
  (Bash `run_in_background`; `/tmp/wisp-dev` để không đụng cả `.dev-data/` người dùng đang dùng thử.)
- Đọc output đầu: lỗi `require`, cú pháp, `getPath of undefined` (chạy `npm start` mà quên `env -u`) → sửa trước.
- Sửa mã main / preload → tắt app (đúng tiến trình dev vừa mở) rồi chạy lại; chỉ sửa trang HTML → tải lại cửa sổ.

## 2. Thử đúng phần vừa sửa

- **Cổng Ghosthand**: `node test/ghosthand-client.js` (đọc cổng + token từ `/tmp/wisp-dev/ghosthand.json`) – chạy lệnh vừa sửa, kiểm kết quả + mã lỗi; ca lỗi (token sai, `ref` cũ, không thấy element) cũng phải thử.
- **Giao diện / hành vi trên màn hình**: dùng MCP Ghosthand – `describe_screen` (rẻ) trước, `screenshot` khi cần nhìn; chỉ thao tác chuột / phím khi cần và trên cửa sổ Wisp dev.
- **Trang web**: ưu tiên trang không cần đăng nhập; chế độ Web chạy bộ trang thử (bước 05) khi đã có.
- **Flash / vào game**: cần plugin + tài khoản game → thường để người dùng thử (`docs/checks.md`), trừ khi họ bảo thử.
- Sửa → chạy lại từ mục 1.

## 3. Giới hạn

- Không đăng nhập / gửi / đăng / thanh toán bằng tài khoản thật khi người dùng chưa bảo rõ.
- Người dùng đang dùng chuột → không tranh chuột; hỏi trước.
- Windows: không thử được trên máy mac → ghi `docs/checks.md`.

## 4. Dọn

Tắt tiến trình Wisp dev đã mở (chỉ cái mình mở, không đụng `Wisp.app` của người dùng); xoá `/tmp/wisp-dev` nếu không cần giữ. Báo những gì đã dọn / còn sót.

## 5. Báo

Lệnh đã chạy, thử gì, kết quả từng cái (qua / lỗi + mã + ảnh nếu có). Việc cần người dùng thử tay → `docs/checks.md`.
