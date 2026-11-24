// Trang lỗi tải / chứng chỉ (logic thuần): data: URL tự chứa, các nút là link `wisp-error:<việc>?url=…` do net-error.js xử lý.
// Cùng dấu `wisp-crashed` với trang Tab bị dừng để tabs.js hiện địa chỉ gốc thay cho data: URL.
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Mã lỗi Chromium (net::ERR_*): -105 không thấy tên miền, -106 mất mạng, -102 từ chối kết nối, -200…-299 chứng chỉ, -107 lỗi SSL
function classify(code) {
  if (code === -3 || code === -20 || code === -27) return null; // bị huỷ / bị chặn có chủ ý
  if (code <= -200 && code >= -299) return { kind: 'cert', title: 'Kết nối không riêng tư', text: 'Chứng chỉ của trang không hợp lệ (hết hạn, sai tên miền hoặc do tổ chức lạ cấp). Kẻ gian có thể đang giả mạo trang này.' };
  if (code === -107) return { kind: 'ssl', title: 'Trang không hỗ trợ kết nối an toàn', text: 'Trang không trả lời được bằng HTTPS.' };
  if (code === -105) return { kind: 'dns', title: 'Không tìm thấy trang', text: 'Không tìm thấy máy chủ. Kiểm tra lại địa chỉ gõ có đúng không.' };
  if (code === -106 || code === -109) return { kind: 'net', title: 'Không có kết nối mạng', text: 'Kiểm tra Wi-Fi / dây mạng rồi thử lại.' };
  if (code === -102 || code === -118 || code === -7) return { kind: 'conn', title: 'Trang không phản hồi', text: 'Máy chủ từ chối hoặc không trả lời kịp.' };
  return { kind: 'other', title: 'Không mở được trang', text: 'Đã xảy ra lỗi khi tải trang.' };
}

const act = (name, url) => `wisp-error:${name}?url=${encodeURIComponent(url)}`;

function errorPageUrl(url, code, desc) {
  const c = classify(code);
  if (!c) return null;
  const btn = (name, label, cls = 'b') => `<a class="${cls}" href="${esc(act(name, url))}">${label}</a>`;
  const buttons = [btn('reload', 'Tải lại')];
  if (c.kind === 'ssl' && /^https:/i.test(url)) buttons.push(btn('http', 'Thử bản http (không an toàn)', 'l'));
  const adv = c.kind === 'cert'
    ? `<details><summary>Nâng cao</summary><p>${esc(desc || '')}</p>${btn('proceed', 'Vẫn tiếp tục (không an toàn)', 'l')}</details>` : '';
  const html = `<!--wisp-crashed--><!doctype html><meta charset="utf-8"><title>${esc(c.title)}</title>
<style>:root{--bg:#fff;--fg:#202124;--mut:#5f6368;--ac:#1a73e8}@media(prefers-color-scheme:dark){:root{--bg:#2b2d31;--fg:#e8eaed;--mut:#9aa0a6;--ac:#8ab4f8}}
body{margin:0;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:var(--bg);color:var(--fg);font:15px system-ui}
p{margin:0;color:var(--mut);max-width:460px;text-align:center;word-break:break-all}.b{padding:8px 18px;border-radius:6px;background:var(--ac);color:var(--bg);text-decoration:none}
.l{color:var(--ac)}details{max-width:460px;color:var(--mut)}div{display:flex;gap:16px;align-items:center}</style>
<h2>${esc(c.title)}</h2><p>${esc(url)}</p><p>${esc(c.text)}</p><div>${buttons.join('')}</div>${adv}`;
  return 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
}

// "wisp-error:proceed?url=…" → { action, url } hoặc null
function parseAction(link) {
  const m = /^wisp-error:([a-z]+)\?url=(.+)$/.exec(String(link || ''));
  if (!m) return null;
  let url; try { url = decodeURIComponent(m[2]); } catch { return null; }
  return /^https?:/i.test(url) ? { action: m[1], url } : null;
}

module.exports = { classify, errorPageUrl, parseAction };
