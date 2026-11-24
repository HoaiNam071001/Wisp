// Lệnh game {action}: tải lại / tắt tiếng / đưa lên trước – để kịch bản tự xử lý game treo.
const tabs = require('../../tabs');
const launcher = require('../../flash/launcher');
const flashRouter = require('../../flash-engine/router');
const { resolveTab } = require('../target');
const { fail } = require('../protocol');

module.exports = {
  async game({ action, tab, width, height }) {
    const t = resolveTab(tab, { flashOk: true }), w = t.view.webContents;
    if (launcher.isFlashTab(t.id)) {
      // focus: đưa cửa sổ engine Flash lên; tab vỏ vẫn chọn để Ghosthand thấy đúng tab
      await flashRouter.game(action, action === 'resize' ? { width, height } : undefined);
      if (action === 'focus') tabs.activateTab(t.id);
      return { tab: t.id, action, engine: 'flash' };
    }
    if (action === 'resize') fail('bad_args', 'resize chỉ cho game ở engine Flash (tab web đổi cỡ cửa sổ Wisp bằng tay)');
    if (action === 'reload') w.reload();
    else if (action === 'focus') { tabs.activateTab(t.id); w.focus(); }
    else w.setAudioMuted(action === 'mute');
    return { tab: t.id, action, engine: 'web' };
  },
};
