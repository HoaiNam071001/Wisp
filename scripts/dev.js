// npm run dev: chạy Wisp bản dev với thư mục dữ liệu riêng (.dev-data/), không đụng bản đã cài.
// Tự bỏ ELECTRON_RUN_AS_NODE (terminal VS Code có sẵn biến này làm Electron chạy như Node).
// Tham số: npm run dev -- [inspect] [url | file.swf]   vd. npm run dev -- inspect https://cf4vn.bar/
// Viết bằng Node để chạy được cả macOS lẫn Windows (không cần cú pháp env của shell).
const { spawn } = require('child_process');
const path = require('path');
const electron = require('electron'); // ngoài Electron, require trả về đường dẫn file chạy

const root = path.join(__dirname, '..');
const env = Object.assign({}, process.env);
delete env.ELECTRON_RUN_AS_NODE;
// Giữ WISP_USER_DATA nếu người dùng đã đặt (vd. muốn thử dữ liệu trống ở /tmp)
if (!env.WISP_USER_DATA) env.WISP_USER_DATA = path.join(root, '.dev-data');

for (const arg of process.argv.slice(2)) {
  if (arg === 'inspect') env.WISP_INSPECT = '1';
  else env.FLASH_URL = arg;
}

console.log('Dữ liệu dev: ' + env.WISP_USER_DATA);
const child = spawn(electron, ['.'], { cwd: root, env, stdio: 'inherit' });
child.on('exit', code => process.exit(code === null ? 1 : code));
