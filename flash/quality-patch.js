// Chạy ở preload (thế giới riêng nhưng chung DOM với trang): đặt thuộc tính quality cho <embed> / <object> Flash
// ngay khi được chèn vào trang, trước khi plugin khởi tạo. Game tự gọi stage.quality trong SWF thì vẫn ghi đè được.
const isFlashObject = (el) => /shockwave|flash/i.test((el.getAttribute('type') || '') + (el.getAttribute('classid') || '') + (el.getAttribute('data') || el.getAttribute('src') || ''));

function patch(el, q) {
  const tag = el.tagName;
  if (tag === 'EMBED' && (isFlashObject(el) || /\.swf/i.test(el.getAttribute('src') || ''))) el.setAttribute('quality', q);
  else if (tag === 'OBJECT' && isFlashObject(el)) {
    let p = [...el.querySelectorAll('param')].find(x => /^quality$/i.test(x.getAttribute('name') || ''));
    if (!p) { p = document.createElement('param'); p.setAttribute('name', 'quality'); el.appendChild(p); }
    p.setAttribute('value', q);
  }
}

function scan(node, q) {
  if (node.nodeType !== 1) return;
  patch(node, q);
  node.querySelectorAll && node.querySelectorAll('embed,object').forEach(el => patch(el, q));
}

function install(q) {
  scan(document.documentElement, q);
  new MutationObserver((list) => { for (const m of list) m.addedNodes.forEach(n => scan(n, q)); })
    .observe(document, { childList: true, subtree: true });
}

module.exports = { install };
