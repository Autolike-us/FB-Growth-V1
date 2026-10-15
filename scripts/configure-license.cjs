#!/usr/bin/env node
// Points this extension at your Aurora website and turns license enforcement on.
//   node scripts/configure-license.cjs --api https://aurora.example.com --jwk '{"kty":"EC",...}'
// Get the JWK by running `node scripts/gen-license-key.mjs` in the Aurora site project.
const fs = require('node:fs'), path = require('node:path');
const root = path.join(__dirname, '..');
const arg = n => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : null; };
const api = (arg('api') || '').replace(/\/+$/, ''), jwkText = arg('jwk');
if (!/^https:\/\/[^/]+$/.test(api) || !jwkText) { console.error('Usage: node scripts/configure-license.cjs --api https://your-site.com --jwk \'{"kty":"EC","crv":"P-256","x":"…","y":"…"}\''); process.exit(1); }
const jwk = JSON.parse(jwkText);
if (jwk.kty !== 'EC' || jwk.crv !== 'P-256' || jwk.d) { console.error('Need the PUBLIC P-256 key (no "d" field).'); process.exit(1); }
const cfgPath = path.join(root, 'license-config.js');
let src = fs.readFileSync(cfgPath, 'utf8');
const product = /["']?product["']?\s*:\s*["']([a-z]+)["']/.exec(src)[1];
fs.writeFileSync(cfgPath, `// Written by scripts/configure-license.cjs\nglobalThis.AuroraLicenseConfig = ${JSON.stringify({ product, enforce: true, apiBase: api, siteUrl: api, supportEmail: 'support@getaurorastudios.com', publicKeyJwk: { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y } }, null, 2)};\n`);
const mPath = path.join(root, 'manifest.json'), m = JSON.parse(fs.readFileSync(mPath, 'utf8'));
m.host_permissions = [...new Set([...(m.host_permissions || []).filter(h => !h.includes('aurora.example.com') && h !== api + '/*'), api + '/*'])];
fs.writeFileSync(mPath, JSON.stringify(m, null, 2) + '\n');
console.log('License enforcement is ON for', product, '→', api);
