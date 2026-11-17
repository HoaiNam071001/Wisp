// Giao thức stdin / stdout giữa vỏ app và engine Flash: mỗi dòng một JSON (logic thuần, Node 12).
// Vỏ → engine: {id, cmd:'open'|'close'|'frameRect'|'quit', url?, domains?}  (domains: trang Flash thật – đi ra ngoài thì engine báo 'leave')
// Engine → vỏ: {id, ok, result|error:{code,detail}} (trả lời) hoặc {event:'ready'|'url'|'title'|'flash'|'leave'|'closed', data}
const CMDS = ['open', 'close', 'frameRect', 'quit'];

function parseLine(line) {
  let m;
  try { m = JSON.parse(line); } catch { return { error: { code: 'bad_args', detail: 'không phải JSON' } }; }
  if (!m || typeof m !== 'object' || !CMDS.includes(m.cmd)) return { error: { code: 'bad_args', detail: 'lệnh không hợp lệ' } };
  if (m.cmd === 'open' && !/^https?:\/\//i.test(String(m.url || ''))) return { error: { code: 'bad_args', detail: 'open cần url http(s)' } };
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

module.exports = { CMDS, hostInDomains, parseLine, reply, fail, event };
