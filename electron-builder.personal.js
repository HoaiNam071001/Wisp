// Bản build dùng cá nhân: như cấu hình "build" trong package.json, nhưng kèm plugin Flash vào app
// (macOS: plugins/PepperFlashPlayer.plugin; Windows: plugins/pepflashplayer.dll, bản 64-bit).
// Lần đầu chạy, app tự chép plugin sang thư mục dữ liệu (…/Wisp/plugins/). KHÔNG phát hành công khai bản này.
const base = require('./package.json').build;

module.exports = {
  ...base,
  artifactName: '${productName}-${version}-personal.${ext}',
  nsis: { ...base.nsis, artifactName: '${productName}-${version}-win-personal-setup.${ext}' },
  mac: { ...base.mac, extraResources: [{ from: 'plugins', to: 'plugins', filter: ['PepperFlashPlayer.plugin/**'] }] },
  win: { ...base.win, extraResources: [{ from: 'plugins', to: 'plugins', filter: ['pepflashplayer.dll'] }] },
};
