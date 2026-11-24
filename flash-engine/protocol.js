// Giao thức stdin / stdout giữa vỏ app và engine Flash: mỗi dòng một JSON (logic thuần, Node 12).
// Vỏ → engine: {id, cmd:'open'|'close'|'frameRect'|'game'|'quit', url?, domains?, action?}  (domains: trang Flash thật – đi ra ngoài thì engine báo 'leave')
// Engine → vỏ: {id, ok, result|error:{code,detail}} (trả lời) hoặc {event:'ready'|'url'|'title'|'flash'|'leave'|'closed', data}
const CMDS = ['open', 'close', 'frameRect', 'game', 'quit'];
const GAME_ACTIONS = ['reload', 'mute', 'unmute', 'focus', 'resize'];
const SIZE_RANGE = [200, 4000]; // kích thước vùng game (px) cho resize
const sizeOk = (n) => typeof n === 'number' && n >= SIZE_RANGE[0] && n <= SIZE_RANGE[1];

function parseLine(line) {
  let m;
  try { m = JSON.parse(line); } catch { return { error: { code: 'bad_args', detail: 'không phải JSON' } }; }
  if (!m || typeof m !== 'object' || !CMDS.includes(m.cmd)) return { error: { code: 'bad_args', detail: 'lệnh không hợp lệ' } };
  if (m.cmd === 'open' && !/^https?:\/\//i.test(String(m.url || ''))) return { error: { code: 'bad_args', detail: 'open cần url http(s)' } };
  if (m.cmd === 'game' && !GAME_ACTIONS.includes(m.action)) return { error: { code: 'bad_args', detail: 'game cần action: ' + GAME_ACTIONS.join(' | ') } };
  if (m.cmd === 'game' && m.action === 'resize' && !(sizeOk(m.width) && sizeOk(m.height))) return { error: { code: 'bad_args', detail: `resize cần width, height trong ${SIZE_RANGE[0]}–${SIZE_RANGE[1]}` } };
  return { msg: m };
}

// host thuộc domain gốc hoặc subdomain của nó (danh sách rỗng = không giới hạn)
function hostInDomains(domains, host) {
  if (!Array.isArray(domains) || !domains.length) return true;
  host = String(host || '').toLowerCase();
  return domains.some((d) => host === d || host.endsWith('.' + d));
}

const reply = (id, result) => JSON.stringify({ id, ok: true, result }) + '\n';
const fail = (id, error) => JSON.stringify({ id, ok: false, error }) + '\n';
const event = (name, data) => JSON.stringify({ event: name, data }) + '\n';

module.exports = { CMDS, GAME_ACTIONS, SIZE_RANGE, hostInDomains, parseLine, reply, fail, event };
