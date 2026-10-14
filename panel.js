(() => {
  if (document.getElementById('aurora-panel-host')) return;
  const host = document.createElement('div');
  host.id = 'aurora-panel-host';
  host.style.cssText = 'position:fixed;right:20px;bottom:80px;z-index:2147483647';
  const shadow = host.attachShadow({mode:'closed'});
  shadow.innerHTML = `<style>
    :host{all:initial;font:14px system-ui;color:#1c1e21}*{box-sizing:border-box}
    button,input{font:inherit}button{cursor:pointer;border:1px solid #ced0d4;border-radius:12px;background:#f0f2f5;color:#1c1e21;padding:10px 14px}button:disabled{opacity:.45;cursor:default}
    #toggle,.primary{background:linear-gradient(135deg,#1877f2,#0a5bd3);color:white;border:0;box-shadow:0 8px 24px rgba(24,119,242,.45);font-weight:650}#toggle{border-radius:999px;padding:11px 18px}#toggle.alert{background:linear-gradient(135deg,#1877f2,#0a5bd3);animation:ring 1.2s ease-in-out infinite}@keyframes ring{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}#alert{display:none;margin:0 0 12px;padding:10px 12px;border-radius:14px;background:#fff0f3;border:1px solid rgba(24,119,242,.45);color:#a3122e;font-weight:600}#alert.on{display:block}
    section{width:min(340px,calc(100vw - 40px));padding:20px;background:#ffffff;border:1px solid #dadde1;border-radius:24px;box-shadow:0 12px 50px #22103233;margin-bottom:10px}
    [hidden]{display:none}pre{white-space:pre-wrap;font:12px/1.5 ui-monospace,Consolas,monospace;background:#f4f6f7;border:1px solid #d9dde0;border-radius:10px;padding:10px;margin:10px 0 0;color:#121218}h2{margin:0;font-size:22px}p{line-height:1.5;margin:12px 0}small{color:#685d76}
    input{width:100%;padding:11px;border:1px solid #d8cae8;border-radius:10px;margin:8px 0 12px;background:white;color:#1c1e21}
    .row{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px}#status{font-weight:600}#message{overflow-wrap:anywhere}label{display:block;margin-top:15px}
  </style><section hidden><h2>✦ Aurora <small>2.0.5</small></h2><div id="alert" role="alert">🔔 Paused — needs you. Check the message, then press Resume.</div>
    <p id="status">Ready</p><p id="message" role="status" aria-live="polite">Preview a profile without sending actions. Open the full studio for live tasks.</p>
    <label for="target">Page or profile</label><input id="target" placeholder="@username">
    <button id="preview" class="primary">Preview profile</button>
    <div class="row"><button id="pause">Pause</button><button id="resume">Resume</button><button id="stop">Stop</button></div>
    <p><small>Checks up to 3 rendered posts. Preview never sends engagement actions.</small></p><div class="row"><button id="studio">Open full studio</button><button id="check">Check page</button></div><div class="row"><button id="copyReport">Copy error report</button></div><pre id="report" hidden></pre>
  </section><button id="toggle" aria-expanded="false">✦ Aurora</button>`;
  document.documentElement.append(host);
  const $ = id => shadow.getElementById(id);
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
  for(const action of ['pause','resume','stop'])$(action).onclick=()=>send(action);
  let wasPaused=false,wasRunning=false;
  function render(job){
    $('status').textContent=job?`${job.status} · ${job.done??job.liked??0} ${job.config?.dry?'previewed':job.config?.action||'actions'} · ${job.skipped||0} skipped`:'Ready';
    if(job?.message)$('message').textContent=job.message;
    const paused=job?.status==='paused',section=shadow.querySelector('section');
    $('alert').classList.toggle('on',paused);$('toggle').classList.toggle('alert',paused);
    $('toggle').textContent=paused?'🔔 Aurora needs you':job?.status==='running'?'✦ Aurora · running':'✦ Aurora';
    if(paused&&!wasPaused){section.hidden=false;$('toggle').setAttribute('aria-expanded','true');}
    const running=job?.status==='running';if(running&&!wasRunning){section.hidden=true;$('toggle').setAttribute('aria-expanded','false');}wasRunning=running;
    wasPaused=paused;
    $('preview').disabled=['running','paused'].includes(job?.status);
    $('pause').disabled=job?.status!=='running';$('resume').disabled=job?.status!=='paused';$('stop').disabled=!['running','paused'].includes(job?.status);
  }
  chrome.storage.local.get('job').then(({job})=>render(job)).catch(error=>$('message').textContent=error.message);
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.job)render(changes.job.newValue);});
})();
