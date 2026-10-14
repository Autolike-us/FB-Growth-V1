const $=id=>document.getElementById(id); const fields=['action','reaction','comment','mode','target','perUser','limit','delay','dailyCap','exclude','dry'];
const hints={users:'Exact usernames or full page/profile links, separated by commas or new lines. Search names are not accepted.',groups:'Exact group IDs, slugs or full /groups/ links, separated by commas or new lines.',hashtag:'One hashtag (like #travel) or its hashtag link.',posts:'Full post links, separated by commas or new lines.',reels:'Full reel or video links, separated by commas or new lines.',market:'A search word (like bike). Visits the Marketplace search for it.'};
function settings(){const o=Object.fromEntries(fields.map(k=>[k,$(k).type==='checkbox'?$(k).checked:$(k).value]));return o;}
function notice(s){$('notice').textContent=s;}
async function send(action,data={}){try{if(action==='resume'){const {job}=await chrome.storage.local.get('job');if(!job?.config.dry&&job?.config.action==='like'&&job.config.reaction!=='Like'&&!await chrome.permissions.contains({permissions:['debugger']}))throw Error('Native mouse input permission is required to resume this reaction.');}const r=await chrome.runtime.sendMessage({action,...data});if(!r?.ok)throw Error(r?.error||'No response');notice(r.message||'Saved.');await render();return true;}catch(e){notice(e.message);return false;}}
function updateForm(){
 const action=$('action').value;
 for(const option of $('mode').options)option.disabled=option.value==='market'||(action==='join'&&option.value!=='groups')||(['follow','unfollow','friend'].includes(action)&&option.value!=='users');
 if(action==='join')$('mode').value='groups';if(['follow','unfollow','friend'].includes(action))$('mode').value='users';if($('mode').selectedOptions[0]?.disabled)$('mode').value='users';
 $('commentGroup').hidden=action!=='comment';$('comment').required=action==='comment';$('reactionGroup').hidden=action!=='like';
 $('actionHint').textContent={like:'Reacts to each discovered post. Pick which reaction below.',follow:'Follows each explicit page or profile.',unfollow:'Unfollows only pages/profiles you explicitly enter.',comment:'Posts your exact comment text; uncertain submissions are never retried.',friend:'Requests friendship with explicit profiles; pending requests are skipped.',join:'Joins explicit groups; membership questions/rules require your review.',share:'Shares posts to your feed using Facebook’s current default audience.'}[action];
 $('hint').textContent=hints[$('mode').value];
 // Hide what this action does not use.
 const account=['follow','unfollow','friend','join'].includes(action);
 $('perUser').parentElement.hidden=account;
 document.querySelector('label[for="mode"]').hidden=account;$('mode').hidden=account;
 $('hint').textContent=account?{follow:'Exact page/profile usernames, numeric IDs (like 100067439378570) or full links, separated by commas or new lines.',unfollow:'Exact page/profile usernames, numeric IDs or full links you already follow, separated by commas or new lines.',friend:'Profile usernames, numeric IDs (like 61572448127618) or full profile links, separated by commas or new lines.',join:'Exact group IDs, slugs or full /groups/ links, separated by commas or new lines.'}[action]:hints[$('mode').value];
 document.querySelector('label[for="target"]').textContent=({follow:'Pages / profiles to follow',unfollow:'Pages / profiles to unfollow',friend:'Profiles to send requests to',join:'Groups to join'})[action]||'Target';
 document.querySelector('label[for="perUser"]').textContent=['comment','share'].includes(action)?'Posts to '+(action==='share'?'share':'comment on')+' per target':'Posts to react to per target';
 paintMode();
 $('target').placeholder={users:'cafe.lovers, Jane Doe, or a page link',groups:'Group name or link',hashtag:'#travel',posts:'Full post links',reels:'Full reel or video links',market:'bike'}[$('mode').value];
}
$('mode').onchange=()=>{disarm();updateForm();};$('action').onchange=()=>{disarm();updateForm();rememberForm();};
let armed=null;
const startLabel=()=>$('dry').checked?'✦ Start preview':'✦ Start live task';
function disarm(){clearTimeout(armed);armed=null;$('start').textContent=startLabel();}
// Always-visible reminder of whether the next run is a harmless preview or a real, live run.
let liveTimer=null;
function paintMode(){
 const bar=$('modeBar'),dry=$('dry').checked;bar.className='modebar '+(dry?'mode-preview':'mode-live');bar.textContent='';
 // Preview stays on screen as a standing reminder. The LIVE notice is shown for 2 seconds after switching, then tucks away (the start button keeps saying "Start live task").
 clearTimeout(liveTimer);bar.hidden=false;if(!dry)liveTimer=setTimeout(()=>{if(!$('dry').checked)bar.hidden=true;},2000);
 const msg=document.createElement('span'),b=document.createElement('b');
 if(dry){b.textContent='👁 PREVIEW MODE';msg.append(b,' — Aurora only checks what it could do. Nothing will be liked, commented, followed, joined, shared or sent.');}
 else{b.textContent='⚡ LIVE MODE';msg.append(b,' — Aurora will perform real actions on your account.');}
 const btn=document.createElement('button');btn.type='button';btn.textContent=dry?'Switch to live':'Back to preview';btn.onclick=()=>{$('dry').checked=!$('dry').checked;disarm();paintMode();rememberForm();};
 bar.append(msg,btn);if(!armed)$('start').textContent=startLabel();
}
$('dry').addEventListener('change',()=>{disarm();paintMode();});
$('task').onsubmit=async e=>{e.preventDefault();const config=settings();
 if(!config.dry&&!armed){$('start').textContent='Confirm live '+config.action;notice('Live task: '+config.action+' on '+config.target+'. Up to '+config.limit+' confirmed actions. Click Confirm within 15 seconds to start.');armed=setTimeout(disarm,15000);return;}
 if(!config.dry&&config.action==='like'&&!config.reaction.endsWith('Like')){try{const granted=await chrome.permissions.contains({permissions:['debugger']});if(!granted){disarm();notice('Love and other non-Like reactions need native mouse input permission. Reload or reinstall the updated extension. No task started.');return;}}catch(e){disarm();notice('Native mouse input permission: '+e.message);return;}}
 disarm();$('start').disabled=true;notice('Starting… using your Facebook task tab. '+(config.dry?'Preview: no engagement actions will be sent.':'Live task enabled.'));const ok=await send('start',{config});await render();
 // The task runs in the site tab, so the small popup is no longer needed: close it.
 if(ok&&document.body.classList.contains('popup'))setTimeout(()=>window.close(),700);};$('save').onclick=()=>send('save',{config:settings()});
for(const action of ['pause','resume','stop'])$(action).onclick=()=>send(action);$('bannerResume').onclick=()=>send('resume');$('bannerStop').onclick=()=>send('stop');
$('theme').onclick=async()=>{document.body.classList.toggle('dark');await chrome.storage.local.set({dark:document.body.classList.contains('dark')});};
function tab(name){for(const k of ['studio','history','debug']){$(k).hidden=k!==name;$(k+'Tab').classList.toggle('selected',k===name);}if(name==='debug')renderDebug();}
$('historyTab').onclick=()=>tab('history');$('studioTab').onclick=()=>tab('studio');$('debugTab').onclick=()=>tab('debug');
async function renderDebug(){$('debugText').textContent=await AuroraReport.build(300);}
async function copyReport(button,label,lines){const text=await AuroraReport.build(lines);try{await navigator.clipboard.writeText(text);notice('Report copied. Paste it into your message.');button.textContent='Copied ✓';}catch{notice('Could not copy automatically: open the Debug log tab, select the text and copy it.');}setTimeout(()=>{button.textContent=label;},2500);}
$('debugCopy').onclick=()=>copyReport($('debugCopy'),'Copy report',300);
$('bannerCopy').onclick=()=>copyReport($('bannerCopy'),'Copy error report',120);
$('debugSave').onclick=async()=>{const url=URL.createObjectURL(new Blob([await AuroraReport.build(1500)],{type:'text/plain'}));const a=document.createElement('a');a.href=url;a.download='aurora-debug-report.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('debugClear').onclick=async()=>{const b=$('debugClear');if(b.dataset.sure!=='1'){b.dataset.sure='1';b.textContent='Click again to clear';setTimeout(()=>{b.dataset.sure='';b.textContent='Clear';},4000);return;}b.dataset.sure='';b.textContent='Clear';await chrome.storage.local.set({debugLog:[]});await renderDebug();};
let wasActive=false;
// Live stays selected across action changes; it returns to Preview only once the live task has finished or been stopped.
function backToPreviewIfDone(st,job){
 const active=['running','paused'].includes(st);
 if(wasActive&&['completed','stopped'].includes(st)&&job?.config?.dry===false&&!$('dry').checked){$('dry').checked=true;disarm();paintMode();rememberForm();notice('Task finished — back to Preview mode.');}
 wasActive=active;
}
async function render(){if(!$('debug').hidden)renderDebug();const {job,history=[]}=await chrome.storage.local.get(['job','history']);const st=job?.status||'ready';backToPreviewIfDone(st,job);document.body.dataset.status=st;document.title=(st==='paused'?'🔔 Needs you · ':st==='running'?'● Running · ':st==='completed'?'✓ Done · ':'')+'Aurora';
 const banner=$('banner'),bad=st==='paused',good=st==='completed';banner.hidden=!(bad||good);banner.classList.toggle('ok',good);
 $('bannerRecordReaction').hidden=!(bad&&job?.config.action==='like'&&job?.queue?.[0]?.kind==='engage');$('bannerRetryReaction').hidden=!(bad&&job?.config.action==='like'&&job?.queue?.[0]?.kind==='engage');if(bad||good){$('bannerTitle').textContent=bad?'🔔 Aurora paused — it needs you':(job.config?.dry?'👁 Preview complete — nothing was sent':'✓ Session complete');$('bannerText').textContent=(good&&job.config?.dry?'This was only a preview, so no likes, comments, follows, joins or shares were made. To run it for real, untick “Preview only” (or press “Switch to live”) and start again. ':'')+(job.message||'');$('bannerResume').hidden=!bad;$('bannerStop').hidden=!bad;$('bannerCopy').hidden=!bad;}
 $('liked').textContent=job?.done??job?.liked??0;$('skipped').textContent=job?.skipped||0;$('status').textContent=job?.status||'Ready';$('message').textContent=(job?.config?.dry&&job?.status&&job.status!=='ready'?'👁 Preview run — nothing was sent. ':'')+(job?.message||'Your next session starts here.');$('progress').max=Number(job?.config.limit)||10;{const left=job?.queue?.length||0,secs=left*(Number(job?.config?.delay)||30)*1.2,active=['running','paused'].includes(job?.status);$('eta').textContent=active&&left?`${left} step${left===1?'':'s'} left · about ${secs<90?'1':Math.round(secs/60)} min`:'';}$('progress').value=job?.done??job?.liked??0;$('start').disabled=['running','paused'].includes(job?.status);$('pause').disabled=job?.status!=='running';$('resume').disabled=job?.status!=='paused';$('stop').disabled=!['running','paused'].includes(job?.status);$('events').replaceChildren(...history.slice(-200).reverse().map(e=>{const d=document.createElement('div');d.className='event';d.textContent=new Date(e.time).toLocaleString()+' · '+e.message;if(e.url){const a=document.createElement('a');a.href=e.url;a.target='_blank';a.rel='noreferrer';a.textContent=' Open post';d.append(a);}return d;}));}
$('clearHistory').onclick=async()=>{if($('clearHistory').dataset.sure!=='1'){$('clearHistory').dataset.sure='1';$('clearHistory').textContent='Click again to clear';setTimeout(()=>{$('clearHistory').dataset.sure='';$('clearHistory').textContent='Clear history';},4000);return;}$('clearHistory').dataset.sure='';$('clearHistory').textContent='Clear history';await chrome.storage.local.set({history:[]});await render();};$('export').onclick=async()=>{const {history=[]}=await chrome.storage.local.get('history');const cell=v=>{let t=String(v??'');if(/^[=+\-@\t\r]/.test(t))t="'"+t;return '"'+t.replace(/"/g,'""')+'"';};const csv=['time,event,url',...history.map(e=>[new Date(e.time).toISOString(),e.message,e.url].map(cell).join(','))].join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));const a=document.createElement('a');a.href=url;a.download='aurora-history.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
(async()=>{const {config:saved,draft,dark}=await chrome.storage.local.get(['config','draft','dark']);const config=draft||saved;if(config)for(const k of fields){if(config[k]!==undefined){if($(k).type==='checkbox')$(k).checked=config[k];else $(k).value=config[k];}}$('dry').checked=draft?.dry!==false;$('dry').disabled=false;document.body.classList.toggle('dark',dark!==false);$('mode').onchange();await render();})();chrome.storage.onChanged.addListener(async changes=>{await render();if(changes?.job?.newValue?.message)notice(changes.job.newValue.message);});window.addEventListener('unhandledrejection',e=>notice('Extension error: '+(e.reason?.message||e.reason)));document.querySelectorAll('input,textarea,select').forEach(el=>el.addEventListener('input',()=>{if(armed)disarm();}));document.querySelectorAll('input,textarea,select').forEach(el=>el.addEventListener('invalid',()=>notice('Check the highlighted field: '+el.id),true));
// ---- Remembered form, reset and named setups ---------------------------------------------------------------
const DEFAULTS=settings();
function applyFields(c){for(const k of fields){if(c?.[k]===undefined)continue;if($(k).type==='checkbox')$(k).checked=!!c[k];else $(k).value=c[k];}$('dry').checked=true;updateForm();}
let draftTimer=null;
function rememberForm(){clearTimeout(draftTimer);draftTimer=setTimeout(()=>chrome.storage.local.set({draft:settings()}).catch(()=>{}),250);}
document.querySelectorAll('#task input,#task textarea,#task select').forEach(el=>{el.addEventListener('input',rememberForm);el.addEventListener('change',rememberForm);});
const sure={};
function twice(btn,label,run){if(sure[btn.id]){clearTimeout(sure[btn.id].t);btn.textContent=sure[btn.id].text;delete sure[btn.id];return run();}sure[btn.id]={text:btn.textContent,t:setTimeout(()=>{btn.textContent=sure[btn.id]?.text||btn.textContent;delete sure[btn.id];},5000)};btn.textContent=label;}
async function getPresets(){return (await chrome.storage.local.get('presets')).presets||{};}
async function renderPresets(keep){const p=await getPresets(),sel=$('presetList'),names=Object.keys(p).sort((a,b)=>a.localeCompare(b));sel.textContent='';const first=document.createElement('option');first.value='';first.textContent=names.length?'— choose a saved setup —':'— no saved setups yet —';sel.append(first);for(const n of names){const o=document.createElement('option');o.value=n;o.textContent=n;sel.append(o);}if(keep&&p[keep])sel.value=keep;}
$('presetSave').onclick=async()=>{const name=$('presetName').value.trim();if(!name){notice('Type a name for this setup first.');return;}const p=await getPresets();const run=async()=>{p[name]=settings();await chrome.storage.local.set({presets:p});await renderPresets(name);$('presetName').value='';notice('Saved setup “'+name+'”.');};if(p[name])twice($('presetSave'),'Click again to overwrite “'+name+'”',run);else await run();};
$('presetLoad').onclick=async()=>{const n=$('presetList').value;if(!n){notice('Choose a saved setup first.');return;}const p=await getPresets();if(!p[n]){notice('That setup no longer exists.');await renderPresets();return;}applyFields(p[n]);rememberForm();notice('Loaded “'+n+'”. Preview only is on — untick it to run live.');};
$('presetDelete').onclick=async()=>{const n=$('presetList').value;if(!n){notice('Choose a saved setup first.');return;}twice($('presetDelete'),'Click again to delete',async()=>{const p=await getPresets();delete p[n];await chrome.storage.local.set({presets:p});await renderPresets();notice('Deleted “'+n+'”.');});};
$('presetRename').onclick=async()=>{const n=$('presetList').value,to=$('presetName').value.trim();if(!n){notice('Choose a saved setup first.');return;}if(!to){notice('Type the new name in the name box.');return;}const p=await getPresets();if(p[to]&&to!==n){notice('A setup named “'+to+'” already exists.');return;}p[to]=p[n];if(to!==n)delete p[n];await chrome.storage.local.set({presets:p});await renderPresets(to);$('presetName').value='';notice('Renamed to “'+to+'”.');};
$('reset').onclick=()=>twice($('reset'),'Click again to reset the form',async()=>{clearTimeout(draftTimer);disarm();applyFields(DEFAULTS);paintMode();await chrome.storage.local.remove('draft');notice('Form reset to defaults. Saved setups and history were kept.');});
renderPresets();

$('bannerRetryReaction').onclick=()=>send('allowReactionRetry');

$('bannerRecordReaction').onclick=()=>send('recordSuccessfulReaction');

try{document.querySelectorAll('header .badge').forEach(b=>{b.textContent='✦ v'+chrome.runtime.getManifest().version+' · Preview + live actions';});}catch{}
