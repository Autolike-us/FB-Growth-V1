// Preview edition: this script never reads, clicks or changes anything on the page.
// It only answers the "Check page" button with what can be told from the address bar.
globalThis.AuroraDiagnose = () => {
  const p = location.pathname;
  const type = /^\/groups\//.test(p) ? 'group' : /\/(posts|permalink|videos)\//.test(p) || /story\.php/.test(p) ? 'post' : /^\/(reel|watch)/.test(p) ? 'reel or video' : /^\/marketplace/.test(p) ? 'marketplace' : /^\/hashtag\//.test(p) ? 'hashtag' : /^\/search/.test(p) ? 'search' : p === '/' ? 'home' : 'page or profile';
  return ['Aurora page check', `Page type: ${type} (from the address only)`, 'Preview edition: no page elements are read, clicked or changed.'].join('\n');
};
