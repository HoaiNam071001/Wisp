// Điều phối đồng bộ Google Drive: cấu hình (khoá liệt kê) + dấu trang + lịch sử. Chỉ chạy khi đã đăng nhập.
// Kéo khi khởi động, đẩy sau thay đổi (debounce 30 s), định kỳ 10 phút; lỗi mạng thì thử lại sau 2 phút. Không chặn main (toàn async).
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { EventEmitter } = require('events');
const auth = require('./google-auth');
const { createDrive } = require('./sync-drive');
const { runAll } = require('./sync-run');
const { mergeItems, mergeHistory, pickConfig, mergeConfig } = require('./sync-merge');
const { loadConfig, saveConfig, saveFlashSites } = require('./config');
const bookmarks = require('./bookmarks');
const history = require('./history');
const keyremap = require('./keyremap-main');

// Chỉ các khoá này lên Drive – không đường dẫn máy, token Ghosthand, cổng, thông tin cập nhật
const CONFIG_KEYS = ['url', 'flashSites', 'keyRemap'];
const DEBOUNCE_MS = 30 * 1000, EVERY_MS = 10 * 60 * 1000, RETRY_MS = 2 * 60 * 1000;

const events = new EventEmitter(); // 'status'
const drive = createDrive(() => auth.getAccessToken());
let status = { syncing: false, lastSync: null, errors: {} };
let timer = null, running = false, applying = false;

const statePath = () => path.join(app.getPath('userData'), 'sync-state.json');
function loadState() { try { return JSON.parse(fs.readFileSync(statePath(), 'utf8')); } catch { return {}; } }
function saveState(s) { try { fs.writeFileSync(statePath(), JSON.stringify(s)); } catch (e) { console.error('Không lưu được trạng thái đồng bộ:', e); } }

function configKind() {
  return {
    name: 'config.json',
    local: () => pickConfig(loadConfig(), CONFIG_KEYS, loadState().configStamps, Date.now()),
    merge: (local, remote) => mergeConfig(local, remote, CONFIG_KEYS),
    apply: (merged) => {
      const cur = loadConfig(), patch = {};
      for (const k of CONFIG_KEYS) if (merged[k] && JSON.stringify(merged[k].v) !== JSON.stringify(cur[k])) patch[k] = merged[k].v;
      applying = true;
      try {
        if (patch.flashSites) saveFlashSites(patch.flashSites);
        delete patch.flashSites;
        if (Object.keys(patch).length) saveConfig(patch);
        if (merged.keyRemap) keyremap.reload();
      } finally { applying = false; }
      saveState(Object.assign(loadState(), { configStamps: merged }));
    },
  };
}

const kinds = () => [
  configKind(),
  { name: 'bookmarks.json', local: () => bookmarks.snapshot(), merge: mergeItems, apply: (m) => { applying = true; try { bookmarks.replaceAll(m); } finally { applying = false; } } },
  { name: 'history.json', local: () => history.snapshot(), merge: (a, b) => mergeHistory(a, b, history.HISTORY_MAX),
    apply: (m) => { applying = true; try { history.replaceAll(m); } finally { applying = false; } } },
];

function setStatus(patch) { status = Object.assign({}, status, patch); events.emit('status', status); }

async function syncNow() {
  if (running || !auth.account()) return status;
  running = true; setStatus({ syncing: true });
  let retry = false;
  try {
    const r = await runAll(drive, kinds());
    retry = Object.keys(r.errors).length > 0;
    setStatus({ syncing: false, errors: r.errors, lastSync: retry ? status.lastSync : Date.now() });
  } catch (e) { retry = true; setStatus({ syncing: false, errors: { all: e.message } }); }
  running = false;
  schedule(retry ? RETRY_MS : EVERY_MS);
  return status;
}

function schedule(ms) {
  clearTimeout(timer);
  if (!auth.account()) { timer = null; return; }
  timer = setTimeout(syncNow, ms);
  if (timer.unref) timer.unref();
}

// Có thay đổi cục bộ → đẩy sau DEBOUNCE_MS (lịch sử đổi mỗi lần xem trang nên không đẩy ngay)
function onLocalChange() {
  if (applying || running || !auth.account()) return;
  schedule(DEBOUNCE_MS);
}

function init() {
  bookmarks.events.on('changed', onLocalChange);
  history.events.on('changed', onLocalChange);
  auth.events.on('changed', () => { if (auth.account()) syncNow(); else { clearTimeout(timer); timer = null; setStatus({ errors: {} }); } });
  if (auth.account()) schedule(5000);
}

// Xoá toàn bộ dữ liệu app trên Drive (nút trong Cài đặt)
async function wipeRemote() { await drive.removeAll(); setStatus({ lastSync: null }); }

module.exports = { events, init, syncNow, wipeRemote, getStatus: () => status, CONFIG_KEYS };
