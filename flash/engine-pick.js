// Chọn engine cho một URL theo flashSites (logic tính ở site-config.js): 'web' | 'flash' | 'ruffle'.
const { flashSites } = require('../config');
const { FLASH_PATH } = require('./mode');
const { engineFor } = require('./site-config');

function hostOf(url) {
  try { return new URL(url).hostname; } catch { return ''; }
}
function engineForHost(host) { return engineFor(flashSites(), host, !!FLASH_PATH); }
function engineForUrl(url) { return engineForHost(hostOf(url)); }

module.exports = { engineForHost, engineForUrl };
