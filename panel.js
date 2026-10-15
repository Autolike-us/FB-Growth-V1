(() => {
  if (document.getElementById('aurora-panel-host')) return;
  const host = document.createElement('div');
  host.id = 'aurora-panel-host';
  host.style.cssText = 'position:fixed;right:20px;bottom:80px;z-index:2147483647';
  const shadow = host.attachShadow({mode:'closed'});
  shadow.innerHTML = `<style>
    :host{all:initial;font:14px system-ui,-apple-system,"Segoe UI",sans-serif;
      --bg:#fff;--ink:#1c1e21;--muted:#65676b;--line:#dadde1;--soft:#f0f2f5;--accent:#1877f2;--ok:#12a594;--bad:#d4222a;--warnbg:#fff3d6;--warnink:#8a5200;--livebg:#ffe9ea;--liveink:#b3202a}
    *{box-sizing:border-box}
    button,input{font:inherit;color:inherit}
    button{cursor:pointer;border:1px solid var(--line);border-radius:12px;background:var(--soft);color:var(--ink);padding:9px 13px;font-weight:600}
    button:hover:not(:disabled){border-color:var(--accent)}
    button:disabled{opacity:.45;cursor:default}
    [hidden]{display:none!important}
    .primary,#toggle{background:linear-gradient(135deg,#1877f2,#0a5bd3);color:#fff;border:0;box-shadow:0 8px 24px rgba(24,119,242,.45)}
    #toggle{border-radius:999px;padding:11px 18px}
    #toggle.alert{animation:ring 1.2s ease-in-out infinite}@keyframes ring{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}
    section{width:min(340px,calc(100vw - 40px));max-height:calc(100vh - 150px);overflow-y:auto;padding:18px;background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:22px;box-shadow:0 12px 50px rgba(20,10,40,.28);margin-bottom:10px}
    header{display:flex;align-items:center;justify-content:space-between;gap:10px}
    h2{margin:0;font-size:19px}small{color:var(--muted);font-size:12px}
    .chip{display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:800;letter-spacing:.04em}
    .chip.preview{background:var(--warnbg);color:var(--warnink)}.chip.live{background:var(--livebg);color:var(--liveink)}
    #alert{margin:12px 0 0;padding:10px 12px;border-radius:14px;background:var(--livebg);color:var(--liveink);font-weight:600;line-height:1.4}
    #now{margin:12px 0 0;font-weight:650;line-height:1.4}
    #message{margin:6px 0 0;color:var(--muted);line-height:1.5;overflow-wrap:anywhere}
    progress{width:100%;height:8px;margin:12px 0 0;accent-color:var(--accent)}
    label{display:block;margin:14px 0 4px;font-weight:600;font-size:13px}
    input{width:100%;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--bg)}
    .row{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px}
    .note{margin:12px 0 0;color:var(--muted);font-size:12px;line-height:1.5}
    pre{white-space:pre-wrap;font:12px/1.5 ui-monospace,Consolas,monospace;background:var(--soft);border:1px solid var(--line);border-radius:10px;padding:10px;margin:10px 0 0;max-height:220px;overflow:auto}
    .bar{display:flex;gap:8px;justify-content:flex-end;align-items:center}
    #quickPause{border-radius:999px;padding:10px 14px;box-shadow:0 6px 18px rgba(0,0,0,.18)}
  </style>
  <section hidden>
    <header><h2>✦ Aurora <small id="ver"></small></h2><span id="chip" class="chip preview">👁 PREVIEW</span></header>
    <div id="alert" role="alert" hidden>🔔 Paused — it needs you. Check the message, then Resume or skip this target.</div>
    <p id="now" hidden></p>
    <progress id="bar" max="10" value="0" hidden></progress>
    <p id="message" role="status" aria-live="polite">Ready. Preview a page or profile without sending anything, or open the full studio for live tasks.</p>
    <div id="idle">
      <label for="target">Page or profile</label><input id="target" placeholder="@username">
      <div class="row"><button id="preview" class="primary">Preview profile</button></div>
      <p class="note">Checks up to 3 rendered posts. Preview never sends engagement actions.</p>
    </div>
    <div class="row" id="controls"><button id="pause">Pause</button><button id="resume">Resume</button><button id="skip">↷ Skip this target</button><button id="stop">Stop</button></div>
    <div class="row"><button id="studio">Open full studio</button><button id="check">Check page</button></div>
    <div class="row" id="reportRow"><button id="copyReport">Copy error report</button></div>
    <pre id="report" hidden></pre>
    <p class="note"><a id="help" target="_blank" rel="noreferrer">Report an issue or contact us</a></p>
  </section>
  <div class="bar"><button id="quickPause" hidden>⏸ Pause</button><button id="toggle" aria-expanded="false">✦ Aurora</button></div>`;
  document.documentElement.append(host);
  const $ = id => shadow.getElementById(id);
  try { $('ver').textContent = chrome.runtime.getManifest().version; } catch {}
  try { const c = (typeof AuroraLicenseConfig !== 'undefined' && AuroraLicenseConfig) || {}, v = chrome.runtime.getManifest().version, n = ({ tiktok: 'TikTok' })[c.product] || String(c.product || 'studio').replace(/^./, x => x.toUpperCase()); $('help').href = 'mailto:' + (c.supportEmail || 'support@getaurorastudios.com') + '?subject=' + encodeURIComponent('[Aurora ' + n + ' ' + v + '] Issue report or question') + '&body=' + encodeURIComponent('What happened?\n\n\n--- Details ---\nAurora ' + n + ' ' + v + ' · ' + navigator.userAgent.slice(0, 110) + '\nPage: ' + location.hostname + '\n'); } catch {}
  const profile = location.pathname.match(/^\/([\w.]+)\/?$/)?.[1];
  if (profile && !['groups','reels','reel','watch','hashtag','marketplace','search','login','friends'].includes(profile)) $('target').value=profile;
  $('toggle').onclick=()=>{const section=shadow.querySelector('section');section.hidden=!section.hidden;$('toggle').setAttribute('aria-expanded',String(!section.hidden));};
  async function send(action, extra={}) {
    try {const result=await chrome.runtime.sendMessage({action,...extra});if(!result?.ok)throw Error(result?.error||'No response from Aurora.');if(result.message)$('message').textContent=result.message;}
    catch(error){$('message').textContent=error.message+' If Aurora was updated, refresh this tab.';}
  }
  $('preview').onclick=()=>send('previewProfile',{target:$('target').value});
  $('studio').onclick=()=>send('openStudio');
  $('copyReport').onclick=async()=>{try{const t=await globalThis.AuroraReport.build(80);await navigator.clipboard.writeText(t);$('message').textContent='Error report copied. Paste it into your message.';}catch(e){$('message').textContent='Could not copy the report: '+e.message;}};
  $('check').onclick=async()=>{const r=$('report');try{const text=globalThis.AuroraDiagnose?globalThis.AuroraDiagnose():'Check unavailable on this page.';r.textContent=text;r.hidden=false;try{await navigator.clipboard.writeText(text);$('message').textContent='Page check copied to your clipboard.';}catch{$('message').textContent='Page check shown below.';}}catch(e){r.textContent='Check failed: '+e.message;r.hidden=false;}};
  for(const action of ['pause','resume','stop','skip'])$(action).onclick=()=>send(action==='skip'?'skipTarget':action);
  let wasPaused=false,wasRunning=false,lastJob=null;
  // "Target 2 of 5 · name · next in 24s", refreshed every second from the last job we saw.
  function tickNow(){
    const job=lastJob,el=$('now');
    const idx=job?.total?Math.min((job.finished?.length||0)+1,job.total):0,label=job?.queue?.[0]?.label;
    if(job?.status==='running'&&label){const s=Math.max(0,Math.round(((job.nextAt||0)-Date.now())/1000));el.textContent='▶ '+(idx?'Target '+idx+' of '+job.total+' · ':'')+label+(s?' · next in '+s+'s':' · working…');el.hidden=false;}
    else if(job?.status==='paused'&&label){el.textContent='⏸ Paused on '+(idx?'target '+idx+' of '+job.total+' · ':'')+label;el.hidden=false;}
    else el.hidden=true;
  }
  setInterval(tickNow,1000);
  function render(job){
    lastJob=job;
    const paused=job?.status==='paused',running=job?.status==='running',active=paused||running,section=shadow.querySelector('section');
    // Mode badge: the live/preview nature of the current task, or the panel's own preview-only nature when idle.
    const live=job&&job.config&&job.config.dry===false&&active;$('chip').textContent=live?'⚡ LIVE':'👁 PREVIEW';$('chip').className='chip '+(live?'live':'preview');
    if(job?.message)$('message').textContent=(job.config?.dry&&active?'Preview run — nothing is sent. ':'')+job.message;
    $('alert').hidden=!paused;$('toggle').classList.toggle('alert',paused);
    $('toggle').textContent=paused?'🔔 Aurora needs you':running?'✦ Aurora · '+(job.done||0)+'/'+(job.config?.limit||'?'):'✦ Aurora';
    if(paused&&!wasPaused){section.hidden=false;$('toggle').setAttribute('aria-expanded','true');}
    if(running&&!wasRunning){section.hidden=true;$('toggle').setAttribute('aria-expanded','false');}
    wasRunning=running;wasPaused=paused;
    // Only show what applies right now.
    $('idle').hidden=active;
    $('controls').hidden=!active;$('pause').hidden=!running;$('resume').hidden=!paused;$('skip').hidden=!(paused&&(job.queue?.length||0)>0);$('stop').hidden=!active;
    $('reportRow').hidden=!paused;
    const bar=$('bar');bar.hidden=!active;if(active){bar.max=Number(job.config?.limit)||10;bar.value=job.done||0;}
    const qp=$('quickPause');qp.hidden=!active;qp.textContent=paused?'▶ Resume':'⏸ Pause';qp.onclick=()=>send(paused?'resume':'pause');
    tickNow();
    lic();
  }
  // Locked until a valid license key has been added in the studio.
  async function lic(){try{if(typeof AuroraLicense==='undefined')return;const st=await AuroraLicense.peek(),busy=['running','paused'].includes(lastJob?.status);$('preview').disabled=busy;}catch{}}
  chrome.storage.local.get('job').then(({job})=>render(job)).catch(error=>$('message').textContent=error.message);
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.license)lic();if(area==='local'&&changes.job)render(changes.job.newValue);});
})();
