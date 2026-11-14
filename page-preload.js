// Chỉ dùng ở chế độ Ruffle: chạy trong mọi frame (kể cả iframe) và chèn Ruffle vào trang.
// Electron 11 chưa có webFrameMain nên dùng preload + nodeIntegrationInSubFrames thay cho bản 1.
const { webFrame } = require('electron');

if (process.argv.includes('--flash-mode=ruffle')) {
  const INJECT = `
  (() => {
    if (window.__ruffleInjected) return;
    window.__ruffleInjected = true;
    window.RufflePlayer = window.RufflePlayer || {};
    window.RufflePlayer.config = Object.assign({
      publicPath: 'ruffle://local/',
      polyfills: true,
      autoplay: 'auto',
      unmuteOverlay: 'hidden',
      letterbox: 'on',
      warnOnUnsupportedContent: false,
      openUrlMode: 'allow',
      allowNetworking: 'all',
    }, window.RufflePlayer.config || {});
    const s = document.createElement('script');
    s.src = 'ruffle://local/ruffle.js';
    (document.head || document.documentElement).appendChild(s);
  })();`;
  const inject = () => webFrame.executeJavaScript(INJECT).catch(() => {});
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', inject, { once: true });
  else inject();
}
