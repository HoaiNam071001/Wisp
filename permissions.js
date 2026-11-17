// Quyền của trang web (camera, micro, vị trí, thông báo…): hỏi người dùng một lần, nhớ theo domain (config sitePermissions).
// Trang chưa từng hỏi thì từ chối. Logic quyết định ở permission-policy.js.
const { dialog } = require('electron');
const { loadConfig, saveConfig } = require('./config');
const { decide, remember, originHost, ASK } = require('./permission-policy');
const tabs = require('./tabs');

const asking = new Map(); // "host|quyền" → Promise đang hỏi (một câu hỏi cho nhiều yêu cầu cùng lúc)

function ask(host, permission) {
  const key = host + '|' + permission;
  if (asking.has(key)) return asking.get(key);
  const win = tabs.getWin();
  const p = dialog.showMessageBox(win, {
    type: 'question', buttons: ['Cho phép', 'Chặn'], defaultId: 1, cancelId: 1,
    message: `${host} muốn dùng ${ASK[permission]}`, detail: 'Wisp nhớ lựa chọn này cho trang. Đổi lại bằng cách xoá dữ liệu trang.',
  }).then(({ response }) => {
    const allowed = response === 0;
    saveConfig({ sitePermissions: remember(loadConfig().sitePermissions, host, permission, allowed) });
    return allowed;
  }).finally(() => asking.delete(key));
  asking.set(key, p);
  return p;
}

function resolve(permission, requestingUrl) {
  const host = originHost(requestingUrl);
  const d = decide(permission, host, loadConfig().sitePermissions);
  return d === 'ask' ? ask(host, permission) : Promise.resolve(d === 'allow');
}

function install(ses) {
  ses.setPermissionRequestHandler((_wc, permission, callback, details) => {
    resolve(permission, details.requestingUrl).then(callback, () => callback(false));
  });
  // Kiểm tra đồng bộ (trang hỏi "đã được cấp chưa"): chỉ trả lời theo cái đã nhớ / tự cho
  ses.setPermissionCheckHandler((_wc, permission, origin) => decide(permission, originHost(origin), loadConfig().sitePermissions) === 'allow');
}

module.exports = { install };
