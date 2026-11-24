# Việc chờ người dùng thử tay

Mới nhất ở trên, nhóm `## <NN> – <tên bước> · [link](plan/<NN>-<tên>.md)`. Người dùng báo đã thử → tick `[x]` + ghi `log.md`.

## 13 – Thông tin trang · [docs/plan/13-thong-tin-trang.md](plan/13-thong-tin-trang.md)
- [ ] 13 (2026-11-24): bấm khoá (https) / "Không bảo mật" (http) trong ô địa chỉ → popover đúng host: "Kết nối an toàn" / "không an toàn"; bấm ra ngoài hoặc Esc / ✕ đóng; bấm khoá lần nữa đóng; trang wisp:// / file:// bấm không ra gì
- [ ] 13: trang xin quyền (vd https://webcamtests.com → Cho phép) rồi mở popover → thấy dòng "camera / micro" = Cho phép; đổi sang Chặn / Hỏi lại, tải lại trang → xin lại / bị chặn đúng; "Đặt lại quyền của trang" xoá hết dòng
- [ ] 13: "Xoá cookie và dữ liệu trang" cần bấm hai lần; xoá xong trang tải lại và bị đăng xuất; trang khác vẫn giữ đăng nhập
- [ ] 13: popover Tài khoản (bước 11) vẫn mở / đóng đúng sau khi tách `popover.js`; đăng nhập (chờ trình duyệt ngoài) không làm popover tự đóng

## 12 – Thanh dấu trang · [docs/plan/12-thanh-dau-trang.md](plan/12-thanh-dau-trang.md)
- [ ] 12 (2026-11-24): `wisp://bookmarks` → "Nhập…" → chọn hồ sơ Chrome → thấy "Đã nhập n dấu trang"; nhập lần hai báo "tất cả đã có"; "File HTML" nhập được file xuất từ Chrome
- [ ] 12: thanh dấu trang hiện dưới thanh địa chỉ đúng thứ tự thanh Chrome; bấm mở tab hiện tại, Cmd/Ctrl+bấm hoặc bấm giữa mở tab mới; chuột phải: Mở / Tab mới / Xoá; kéo thả đổi thứ tự (khởi động lại vẫn giữ)
- [ ] 12: thanh dấu trang hiện icon thật của trang (mở trang một lần là học icon; trang chưa mở thử /favicon.ico; không có thì chữ cái màu); khởi động lại vẫn giữ icon
- [ ] 12: bấm "Tất cả dấu trang" (cuối thanh) → dropdown nhỏ gọn (dòng 28px, nền tối, tối đa 10 mục; nhiều hơn có dòng "Hiện tất cả (n)" mở trang quản lý) có icon từng trang, bấm mở đúng trang (Cmd/Ctrl+bấm hoặc bấm giữa = tab mới); dòng cuối mở trang quản lý; nút » cũng mở dropdown cùng kiểu; Esc / bấm ra ngoài đóng
- [ ] 06/12: bật chọn element (Cmd+Shift+E hoặc nút) → nút đổi màu cam; Esc / ✕ trong bảng chọn / tải lại trang → nút trở lại bình thường; đổi sang tab khác nút theo tab đang xem
- [ ] 12: thu nhỏ cửa sổ → nút » hiện, bấm ra menu các dấu trang bị che; Cmd/Ctrl+Shift+B (và menu ⋮) ẩn / hiện, trang bên dưới co giãn đúng, khởi động lại nhớ trạng thái; Flash / video toàn màn hình không lòi thanh
- [ ] 12: đồng bộ: kéo thả ở máy A, "Đồng bộ ngay", máy B thấy thứ tự mới; theme sáng không dùng (app chỉ tối) – bỏ qua

## 02 – Ghosthand dùng Wisp · [link](plan/02-ghosthand-backend-wisp.md)

Cần Ghosthand bản mới (`make dev-install` ở `../autoclicker`) + Wisp đang mở, bật Cổng Ghosthand:
- [x] 11/11 mẫu web sân thử chạy trên Wisp dev bằng engine (Claude thử 2026-11-15).
- [ ] Ghosthand → Cài đặt → *Trình duyệt*: ô Wisp báo "Sẵn sàng"; tắt Wisp → *Kiểm tra lại* báo cách sửa.
- [ ] Chọn *Wisp*, mở *Mẫu thử* → mẫu web (vd Web: đăng nhập) → Chạy: chạy trong tab Wisp, chuột không nhúc nhích, chip tím Ghosthand hiện trên Wisp.
- [ ] Chọn *Wisp* khi Wisp đang tắt → Chạy mẫu web: Wisp tự mở rồi chạy.
- [ ] Đang chạy, bấm chip Ghosthand trên Wisp → node báo "đã ngắt Ghosthand trong Wisp".
- [ ] Windows: Ghosthand tìm thấy Wisp đã cài (`%LOCALAPPDATA%\Programs\Wisp`), chạy mẫu web.

## 01 – Cổng Wisp cho Ghosthand · [link](plan/01-cong-ghosthand.md)

Chạy `npm run dev`, rồi ở terminal khác `node scripts/ghosthand-client.js 20 wiki`:
- [x] 20/20 lần ok trên vi.wikipedia.org (Claude thử 2026-11-15).
- [ ] Vào game Flash cf4vn.bar vẫn chạy như trước khi có cổng (agent nằm trong preload mọi trang).
- [ ] Vào game Flash (cf4vn.bar, game nằm trong iframe nếu có) sau khi tắt site isolation + preload chạy mọi frame: game, đăng nhập, âm thanh như cũ.
- [ ] Menu ⋮ → *Tuỳ chọn* → **Cổng Ghosthand**: tắt → `.dev-data/ghosthand.json` biến mất, dòng phụ "Cho Ghosthand…"; bật lại → file mới (token mới), "Đang bật – chờ Ghosthand nối".
- [ ] Đang chạy `node scripts/ghosthand-client.js 20 wiki` → chip tím **Ghosthand** hiện trên toolbar (Claude đã thấy chip); bấm chip → script báo lỗi ngắt, chip ẩn.
- [ ] Windows: cổng mở, `ghosthand.json` tạo trong `%APPDATA%\Wisp\`, script thử chạy được.

## 03 – Tách main.js · [link](plan/03-tach-main-js.md)

Chạy `npm run dev` (dữ liệu `.dev-data/`), thử như bản 2.3.0:
- [x] Tab: Cmd+T, Cmd+W, Cmd+1, Shift+Cmd+T (Claude thử 2026-11-15).
- [ ] Tab: chuột phải tab (nhân bản, tắt tiếng, đóng các tab khác), Ctrl+Tab, link target=_blank mở tab bên phải.
- [x] Menu ⋮ mở tức thì, trạng thái đúng; phóng to giữ menu mở (100 → 110 → 120%); mở Bảng kiểm tra từ menu (Claude thử).
- [ ] Menu ⋮: bật / tắt 3 tuỳ chọn; "Thêm tuỳ chọn Flash…" hiện menu đúng chỗ.
- [ ] Menu hệ thống: Tệp / Trang / Flash / Lịch sử / Tab / Tuỳ chọn – mục Lịch sử hiện trang vừa xem, menu Tab cập nhật tên tab.
- [x] Trang Lịch sử (wisp://history): danh sách, tự cập nhật khi xem trang mới (Claude thử).
- [ ] Trang Lịch sử: mở, xoá một mục, xoá lịch sử.
- [x] Bảng kiểm tra: hiệu năng (nhãn tiến trình đúng), Mạng (request + lỗi), Flash (navigator.plugins có Flash 32, mms.cfg) (Claude thử).
- [ ] Bảng kiểm tra: socket TCP của game, thử TCP, ghi NetLog, lưu báo cáo.
- [x] Vào game Flash cf4vn.bar (người dùng thử bản dev 2026-11-15): vào sảnh, ping 25 ms trên thanh công cụ, icon loa trên tab.
- [ ] "Cho phép Flash trên trang này".
- [x] Cmd+Q → mở lại: khôi phục đúng 2 tab + tab đang xem; menu hệ thống hiện đủ (Claude thử).
- [ ] Chụp màn hình tab (Shift+Cmd+S).
- [ ] Windows (`npm run dist:win`): cài plugin từ bộ cài .exe, socket / ping trong Bảng kiểm tra.
- ⬜ **Đổi phím (bước 09, cả engine Flash):** menu ⋮ → Đổi phím… → Thêm: nhấn phím game cần (vd S), rồi phím thay (vd B). Vào game Flash bấm B phải ra S (giữ / nhả đúng, không lọt thêm chữ b); ô chat trong game gõ B ra S; thanh địa chỉ vẫn gõ B bình thường; tắt công tắc trả như cũ; thử trong iframe khác nguồn và Windows.
- ⬜ **Vòng tiến độ (bước 10):** khi bấm Cập nhật Wisp / Cài Flash Player, góc phải thanh công cụ hiện vòng tròn chạy % (tải), quay khi giải nén / kiểm tra; biến mất khi xong hoặc lỗi; Dock / taskbar cũng có thanh tiến độ.
- ⬜ **Chất lượng vẽ Flash + cờ GPU:** menu Flash → "Chất lượng vẽ Flash" → chọn Thấp, mở tab mới vào game: không lỗi hình, so CPU / FPS với "Theo game". Cờ GPU (main.js) so với `WISP_NO_PERF_FLAGS=1 npm run dev`. Nếu game tự đặt stage.quality thì lựa chọn này không có tác dụng.
- [ ] 04 (2026-11-17): `npm run dev -- https://cf4vn.bar/` → mở cửa sổ engine Flash riêng, vào được game; bấm link ra youtube.com từ trang game → mở ở cửa sổ chính; youtube phát video bình thường ở tab
- [ ] 04: bấm / gõ trong iframe khác site ở tab web bằng cổng Ghosthand (đã bỏ `disable-site-isolation-trials`)
- [ ] 04: bản đóng gói `npm run dist` (macOS) mở cf4vn.bar ở engine Flash (dev đã thử 2026-11-17); Windows chưa thử
- [ ] 04: chạy lệnh thử engine Flash (docs/plan/04) với plugin thật, cửa sổ hiện game cf4vn.bar và vào được game
- [ ] 04 (2026-11-17): mở cf4vn.bar → chuột phải → bấm "Chạy bằng Flash" (có dấu ✓) → cửa sổ engine Flash mở game; bấm lại để bỏ ✓ → tab tải lại như web thường
- [ ] 04 (2026-11-17): ⋮ → "Thêm tuỳ chọn Flash…" (hoặc menu Flash → "Cài đặt Flash…") mở cửa sổ Cài đặt Flash: thêm domain, xoá, ghi log allowlist, nút cài / thay plugin, mở thư mục plugin / mms.cfg hoạt động; tối (dark) đọc được
- [ ] 04 (2026-11-17): bỏ Ruffle: app mở bình thường; menu ⋮ phần Flash không còn nút Flash thật / Ruffle; menu hệ thống Flash không còn "Chế độ…"; Cài đặt Flash chỉ còn domain + Xoá; config.json cũ có engine ruffle vẫn mở được (thành Flash thật); mở file .swf (Cmd+O) báo / chạy bằng Flash thật không lỗi; chưa có plugin → chấm cam trên ⋮ và app hỏi cài.
- [ ] 04 (2026-11-17): cửa sổ engine Flash có thanh trên cùng (chỉ còn nút tải lại; đã bỏ Ruffle / Tắt Flash khỏi thanh): trên trang chờ Flash bấm "Mở như web thường" → cửa sổ Flash đóng (nếu đang mở), tab tải lại như web thường và domain biến mất khỏi Cài đặt Flash; Ghosthand vẫn lấy đúng vùng game (frameRect trừ thanh)
- [ ] 04 (2026-11-17): mở trang đã bật Flash (vd cf4vn.bar) → tab hiện trang chờ màu tím–cam có nút "Mở game Flash" (thanh địa chỉ vẫn hiện địa chỉ thật); bấm nút → cửa sổ Flash mở; đóng tab → cửa sổ Flash đóng; đóng cửa sổ Flash → tab KHÔNG đóng (vẫn ở trang chờ, bấm lại mở được); thoát app → cửa sổ Flash đóng; khởi động lại app khôi phục tab Flash về đúng trang chờ
- [ ] 04 (2026-11-17): chuột phải trong tab: trên link (mở tab mới / sao chép), ảnh, chữ chọn (sao chép / tìm Google), ô nhập (cắt / dán…), trống (quay lại / tiến / tải lại, "Chạy bằng Flash" (bật / tắt, có dấu ✓ khi đang bật), kiểm tra phần tử, Bảng kiểm tra) đều chạy đúng
- [ ] 04 (2026-11-17): bấm "Mở game" ở trang chờ rồi chạy Ghosthand `tabs` (tab đó `engine: "flash"`), `frameRect` (trả `tag: "flash"`, `screenRect` đúng vùng game, trừ thanh), `find` / `click` (lỗi `flash_page`); đóng cửa sổ Flash → tab về `engine: "web"`
- [ ] 04 (2026-11-17): mở trang có .swf mà chưa bật Flash (không phải cf4vn…) → chip cam "Cần Flash – Bật" cạnh ⋮; bấm → tab chuyển sang trang chờ Flash; chuyển trang khác thì chip mất
- [x] 04 (2026-11-17): `screenshot fullPage` qua Ghosthand trên một trang dài → ảnh cả trang (không cắt phần dưới trừ khi > 16000 px) (Claude thử 2026-11-24: vi.wikipedia.org/wiki/Việt_Nam ra PNG cao đúng 16000 px)
- [ ] 05 (2026-11-17): trang đòi camera / vị trí (vd https://webcamtests.com) → hộp "Cho phép / Chặn"; chọn xong tải lại trang không hỏi lại
- [ ] 05: "Đăng nhập bằng Google / Facebook" bằng popup trên vài trang → popup mở, đăng nhập xong tự đóng, trang gốc nhận kết quả
- [ ] 05: tải một file thật từ trang web → vòng tròn tiến độ, toast, file nằm trong Downloads
- 05 Session: menu 'Xoá cookie và dữ liệu trang…' (browsing-data.js) – thử tay: đăng nhập 1 trang, xoá cookie, tải lại phải mất đăng nhập; 'Chỉ cache' giữ đăng nhập.
- 05 Khác: (1) từ trang web http(s) bấm link / window.open tới file:///… phải bị chặn; (2) Cmd/Ctrl+P hiện hộp in.
- 05 Tìm trong trang: Cmd/Ctrl+F hiện thanh tìm; gõ → tô kết quả + đếm n/m; Enter / ⇧Enter đi tiếp / lùi; Esc đóng; đổi tab thì thanh đóng; kéo / đổi cỡ cửa sổ thanh đi theo.
- 05 Zoom: phóng to một trang (Cmd+=), mở tab mới vào cùng domain → vẫn phóng; khởi động lại app vẫn nhớ; domain khác 100%; Cmd+0 thì quên. 05 PDF: mở link .pdf local / lớn xem được.
- 05 Đăng nhập Google: đăng nhập thật 1 tài khoản trên accounts.google.com; nếu báo 'không an toàn' → dùng 'Mở bằng trình duyệt hệ thống' (menu ⋮) và báo lại. 05 Bộ trang thử: chạy `npm run dev` rồi `node scripts/sites-try.js` trước khi phát hành.
- 11 Dấu trang: bấm ★ (hoặc Cmd/Ctrl+D) trên trang https → ★ vàng + toast; bấm lại bỏ; mở wisp://bookmarks (menu ⋮ → Quản lý dấu trang) thấy trang vừa thêm, bấm mở, Cmd+bấm tab mới, ✕ xoá; khởi động lại app vẫn còn.
- 11 Google Cloud (người dùng): deploy Vercel (Root Directory site) → điền Homepage / Privacy / Authorised domain → xác minh Search Console → Publish app; tạo google-oauth.local.json chứa Client secret.
- 05 Session: thử đăng nhập một trang, thoát hẳn Wisp, mở lại vẫn đăng nhập; menu ⋮ → Xoá cookie và dữ liệu trang… thì bị đăng xuất.
- 06 Chọn element: bật Ghosthand, mở trang bất kỳ, bấm nút ngắm (hoặc Cmd/Ctrl+Shift+E) → rê chuột thấy khung + nhãn; ↑ / ↓ đổi cha / con; bấm → bảng; đổi selector trong ô thì số khớp đổi; Chép dán được; Esc thoát và trang bấm lại bình thường. Thử cả trang có iframe cùng nguồn.
- 07 Lệnh game: mở cf4vn.bar (engine Flash) rồi chạy `game` qua cổng Ghosthand: reload tải lại game, mute / unmute tắt / bật tiếng, focus đưa cửa sổ game lên trước (cả khi đang thu nhỏ).
- 07 Cỡ cửa sổ game: gọi `game {action:"resize", width:1000, height:600}` trên tab game Flash → vùng game đúng cỡ; thu nhỏ cửa sổ rồi `frameRect` phải báo `hidden: true`.
- ⬜ **Đăng nhập Google (bước 11):** có Client secret trong google-oauth.local.json rồi thử gọi login() – trình duyệt mở, bấm cho phép, trang 'Đăng nhập xong', token nằm ở google-token.bin (chưa có nút trên UI, thử bằng dev console).
- ⬜ **Đồng bộ Drive (bước 11):** sau khi đăng nhập được, thêm dấu trang ở máy A, đợi ~30 s hoặc gọi sync.syncNow(); máy B đăng nhập thấy dấu trang; xoá ở A → mất ở B; đổi trang chủ ở A → B nhận.
- ⬜ **Nút tài khoản (bước 11):** nút hình người cạnh ⋮ → cửa sổ Tài khoản mở, bố cục / theme tối đẹp; đăng nhập xong nút thành chữ cái đầu; đăng xuất về hình người; thử Windows (tường lửa hỏi loopback?).
- 11 Cookie game: ở máy A đăng nhập Google + Tài khoản → bật *Đồng bộ phiên game*, đặt mật khẩu ≥ 8 ký tự, đăng nhập một game Flash (cf4vn.bar), đóng cửa sổ game, bấm Đồng bộ ngay; máy B đăng nhập Google, bật cùng mật khẩu → mở game thấy đã đăng nhập; nhập sai mật khẩu → báo 'Sai mật khẩu đồng bộ' và không ghi đè Drive; tắt công tắc thì ngừng đồng bộ.
- 12 Dấu trang (thanh): thêm vài dấu trang → hiện nút dưới thanh địa chỉ; bấm mở, Cmd/Ctrl+bấm / bấm giữa tab mới; kéo thả đổi thứ tự (khởi động lại vẫn giữ); chuột phải → Sửa tên… (Enter lưu, Esc đóng, tên rỗng thì hiện tên miền) / Xoá; thu nhỏ cửa sổ thấy » và dropdown; Cmd/Ctrl+Shift+B + menu ⋮ ẩn / hiện (trang co giãn đúng); theme tối; tab Flash toàn màn hình không lòi thanh; đồng bộ sang máy thứ hai (cả thứ tự, tên).

## Bước 14 – tab ngủ / khôi phục lười / tab crash (2026-11-24)
- ⬜ Mở 3 tab, đặt `sleepMinutes: 1` trong config.json, để 2 tab nền > 1 phút → thanh tab hiện mờ; bấm vào → nạp lại đúng trang, không mất tiêu đề.
- ⬜ Tab đang phát tiếng / tab game Flash không bị ngủ.
- ⬜ Thoát rồi mở lại app: chỉ tab đang xem nạp ngay, tab khác mờ tới khi bấm.
- ⬜ Làm tab crash (vd `chrome://crash` gõ vào ô địa chỉ hoặc kill tiến trình tab) → hiện trang "Tab bị dừng", bấm Tải lại nạp lại được.

## Bước 15 – thanh địa chỉ gợi ý, ghim / kéo tab (2026-11-24)
- ⬜ Gõ "wiki" vào ô địa chỉ → danh sách gợi ý hiện dưới ô, ↑↓ chọn, Enter mở; bấm vào dòng mở được; Esc / bấm ra ngoài đóng.
- ⬜ Gõ "cách nấu phở" → dòng đầu "Tìm bằng Google" (đổi được ở Tuỳ chọn → Công cụ tìm kiếm); gõ "example.com" → mở thẳng.
- ⬜ Gõ tên tab đang mở → dòng "Chuyển sang tab" chuyển đúng tab; Cmd/Ctrl+K đưa con trỏ vào ô địa chỉ.
- ⬜ Chuột phải tab → Ghim tab: tab thu nhỏ còn icon, đứng đầu, Cmd+W không đóng; mở lại app vẫn ghim.
- ⬜ Kéo tab sang trái / phải đổi chỗ; kéo tab thường vào vùng tab ghim không chen được.

## Bước 16 – riêng tư / an toàn (2026-11-24)
- ⬜ Mở trang nhiều quảng cáo (báo, blog): ít quảng cáo hơn, trang không vỡ; bấm khoá → "Quảng cáo và theo dõi" hiện số đã chặn; tắt công tắc → trang tải lại và quảng cáo hiện.
- ⬜ Tệp → Tab ẩn danh mới: đăng nhập một trang, đóng tab ẩn danh, mở lại tab ẩn danh → chưa đăng nhập; lịch sử không có trang đã xem; thoát / mở lại app không thấy tab ẩn danh.
- ⬜ Mở https://expired.badssl.com/ → trang "Kết nối không riêng tư"; Nâng cao → Vẫn tiếp tục mở được trang; mở https://nonexistent.invalid/ → "Không tìm thấy trang".
- ⬜ Mở https://httpbin.org/headers → thấy `Sec-Gpc: 1`; tắt ở Tuỳ chọn thì không còn.
- ⬜ Trang Flash (cf4vn.bar) vẫn vào game bình thường khi bật chặn quảng cáo.
