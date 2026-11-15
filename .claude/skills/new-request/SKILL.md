---
name: new-request
description: Người dùng đưa yêu cầu mới / đổi yêu cầu / ý tưởng tính năng cho Wisp (vd "thêm tính năng…", "muốn đổi…", "sau này cần…"). Phân loại, đối chiếu plan + quyết định đã chốt, ghi vào docs/plan đúng chỗ, hỏi những gì cần chốt – trước khi code.
---

# Nhận yêu cầu mới / đổi yêu cầu

Mục tiêu: không yêu cầu nào chỉ nằm trong chat; `docs/plan/` luôn phản ánh đúng ý người dùng.

## 1. Hiểu + đối chiếu

- Viết lại yêu cầu bằng 1–2 câu (kết quả người dùng muốn thấy, không phải cách làm).
- Đối chiếu:
  - Bảng *Các bước* trong `docs/plan/README.md` – đã có / đã lên plan chưa? Bước nào gần nhất?
  - *Mục tiêu & nguyên tắc* (`docs/plan/README.md`) + `docs/decisions.md` – có mâu thuẫn không (vd mở cổng CDP, giả dấu vân tay, gắn biến vào `window` của trang)?
  - Đụng phần nào: chế độ Web / Game, cổng Ghosthand (API → phải sửa cả phía Ghosthand `../autoclicker`), `config.json` / cập nhật, đóng gói mac / Windows.

## 2. Phân loại

| Loại | Làm gì |
|---|---|
| Sửa nhỏ trong bước đang làm / đã xong | Thêm việc `- ⬜ …` vào file bước đó, ghi *(người dùng yêu cầu YYYY-MM-DD)* |
| Mở rộng một bước chưa làm | Thêm việc vào file bước, chỉnh **Xong khi** nếu đổi |
| Tính năng mới hẳn | File mới `docs/plan/<NN>-<tên-ngắn>.md` (số tiếp theo; mẫu: `# NN. ⬜ <tên>`, **Phụ thuộc**, **Xong khi**, danh sách `- ⬜`) + dòng trong bảng *Các bước*; đề xuất vị trí trong thứ tự |
| Việc phía Ghosthand | Ghi ở bước Wisp liên quan (mục *Phía Ghosthand*); khi làm thì theo skill `new-request` / `implement-step` của `../autoclicker` |
| Đổi điều đã chốt | Nêu cái cũ, cái mới, hệ quả (code phải sửa, người dùng đang dùng bản cũ). Đồng ý → sửa `docs/decisions.md` (ngày, lý do, ghi *thay bởi*, không xoá dòng cũ) |
| Lỗi | Dùng skill `fix-bug` |

## 3. Chốt với người dùng

- Chỉ hỏi điều làm đổi hướng làm (hành vi, UI, phạm vi, ưu tiên) – mỗi câu kèm khuyến nghị + lý do; gom vào một lần AskUserQuestion.
- Yêu cầu lớn → chia việc theo thứ tự làm được + kiểm tra được; nêu rủi ro (Electron 11 / Node 12, Rosetta, Windows, trang lớn chặn, dung lượng gói).
- Người dùng chỉ đang lên ý tưởng / hỏi → không code. Bảo làm luôn → chuyển sang skill `implement-step`.

## 4. Ghi lại

- Cập nhật file bước + bảng *Các bước* (`docs/plan/README.md`).
- `echo '- **YYYY-MM-DD** – Kế hoạch (người dùng yêu cầu): …' >> docs/log.md`.
- Commit `docs: …` nếu người dùng muốn commit.
