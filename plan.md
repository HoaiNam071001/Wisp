# Wisp (trước là Flash Browser) — Kế hoạch

## 1. Mục tiêu

App desktop macOS đơn giản: mở một trang web và chạy được nội dung Flash, chủ yếu để chơi **webgame Flash online** kiểu **Bang Bang** (game bắn tank của CMN Online, trước ở trên Zing Me).

## 2. Hiện trạng (bản 1 — `flash-app.zip`)

- Electron 45 + **Ruffle 0.7.1** (trình giả lập Flash bằng WebAssembly).
- Gắn Ruffle vào mọi trang (cả iframe) qua giao thức riêng `ruffle://local/` và gỡ header CSP.
- Có thanh địa chỉ, nút lùi/tiến/tải lại, nút "Đặt làm trang chủ" (lưu ở `userData/config.json`), mở file `.swf` trên máy, menu kiểu macOS.
- Đã test: thẻ `<embed>` Flash được thay bằng `<ruffle-embed>`.

**Vấn đề:** Bang Bang là game online nhiều người chơi, phải kết nối socket liên tục tới máy chủ game. Ruffle chạy trong trình duyệt không mở được kết nối TCP/socket thẳng (chỉ đi được qua proxy WebSocket), nên game nhiều khả năng sẽ đứng ở màn hình đăng nhập hoặc báo mất kết nối. Nhà phát hành cũng chỉ hỗ trợ client riêng hoặc trình duyệt 37ABC (có sẵn Flash thật), và cả hai đều chỉ có cho Windows.

→ **Bản 2: thay Ruffle bằng Flash Player thật (plugin PPAPI / Pepper Flash) chạy trong một bản Electron cũ còn hỗ trợ Flash.** Đây chính là cách trình duyệt 37ABC làm.

## 3. Hướng kỹ thuật bản 2

| Thành phần | Lựa chọn | Ghi chú |
|---|---|---|
| Electron | **11.x** (bản cuối 11.5.0) | Electron 12 đã bỏ Pepper Flash. Electron ≥ 12 không dùng được. |
| Kiến trúc | **x64** (chạy qua Rosetta 2 trên Mac chip M) | Plugin Flash cho Mac chỉ có bản x64; kiến trúc của plugin phải khớp với Electron. |
| Plugin Flash | `PepperFlashPlayer.plugin` (PPAPI, bản 32.0.0.x) | Không phải bản NPAPI "Flash Player.plugin" dành cho Safari/Firefox. |
| Kill switch | Tắt bằng file `mms.cfg` (allowlist) | Từ 12/01/2021 Flash bản 32 tự chặn nội dung; `mms.cfg` cho phép chạy lại trên các domain trong danh sách. |
| Dự phòng | Giữ chế độ Ruffle của bản 1 | Dùng cho trang có Flash đơn giản, không cần socket. |

### 3.1 Lấy plugin Flash

- Plugin PPAPI cho Mac từng được cài ở: `/Library/Internet Plug-Ins/PepperFlashPlayer/PepperFlashPlayer.plugin`
- Adobe đã gỡ bộ cài khỏi trang chủ. Phải tự tìm bộ cài **"Flash Player for Opera and Chromium – PPAPI" cho macOS** (bản 32.0.0.x), ưu tiên bản lưu trữ có checksum, hoặc chép từ một máy Mac cũ còn cài.
- Đặt plugin vào `plugins/PepperFlashPlayer.plugin` trong project rồi đóng gói kèm app (`extraResources`).
- ⚠️ Kiểm tra nguồn tải thật kỹ: đây là phần mềm không còn được vá bảo mật, rất hay bị phát tán kèm mã độc.

### 3.2 Cấu hình `mms.cfg` để tắt kill switch

Nội dung (thay domain bằng domain thật của game; xem domain trong DevTools → Network):

```
EOLUninstallDisable=1
AutoUpdateDisable=1
SilentAutoUpdateEnable=0
EnableAllowList=1
AllowListUrlPattern=*://*.cmn.vn/
AllowListUrlPattern=file:*
```

Không có pattern nào cho phép tất cả domain (`*:*` không hợp lệ), nên phải liệt kê từng domain mà game tải `.swf` về.

Vị trí cần thử (cần xác minh bằng thực tế; app nên tự ghi file vào các vị trí này khi khởi động):
1. `<app.getPath('userData')>/Pepper Data/Shockwave Flash/System/mms.cfg` ← plugin PPAPI chạy trong Chromium/Electron thường đọc ở đây
2. `/Library/Application Support/Macromedia/mms.cfg` (cần quyền admin)

Gỡ lỗi: thêm `AllowListPreview=1` và `TraceOutputEcho=1` để Flash in ra URL nó đang so khớp với allowlist.

### 3.3 Khung code `main.js` (Electron 11)

```js
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const FLASH = app.isPackaged
  ? path.join(process.resourcesPath, 'plugins', 'PepperFlashPlayer.plugin')
  : path.join(__dirname, 'plugins', 'PepperFlashPlayer.plugin');

app.commandLine.appendSwitch('ppapi-flash-path', FLASH);
app.commandLine.appendSwitch('ppapi-flash-version', '32.0.0.465'); // đúng version của plugin

function writeMmsCfg() {
  const dir = path.join(app.getPath('userData'), 'Pepper Data', 'Shockwave Flash', 'System');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'mms.cfg'), [
    'EOLUninstallDisable=1', 'AutoUpdateDisable=1', 'SilentAutoUpdateEnable=0',
    'EnableAllowList=1',
    'AllowListUrlPattern=*://*.cmn.vn/',
    'AllowListUrlPattern=file:*',
  ].join('\n'));
}

app.whenReady().then(() => {
  writeMmsCfg();
  const win = new BrowserWindow({
    width: 1280, height: 820,
    webPreferences: { plugins: true, contextIsolation: true },
  });
  win.loadURL('https://bangbang.cmn.vn/'); // thay bằng trang chơi thật
});
```

Thanh địa chỉ: Electron 11 chưa có `WebContentsView`. Dùng `BrowserView`, hoặc một `toolbar.html` + thẻ `<webview plugins>` (cần `webviewTag: true`). Có thể dùng lại `toolbar.html` / `toolbar-preload.js` của bản 1 nếu đổi sang `BrowserView`.

### 3.4 `package.json` gợi ý

```json
{
  "name": "flash-browser",
  "productName": "Flash Browser",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "dist": "electron-builder --mac dmg --x64"
  },
  "devDependencies": {
    "electron": "11.5.0",
    "electron-builder": "^24"
  },
  "build": {
    "appId": "local.flashbrowser",
    "mac": { "target": [{ "target": "dmg", "arch": ["x64"] }], "identity": null },
    "extraResources": [{ "from": "plugins", "to": "plugins" }]
  }
}
```

Khi cài trên Mac chip M: `npm install --arch=x64` (hoặc `npm_config_arch=x64 npm install`) để tải bản Electron x64. Cần đã cài Rosetta: `softwareupdate --install-rosetta`.

## 4. Các bước làm

1. [ ] Tạo nhánh/thư mục mới từ bản 1; hạ Electron xuống `11.5.0` (x64), bỏ `WebContentsView`/`navigationHistory` (API mới), chuyển sang `BrowserView` + `webContents.goBack()`.
2. [ ] Lấy `PepperFlashPlayer.plugin` (x64, 32.0.0.x), đặt vào `plugins/`, ghi đúng version vào `ppapi-flash-version`.
3. [ ] Bật `plugins: true` cho trang; ghi `mms.cfg` lúc khởi động.
4. [ ] Kiểm tra plugin đã nạp: mở DevTools và gõ `navigator.plugins` → phải thấy "Shockwave Flash".
5. [ ] Thử với một file `.swf` local → nếu bị chặn hoặc hiện biểu tượng "plugin bị chặn", sửa vị trí `mms.cfg` hoặc allowlist.
6. [ ] Mở trang Bang Bang, đăng nhập, vào phòng chờ, chơi thử 1 trận. Ghi lại các domain trong tab Network và thêm vào allowlist.
7. [ ] (Tuỳ chọn) Giữ chế độ Ruffle làm dự phòng: menu "Chế độ Flash: Thật / Ruffle".
8. [ ] Đóng gói `.dmg` x64; trên máy chạy app lần đầu: chuột phải → Open, hoặc chạy `xattr -cr "/Applications/Flash Browser.app"`.

## 5. Kiểm tra / tiêu chí xong

- `navigator.plugins` có Shockwave Flash, và trang test Flash (một file `.swf` hiện `Capabilities.version`) hiện đúng version.
- File `.swf` local chạy được.
- Bang Bang: tải xong, đăng nhập được, vào trận và bắn được, không mất kết nối sau ≥ 10 phút.
- App chạy được sau khi tắt mở lại; `.dmg` cài được trên máy Mac khác.

## 6. Rủi ro & lưu ý

- **Bảo mật:** Electron 11 (Chromium 87) và Flash 32 đều không còn được vá lỗi. Chỉ dùng app này cho trang game; không dùng để duyệt web chung, không đăng nhập tài khoản quan trọng. Có thể chặn điều hướng ra ngoài các domain trong allowlist (`will-navigate` + `setWindowOpenHandler`).
- **macOS mới:** Electron 11 có thể lỗi vặt trên macOS 14/15 (Rosetta, cửa sổ, quyền). Nếu không chạy được thì phương án B là chạy Windows bằng Parallels / VMware Fusion / CrossOver rồi cài client chính thức của CMN.
- **Máy chủ game:** Nếu nhà phát hành đã tắt server bản web thì không app nào cứu được; khi đó chỉ còn BangBang Origin (client Windows).
- **Bản quyền:** Không đóng gói plugin Flash để phát hành công khai; chỉ dùng cá nhân.

## 7. Tham khảo

- Electron — Pepper Flash (đã bỏ hỗ trợ): https://electronjs.org/docs/tutorial/using-pepper-flash-plugin
- Tài liệu cũ (cách dùng `ppapi-flash-path`): https://github.com/electron/electron/blob/v1.1.3/docs/tutorial/using-pepper-flash-plugin.md
- Flash Player 32 Admin Guide (mục Enterprise Enablement — `mms.cfg`, allowlist): https://open-flash.github.io/mirrors/flash-player-admin-32.pdf
- Ví dụ `mms.cfg` tắt kill switch cho một site: https://gist.github.com/MatthewCallis/6eceaec189704d75e09acd7c38be69d6
- Ruffle (chế độ dự phòng): https://ruffle.rs

## 8. Hướng tiếp theo: Wisp làm trình duyệt cho Ghosthand

Mục tiêu: Ghosthand điều khiển được trang web trong Wisp (đọc trang, tìm phần tử, bấm, gõ) như với Chrome.

- Ghosthand điều khiển web qua Chrome DevTools Protocol (CDP). Electron mở được bằng `app.commandLine.appendSwitch('remote-debugging-port', '<port>')`; chỉ nghe trên 127.0.0.1.
- Electron 11 (Chromium 87) quá cũ, CDP có thể thiếu lệnh mà Ghosthand cần → cần thử. Nếu không đủ, tách 2 chế độ:
  - **Web**: Electron mới (CDP đầy đủ, còn được vá bảo mật) cho web thường + Ghosthand.
  - **Flash**: Electron 11 + Pepper Flash như hiện tại; Ghosthand điều khiển bằng ảnh/chữ trên màn hình (Flash không có DOM).
- Có thể thêm một cách để Ghosthand biết tab nào đang hiện (vd. mỗi tab là một BrowserView, đặt tiêu đề rõ ràng).
- Đổi tên tiến trình/bundle id để Ghosthand nhận ra app (hiện: `local.wisp`).

## 9. Đang làm dở: Bảng kiểm tra (mạng, socket, console) — 14/11/2026

**Lý do:** vào cf4vn.bar (Bang Bang 4VN) bằng Wisp luôn báo `登陆超时，请稍后再试` ("đăng nhập quá thời gian chờ"), trong khi người khác vẫn vào được → nghi Wisp lỗi. DevTools có sẵn không thấy kết nối socket của Flash, nên cần bảng riêng.

**Đã biết (đã kiểm tra trực tiếp):**
- Máy chủ game: `game.cf4vn.bar` (103.116.39.95) cổng **49119**; policy Flash ở cổng **41843** (lấy từ `https://cf4vn.bar/rez/server.cub`, `rez/serverList.cub`).
- Từ máy này, hai cổng đều mở; policy trả về `allow-access-from domain="cf4vn.bar" to-ports="49119,41843"`.
- Lúc kiểm tra: máy chủ đầy 133/133, hàng chờ ~45 → chưa bắt được lúc Flash kết nối (chưa tới lượt).

**Đã xong (chưa chạy thử, chưa `node --check`):**
- `main.js`: `installRequestLog` (gom mọi `webRequest` vào một chỗ, gồm cả gỡ CSP cho Ruffle + gom domain .swf cũ), `addLog` (console + sự kiện trang), theo dõi socket bằng `lsof` mỗi 400ms khi bảng mở (`pollSockets`), `probeTcp` (thử kết nối + `<policy-file-request/>`), NetLog bật/tắt (lưu vào Downloads), lưu báo cáo JSON, IPC `inspect:*`, `openInspector()`, menu **Trang → Bảng kiểm tra** (Shift+Cmd+I).
- `toolbar.html` / `toolbar-preload.js`: nút 🔍 → `nav('inspect')`.
- `package.json`: thêm `inspect.html`, `inspect-preload.js` vào `build.files`.

**Còn lại:**
1. Tạo `inspect-preload.js`: expose `snapshot`, `clear(kind)`, `info`, `probe(host, port, policy)`, `devtools`, `copy`, `reveal`, `netlog(on)`, `report`, `onUpdate(cb)` (kênh `inspect:update` gửi `{http, log, sock}` theo lô).
2. Tạo `inspect.html` (giao diện tối như toolbar, CSP giống toolbar), 4 tab:
   - **Mạng**: bảng giờ / method / status / loại / host / path / thời gian; lọc chữ, "chỉ lỗi", ẩn ảnh/font/css; bấm dòng → header request/response, redirect, sao chép URL / cURL.
   - **Socket**: bảng kết nối TCP (bắt đầu, kết thúc, thời lượng, tiến trình, đích, chuỗi trạng thái), mặc định ẩn 443/80 và tô nổi cổng lạ; form "Thử kết nối" (gợi ý sẵn `game.cf4vn.bar` 49119 / 41843 + policy); nút bật/tắt NetLog.
   - **Console & sự kiện**: lọc theo mức / loại.
   - **Flash**: thông tin plugin, version, UA, `mms.cfg`, domain cho phép, domain .swf đã thấy; nút mở DevTools, lưu báo cáo.
3. `node --check main.js`, `npm start`, mở bảng, vào cf4vn.bar → xem có dòng TCP tới `:49119` không và trạng thái (SYN_SENT mãi = bị chặn; ESTABLISHED rồi đóng = máy chủ không trả lời / lỗi giao thức).
4. Cập nhật README (mục 4 Cách dùng), build lại dmg.

**Lưu ý:** `lsof` có thể bỏ sót kết nối rất ngắn (vd. lấy policy) → dùng NetLog để chắc. Có thể cân nhắc cho theo dõi socket chạy cả khi bảng đóng (để mở bảng sau khi lỗi vẫn thấy), nhưng tốn CPU hơn.
