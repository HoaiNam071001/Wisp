# Wisp

Trình duyệt Electron mở webgame Flash bằng Flash Player thật (Pepper Flash 32 trong Electron 11.5.0 x64), dự phòng Ruffle; macOS + Windows. Hướng tới: **một trình duyệt** chuẩn (Electron mới) – trang được cấu hình Flash tự mở bằng engine Flash đi kèm (Electron 11) có **cổng nối Ghosthand** để AI đọc / thao tác element – plan ở `docs/plan/`.

## Bắt đầu mỗi session

1. Trạng thái (bảng bước, việc chờ thử tay, git) được hook SessionStart chèn sẵn (`scripts/session-status.sh`) – không cần mở cả `docs/plan/README.md`. Chỉ mở file của bước đang làm `docs/plan/<NN>-<tên>.md`.
2. Tài liệu khác chỉ mở khi cần: `docs/plan/README.md` (mục tiêu, nguyên tắc, rủi ro), `docs/decisions.md` (quyết định đã chốt – không bàn lại), `docs/checks.md` (việc chờ người dùng thử tay), `plan.md` (lịch sử mục 1–3: Flash, allowlist, cập nhật), `README.md` (cài đặt, chạy dev, biến môi trường). **Không đọc `docs/log.md`** – chỉ thêm dòng bằng `>>`.
3. **Skill dự án** (`.claude/skills/`): `new-request` (yêu cầu mới → ghi plan, hỏi chốt trước khi code), `implement-step` (làm bước theo plan), `fix-bug`, `senior-review` (review diff trước commit), `test-after-change` (chạy app thật + thử), `wrap-up` (cập nhật tài liệu + kiểm tra + commit).
4. Người dùng trao đổi bằng **tiếng Việt** – trả lời, comment, UI, tài liệu tiếng Việt; tên biến / hàm tiếng Anh.
5. Repo liên quan: **Ghosthand** ở `../autoclicker` (Go + Wails, có `CLAUDE.md` + skill riêng). Việc phía Ghosthand (bước 02, 06, 07) làm theo quy tắc của repo đó.

## Lệnh

```bash
npm run dev                                                 # chạy dev: dữ liệu riêng .dev-data/, tự bỏ ELECTRON_RUN_AS_NODE
npm run dev -- inspect [url]                                # + mở Bảng kiểm tra, mở thẳng url (WISP_USER_DATA=… để đổi thư mục dữ liệu)
npm test                                                    # node --test test/*.test.js (logic thuần)
npm run check                                               # node --check mọi file .js (lỗi cú pháp)
npm run dist / dist:win / dist:personal                     # đóng gói (xem README mục 5)
```

## Quy tắc code

- **Một file một việc**, nhắm ≤ ~300 dòng / file, hàm ≤ ~60 dòng. `main.js` chỉ lo khởi động – tính năng mới vào module riêng (`tabs.js` phát `tabs.events` thay vì gọi ngược lên lịch sử / menu; lớp dưới không `require` lớp trên, xem `docs/plan/03-tach-main-js.md`).
- **Logic thuần tách khỏi Electron**: phần tính (chọn chế độ theo URL, tạo selector, phân tích lệnh cổng Ghosthand, so phiên bản…) để trong module không `require('electron')`, có test `test/<tên>.test.js` chạy bằng `node --test`.
- **Tiến trình**: main (Node) ↔ preload (`contextIsolation: true`, `nodeIntegration: false`) ↔ trang. Preload chỉ đưa ra API tối thiểu qua `contextBridge`; **không gắn biến / hàm của app vào `window` của trang web** (trang thấy được → bị nhận ra là bị điều khiển).
- **Cổng Ghosthand**: chỉ `127.0.0.1`, có token; không mở `--remote-debugging-port`; thao tác bằng `webContents.sendInputEvent` (sự kiện thật); lỗi trả `{code, detail}` với mã đã liệt kê ở `docs/plan/01-cong-ghosthand.md`. Selector cùng cú pháp Ghosthand (`text=` / `aria=` / `role=…[name="…"]` / `css=`).
- **Không giả dấu vân tay** (canvas, GPU, font, TLS…). Chỉ UA / Client Hints cho khớp bản Chromium thật.
- **Electron 11 = Node 12 + Chromium 87** cho mã chạy ở engine Flash (và mã hiện tại): không dùng `fetch`, `structuredClone`, `Array.prototype.at`, `fs.rm`, top-level await… Mã chỉ chạy ở engine web (Electron mới) thì được dùng API mới – ghi rõ đầu file.
- **Đa nền tảng**: mã riêng macOS / Windows tách file (`*-mac.js` / `*-win.js` như `flash-win.js`) hoặc nhánh `process.platform` gọn; đường dẫn bằng `path.join`, không nối chuỗi `/`.
- **Dữ liệu người dùng**: `app.getPath('userData')` (đổi được bằng `WISP_USER_DATA`), `config.json` – thêm khoá mới phải có mặc định, không làm hỏng `config.json` cũ (người dùng cập nhật qua `updater.js`).
- **File mới chạy trong app** (`.js`, `.html`, thư mục module) → thêm vào `build.files` trong `package.json`, không thì bản đóng gói thiếu file (dev vẫn chạy nên dễ sót). `test/`, `docs/`, `scripts/` không đóng gói.
- **Không giữ code chết**; cầu nối tạm phải ghi bước sẽ xoá trong file bước.
- Comment tiếng Việt, ngắn, nói *vì sao* / ràng buộc; không comment lại điều code đã nói.

## Quy ước UI

- Giao diện là HTML tĩnh (`toolbar.html`, `menu.html`, `inspect.html`, `history.html`…) + preload riêng. Màu đặt thành biến CSS trên `:root`, có theme tối (`prefers-color-scheme`); không màu cứng rải rác.
- Chữ trên UI tiếng Việt, ngắn; trạng thái lỗi nói cách khắc phục.
- Menu ⋮ phải mở tức thì (đã tối ưu ở commit 2898afe) – không chặn tiến trình main khi mở menu.

## Lưu ý nền tảng

- Electron 11 chỉ x64 → trên Apple Silicon chạy Rosetta; `npm install` với `npm_config_arch=x64`.
- Plugin Flash không nằm trong repo / bản phát hành công khai (`plugins/` bị gitignore) – xem `plan.md` mục 3.1.
- Bảo mật: Chromium 87 + Flash 32 không còn được vá – engine Flash chỉ mở trang đã cấu hình Flash.
