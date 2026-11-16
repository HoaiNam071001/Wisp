// Thử engine Flash độc lập: node scripts/flash-engine-try.js [url]  (mở 1 cửa sổ, hỏi frameRect, đóng)
const path = require('path');
const electron = require('electron');

const fs = require('fs');
const { mmsCfgContent } = require('../flash/allowlist');
const userData = path.join(__dirname, '..', '.dev-data-engine');
const env = Object.assign({}, process.env, { WISP_USER_DATA: userData });
// WISP_FLASH_PLUGIN=… WISP_FLASH_VERSION=… để nạp Flash thật; mms.cfg cho phép cf4vn.bar, cmn.vn
if (env.WISP_FLASH_PLUGIN) {
  const mms = path.join(userData, 'Pepper Data', 'Shockwave Flash', 'System', 'mms.cfg');
  fs.mkdirSync(path.dirname(mms), { recursive: true });
  fs.writeFileSync(mms, mmsCfgContent(['cf4vn.bar', 'cmn.vn'], false));
}
delete env.ELECTRON_RUN_AS_NODE;
const { EngineClient } = require('../flash-engine/client');
const { launchFor } = require('../flash-engine/launch');

(async () => {
  const c = new EngineClient(launchFor({
    electronPath: electron, userData, pluginPath: env.WISP_FLASH_PLUGIN, pluginVersion: env.WISP_FLASH_VERSION,
  }));
  for (const e of ['url', 'title', 'flash', 'closed', 'exit']) c.on(e, (d) => console.log('←', e, JSON.stringify(d)));
  await c.start();
  await c.request('open', { url: process.argv[2] || 'https://example.com/' });
  console.log('frameRect', JSON.stringify(await c.request('frameRect')));
  await new Promise((r) => setTimeout(r, Number(process.env.HOLD_MS) || 800));
  await c.stop();
})().catch((e) => { console.error(e); process.exit(1); });
