// Gắn urls.js với đường dẫn + chế độ Flash / Ruffle thật của app.
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { PLAYER_PATH, createUrls } = require('./urls');
const { MODE } = require('./flash/mode');

const HISTORY_URL = pathToFileURL(path.join(__dirname, 'history.html')).href;
const LAUNCHER_URL = pathToFileURL(path.join(__dirname, 'flash-launcher.html')).href;

module.exports = {
  HISTORY_URL, LAUNCHER_URL, PLAYER_PATH,
  ...createUrls({
    historyUrl: HISTORY_URL, launcherUrl: LAUNCHER_URL, appDir: __dirname, homeDir: () => app.getPath('home'),
    ruffle: MODE === 'ruffle', isWin: process.platform === 'win32', exists: fs.existsSync,
  }),
};
