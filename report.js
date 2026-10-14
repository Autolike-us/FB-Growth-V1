// Builds the plain-text debug report people can copy and send for support.
// Contains: version, browser, task settings, and the activity log. No cookies, tokens, passwords or the signed-in account name.
globalThis.AuroraReport={
 stamp(t){return new Date(t).toISOString().replace('T',' ').slice(5,19);},
 async build(max=150){
  const m=chrome.runtime.getManifest();
  const {debugLog=[],job,daily}=await chrome.storage.local.get(['debugLog','job','daily']);
  const c=job?.config||{};
  const head=[
   'Aurora debug report',
   `${m.name} v${m.version}`,
   `Generated: ${new Date().toISOString()}`,
   `Browser: ${navigator.userAgent}`,
   job?`Task: status=${job.status} action=${c.action} mode=${c.mode} preview=${!!c.dry} done=${job.done||0}/${c.limit} skipped=${job.skipped||0} steps-left=${job.queue?.length||0} retries=${job.retries||0} interrupted=${!!job.inFlight} delay=${c.delay}s dailyCap=${c.dailyCap||0} today=${daily?.count||0}`:'Task: none',
   job?.message?`Last message: ${job.message}`:''
  ].filter(Boolean);
  const lines=debugLog.slice(-max).map(e=>`${this.stamp(e.t)} ${String(e.l||'info').toUpperCase().padEnd(5)} ${e.m}${e.d?'\n      '+String(e.d).replace(/\n/g,'\n      '):''}`);
  return head.join('\n')+`\n--- last ${lines.length} of ${debugLog.length} events ---\n`+(lines.join('\n')||'(no events yet)');
 }
};
