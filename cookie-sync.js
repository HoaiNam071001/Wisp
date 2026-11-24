// Đồng bộ phiên game (cookie) qua Drive – mặc định TẮT, bật riêng trong cửa sổ Tài khoản.
// Hai kho cookie: web (engine chính) + flash (engine Flash, tiến trình riêng – chỉ đọc / nạp khi engine đang chạy).
// Mã hoá đầu-cuối bằng mật khẩu đồng bộ (sync-crypt.js) trước khi lên Drive; mật khẩu lưu bằng safeStorage.
// Logic gộp thuần ở sync-cookies.js.
const { session } = require('electron');
const crypt = require('./sync-crypt');
const sc = require('./sync-cookies');
const { createStore } = require('./token-store');
const { loadConfig, saveConfig, allowDomains } = require('./config');
const router = require('./flash-engine/router');

const passwordStore = createStore('sync-password.bin');
const FILE = 'sessions.enc';

// Cache trong bộ nhớ: sự kiện cookie 'changed' đến liên tục (mỗi trang), không được đọc đĩa / Keychain mỗi lần.
// Mọi chỗ đổi cấu hình đi qua update / forgetPassword (xoá cache); allowDomains đổi thì tối đa trễ CACHE_MS.
const CACHE_MS = 5000;
let cache = null;
const fresh = () => {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache;
  const c = loadConfig().cookieSync || {};
  const p = passwordStore.load();
  const s = { enabled: !!c.enabled, userDomains: sc.normalizeDomains(c.domains).domains, password: p && p.password };
  // Domain được đồng bộ = trang bật Flash + domain người dùng thêm (không bao giờ Google – sc.normalizeDomains lọc)
  s.domains = sc.normalizeDomains(allowDomains().concat(s.userDomains)).domains;
  cache = Object.assign(s, { at: Date.now() });
  return cache;
};
const settings = () => { const s = fresh(); return { enabled: s.enabled, domains: s.userDomains }; };
const password = () => fresh().password;
const domains = () => fresh().domains;
const ready = () => { const s = fresh(); return s.enabled && !!s.password; };

// Cho UI: không bao giờ trả mật khẩu
function view() {
  const s = settings();
  return { enabled: s.enabled, domains: s.domains, flashDomains: sc.normalizeDomains(allowDomains()).domains, hasPassword: !!password(), keychain: passwordStore.available() };
}

// { enabled?, domains?: string[], password? } → { ok, error? }. Bật khi chưa có mật khẩu → từ chối.
function update(p) {
  cache = null;
  const patch = Object.assign({}, loadConfig().cookieSync);
  if (Array.isArray(p.domains)) {
    const n = sc.normalizeDomains(p.domains);
    if (n.rejected.length) return { ok: false, error: 'Domain không hợp lệ (hoặc là của Google, không đồng bộ): ' + n.rejected.join(', ') };
    patch.domains = n.domains;
  }
  if (p.password !== undefined && p.password !== '') {
    const err = crypt.checkPassword(p.password);
    if (err) return { ok: false, error: err };
    try { passwordStore.save({ password: p.password }); } catch (e) { return { ok: false, error: e.message }; }
  }
  if (p.enabled !== undefined) {
    if (p.enabled && !password()) return { ok: false, error: 'Đặt mật khẩu đồng bộ trước khi bật (máy khác dùng đúng mật khẩu này để mở phiên game).' };
    patch.enabled = !!p.enabled;
  }
  saveConfig({ cookieSync: patch });
  cache = null;
  return { ok: true };
}

// Quên mật khẩu trên máy này (không xoá dữ liệu trên Drive) – tắt luôn đồng bộ
function forgetPassword() { cache = null; passwordStore.clear(); saveConfig({ cookieSync: Object.assign({}, loadConfig().cookieSync, { enabled: false }) }); }

const sameCookie = (a, b) => a && b && a.value === b.value && a.expirationDate === b.expirationDate;
const diff = (merged, local) => {
  const L = new Map((local || []).map((c) => [sc.keyOf(c), c]));
  return merged.filter((c) => !sameCookie(L.get(sc.keyOf(c)), c));
};

// Cookie này có thuộc phạm vi đồng bộ không (cho sự kiện 'changed' → đẩy sau)
const watching = (cookie) => ready() && sc.inDomains(cookie.domain, domains());

// state: { get(), set(patch) } – sync-state.json do sync.js giữ (cookieBase = hash giá trị lần đồng bộ trước)
function createKind(state) {
  let local = null, nextBase = null;
  const now = () => Math.floor(Date.now() / 1000);
  return {
    name: FILE,
    async local() {
      const d = domains();
      local = { web: sc.pick(await session.defaultSession.cookies.get({}), d), flash: await router.cookies(d) };
      return local;
    },
    merge(mine, remote) {
      // remote đã parse từ JSON của khối mã hoá → đưa lại thành chuỗi cho decrypt (sai mật khẩu → lỗi nói rõ)
      const r = remote ? JSON.parse(crypt.decrypt(JSON.stringify(remote), password())) : null;
      const m = sc.merge(mine, r, state.get().cookieBase, now());
      nextBase = m.base;
      return m.merged;
    },
    async apply(merged) {
      for (const c of diff(merged.web, local.web)) {
        const d = sc.toSetDetails(c, now());
        if (d) await session.defaultSession.cookies.set(d).catch(() => {});
      }
      const f = local.flash ? diff(merged.flash, local.flash) : merged.flash;
      if (f.length) await router.setCookies(f);
      state.set({ cookieBase: nextBase });
    },
    // mã hoá có salt ngẫu nhiên: nội dung không đổi thì giữ nguyên bản cũ, khỏi ghi lại Drive
    encode(merged, prevText) {
      const plain = JSON.stringify(merged);
      if (prevText) { try { if (crypt.decrypt(prevText, password()) === plain) return prevText; } catch { /* đổi mật khẩu: mã hoá lại */ } }
      return crypt.encrypt(plain, password());
    },
  };
}

module.exports = { FILE, view, update, forgetPassword, ready, watching, createKind };
