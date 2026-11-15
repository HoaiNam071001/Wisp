// Lệnh nhóm chờ: waitFor (phần tử hiện / ẩn / bật) – hỏi agent lặp lại tới khi thoả hoặc hết giờ.
const { GhError } = require('../protocol');
const { resolveTab, screenRect } = require('../target');
const { callAgent } = require('../agent-call');
const { sleep } = require('../input');
const tabCmds = require('./tabs');

async function waitFor({ tab, sels, selectors, state = 'visible', timeoutMs = 10000 }) {
  const t = resolveTab(tab), start = Date.now();
  for (;;) {
    // trang đang chuyển thì agent chưa trả lời – coi như chưa thấy, hỏi lại
    const r = await callAgent(t.view.webContents, 'check', { sels, state }, 2000).catch(e => {
      if (e.code === 'bad_args' || e.code === 'no_tab') throw e;
      return null;
    });
    if (r && r.met) {
      if (r.element) r.element.screenRect = screenRect(t, r.element.rect);
      return { ms: Date.now() - start, element: r.element || null };
    }
    if (Date.now() - start >= timeoutMs) throw new GhError('timeout', `sau ${timeoutMs}ms vẫn chưa ${state} – ${selectors.join(' | ')}`);
    await sleep(150);
  }
}

// Chờ trang yên: hết tải + DOM đứng yên 500ms (sau thao tác làm trang tự cập nhật).
function settle({ tab, timeoutMs = 10000 }) { return tabCmds.waitLoad({ tab, until: 'idle', timeoutMs }); }

module.exports = { waitFor, settle };
