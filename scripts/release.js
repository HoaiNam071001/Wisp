// Phát hành: npm run release [x|y|z|x.y.z] [-- --win --notes "…" --dry]
// (không tham số = z; x = số đầu / major, y = số giữa / minor, z = số cuối / patch)
// Tăng version → kiểm tra → đóng gói mac (dmg + zip + sha256, tuỳ chọn Windows) → commit + tag + push → GitHub release.
// --dry: dừng sau khi đóng gói (không commit / push / tạo release; version trong package.json đã đổi).
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');

function nextVersion(cur, bump) {
  bump = { x: 'major', y: 'minor', z: 'patch' }[bump] || bump;
  if (/^\d+\.\d+\.\d+$/.test(bump)) return bump;
  const [a, b, c] = cur.split('.').map(Number);
  if (bump === 'major') return `${a + 1}.0.0`;
  if (bump === 'minor') return `${a}.${b + 1}.0`;
  if (bump === 'patch') return `${a}.${b}.${c + 1}`;
  throw new Error('Tham số phải là x | y | z | x.y.z (hoặc major | minor | patch)');
}

function run(cmd, args, opts = {}) {
  console.log('$', cmd, args.join(' '));
  const r = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', ...opts });
  if (r.status !== 0) throw new Error(`Lệnh lỗi: ${cmd} ${args.join(' ')}`);
}
const out = (cmd, args) => spawnSync(cmd, args, { cwd: root, encoding: 'utf8' }).stdout.trim();

function sha(file) { run('sh', ['-c', `shasum -a 256 "${path.basename(file)}" > "${path.basename(file)}.sha256"`], { cwd: dist }); }

function main() {
  const argv = process.argv.slice(2);
  const flag = (f) => argv.includes(f);
  const ni = argv.indexOf('--notes');
  const notes = ni >= 0 ? argv[ni + 1] : '';
  const bump = argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--notes') || 'patch';
  const dry = flag('--dry');

  if (out('git', ['status', '--porcelain'])) throw new Error('Còn file chưa commit – commit hoặc cất trước khi phát hành.');
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const v = nextVersion(pkg.version, bump);
  console.log(`Phát hành ${pkg.version} → ${v}${dry ? ' (dry)' : ''}`);

  run('npm', ['version', v, '--no-git-tag-version']);
  run('npm', ['run', 'check']);
  run('npm', ['test']);
  fs.rmSync(dist, { recursive: true, force: true });

  run('npm', ['run', 'dist']);
  const app = ['mac', 'mac-arm64'].map((d) => path.join(dist, d, 'Wisp.app')).find(fs.existsSync);
  if (!app) throw new Error('Không thấy dist/mac/Wisp.app sau khi đóng gói.');
  const zip = path.join(dist, `Wisp-${v}-mac.zip`);
  run('ditto', ['-c', '-k', '--keepParent', app, zip]); // zip cho bộ cập nhật trong app
  sha(zip);
  const assets = [path.join(dist, `Wisp-${v}.dmg`), zip, zip + '.sha256'];

  if (flag('--win')) {
    run('npm', ['run', 'dist:win']);
    const exe = path.join(dist, `Wisp-${v}-win-setup.exe`);
    sha(exe);
    assets.push(exe, exe + '.sha256');
  }
  for (const f of assets) if (!fs.existsSync(f)) throw new Error('Thiếu file phát hành: ' + f);
  if (dry) return console.log('Dry: xong đóng gói.\n' + assets.join('\n'));

  run('git', ['commit', '-am', `Phát hành ${v}`]);
  run('git', ['tag', `v${v}`]);
  run('git', ['push', 'origin', 'HEAD', `v${v}`]);
  run('gh', ['release', 'create', `v${v}`, ...assets, '--title', `Wisp ${v}`, '--notes', notes || `Wisp ${v}`]);
}

if (require.main === module) {
  try { main(); } catch (e) { console.error('✗ ' + e.message); process.exit(1); }
}
module.exports = { nextVersion };
