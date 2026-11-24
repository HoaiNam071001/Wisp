// Tab ẩn danh: dùng session trong bộ nhớ (partition không có "persist:") nên cookie / cache / localStorage không ghi ra đĩa,
// không vào lịch sử / phiên tab / "tab vừa đóng". Đóng tab ẩn danh cuối cùng thì xoá sạch session.
// Giới hạn: trang Flash luôn mở bằng engine Flash (cửa sổ riêng) nên không ẩn danh.
const tabs = require('./tabs');
const { session } = require('electron');
const { installRequestLog } = require('./inspect/request-log');

const PARTITION = 'incognito';
let ready = false;

function sessionFor() {
  const ses = session.fromPartition(PARTITION);
  if (!ready) {
    ready = true;
    const blocker = require('./content-blocker');
    require('./permissions').install(ses);
    require('./downloads').install(ses);
    installRequestLog(ses, blocker.decide);
    blocker.installGpc(ses);
  }
  return ses;
}

const any = () => tabs.list().some(t => t.incognito);

tabs.events.on('created', (t) => { if (t.incognito) sessionFor(); });
tabs.events.on('tab-closed', (t) => {
  if (!t.incognito || any() || !ready) return;
  const ses = session.fromPartition(PARTITION);
  ses.clearStorageData().catch(() => {});
  ses.clearCache().catch(() => {});
});

function newIncognitoTab() {
  tabs.createTab(require('./config').homeUrl(), { incognito: true });
  tabs.focusUrlBar();
}

module.exports = { newIncognitoTab, PARTITION };
