// Xoá dữ liệu duyệt web của tab (session mặc định, lưu lâu dài ở userData). Engine Flash có dữ liệu riêng
// (userData/flash-engine) – không đụng ở đây vì tiến trình đó có thể đang chạy.
const { session, dialog } = require('electron');
const tabs = require('./tabs');
const { addLog } = require('./inspect/store');

async function clearBrowsingDataDialog() {
  const { response } = await dialog.showMessageBox(tabs.getWin(), {
    type: 'warning', message: 'Xoá dữ liệu duyệt web',
    detail: 'Cookie và dữ liệu trang: bạn sẽ bị đăng xuất khỏi các trang web (lịch sử, dấu trang, quyền đã nhớ giữ nguyên).\nChỉ cache: giữ đăng nhập.',
    buttons: ['Cookie và dữ liệu trang', 'Chỉ cache', 'Huỷ'], defaultId: 1, cancelId: 2,
  });
  if (response === 2) return false;
  const ses = session.defaultSession;
  try {
    await ses.clearCache();
    if (response === 0) await ses.clearStorageData({ storages: ['cookies', 'localstorage', 'indexdb', 'serviceworkers', 'cachestorage', 'websql'] });
  } catch (e) {
    addLog('error', 'event', 'Xoá dữ liệu duyệt web lỗi: ' + e.message);
    tabs.toast('Không xoá được: ' + e.message);
    return false;
  }
  addLog('info', 'event', response === 0 ? 'Đã xoá cookie, dữ liệu trang và cache' : 'Đã xoá cache');
  tabs.toast(response === 0 ? 'Đã xoá cookie và dữ liệu trang' : 'Đã xoá cache');
  const w = tabs.wc();
  if (w) w.reload();
  return true;
}

module.exports = { clearBrowsingDataDialog };
