---
name: wrap-up
description: Chốt việc Wisp trước khi commit / kết thúc session (vd "commit", "chốt", "xong rồi", "kết thúc"): kiểm tra, đồng bộ docs/plan, checks, log, README, commit theo quy ước.
---

# Chốt việc

## 1. Kiểm tra code

```bash
npm run check && npm test
```

Sửa đụng thứ chỉ app thật mới biết (tab, cổng Ghosthand, UI, chế độ Web / Game) → skill `test-after-change` trước khi báo xong. Không xanh → dừng, báo người dùng kèm output; không commit đỏ trừ khi người dùng bảo.

## 2. Đồng bộ tài liệu

Việc xong đổi `⬜` → `✅` ngay khi làm (không đợi tới đây); việc phát sinh thành dòng mới trong file bước, không chỉ ghi ở chat.

- [ ] File bước `docs/plan/<NN>-*.md`: việc xong đã ✅; tiêu đề bước ✅ khi mọi việc code đã ✅ (kiểm tra tay không chặn). Bảng *Các bước* trong `docs/plan/README.md` cùng trạng thái (⬜ / 🔄 / ✅).
- [ ] Việc cần thử tay → `docs/checks.md` (mới nhất ở trên, nhóm `## <NN> – <tên> · [link]`), dạng `- [ ] …`. Người dùng báo đã thử → tick + ghi log.
- [ ] `docs/log.md`: **chỉ thêm bằng `>>`** – `- **YYYY-MM-DD** – <việc>. <kiểm tra: lệnh nào OK / chưa thử tay>.`
- [ ] `docs/decisions.md`: người dùng vừa chốt điều mới → ghi (ngày, lý do).
- [ ] `README.md`: đổi cách cài / chạy / biến môi trường / tính năng người dùng thấy → sửa.
- [ ] `CLAUDE.md`: đổi lệnh, quy tắc, cấu trúc lớn → sửa.
- [ ] File mới chạy trong app → có trong `build.files`.

## 3. Commit (khi người dùng yêu cầu / đã cho phép)

- `git status` + `git diff --stat`; không add file rác (`dist/`, plugin Flash, log, ảnh tạm, `/tmp/wisp-dev`).
- Message tiếng Việt theo lịch sử repo (câu mô tả ngắn, kèm số phiên bản khi phát hành, vd `Sửa lỗi … (2.2.1)`); việc theo plan ghi số bước, vd `Cổng Ghosthand: lệnh tabs / open (bước 01)`.
- Đang ở `main` và thay đổi lớn → hỏi có muốn tạo nhánh không.

## 4. Báo người dùng

Ngắn: đã xong gì, kiểm tra đã chạy (kết quả thật), việc chờ thử tay (link `docs/checks.md`), bước tiếp theo.
