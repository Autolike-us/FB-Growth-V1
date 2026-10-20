// Aurora comment variants: "a different comment on each post".
// The studio form takes one comment per line. For each post Aurora picks one at random and never repeats a comment until all of them
// have been used, then starts a new round (and never starts the new round with the comment it just used).
// The same post always gets the same comment, so a retry or a resume never changes it, and every task starts fresh.
globalThis.AuroraComments = {
  split(raw) {
    const seen = new Set(), out = [];
    for (const line of String(raw || '').split(/\r?\n/)) {
      const t = line.replace(/\s+/g, ' ').trim();
      if (t && !seen.has(t.toLowerCase())) { seen.add(t.toLowerCase()); out.push(t); }
    }
    return out;
  },
  async pick(c, key) {
    const list = Array.isArray(c.commentList) ? c.commentList : [];
    if (!c.commentMany || !list.length) return c.comment;
    const { commentUse } = await chrome.storage.local.get('commentUse');
    const u = commentUse && commentUse.seed === c.commentSeed ? commentUse : { seed: c.commentSeed, picks: {}, round: [], last: -1 };
    if (Number.isInteger(u.picks[key]) && list[u.picks[key]] != null) return list[u.picks[key]];
    let pool = list.map((_, i) => i).filter(i => !u.round.includes(i));
    if (!pool.length) { u.round = []; pool = list.map((_, i) => i); if (pool.length > 1) pool = pool.filter(i => i !== u.last); }
    const i = pool[Math.floor(Math.random() * pool.length)];
    u.round.push(i); u.last = i; u.picks[key] = i;
    const keys = Object.keys(u.picks); if (keys.length > 3000) for (const k of keys.slice(0, keys.length - 3000)) delete u.picks[k];
    await chrome.storage.local.set({ commentUse: u });
    return list[i];
  },
};
