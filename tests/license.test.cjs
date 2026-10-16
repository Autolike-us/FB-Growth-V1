// Offline tests of the license client: real ES256 signatures, stubbed storage and network.
const test = require('node:test'), assert = require('node:assert/strict'), vm = require('node:vm'), fs = require('node:fs'), path = require('node:path');
const { webcrypto } = require('node:crypto');
const ROOT = path.join(__dirname, '..'), read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const PRODUCT = /["']?product["']?\s*:\s*["']([a-z]+)["']/.exec(read('license-config.js'))[1];
const b64u = b => Buffer.from(b).toString('base64url');

async function signer() {
  const pair = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const jwk = await webcrypto.subtle.exportKey('jwk', pair.publicKey);
  const sign = async payload => { const h = b64u(JSON.stringify({ alg: 'ES256' })), p = b64u(JSON.stringify(payload)); const sig = await webcrypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey, Buffer.from(h + '.' + p)); return h + '.' + p + '.' + b64u(sig); };
  return { jwk: { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y }, sign };
}

function env({ jwk, enforce = true, fetchImpl }) {
  const data = {};
  const chrome = { storage: { local: { get: async k => { const o = {}; [].concat(k).forEach(x => { if (x in data) o[x] = structuredClone(data[x]); }); return o; }, set: async o => Object.assign(data, structuredClone(o)) } }, runtime: { getManifest: () => ({ version: '1.0.0' }) } };
  const ctx = vm.createContext({ chrome, crypto: webcrypto, atob, TextEncoder, TextDecoder, Date, JSON, console, fetch: fetchImpl || (async () => { throw new Error('offline'); }) });
  vm.runInContext(`globalThis.AuroraLicenseConfig=${JSON.stringify({ product: PRODUCT, enforce, apiBase: 'https://aurora.test', siteUrl: 'https://aurora.test', publicKeyJwk: jwk })};`, ctx);
  vm.runInContext(read('license.js'), ctx);
  return { L: ctx.AuroraLicense, data };
}
const KEY = 'AUR-AAAA-BBBB-CCCC';
const inHours = h => Math.floor(Date.now() / 1000) + h * 3600;

test('builds with enforcement off run unlocked', async () => { const { L } = env({ jwk: null, enforce: false }); assert.equal((await L.check()).allowed, true); });
test('with enforcement on and no key, nothing runs', async () => { const { L } = env({ jwk: null }); const r = await L.check(); assert.equal(r.allowed, false); assert.equal(r.status, 'none'); assert.match(r.message, /license key/i); });
test('malformed keys are rejected before any network call', async () => { let called = false; const { L } = env({ jwk: null, fetchImpl: async () => { called = true; } }); const r = await L.activate('hello'); assert.equal(r.ok, false); assert.equal(called, false); });

test('a valid signed token for this product works offline', async () => {
  const s = await signer(); const { L, data } = env({ jwk: s.jwk });
  const iid = await L.installId();
  data.license = { ...data.license, key: KEY, token: await s.sign({ product: PRODUCT, sub: KEY, iid, status: 'trial', exp: inHours(48) }), checkedAt: Date.now() };
  const r = await L.check(); assert.equal(r.allowed, true); assert.equal(r.status, 'trial');
  assert.equal((await L.peek()).allowed, true);
});

test('tokens for another product, key or browser, expired, or forged are refused (and trigger a server check)', async () => {
  const s = await signer(), other = await signer();
  for (const [name, mk] of [
    ['other product', (iid, sg) => sg.sign({ product: PRODUCT === 'tiktok' ? 'facebook' : 'tiktok', sub: KEY, iid, status: 'active', exp: inHours(48) })],
    ['other key', (iid, sg) => sg.sign({ product: PRODUCT, sub: 'AUR-ZZZZ-ZZZZ-ZZZZ', iid, status: 'active', exp: inHours(48) })],
    ['other browser', (_iid, sg) => sg.sign({ product: PRODUCT, sub: KEY, iid: 'someone-else', status: 'active', exp: inHours(48) })],
    ['expired', (iid, sg) => sg.sign({ product: PRODUCT, sub: KEY, iid, status: 'active', exp: inHours(-1) })],
    ['forged signature', (iid) => other.sign({ product: PRODUCT, sub: KEY, iid, status: 'active', exp: inHours(48) })],
  ]) {
    const { L, data } = env({ jwk: s.jwk }); const iid = await L.installId();
    data.license = { ...data.license, key: KEY, token: await mk(iid, s), checkedAt: Date.now() };
    const r = await L.check(); assert.equal(r.allowed, false, name);
  }
});

test('activate stores the signed token the server returns', async () => {
  const s = await signer(); let body;
  const { L } = env({ jwk: s.jwk, fetchImpl: async (_u, init) => { body = JSON.parse(init.body); const iid = body.installId; return { json: async () => ({ ok: true, status: 'trial', token: await s.sign({ product: body.product, sub: body.key, iid, status: 'trial', exp: inHours(72) }), expiresAt: Date.now() + 72 * 3600e3, trialEndsAt: '2099-01-01T00:00:00Z', message: 'Free trial: 3 days left.' }) }; } });
  const r = await L.activate(KEY.toLowerCase()); assert.equal(r.ok, true); assert.equal(body.key, KEY); assert.equal(body.product, PRODUCT);
  assert.equal((await L.check()).allowed, true);
});

test('a server refusal removes access and keeps the reason', async () => {
  const s = await signer();
  const { L, data } = env({ jwk: s.jwk, fetchImpl: async () => ({ json: async () => ({ ok: false, status: 'expired', message: 'Your 3-day trial has ended.' }) }) });
  const iid = await L.installId();
  data.license = { ...data.license, key: KEY, token: await s.sign({ product: PRODUCT, sub: KEY, iid, status: 'trial', exp: inHours(-2) }) };
  const r = await L.check(); assert.equal(r.allowed, false); assert.equal(r.status, 'expired'); assert.match(r.message, /trial has ended/);
  assert.equal(data.license.token, null);
});

test('being offline never grants access with an expired token, and never wipes a valid one', async () => {
  const s = await signer(); const { L, data } = env({ jwk: s.jwk });
  const iid = await L.installId();
  data.license = { ...data.license, key: KEY, token: await s.sign({ product: PRODUCT, sub: KEY, iid, status: 'active', exp: inHours(-1) }) };
  assert.equal((await L.check()).allowed, false);
  data.license.token = await s.sign({ product: PRODUCT, sub: KEY, iid, status: 'active', exp: inHours(30) }); data.license.checkedAt = 0;
  assert.equal((await L.check()).allowed, true); // stale check time triggers a background refresh that fails offline; the token still works
  assert.ok(data.license.token);
});

test('a server error reply is reported with its HTTP status and never treated as an invalid key', async () => { const s = await signer(); const { L, data } = env({ jwk: s.jwk, fetchImpl: async () => ({ status: 500, json: async () => ({ ok: false, error: 'Something went wrong. Please try again.' }) }) }); const r = await L.activate('AUR-AAAA-BBBB-CCCC'); assert.equal(r.ok, false); assert.equal(r.offline, true); assert.match(r.message, /HTTP 500/); assert.match(r.message, /Something went wrong/); assert.notEqual(data.license?.status, 'invalid'); });
test('a non-JSON reply (for example a firewall page) is reported as an unexpected reply', async () => { const s = await signer(); const { L } = env({ jwk: s.jwk, fetchImpl: async () => ({ status: 406, json: async () => { throw new Error('not json'); } }) }); const r = await L.activate('AUR-AAAA-BBBB-CCCC'); assert.equal(r.ok, false); assert.match(r.message, /HTTP 406/); });
