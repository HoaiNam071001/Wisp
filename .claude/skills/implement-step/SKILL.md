---
name: implement-step
description: Làm một bước / việc theo plan Wisp trong docs/plan (vd "làm tiếp", "làm bước 01", "tiếp tục plan"). Đọc trạng thái, lập kế hoạch nhỏ, code theo lớp, kiểm tra, cập nhật tài liệu, commit.
---

# Làm bước theo plan

## 1. Nạp ngữ cảnh (đọc ít, đúng chỗ)

1. Bảng bước đã có sẵn đầu session nhờ hook. Người dùng nêu bước nào thì theo người dùng; không nêu → bước ⬜ / 🔄 đầu tiên mà các bước **Phụ thuộc** đã ✅.
2. Mở file bước `docs/plan/<NN>-<tên>.md`; *Mục tiêu & nguyên tắc* ở `docs/plan/README.md` khi bước đụng cổng Ghosthand / chế độ Web.
3. `docs/decisions.md` khi đụng điều đã chốt (không bàn lại).
4. Code: `grep -n` tìm hàm trong `main.js` rồi đọc đúng đoạn, không đọc cả file. Bước phía Ghosthand → đọc `../autoclicker/CLAUDE.md` và làm theo skill của repo đó.

## 2. Lập kế hoạch trước khi code

- Liệt kê việc `⬜` sẽ làm trong lượt này (mỗi việc làm xong được, kiểm tra được). Việc mơ hồ / thiếu → thêm việc vào file bước trước.
- Lựa chọn ảnh hưởng người dùng (UI, hành vi, định dạng `config.json`, API cổng Ghosthand) chưa có trong plan / decisions → hỏi (AskUserQuestion, có khuyến nghị). Chi tiết kỹ thuật thì tự chọn, ghi lý do ngắn trong file bước.
- Đổi trạng thái bước trong bảng `docs/plan/README.md` thành 🔄.

## 3. Code theo thứ tự lớp

1. **Logic thuần** (không `require('electron')`) + `test/<tên>.test.js` (`node --test`): chọn chế độ theo URL, selector, phân tích / kiểm tra lệnh cổng, so phiên bản…
2. **Tiến trình main**: module riêng theo việc (vd `ghosthand/server.js`, `ghosthand/commands/<nhóm>.js`), `main.js` chỉ gọi vào. Đụng phần cũ của `main.js` → tách phần đó ra file riêng trước, không đổi hành vi.
3. **Preload / trang**: `contextBridge` tối thiểu; mã chạy trong trang web (agent của cổng Ghosthand) nằm trong thế giới riêng, không để lại biến trên `window`.
4. **UI** (`*.html`): biến màu CSS + theme tối, chữ tiếng Việt.
5. File mới chạy trong app → thêm vào `build.files` (`package.json`).

Ràng buộc luôn giữ: Node 12 cho mã chạy trên Electron 11; cổng chỉ `127.0.0.1` + token; thao tác bằng sự kiện thật; mã lỗi `{code, detail}` đúng danh sách của bước 01; selector cùng cú pháp Ghosthand.

Trong lúc làm: việc xong đổi `⬜` → `✅` ngay; việc phát sinh thành dòng `⬜` mới.

## 4. Kiểm tra (bắt buộc, báo kết quả thật)

```bash
npm run check && npm test
```

Rồi skill `test-after-change` (chạy app thật, thử đúng phần vừa sửa). Việc chỉ người dùng thử được (Flash vào game, Windows, đăng nhập tài khoản thật) → `docs/checks.md`.

Sau đó chạy skill `senior-review` trên diff và sửa những gì nó tìm thấy.

## 5. Chốt

Dùng skill `wrap-up`.
