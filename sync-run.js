// Một lượt đồng bộ cho một loại dữ liệu: đọc Drive → gộp với máy này → áp dụng cục bộ → ghi lại nếu khác. Thuần (inject drive).
const MAX_TRIES = 3; // gặp 'conflict' (máy khác ghi giữa chừng) thì đọc – gộp – ghi lại

// kind: { name, local() → dữ liệu, merge(local, remote) → gộp, apply(merged) }
async function runKind(drive, kind) {
  for (let i = 0; i < MAX_TRIES; i++) {
    const prev = await drive.read(kind.name);
    let remote = null;
    if (prev) {
      try { remote = JSON.parse(prev.text); } catch { throw new Error('File ' + kind.name + ' trên Drive hỏng – xoá dữ liệu đồng bộ rồi đồng bộ lại'); }
    }
    const merged = kind.merge(kind.local(), remote);
    kind.apply(merged);
    const text = JSON.stringify(merged);
    if (prev && prev.text === text) return { wrote: false };
    try { await drive.write(kind.name, text, prev); return { wrote: true }; }
    catch (e) { if (e.code !== 'conflict' || i === MAX_TRIES - 1) throw e; }
  }
}

// Chạy lần lượt; lỗi một loại không chặn loại khác. → { ok: {tên: true}, errors: {tên: thông báo} }
async function runAll(drive, kinds) {
  const out = { ok: {}, errors: {} };
  for (const k of kinds) {
    try { await runKind(drive, k); out.ok[k.name] = true; } catch (e) { out.errors[k.name] = e.message; }
  }
  return out;
}

module.exports = { runKind, runAll };
