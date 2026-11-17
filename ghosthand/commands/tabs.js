// Lệnh nhóm tab: tabs, open, navigate, back, forward, reload, close, activate, waitLoad.
const tabs = require('../../tabs');
const { normalizeUrl } = require('../../app-urls');
const { fail, GhError, webUrlOnly } = require('../protocol');
const { resolveTab } = require('../target');
const { callAgent } = require('../agent-call');
const { sleep } = require('../input');

// "google.com" → https://google.com; file / .swf / trang nội bộ thì từ chối (webUrlOnly).
const urlOf = u => webUrlOnly(normalizeUrl(u) || u);
// loadURL bị huỷ giữa chừng (ERR_ABORTED khi trang tự chuyển) cũng reject – kết quả tải xem bằng waitLoad
const load = (w, u) => { w.loadURL(u).catch(() => {}); };

function tabEntry(t) {
  const w = t.view.webContents;
  // engine "flash" có từ bước 04 (trang cấu hình Flash mở bằng engine Flash riêng); giờ mọi tab cùng một engine
  return { id: t.id, url: w.getURL(), title: t.title || w.getTitle(), active: t.id === tabs.getActiveId(), engine: 'web', loading: w.isLoading() };
}

// Chờ tab hết tải: until = load (hết vòng quay) | idle (thêm DOM đứng yên 500ms).
async function waitLoad(t, until = 'load', timeoutMs = 30000) {
  const w = t.view.webContents, start = Date.now();
  const left = () => timeoutMs - (Date.now() - start);
  const timeout = () => new GhError('timeout', `trang chưa tải xong sau ${timeoutMs}ms (${w.getURL()})`);
  // Vừa gọi loadURL thì isLoading có thể chưa bật → chờ một nhịp
  await sleep(50);
  const gone = () => { if (w.isDestroyed()) fail('no_tab', 'tab đã đóng trong lúc chờ'); };
  for (gone(); w.isLoading(); gone()) {
    if (left() <= 0) throw timeout();
    await new Promise(r => {
      const done = () => { clearTimeout(timer); w.removeListener('did-stop-loading', done); r(); };
      const timer = setTimeout(done, Math.min(left(), 500));
      w.once('did-stop-loading', done);
    });
  }
  if (until === 'idle') {
    for (;;) {
      gone();
      if (left() <= 0) throw timeout();
      // trang vừa chuyển thì agent chưa sẵn sàng – coi như chưa yên, hỏi lại
      const q = await callAgent(w, 'quiet', {}, 2000).catch(() => null);
      if (q && q.readyState === 'complete' && q.quietMs >= 500) break;
      await sleep(150);
    }
  }
  return { url: w.getURL(), ms: Date.now() - start };
}

module.exports = {
  tabs: () => tabs.list().filter(t => !t.view.webContents.isDestroyed()).map(tabEntry),
  open({ url, newTab, tab }) {
    const u = urlOf(url);
    if (newTab) return { tab: tabs.createTab(u).id };
    const t = resolveTab(tab);
    load(t.view.webContents, u);
    return { tab: t.id };
  },
  navigate({ url, tab }) {
    const t = resolveTab(tab);
    load(t.view.webContents, urlOf(url));
    return { tab: t.id };
  },
  back({ tab }) {
    const t = resolveTab(tab), w = t.view.webContents;
    if (!w.navigationHistory.canGoBack()) fail('bad_args', 'tab không có trang trước');
    w.navigationHistory.goBack();
    return { tab: t.id };
  },
  forward({ tab }) {
    const t = resolveTab(tab), w = t.view.webContents;
    if (!w.navigationHistory.canGoForward()) fail('bad_args', 'tab không có trang sau');
    w.navigationHistory.goForward();
    return { tab: t.id };
  },
  reload({ tab }) { const t = resolveTab(tab); t.view.webContents.reload(); return { tab: t.id }; },
  close({ tab }) { const t = resolveTab(tab); tabs.closeTab(t.id); return { tab: t.id }; },
  activate({ tab }) { const t = resolveTab(tab); tabs.activateTab(t.id); return { tab: t.id }; },
  waitLoad({ tab, until, timeoutMs }) { return waitLoad(resolveTab(tab), until, timeoutMs); },
};
