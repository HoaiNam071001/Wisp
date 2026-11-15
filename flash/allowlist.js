// Allowlist Flash – logic thuần (không require electron): domain gốc + nội dung mms.cfg.

// Lấy "domain gốc" để đưa vào allowlist, vd. static.game.cmn.vn → cmn.vn
const TWO_PART_TLD = /\.(com|net|org|edu|gov|info|biz|name|pro|int|ac|co)\.[a-z]{2}$/i;
function baseDomain(host) {
  const parts = String(host || '').toLowerCase().split('.').filter(Boolean);
  if (parts.length <= 2 || /^\d+$/.test(parts[parts.length - 1])) return parts.join('.');
  return parts.slice(TWO_PART_TLD.test(host) ? -3 : -2).join('.');
}

// Luôn gồm domain mặc định, cộng thêm domain người dùng tự thêm (config.json có thể hỏng → bỏ qua)
function mergeDomains(defaults, list) {
  return [...new Set([...defaults, ...(Array.isArray(list) ? list : [])])];
}

// mms.cfg: tắt kill switch của Flash 32 cho các domain trong allowlist
function mmsCfgContent(domains, debug) {
  const lines = [
    'EOLUninstallDisable=1',
    'AutoUpdateDisable=1',
    'SilentAutoUpdateEnable=0',
    'EnableAllowList=1',
    // Chỉ kiểm tra SWF gốc. Không có dòng này, Flash kiểm tra cả SWF con, request
    // và socket: mẫu "*://domain/" không khớp URL có cổng (xmlsocket://game.cf4vn.bar:49119)
    // → Flash lặng lẽ không nối tới máy chủ game → game báo 登陆超时.
    'AllowListRootMovieOnly=1',
  ];
  for (const d of domains) {
    lines.push(`AllowListUrlPattern=*://${d}/`);
    lines.push(`AllowListUrlPattern=*://*.${d}/`);
  }
  lines.push('AllowListUrlPattern=file:*');
  if (debug) lines.push('AllowListPreview=1', 'TraceOutputEcho=1');
  return lines.join('\n') + '\n';
}

module.exports = { baseDomain, mergeDomains, mmsCfgContent };
