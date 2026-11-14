// Bản build dùng cá nhân: như cấu hình "build" trong package.json, nhưng kèm plugin Flash
// (plugins/PepperFlashPlayer.plugin) vào app. Lần đầu chạy, app tự chép plugin sang
// ~/Library/Application Support/Wisp/plugins/. KHÔNG phát hành công khai bản này.
const base = require('./package.json').build;

module.exports = {
  ...base,
  artifactName: '${productName}-${version}-personal.${ext}',
  extraResources: [{ from: 'plugins', to: 'plugins', filter: ['PepperFlashPlayer.plugin/**'] }],
};
