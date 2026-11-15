// npm run check: node --check mọi file .js của app (bỏ node_modules, dist, v1-ruffle) – bắt lỗi cú pháp trước khi chạy Electron.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const skip = new Set(['node_modules', 'dist', 'v1-ruffle', 'plugins', '.git', 'build', '.dev-data']);
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.js')) files.push(p);
  }
})(root);
let bad = 0;
for (const f of files) {
  try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); }
  catch (e) { bad++; console.error(path.relative(root, f) + '\n' + e.stderr); }
}
console.log(`${files.length - bad}/${files.length} file .js qua kiểm tra cú pháp`);
process.exit(bad ? 1 : 0);
