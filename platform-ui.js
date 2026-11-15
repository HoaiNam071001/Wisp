// Dùng trong các preload: ngoài macOS, đổi chữ phím tắt trên giao diện (Cmd, ⌘ ⇧ ⌥) sang kiểu Windows
// và vài nhãn chỉ đúng trên macOS. Theo dõi DOM nên cả title / chữ do trang tự đặt sau này cũng được đổi.
if (process.platform !== 'darwin') {
  const SPECIAL = { '⌘Y': 'Ctrl+H', '⇧⌘⌫': 'Ctrl+Shift+Del', '⌥⌘I': 'Ctrl+Alt+I' };
  const TEXT = [
    ['Ctrl+Cmd+F', 'F11'], ['Cmd+[', 'Alt+←'], ['Cmd+]', 'Alt+→'], ['Shift+Cmd+', 'Ctrl+Shift+'], ['Alt+Cmd+', 'Ctrl+Alt+'], ['Cmd+', 'Ctrl+'],
    ['Chống App Nap', 'Không cho máy ngủ'], ['Game không bị chậm khi cửa sổ bị che / thu nhỏ', 'Giữ máy thức khi đang mở Wisp'],
    ['Ảnh/Wisp', 'Pictures\\Wisp'],
  ];
  const fix = (s) => {
    if (!s || !/[⌘⇧⌥]|Cmd|App Nap|bị che|Ảnh\/Wisp/.test(s)) return s;
    let r = s.replace(/[⌃⌥⇧⌘]+./g, (m) => SPECIAL[m] || m
      .replace(/(.*)⌘/, 'Ctrl+$1').replace('⇧', 'Shift+').replace('⌥', 'Alt+').replace('⌃', 'Ctrl+').replace('⌫', 'Backspace'));
    for (const [a, b] of TEXT) r = r.split(a).join(b);
    return r;
  };
  const fixNode = (n) => {
    if (n.nodeType === 3) { const v = fix(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; return; }
    if (n.nodeType !== 1) return;
    if (n.title) { const v = fix(n.title); if (v !== n.title) n.title = v; }
    for (const c of n.childNodes) fixNode(c);
  };
  window.addEventListener('DOMContentLoaded', () => {
    fixNode(document.body);
    new MutationObserver((list) => {
      for (const m of list) {
        if (m.type === 'attributes' || m.type === 'characterData') fixNode(m.target);
        else m.addedNodes.forEach(fixNode);
      }
    }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['title'] });
  });
}
