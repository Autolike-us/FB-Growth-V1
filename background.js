importScripts('selectors.js','engine.js','license-config.js','license.js');
const base='https://www.facebook.com/';
let busy=false;
// Errors raised before any click is sent; safe to retry while Facebook finishes rendering.
const RETRYABLE=/did not render this page|No posts appeared|Post content did not render/;
// Pauses that need a person (not a one-click Resume).
const NEEDS_HUMAN=/captcha|verify|verification|restricted|Sign in|Daily cap|interrupted|restarted|unknown/i;
const HISTORY_MAX=5000,RECEIPT_MAX_AGE=90*864e5,LOG_MAX=1500;
const BADGE={running:['ON','#1fae7c'],paused:['!','#1877f2'],completed:['✓','#7b5cf0']};
function badge(job){const b=BADGE[job?.status];chrome.action.setBadgeText({text:b?b[0]:''});if(b)chrome.action.setBadgeBackgroundColor({color:b[1]});}
const save=job=>{badge(job);return chrome.storage.local.set({job});};
chrome.storage.local.get('job').then(({job})=>badge(job));

// Debug log: a rolling record of what Aurora did and what the page looked like when something went wrong (see report.js).
let logChain=Promise.resolve();
function dlog(level,msg,data){
 const e={t:Date.now(),l:level,m:String(msg).slice(0,600)};if(data!==undefined&&data!=='')e.d=String(typeof data==='string'?data:JSON.stringify(data)).slice(0,2500);
 logChain=logChain.then(async()=>{const {debugLog=[]}=await chrome.storage.local.get('debugLog');debugLog.push(e);await chrome.storage.local.set({debugLog:debugLog.slice(-LOG_MAX)});}).catch(()=>{});
 return logChain;
}
const short=u=>{try{const x=new URL(u),q=new URLSearchParams();for(const k of ['story_fbid','fbid','id','v'])if(x.searchParams.has(k))q.set(k,x.searchParams.get(k));return x.origin+x.pathname+(q.size?'?'+q:'');}catch{return String(u||'').split('?')[0];}};
const ctx=r=>[r?.trace?.length?'page trace: '+r.trace.join(' | '):'',r?.stack?'page error stack:\n'+r.stack:'',r?.diag||''].filter(Boolean).join('\n');
globalThis.addEventListener?.('unhandledrejection',e=>dlog('error','Unhandled error in background',String(e.reason?.stack||e.reason).split('\n').slice(0,5).join('\n')));

// One status notification that is replaced, never stacked.
const NOTE='aurora-status';
async function notify(title,message,{resume=false}={}){
 const o={type:'basic',iconUrl:'icons/icon128.png',title,message:String(message||'').slice(0,250),priority:2,requireInteraction:true};
 try{await chrome.notifications.create(NOTE,resume?{...o,buttons:[{title:'Resume'},{title:'Open studio'}]}:o);}
 catch{try{await chrome.notifications.create(NOTE,o);}catch{}}
}
async function openStudio(){const url=chrome.runtime.getURL('dashboard.html');const [t]=await chrome.tabs.query({url});if(t){await chrome.tabs.update(t.id,{active:true});await chrome.windows.update(t.windowId,{focused:true});}else await chrome.tabs.create({url});}
chrome.notifications.onClicked.addListener(async id=>{chrome.notifications.clear(id);await openStudio();});
chrome.notifications.onButtonClicked.addListener(async(id,index)=>{chrome.notifications.clear(id);if(index===0){try{await resumeTask();}catch{await openStudio();}}else await openStudio();});

async function log(message,url){const {history=[]}=await chrome.storage.local.get('history');history.push({time:Date.now(),message,url});await chrome.storage.local.set({history:history.slice(-HISTORY_MAX)});}
let wakeTimer=null;
async function schedule(job){const delay=Math.max(1000,(job.nextAt||0)-Date.now());await chrome.alarms.create('step',{when:Date.now()+delay});clearTimeout(wakeTimer);if(delay<30000)wakeTimer=setTimeout(()=>tick(),delay);}

// Wait after each counted action (like/follow/comment, or a preview of one): never shorter than the user's setting, plus 0-40% random extra so the rhythm is not mechanical.
const pause=job=>Math.round(job.config.delay*1000*(1+Math.random()*0.4));
// Short, natural pause used after reading a profile or skipping a post (nothing was sent), so the first action starts quickly.
const quick=()=>Math.round((4+Math.random()*5)*1000);

// Optional daily cap on live actions (0 = off).
const today=()=>new Date().toDateString();
async function dailyCount(){const {daily}=await chrome.storage.local.get('daily');return daily?.day===today()?daily.count:0;}
async function bumpDaily(){await chrome.storage.local.set({daily:{day:today(),count:(await dailyCount())+1}});}

// Bring the task tab to the front so a captcha can be solved right away.
async function focusTab(job){try{await chrome.tabs.update(job.tabId,{active:true});const t=await chrome.tabs.get(job.tabId);await chrome.windows.update(t.windowId,{focused:true,drawAttention:true});}catch{}}
// Live mode is remembered in the studio form until the task is done; then the next form opens in Preview again.
async function draftToPreview(){try{const {draft}=await chrome.storage.local.get('draft');if(draft&&draft.dry===false)await chrome.storage.local.set({draft:{...draft,dry:true}});}catch{}}
// Per-target progress for the studio's Live session card.
function closeStep(job,step,r){(job.finished??=[]).push({label:step.label||short(step.url),state:step.kind==='feed'?((step.count||0)>0?'done':'skipped'):(r&&(r.performed||r.preview)?'done':'skipped'),n:step.count||0});if(job.finished.length>200)job.finished.shift();}
async function finish(job){
 job.status='completed';if(!job.config.dry)await draftToPreview();job.message=`Session complete: ${job.done||0} ${job.config.dry?'previewed':'actions confirmed'}, ${job.skipped||0} skipped.`;
 await save(job);await log(job.message);await dlog('info','Task finished: '+job.message);await chrome.alarms.clear('step');await notify('Aurora finished ✓',job.message);
}
// Send a step to the task tab; if the content script is missing (extension reloaded, tab opened earlier), attach it once and retry.
async function sendStep(job,step){
 const msg={action:'step',step,config:job.config,jobId:job.id,seen:job.seen||[]};
 try{return await chrome.tabs.sendMessage(job.tabId,msg);}
 catch(err){
  await dlog('warn','Page script not reachable, re-attaching it',String(err?.message||err));
  try{await chrome.scripting.executeScript({target:{tabId:job.tabId},files:['selectors.js','engine.js','dom.js','comments.js','content.js']});return await chrome.tabs.sendMessage(job.tabId,msg);}
  catch(err2){throw Error('Facebook content script is unavailable. Refresh the task tab and resume.'+(err2?.message?' ('+String(err2.message).slice(0,120)+')':''));}
 }
}
async function tick(){
 if(busy)return;busy=true;
 try{
  const {job}=await chrome.storage.local.get('job');if(job?.status!=='running')return;
  if(!job.queue.length||(job.done||0)>=job.config.limit){await finish(job);return;}
  if(job.config.dry===false){const lic=await AuroraLicense.check();if(!lic.allowed)throw Error('License: '+lic.message);}
  if(job.inFlight)throw Error('The last action was interrupted and its outcome is unknown. Check Facebook manually, stop this task, and create a new task for remaining targets.');
  if(Date.now()<(job.nextAt||0)){await schedule(job);return;}
  const step=job.queue[0];let tab;try{tab=await chrome.tabs.get(job.tabId);}catch{throw Error('The task tab was closed. Resume to open a new tab.');}
  if(tab.status!=='complete'){job.nextAt=Date.now()+2000;await save(job);await schedule(job);return;}
  if(/\/(?:login|checkpoint|recover)(?:[/?]|$)/.test(tab.url||''))throw Error('Sign in or complete verification on Facebook, then resume.');
  // A page opened by numeric ID (profile.php?id=…) is often redirected by Facebook to its username. Follow that redirect instead of stopping.
  if(job.navigation?.target===step.url&&job.navigation.attempts>=2&&['account','feed'].includes(step.kind)){const landed=AuroraSelectors.profileURL(tab.url);if(landed&&AuroraSelectors.profileURL(step.url)&&AuroraSelectors.pageKey(landed)!==AuroraSelectors.pageKey(step.url)){await dlog('info','Facebook redirected '+short(step.url)+' to '+short(landed)+'; continuing there');step.url=landed;job.navigation=null;}}
  if(AuroraSelectors.pageKey(tab.url)!==AuroraSelectors.pageKey(step.url)){
   if(job.navigation?.target===step.url&&job.navigation.attempts>=2)throw Error('Facebook redirected away from this target. Check the task tab and resume; Aurora stopped retrying the URL.');
   job.navigation={target:step.url,attempts:job.navigation?.target===step.url?job.navigation.attempts+1:1};job.message='Opening '+step.url;job.nextAt=Date.now()+2000;await save(job);await dlog('info','Opening '+short(step.url)+(job.navigation.attempts>1?` (attempt ${job.navigation.attempts})`:''));await chrome.tabs.update(job.tabId,{url:step.url,active:true});await schedule(job);return;
  }

  const action=['account','engage','feed'].includes(step.kind)&&!job.config.dry;
  if(action&&job.config.dailyCap&&await dailyCount()>=job.config.dailyCap)throw Error(`Daily cap reached (${job.config.dailyCap} actions today). Resume tomorrow or raise the cap in the studio.`);
  job.navigation=null;job.message='Reading Facebook: '+step.kind;await save(job);
  if(action){job.inFlight=true;await save(job);}
  await dlog('info',`Step ${step.kind} ${short(step.url)}${job.config.dry?' [preview]':''}`);
  const r=await sendStep(job,step);
  const latest=(await chrome.storage.local.get('job')).job;if(latest?.id!==job.id)return;const interrupted=latest.status!=='running';if(interrupted)job.status=latest.status;
  job.inFlight=false;await save(job);
  if(r?.error&&RETRYABLE.test(r.error)&&(job.retries||0)<3){job.retries=(job.retries||0)+1;job.message=`Facebook was still loading (${r.error}) Retrying ${job.retries}/3…`;job.nextAt=Date.now()+8000;await save(job);await dlog('warn',`Retry ${job.retries}/3 after: ${r.error}`,ctx(r));await schedule(job);return;}
  if(r?.error){await dlog('error','Step failed: '+r.error,ctx(r));throw Error(r.error);}if(!r)throw Error('Facebook returned no result.');
  job.retries=0;
  if(r.wait){job.message=r.wait;job.nextAt=Date.now()+3000;await save(job);await schedule(job);return;}
  let more=[];
  if(step.kind==='feed'){
   // perUser counts posts actually reacted to/commented on; already-handled posts are skipped without using up the quota (bounded by a generous look-at cap).
   // A post that could not be handled is skipped; three in a row means something systematic, so pause with the reason instead of grinding on.
   if(r.failed){job.failStreak=(job.failStreak||0)+1;if(job.failStreak>=3)throw Error('Three posts in a row could not be handled. Last reason: '+String(r.message||'').replace(/^Skipped: /,''));}else if(r.key)job.failStreak=0;
   if(r.key)(job.seen??=[]).push(r.key);if(r.key)step.examined=(step.examined||0)+1;if(r.performed||r.preview)step.count=(step.count||0)+1;
   if(r.end||(step.count||0)>=job.config.perUser||(step.examined||0)>=job.config.perUser*10+20){job.queue.shift();closeStep(job,step,r);}}
  else{job.queue.shift();if(step.kind!=='posts')closeStep(job,step,r);more=AuroraEngine.expand(job,step,r);job.queue.unshift(...more);}
  let gap=quick();
  if(step.kind==='posts')job.message=`Discovered ${more.length} ${step.kind==='posts'?'posts':'profiles'}. ${r.note||''}`;
  else{if(r.performed||r.preview){gap=pause(job);job.done=(job.done||0)+1;if(r.performed){job.counts[job.config.action]++;await bumpDaily();}else job.previewed++;}else if(step.kind!=='feed'||r.key)job.skipped++;job.liked=job.counts.like;job.message=r.message;}
  await log(job.message,r.url||step.url);await dlog('info','→ '+job.message,/^Skipped|could not confirm/.test(job.message||'')?ctx(r):undefined);
  if(interrupted){job.message=latest.message+' Last result: '+job.message;await save(job);return;}
  if(!job.queue.length||(job.done||0)>=job.config.limit){await finish(job);return;}
  job.nextAt=Date.now()+gap;await save(job);await schedule(job);
 }catch(e){const {job}=await chrome.storage.local.get('job');if(job?.status==='running'){job.status='paused';job.message=e.message;job.waitingCaptcha=false;await save(job);await chrome.alarms.clear('step');await log(e.message);if(job.waitingCaptcha)await focusTab(job);await dlog('error','Paused: '+e.message,String(e.stack||'').split('\n').slice(0,4).join('\n'));await notify('Aurora paused — needs you',e.message+(NEEDS_HUMAN.test(e.message)?' Open Aurora to review.':' Press Resume to continue.'),{resume:!NEEDS_HUMAN.test(e.message)});}}
 finally{busy=false;}
}
chrome.alarms.onAlarm.addListener(a=>{if(a.name==='step')tick();});
// Reuses the site tab you already have open (most recently used first) so no extra tab appears; opens a new one only when there is none.
async function taskTab(url){
 try{const tabs=(await chrome.tabs.query({url:base+'*'})).filter(t=>t.id!=null).sort((a,b)=>(b.active?1:0)-(a.active?1:0)||(b.lastAccessed||0)-(a.lastAccessed||0));
  if(tabs[0]){const t=await chrome.tabs.update(tabs[0].id,{url,active:true});await dlog('info','Using your open tab');return t||tabs[0];}}catch{}
 return chrome.tabs.create({url});
}
async function resumeTask(){
 const {job}=await chrome.storage.local.get('job');if(!job)throw Error('Create a task first.');
 if(job.config?.dry===false){const lic=await AuroraLicense.check();if(!lic.allowed)throw Error(lic.message);}
 if(busy)throw Error('A step is still finishing. Wait for its result before resuming.');
 if(job.inFlight)throw Error('Interrupted action: check Facebook manually, then stop this task and create a new task for remaining targets.');
 if(job.version!==4)throw Error('Stop the old-version task and create a new task.');if(job.status!=='paused')throw Error('Only paused tasks can resume.');
 try{await chrome.tabs.get(job.tabId);}catch{job.tabId=(await chrome.tabs.create({url:job.queue[0]?.url||base})).id;}
 job.status='running';job.waitingCaptcha=false;job.navigation=null;job.retries=0;job.nextAt=Date.now()+1000;job.message='Resumed.';
 await save(job);await schedule(job);await dlog('info','Resumed');return{ok:true,message:job.message};
}
// Native input is restricted to the currently running, explicitly configured Facebook reaction.
async function nativeReactionClick(m,s){
 m.nativeDispatchStarted=false;
 const {job}=await chrome.storage.local.get('job');
 if(s.id!==chrome.runtime.id||!s.tab||!s.url?.startsWith(base)||job?.tabId!==s.tab.id||job.id!==m.jobId||job.status!=='running'||job.config.dry||job.config.action!=='like'||job.config.reaction!==m.reaction||m.reaction==='Like')throw Error('Native input does not match the active Facebook reaction task.');
 const step=job.queue[0],tab=await chrome.tabs.get(job.tabId);
 if(!['engage','feed'].includes(step?.kind)||AuroraSelectors.pageKey(tab.url)!==AuroraSelectors.pageKey(step.url)||AuroraSelectors.pageKey(m.url)!==AuroraSelectors.pageKey(step.url))throw Error('Native input target changed. No click sent.');
 if(!Number.isFinite(m.x)||!Number.isFinite(m.y)||m.x<0||m.y<0||m.x>10000||m.y>10000)throw Error('Invalid native input position.');
 if(!await chrome.permissions.contains({permissions:['debugger']}))throw Error('Native mouse input permission is missing. Open the studio and start the task again.');
 const probe=async()=>{const [r]=await chrome.scripting.executeScript({target:{tabId:job.tabId},func:(x,y,reaction)=>{const e=document.elementFromPoint(x,y)?.closest('button,[role="button"],[role="radio"],[role="menuitem"],[data-interactable*="|click|"]');return !!e&&globalThis.AuroraDOM?.visible(e)&&globalThis.AuroraDOM.reactionName(e)===reaction&&!e.closest('[aria-label*="Comment by" i]');},args:[m.x,m.y,m.reaction]});return r?.result===true;};
 if(!await probe())throw Error('The native reaction control is no longer under the pointer. No click sent.');
 const target={tabId:job.tabId};let attached=false;
 try{
  try{await chrome.debugger.attach(target,'1.3');attached=true;}catch{throw Error('Close DevTools on the Facebook task tab, then resume. Native input could not attach; no click sent.');}
  const latest=(await chrome.storage.local.get('job')).job;if(latest?.id!==job.id||latest.status!=='running'||!await probe())throw Error('Task or reaction target changed before native input. No click sent.');
  await chrome.debugger.sendCommand(target,'Input.dispatchMouseEvent',{type:'mouseMoved',x:m.x,y:m.y,button:'none',buttons:0});
  m.nativeDispatchStarted=true;
  await chrome.debugger.sendCommand(target,'Input.dispatchMouseEvent',{type:'mousePressed',x:m.x,y:m.y,button:'left',buttons:1,clickCount:1});
  await chrome.debugger.sendCommand(target,'Input.dispatchMouseEvent',{type:'mouseReleased',x:m.x,y:m.y,button:'left',buttons:0,clickCount:1});
  await dlog('info','Native '+m.reaction+' reaction click dispatched');return {ok:true};
 }finally{if(attached)try{await chrome.debugger.detach(target);}catch{}}
}
// Paused on one stubborn page/group/post? Drop just that target (it is never retried) and carry on with the rest.
async function skipTarget(){
 if(busy)throw Error('A step is still finishing. Wait for its result before skipping.');
 const {job}=await chrome.storage.local.get('job');if(job?.status!=='paused')throw Error('Only a paused task can skip its current target.');
 const step=job.queue.shift();if(!step)throw Error('There is no target left to skip.');
 (job.finished??=[]).push({label:step.label||short(step.url),state:'skipped',n:step.count||0,note:'skipped by you'});
 job.skipped=(job.skipped||0)+1;job.inFlight=false;job.retries=0;job.navigation=null;job.failStreak=0;
 await dlog('info','You skipped '+short(step.url));
 if(!job.queue.length){await save(job);await finish(job);return{ok:true,message:job.message};}
 job.message='Skipped '+(step.label||'that target')+'. Continuing with the next one.';await save(job);await log(job.message);
 return resumeTask();
}
async function recordSuccessfulReaction(){
 if(busy)throw Error('Wait for the current step to finish.');
 const {job,receipts={}}=await chrome.storage.local.get(['job','receipts']);
 if(job?.status!=='paused'||job.config.action!=='like'||job.queue[0]?.kind!=='engage')throw Error('Only the current paused reaction can be recorded.');
 const [r]=await chrome.scripting.executeScript({target:{tabId:job.tabId},func:()=>globalThis.AuroraDOM?.actor()||'browser'});
 const step=job.queue[0],key=(r?.result||'browser')+':like:'+AuroraSelectors.pageKey(step.url)+':'+job.config.reaction;
 if(receipts[key]?.status!=='attempted')throw Error('No unconfirmed attempted reaction to record.');
 receipts[key]={...receipts[key],status:'confirmed',review:'manual',time:Date.now()};await chrome.storage.local.set({receipts});
 job.queue.shift();job.done=(job.done||0)+1;job.counts.like=(job.counts.like||0)+1;job.liked=job.counts.like;job.inFlight=false;await bumpDaily();
 job.message='You confirmed the reaction succeeded. It was counted without clicking again. Press Resume for the next target.';await save(job);await log(job.message,step.url);return{ok:true,message:job.message};
}
async function allowReactionRetry(){
 if(busy)throw Error("The current step is still finishing. Wait for its result before reviewing a retry.");
 const {job,receipts={}}=await chrome.storage.local.get(['job','receipts']);
 if(job?.status!=='paused'||job.config.action!=='like'||job.queue[0]?.kind!=='engage')throw Error('Only a paused reaction task can be reviewed for retry.');
 const [r]=await chrome.scripting.executeScript({target:{tabId:job.tabId},func:()=>globalThis.AuroraDOM?.actor()||'browser'});
 const key=(r?.result||'browser')+':like:'+AuroraSelectors.pageKey(job.queue[0].url)+':'+job.config.reaction;
 if(receipts[key]?.status!=='attempted')throw Error('No uncertain attempt for the current account and reaction. Confirmed actions are never reset.');
 delete receipts[key];await chrome.storage.local.set({receipts});job.inFlight=false;job.message='You confirmed that no reaction was applied. Press Resume to retry this target once.';await save(job);await dlog('warn','Manual review: allowed retry of the current reaction target');return{ok:true,message:job.message};
}
chrome.runtime.onMessage.addListener((m,s,respond)=>{
 if(m.action==='nativeReactionClick'){nativeReactionClick(m,s).then(respond,e=>respond({ok:false,error:e.message,noClick:m.nativeDispatchStarted===false}));return true;}
 const ownPage=[chrome.runtime.getURL('dashboard.html'),chrome.runtime.getURL('popup.html')].includes(s.url?.split(/[?#]/)[0]);
 const panel=s.tab&&s.url?.startsWith(base)&&['openStudio','previewProfile','pause','resume','stop','skipTarget'].includes(m.action);
 if(s.id!==chrome.runtime.id||(!ownPage&&!panel)){respond({ok:false,error:'Dashboard commands only.'});return;}
 (async()=>{
  if(m.action==='openStudio'){await chrome.tabs.create({url:chrome.runtime.getURL('dashboard.html')});return{ok:true};}
  if(m.action==='previewProfile')m={action:'start',config:{action:'like',reaction:'👍 Like',mode:'users',target:m.target,perUser:3,limit:3,delay:20,dailyCap:0,exclude:'',dry:true}};
  if(m.action==='recordSuccessfulReaction')return recordSuccessfulReaction();
  if(m.action==='allowReactionRetry')return allowReactionRetry();
  if(m.action==='save'){await chrome.storage.local.set({config:m.config});return{ok:true};}
  if(m.action==='start'){
   if(m.config?.dry===false){const lic=await AuroraLicense.check();if(!lic.allowed)throw Error(lic.message);}
   if(busy)throw Error('A step is finishing. Try again shortly.');const old=(await chrome.storage.local.get('job')).job;if(['running','paused'].includes(old?.status))throw Error('Stop the current task first.');
   const config=AuroraEngine.config(m.config),queue=AuroraEngine.initial(config);if(!config.dry&&config.action==='like'&&config.reaction!=='Like'&&!await chrome.permissions.contains({permissions:['debugger']}))throw Error('Allow native mouse input in the studio to run this reaction.');if(!queue.length)throw Error('All targets are excluded.');
   await chrome.storage.local.set({config:m.config});const tab=await taskTab(queue[0].url);
   const job={version:4,id:crypto.randomUUID(),config,queue,total:queue.length,finished:[],tabId:tab.id,status:'running',counts:{like:0,follow:0,unfollow:0,comment:0,friend:0,join:0,share:0},done:0,liked:0,previewed:0,skipped:0,seen:[],seenUsers:[],nextAt:Date.now()+2000,message:`${config.dry?'Preview':'Live'} ${config.action} task started. Waiting for Facebook.`};
   await save(job);await log(job.message);await dlog('info',job.message,{action:config.action,reaction:config.reaction,mode:config.mode,target:String(config.target||'').slice(0,200),limit:config.limit,perUser:config.perUser,scanLimit:config.scanLimit,delay:config.delay,dailyCap:config.dailyCap,preview:config.dry,steps:queue.length});await schedule(job);return{ok:true,message:job.message};
  }

  if(panel&&['pause','resume','stop','skipTarget'].includes(m.action)){const {job}=await chrome.storage.local.get('job');if(job?.tabId!==s.tab.id)throw Error('Open the task tab to control this session.');}
  if(m.action==='skipTarget')return skipTarget();
  if(m.action==='resume')return resumeTask();
  const {job}=await chrome.storage.local.get('job');if(!job)throw Error('Create a task first.');
  if(m.action!=='pause'&&m.action!=='stop')throw Error('Unknown action.');
  job.status=m.action==='pause'?'paused':'stopped';if(m.action==='stop'&&!job.config.dry)await draftToPreview();job.message=job.status+'. A click already sent may finish.';await chrome.alarms.clear('step');
  await save(job);await dlog('info','You pressed '+m.action);return{ok:true,message:job.message};
 })().then(respond,e=>respond({ok:false,error:e.message}));return true;
});
// Housekeeping: drop old like/follow/unfollow receipts. Comment receipts are kept forever (they prevent duplicate comments).
async function pruneReceipts(){
 const {receipts={}}=await chrome.storage.local.get('receipts');const cut=Date.now()-RECEIPT_MAX_AGE;let changed=false;
 for(const [k,v] of Object.entries(receipts))if(!/:comment:|:friend:|:join:|:share:/.test(k)&&(v.time||0)<cut){delete receipts[k];changed=true;}
 if(changed)await chrome.storage.local.set({receipts});
}
async function pauseOnRestart(details){await pruneReceipts();await dlog('info','Extension '+(details?.reason||'started')+(chrome.runtime.getManifest?' v'+chrome.runtime.getManifest().version:''));const {job}=await chrome.storage.local.get('job');if(job&&['running','paused'].includes(job.status)){job.status='paused';job.message=job.version===4?'Browser or extension restarted. Check the task before resuming.':'Updated extension: stop the previous task and create a new one.';await save(job);await chrome.alarms.clear('step');await notify('Aurora paused — needs you',job.message);}}
chrome.runtime.onStartup.addListener(pauseOnRestart);
chrome.runtime.onInstalled.addListener(pauseOnRestart);
