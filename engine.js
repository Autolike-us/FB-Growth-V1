// Planning for the preview edition. Turns what you typed into plain Facebook addresses. Nothing here clicks or reads a page.
globalThis.AuroraEngine = {
  FB_HOST: /^(?:[a-z0-9-]+\.)*(?:facebook\.com|fb\.com|fb\.me)$/i,
  VERB: {like:'react to',follow:'follow',unfollow:'unfollow',comment:'comment on',friend:'send a friend request to',join:'join',share:'share'},
  resolve(raw, mode) {
    const t = String(raw).trim().replace(/^@/, ''); if (!t) return null;
    if (/^https?:\/\//i.test(t) || /^(?:www\.|m\.)?(?:facebook|fb)\.com\//i.test(t)) {
      let u; try { u = new URL(/^https?:/i.test(t) ? t : 'https://' + t); } catch { throw Error('“' + t + '” is not a valid link.'); }
      if (!this.FB_HOST.test(u.hostname)) throw Error('“' + t + '” is not a Facebook link.');
      u.protocol = 'https:'; u.hostname = 'www.facebook.com'; u.hash = '';
      return { label: (u.pathname.replace(/\/+$/, '') || '/').slice(0, 80), url: u.toString() };
    }
    if (mode === 'posts' || mode === 'reels') throw Error('“' + t + '” needs a full link.');
    if (mode === 'market') return { label: t, url: 'https://www.facebook.com/marketplace/search?query=' + encodeURIComponent(t) };
    if (mode === 'hashtag') { const h = t.replace(/^#/, ''); if (!/^[\p{L}\p{N}_]+$/u.test(h)) throw Error('Enter one hashtag, like #travel.'); return { label: '#' + h, url: 'https://www.facebook.com/hashtag/' + encodeURIComponent(h) }; }
    if (/^[A-Za-z0-9.\-]{3,}$/.test(t)) return { label: t, url: 'https://www.facebook.com/' + (mode === 'groups' ? 'groups/' : '') + t };
    return { label: t, url: 'https://www.facebook.com/search/' + (mode === 'groups' ? 'groups' : 'top') + '?q=' + encodeURIComponent(t) };
  },
  config(input) {
    const c = { ...input, action: input.action || 'like', dry: true };
    if (!this.VERB[c.action]) throw Error('Choose an action.');
    for (const key of ['perUser', 'limit', 'delay', 'dailyCap']) {
      c[key] = Number(c[key] ?? 0); const min = key === 'dailyCap' ? 0 : key === 'delay' ? 30 : 1; const max = key === 'delay' ? 86400 : key === 'dailyCap' ? 10000 : 100000;
      if (!Number.isInteger(c[key]) || c[key] < min || c[key] > max) throw Error(`Check ${key}: enter a whole number from ${min} to ${max}.`);
    }
    c.exclude = String(c.exclude || '').split(/[,\n]+/).map(x => x.trim().toLowerCase()).filter(Boolean);
    c.comment = String(c.comment || '').trim(); c.reaction = String(c.reaction || '👍 Like');
    if (c.action === 'comment' && (!c.comment || c.comment.length > 2000)) throw Error('Enter your comment text (1–2000 characters).');
    if (c.action === 'unfollow' && c.mode !== 'users') throw Error('Unfollow uses your explicit list of pages and profiles.');
    if (c.action === 'join' && c.mode !== 'groups') throw Error('Joining uses the Groups source.');
    return c;
  },
  initial(c) {
    const value = String(c.target || '').trim(); if (!value) throw Error('Enter a target.');
    const parts = [...new Set(value.split(/[\n,]+/).map(x => x.trim()).filter(Boolean))].slice(0, 500);
    const single = ['posts', 'reels'].includes(c.mode) || ['follow', 'unfollow', 'friend', 'join'].includes(c.action);
    const steps = [];
    for (const raw of parts) {
      if (c.exclude.includes(raw.toLowerCase().replace(/^@/, ''))) continue;
      const r = this.resolve(raw, c.mode); if (!r) continue;
      const n = single ? 1 : c.perUser;
      for (let k = 1; k <= n; k++) steps.push({ kind: 'visit', url: r.url, label: r.label, k, n });
    }
    return steps;
  },
  describe(step, c) {
    const what = c.action === 'like' ? ` (${c.reaction})` : c.action === 'comment' ? ` — “${c.comment.slice(0, 60)}”` : '';
    const where = step.n > 1 ? `post ${step.k} of “${step.label}”` : `“${step.label}”`;
    return `Preview: would ${this.VERB[c.action]} ${where}${what}. Nothing was clicked.`;
  }
};
