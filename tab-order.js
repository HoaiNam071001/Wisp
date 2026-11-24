// Thứ tự tab (logic thuần): tab ghim luôn đứng đầu, kéo thả không làm lẫn hai nhóm.
// items: [{ id, pinned }] → mảng id theo thứ tự mới.
function orderIds(items) { return [...items.filter(t => t.pinned), ...items.filter(t => !t.pinned)].map(t => t.id); }

// Chuyển tab `id` đứng trước tab `beforeId` (null = cuối nhóm của nó). Không vượt qua ranh giới ghim.
function moveTab(items, id, beforeId) {
  const me = items.find(t => t.id === id);
  if (!me) return orderIds(items);
  const rest = items.filter(t => t.id !== id);
  const before = rest.find(t => t.id === beforeId);
  const group = rest.filter(t => !!t.pinned === !!me.pinned);
  let at; // vị trí trong `rest`
  if (before && !!before.pinned === !!me.pinned) at = rest.indexOf(before);
  else if (me.pinned) at = rest.filter(t => t.pinned).length;       // thả sang nhóm kia → cuối nhóm mình
  else at = rest.length;
  if (!group.length && !me.pinned) at = rest.length;
  const out = [...rest.slice(0, at), me, ...rest.slice(at)];
  return orderIds(out);
}

// Ghim / bỏ ghim: tab ghim xuống cuối nhóm ghim, bỏ ghim lên đầu nhóm thường
function setPinned(items, id, pinned) {
  const next = items.map(t => t.id === id ? { ...t, pinned } : t);
  const me = next.find(t => t.id === id);
  const others = next.filter(t => t.id !== id);
  const pins = others.filter(t => t.pinned);
  return [...pins, me, ...others.filter(t => !t.pinned)].map(t => t.id);
}

module.exports = { moveTab, setPinned, orderIds };
