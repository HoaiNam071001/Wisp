// Trang "Tab bị dừng" (logic thuần): data: URL tự chứa, nút Tải lại là link về địa chỉ cũ.
const CRASH_REASONS = ['crashed', 'oom', 'launch-failed', 'integrity-failure', 'abnormal-exit'];

const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const isCrash = (reason) => CRASH_REASONS.includes(reason);
const isCrashedPage = (url) => String(url || '').startsWith('data:text/html;charset=utf-8,%3C!--wisp-crashed');

function crashedPageUrl(url, reason) {
  const link = /^https?:/i.test(url) ? `<a class="b" href="${esc(url)}">Tải lại trang</a>` : '';
  const html = `<!--wisp-crashed--><!doctype html><meta charset="utf-8"><title>Tab bị dừng</title>
<style>:root{--bg:#fff;--fg:#202124;--mut:#5f6368;--ac:#1a73e8}@media(prefers-color-scheme:dark){:root{--bg:#2b2d31;--fg:#e8eaed;--mut:#9aa0a6;--ac:#8ab4f8}}
body{margin:0;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:var(--bg);color:var(--fg);font:15px system-ui}
p{margin:0;color:var(--mut);max-width:420px;text-align:center;word-break:break-all}.b{padding:8px 18px;border-radius:6px;background:var(--ac);color:var(--bg);text-decoration:none}</style>
<h2>Tab bị dừng</h2><p>${esc(url)}</p><p>Hết bộ nhớ hoặc trang bị lỗi (${esc(reason)}). Tải lại để tiếp tục.</p>${link}`;
  return 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
}

module.exports = { isCrash, crashedPageUrl, isCrashedPage };
