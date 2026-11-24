// Chọn tab nào cho ngủ (logic thuần, không Electron). Tab ngủ = bỏ trang đang nạp để trả RAM, bấm vào thì nạp lại.
const DEFAULT_MINUTES = 30;

function sleepMinutes(cfg) {
  const m = Number(cfg && cfg.sleepMinutes);
  return Number.isFinite(m) && m >= 1 ? m : DEFAULT_MINUTES;
}
function sleepEnabled(cfg) { return !(cfg && cfg.sleepTabs === false); }

// Chỉ tab http(s) thường mới ngủ được: trang nội bộ / Flash / file thì không.
function sleepableUrl(url) { return /^https?:/i.test(String(url || '')); }

// t: { id, url, lastActive, active, audible, loading, sleeping, htmlFull, devtools, wantsFlash }
function pickSleepers(tabs, now, cfg) {
  if (!sleepEnabled(cfg)) return [];
  const limit = sleepMinutes(cfg) * 60000;
  return tabs.filter(t =>
    !t.active && !t.sleeping && !t.audible && !t.loading && !t.htmlFull && !t.devtools && !t.wantsFlash &&
    sleepableUrl(t.url) && now - t.lastActive >= limit).map(t => t.id);
}

module.exports = { pickSleepers, sleepMinutes, sleepEnabled, sleepableUrl };
