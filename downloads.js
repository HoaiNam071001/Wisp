// Tải file từ trang web: lưu vào thư mục Downloads (không đè file có sẵn), tiến độ ở vòng tròn trên thanh công cụ.
const { app, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const tasks = require('./progress-tasks');
const tabs = require('./tabs');
const { addLog } = require('./inspect/store');
const { uniquePath } = require('./download-name');

let seq = 0;

function install(ses) {
  ses.on('will-download', (_e, item) => {
    const id = 'download-' + (++seq);
    const file = uniquePath(app.getPath('downloads'), item.getFilename(), fs.existsSync);
    item.setSavePath(file);
    const label = 'Đang tải ' + path.basename(file);
    tasks.set(id, label, item.getTotalBytes() ? 0 : null);
    item.on('updated', () => {
      const total = item.getTotalBytes();
      tasks.set(id, label, total ? item.getReceivedBytes() / total : null);
    });
    item.once('done', (_ev, state) => {
      tasks.finish(id);
      const name = path.basename(file);
      if (state === 'completed') {
        addLog('info', 'event', 'Đã tải xong ' + file);
        tabs.toast('Đã tải xong ' + name);
        app.dock && app.dock.downloadFinished && app.dock.downloadFinished(file); // macOS: nảy icon Downloads trên Dock
      } else if (state === 'interrupted') {
        addLog('warning', 'event', 'Tải bị ngắt: ' + name);
        tabs.toast('Tải ' + name + ' bị ngắt');
      }
    });
  });
}

const openDownloadsDir = () => shell.openPath(app.getPath('downloads'));

module.exports = { install, openDownloadsDir };
