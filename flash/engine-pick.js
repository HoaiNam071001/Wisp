// Chọn engine cho một URL theo flashSites (logic tính ở site-config.js): 'web' | 'flash'.
const { flashSites } = require('../config');
const { engineFor } = require('./site-config');

function hostOf(url) {
  try { return new URL(url).hostname; } catch { return ''; }
}
function engineForUrl(url) { return engineFor(flashSites(), hostOf(url)); }

module.exports = { engineForUrl };
