// Aurora license client. Shared by the background worker, the studio/popup pages and (read-only, via peek) the on-page panel.
// The server signs a short-lived ES256 token; it is verified here offline with the public key from license-config.js.
(() => {
  if (globalThis.AuroraLicense) return;
  const cfg = () => globalThis.AuroraLicenseConfig || {};
  const REFRESH_MS = 12 * 3600 * 1000;
  const b64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), c => c.charCodeAt(0));
  const read = async () => (await chrome.storage.local.get('license')).license || {};
  const write = async patch => { const next = { ...(await read()), ...patch }; await chrome.storage.local.set({ license: next }); return next; };
  const normalize = k => String(k || '').trim().toUpperCase();

  async function installId() {
    const st = await read();
    if (st.installId) return st.installId;
    const id = crypto.randomUUID();
    await write({ installId: id });
    return id;
  }

  async function verifyToken(jwt) {
    try {
      const jwk = cfg().publicKeyJwk;
      if (!jwk || !jwt) return null;
      const [h, p, s] = String(jwt).split('.');
      const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
      const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, b64u(s), new TextEncoder().encode(h + '.' + p));
      return ok ? JSON.parse(new TextDecoder().decode(b64u(p))) : null;
    } catch { return null; }
  }

  // Is the stored token genuine, for this product, key and browser, and not expired?
  async function tokenOk(st) {
    const p = await verifyToken(st.token);
    return !!p && p.product === cfg().product && p.sub === st.key && p.iid === st.installId && p.exp * 1000 > Date.now() ? p : null;
  }

  const unconfigured = () => ({ allowed: true, status: 'dev', message: 'License checks are switched off in this build.' });
  const needKey = () => ({ allowed: false, status: 'none', message: 'Add your Aurora license key to run live tasks. Preview works without one.' });

  // Asks the server about this key. Stores the signed token on success, or the refusal on failure. Network trouble is not a refusal.
  async function refresh() {
    const st = await read();
    if (!st.key) return { ok: false, status: 'none', message: needKey().message };
    const iid = await installId();
    let res;
    try {
      const r = await fetch(cfg().apiBase + '/api/license/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: st.key, product: cfg().product, installId: iid, version: chrome.runtime.getManifest().version }) });
      res = await r.json();
    } catch { return { ok: false, offline: true, status: st.status || 'offline', message: 'Could not reach the Aurora license server. Check your internet connection.' }; }
    if (res.ok) { await write({ token: res.token, expiresAt: res.expiresAt, status: res.status, trialEndsAt: res.trialEndsAt || null, renewsAt: res.renewsAt || null, message: res.message || '', checkedAt: Date.now() }); return { ok: true, status: res.status, message: res.message, trialEndsAt: res.trialEndsAt }; }
    await write({ token: null, expiresAt: 0, status: res.status || 'invalid', message: res.message || 'License not valid.', trialEndsAt: res.trialEndsAt || null, checkedAt: Date.now() });
    return { ok: false, status: res.status || 'invalid', message: res.message || 'License not valid.' };
  }

  // Saves a new key and verifies it right away.
  async function activate(rawKey) {
    const key = normalize(rawKey);
    if (!/^AUR-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(key)) return { ok: false, status: 'invalid', message: 'That does not look like an Aurora key (AUR-XXXX-XXXX-XXXX).' };
    await write({ key, token: null, expiresAt: 0, status: 'pending', message: '' });
    return refresh();
  }

  async function deactivate() { await write({ key: '', token: null, expiresAt: 0, status: 'none', message: '' }); }

  // The gate: may Aurora work right now? Used before every task start, resume and step.
  async function check() {
    if (!cfg().enforce) return unconfigured();
    const st = await read();
    if (!st.key) return needKey();
    const p = await tokenOk(st);
    if (p) {
      if (Date.now() - (st.checkedAt || 0) > REFRESH_MS) refresh().catch(() => {});
      return { allowed: true, status: p.status, trialEndsAt: p.trialEndsAt || st.trialEndsAt || null, message: st.message || '' };
    }
    const r = await refresh();
    return r.ok ? { allowed: true, status: r.status, trialEndsAt: r.trialEndsAt || null, message: r.message || '' } : { allowed: false, status: r.status, message: r.message };
  }

  // Same answer without touching the network (for the on-page panel).
  async function peek() {
    if (!cfg().enforce) return unconfigured();
    const st = await read();
    if (!st.key) return needKey();
    const p = await tokenOk(st);
    return p ? { allowed: true, status: p.status, trialEndsAt: p.trialEndsAt || null, message: st.message || '' } : { allowed: false, status: st.status || 'expired', message: st.message || 'Open the Aurora studio to refresh your license.' };
  }

  globalThis.AuroraLicense = { check, peek, activate, refresh, deactivate, state: read, installId };
})();
