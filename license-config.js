// License settings. Run scripts/configure-license.cjs to point this build at your site and turn enforcement on.
// While enforce is false the extension runs unlocked (development builds only; `npm run package` refuses to build like this).
globalThis.AuroraLicenseConfig = {
  product: 'facebook',
  enforce: false,
  apiBase: 'https://aurora.example.com',
  siteUrl: 'https://aurora.example.com',
  publicKeyJwk: null,
};
