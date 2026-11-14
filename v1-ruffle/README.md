# Flash Browser (macOS)

App mở trang web có nội dung Flash (.swf). Flash chạy bằng **Ruffle**, một trình giả lập Flash dùng WebAssembly, nên không cần cài Adobe Flash Player.

## Chạy thử

1. Cài Node.js (bản LTS) từ https://nodejs.org
2. Mở Terminal, vào thư mục này:
   ```bash
   cd ~/Downloads/flash-app
   npm install
   npm start
   ```

## Đóng gói thành app (.dmg)

```bash
npm run dist
```
File `.dmg` nằm trong thư mục `dist/`. Mở nó ra rồi kéo **Flash Browser** vào Applications.

App không có chữ ký của Apple, nên lần đầu mở macOS sẽ chặn. Cách mở:
chuột phải vào app → **Open** → **Open**. Nếu vẫn bị chặn, vào **System Settings → Privacy & Security** và bấm **Open Anyway**.
Nếu báo "app bị hỏng" (damaged), chạy lệnh: `xattr -cr "/Applications/Flash Browser.app"`

## Cách dùng

- Gõ địa chỉ trang web vào thanh trên cùng rồi Enter (Cmd+L để nhảy vào thanh địa chỉ).
- Bấm **★ Đặt làm trang chủ** thì lần sau mở app sẽ vào thẳng trang đó.
- Muốn đặt sẵn trang mặc định: sửa `DEFAULT_URL` ở đầu file `main.js`.
- Mở file .swf trên máy: gõ đường dẫn (vd. `~/Downloads/game.swf`), hoặc kéo file vào icon app trên Dock.
- Phím tắt: Cmd+R tải lại, Ctrl+Cmd+F toàn màn hình, Cmd+= / Cmd+- phóng to / thu nhỏ.

## Giới hạn

Ruffle chạy tốt hầu hết game và hoạt hình Flash cũ (ActionScript 1/2). Với nội dung ActionScript 3 phức tạp, một số phần có thể chưa chạy đúng. Bảng tương thích: https://ruffle.rs/compatibility
