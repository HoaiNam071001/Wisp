// Gọi agent của cả trang: khung chính + agent frame khác nguồn (ghosthand/frames.js). Không có frame con → gọi thẳng
// khung chính như trước. Có → hỏi frames() để biết gốc toạ độ (frame-layout.compose), rồi theo từng hàm:
//   ref → agent sinh ra ref (mã lần tải đứng trước dấu chấm); selector → agent có selector khớp sớm nhất
//   (pickFirst – cùng thứ tự selector như một trang); outline / pageText ghép; gameRect lấy khung lớn nhất.
const { GhError } = require('./protocol');
const { parseSelector } = require('./selector');
const { compose, pickFirst, pathOrder } = require('./frame-layout');
const { callAgent } = require('./agent-call');
const frames = require('./frames');

const REMOTE_MS = 1500; // hỏi rộng mọi frame: frame treo / đã mất không làm chậm cả lệnh
const MISSES = 3; // không trả lời frames() liền 3 lần → coi frame đã mất
const REF_RE = /^[a-z0-9]{6}\.\d+$/;
const misses = new Map();

const call = (wc, a, fn, args, ms) => callAgent(wc, fn, a.base ? Object.assign({}, args, { _frame: a.base }) : args, ms, a.frame);

// Danh sách agent theo thứ tự trang (khung chính đầu) + gốc toạ độ; null = trang chỉ có khung chính.
async function agentsOf(wc) {
  const rs = frames.remotes(wc);
  if (!rs.length) return null;
  const reps = await Promise.all([callAgent(wc, 'frames', {})].concat(rs.map(f => callAgent(wc, 'frames', {}, REMOTE_MS, f).then(r => {
    misses.delete(f);
    return r;
  }, () => {
    misses.set(f, (misses.get(f) || 0) + 1);
    if (misses.get(f) >= MISSES) { misses.delete(f); frames.drop(wc, f); }
    return null;
  }))));
  const reports = [{ key: 'top', self: '', frames: reps[0].frames }];
  rs.forEach((f, i) => { if (reps[i + 1]) reports.push({ key: f.pid + ':' + f.fid, self: reps[i + 1].self, frames: reps[i + 1].frames }); });
  const layout = compose(reports);
  const agents = [{ key: 'top', frame: null, base: null, page: reps[0].page, path: '', owner: null }];
  rs.forEach(f => {
    const l = layout.get(f.pid + ':' + f.fid);
    if (l) agents.push({ key: f.pid + ':' + f.fid, frame: f, base: { x: l.x, y: l.y, clip: l.clip }, page: f.page, path: l.path, owner: l.owner });
  });
  agents.sort((a, b) => pathOrder(a.path, b.path));
  return agents;
}

const byRef = (agents, ref) => agents.find(a => String(ref).startsWith(a.page + '.')) || agents[0];

// Selector đầu tiên khớp ở agent nào (khung chính lỗi – vd css sai cú pháp – thì báo lỗi luôn).
// noDialog: scope dialog mà không frame nào có hộp thoại.
async function choose(wc, agents, sels, visibleOnly, scope) {
  const rs = await Promise.all(agents.map((a, i) => call(wc, a, 'firstIndex', { sels, visibleOnly, scope }, i ? REMOTE_MS : 5000)
    .catch(e => { if (!i) throw e; return null; })));
  return Object.assign(pickFirst(rs), { noDialog: rs.every(r => !r || r.noDialog) });
}
function notFound(p) {
  if (p.hidden) return new GhError('not_visible', `tìm thấy ${p.hidden} phần tử khớp nhưng đang ẩn`);
  return new GhError('not_found', 'không thấy phần tử khớp selector nào');
}

// Selector của phần tử ở frame con: bỏ cái mà agent đứng trước cũng khớp (tìm lại sẽ ra phần tử khác).
async function ownSelectors(wc, earlier, found) {
  const all = Array.from(new Set([].concat(...found.map(f => f.selectors || []))));
  if (!all.length) return;
  const parsed = all.map(s => parseSelector(s));
  const hits = await Promise.all(earlier.map((a, i) => call(wc, a, 'matchesAny', { sels: parsed }, i ? REMOTE_MS : 5000).catch(() => null)));
  const taken = new Set(all.filter((_s, j) => hits.some(h => h && h[j])));
  for (const f of found) {
    const own = (f.selectors || []).filter(s => !taken.has(s));
    if (own.length) { f.selectors = own; f.selector = own[0]; } // không còn cái nào riêng: giữ như cũ (tốt nhất có thể)
  }
}

// Phần tử ở frame con: thẻ iframe của nó (và của frame cha) có bị phần tử khác của trang cha che tại điểm bấm không.
async function coverAbove(wc, agents, a, x, y) {
  for (let cur = a; cur && cur.owner;) {
    const owner = agents.find(o => o.key === cur.owner);
    if (!owner) return '';
    const r = await call(wc, owner, 'frameCover', { path: cur.path, x, y });
    if (r.covered) return r.covered;
    cur = owner;
  }
  return '';
}

async function locate(wc, agents, a, args, ms) {
  let r = await call(wc, a, 'locate', args, ms);
  if (a.frame && r.scrolled) { // cuộn trong frame con có thể cuộn cả trang cha → tính lại gốc toạ độ
    const again = (await agentsOf(wc)) || agents;
    a = again.find(x => x.key === a.key) || a;
    agents = again;
    r = await call(wc, a, 'locate', Object.assign({ ref: r.ref }, args.offset ? { offset: args.offset } : {}), ms);
  }
  if (!r.covered && a.frame) r.covered = await coverAbove(wc, agents, a, r.x, r.y);
  return r;
}

async function find(wc, agents, args, ms) {
  const p = await choose(wc, agents, args.sels, args.visibleOnly !== false, args.scope);
  if (p.agent < 0) return Object.assign({ selectorIndex: -1, found: [], hidden: p.hidden }, p.noDialog ? { noDialog: true } : {});
  const r = await call(wc, agents[p.agent], 'find', Object.assign({}, args, { sels: [args.sels[p.index]] }), ms);
  r.selectorIndex = p.index;
  if (p.agent > 0) await ownSelectors(wc, agents.slice(0, p.agent), r.found);
  return r;
}

async function check(wc, agents, args, ms) {
  const p = await choose(wc, agents, args.sels, true);
  if (args.state === 'hidden') return { met: p.agent < 0 };
  if (p.agent < 0) return { met: false };
  return call(wc, agents[p.agent], 'check', Object.assign({}, args, { sels: [args.sels[p.index]] }), ms);
}

// outline: khung chính rồi từng frame con (dòng của frame con có thêm frame = đường dẫn), chung trần maxNodes.
async function outline(wc, agents, args, ms) {
  if (args.root) {
    const a = REF_RE.test(args.root) ? byRef(agents, args.root) : agents[(await chooseRoot(wc, agents, args.root))];
    return call(wc, a, 'outline', args, ms);
  }
  const max = args.maxNodes || 300, r = await call(wc, agents[0], 'outline', args, ms);
  for (const a of agents.slice(1)) {
    const sub = await call(wc, a, 'outline', Object.assign({}, args, { maxNodes: Math.max(0, max - r.items.length) }), ms).catch(() => null);
    if (!sub) continue;
    for (const it of sub.items) { it.frame = a.path; r.items.push(it); }
    r.total += sub.total;
  }
  r.truncated = r.total > r.items.length;
  return r;
}
async function chooseRoot(wc, agents, root) {
  let sel;
  try { sel = parseSelector(root); } catch (e) { throw new GhError('bad_args', 'root: ' + e.message); }
  const p = await choose(wc, agents, [sel], true);
  if (p.agent < 0) throw notFound(p);
  return p.agent;
}

// pageText: chữ khung chính + frame con đang nhìn thấy, chung trần maxChars.
async function pageText(wc, agents, args, ms) {
  const max = args.maxChars || 20000, r = await call(wc, agents[0], 'pageText', args, ms);
  for (const a of agents.slice(1)) {
    if (!a.base.clip.w || !a.base.clip.h || r.text.length >= max) continue;
    const sub = await call(wc, a, 'pageText', args, REMOTE_MS).catch(() => null);
    if (sub && sub.text) { r.text = (r.text + '\n\n' + sub.text).slice(0, max); r.truncated = r.truncated || sub.truncated || r.text.length >= max; }
  }
  return r;
}

// Khung game lớn nhất của cả trang; bằng nhau thì lấy phần tử bên trong frame (embed thay cho thẻ iframe bọc nó).
async function gameRect(wc, agents, args, ms) {
  const rs = await Promise.all(agents.map((a, i) => call(wc, a, 'gameRect', args, i ? REMOTE_MS : ms).catch(e => (i ? null : e))));
  let best = null;
  for (const r of rs) if (r && !(r instanceof Error) && (!best || r.rect.w * r.rect.h >= best.rect.w * best.rect.h)) best = r;
  if (!best) throw rs[0];
  return best;
}

const BY_REF_ONLY = new Set(['focused', 'selectText', 'selectResult']);
const SPECIAL = { find, check, outline, pageText, gameRect };

async function callPage(wc, fn, args, ms = 5000) {
  const agents = await agentsOf(wc);
  if (!agents) return callAgent(wc, fn, args, ms);
  if (fn === 'viewport' || fn === 'quiet') return callAgent(wc, fn, args, ms);
  if (SPECIAL[fn]) return SPECIAL[fn](wc, agents, args, ms);
  let a, rest = args;
  if (args.ref || BY_REF_ONLY.has(fn)) a = byRef(agents, args.ref);
  else {
    const p = await choose(wc, agents, args.sels, true);
    if (p.agent < 0) throw notFound(p);
    a = agents[p.agent];
    rest = Object.assign({}, args, { sels: [args.sels[p.index]] });
  }
  return fn === 'locate' ? locate(wc, agents, a, rest, ms) : call(wc, a, fn, rest, ms);
}

module.exports = { callPage };
