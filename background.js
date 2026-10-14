importScripts('engine.js');
const base='https://www.facebook.com/';
let busy=false;
// Pauses that need a person (not a one-click Resume).
const NEEDS_HUMAN=/captcha|verify|verification|restricted|Sign in|log in|Daily cap|interrupted|restarted|unknown|redirected/i;
const HISTORY_MAX=5000,RECEIPT_MAX_AGE=90*864e5,LOG_MAX=1500;
const BADGE={running:['ON','#42b72a'],paused:['!','#fa383e'],completed:['✓','#1877f2']};
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
const short=u=>String(u||'').split('?')[0];
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
async function schedule(job){await chrome.alarms.create('step',{when:Date.now()+Math.max(1000,(job.nextAt||0)-Date.now())});}
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
async function finish(job){
 job.status='completed';job.message=`Session complete: ${job.done||0} previewed, ${job.skipped||0} skipped. Nothing was clicked.`;
 await save(job);await log(job.message);await dlog('info','Task finished: '+job.message);await chrome.alarms.clear('step');await notify('Aurora finished ✓',job.message);
}

const norm=u=>{try{const x=new URL(u);return x.hostname.replace(/^(m|web|mbasic)\./,'www.')+x.pathname.replace(/\/+$/,'')+x.search;}catch{return String(u||'');}};
async function tick(){
 if(busy)return;busy=true;
 try{
  const {job}=await chrome.storage.local.get('job');if(job?.status!=='running')return;
  if(!job.queue.length||(job.done||0)>=job.config.limit){await finish(job);return;}
  if(Date.now()<(job.nextAt||0)){await schedule(job);return;}
  const step=job.queue[0];let tab;try{tab=await chrome.tabs.get(job.tabId);}catch{throw Error('The task tab was closed. Resume to open a new tab.');}
  if(tab.status!=='complete'){job.nextAt=Date.now()+2000;await save(job);await schedule(job);return;}
  if(/\/login|\/checkpoint|\/recover/.test(tab.url||''))throw Error('Please log in to Facebook in the task tab, then press Resume.');
  if(norm(tab.url)!==norm(step.url)){
   if(job.navigation?.target===step.url&&job.navigation.attempts>=2)throw Error('Facebook redirected away from this target. Check the task tab and resume; Aurora stopped retrying the address.');
   job.navigation={target:step.url,attempts:job.navigation?.target===step.url?job.navigation.attempts+1:1};job.message='Opening '+step.url;job.nextAt=Date.now()+2500;await save(job);await dlog('info','Opening '+short(step.url)+(job.navigation.attempts>1?` (attempt ${job.navigation.attempts})`:''));await chrome.tabs.update(job.tabId,{url:step.url,active:true});await schedule(job);return;
  }
  if(job.config.dailyCap&&await dailyCount()>=job.config.dailyCap)throw Error(`Daily cap reached (${job.config.dailyCap} steps today). Resume tomorrow or raise the cap in the studio.`);
  job.navigation=null;
  // Preview only: the page has been visited. Nothing on it is read, clicked or changed.
  job.queue.shift();job.done=(job.done||0)+1;job.previewed=(job.previewed||0)+1;await bumpDaily();
  job.message=AuroraEngine.describe(step,job.config);
  await log(job.message,step.url);await dlog('info','→ '+job.message);
  if(!job.queue.length||(job.done||0)>=job.config.limit){await finish(job);return;}
  job.nextAt=Date.now()+pause(job);await save(job);await schedule(job);
 }catch(e){const {job}=await chrome.storage.local.get('job');if(job?.status==='running'){job.status='paused';job.message=e.message;await save(job);await chrome.alarms.clear('step');await log(e.message);await dlog('error','Paused: '+e.message,String(e.stack||'').split('\n').slice(0,4).join('\n'));await notify('Aurora paused — needs you',e.message+(NEEDS_HUMAN.test(e.message)?' Open Aurora to review.':' Press Resume to continue.'),{resume:!NEEDS_HUMAN.test(e.message)});}}
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
 if(job.status!=='paused')throw Error('Only paused tasks can resume.');
 try{await chrome.tabs.get(job.tabId);}catch{job.tabId=(await chrome.tabs.create({url:job.queue[0]?.url||base})).id;}
 job.status='running';job.navigation=null;job.nextAt=Date.now()+1000;job.message='Resumed.';
 await save(job);await schedule(job);await dlog('info','Resumed');return{ok:true,message:job.message};
}
chrome.runtime.onMessage.addListener((m,s,respond)=>{
 const ownPage=[chrome.runtime.getURL('dashboard.html'),chrome.runtime.getURL('popup.html')].includes(s.url?.split(/[?#]/)[0]);
 const panel=s.tab&&s.url?.startsWith(base)&&['openStudio','previewProfile','pause','resume','stop'].includes(m.action);
 if(s.id!==chrome.runtime.id||(!ownPage&&!panel)){respond({ok:false,error:'Dashboard commands only.'});return;}
 (async()=>{
  if(m.action==='openStudio'){await chrome.tabs.create({url:chrome.runtime.getURL('dashboard.html')});return{ok:true};}
  if(m.action==='previewProfile')m={action:'start',config:{action:'like',reaction:'👍 Like',mode:'users',target:m.target,perUser:3,limit:3,delay:30,dailyCap:0,exclude:'',dry:true}};
  if(m.action==='save'){await chrome.storage.local.set({config:m.config});return{ok:true};}
  if(m.action==='start'){
   if(busy)throw Error('A step is finishing. Try again shortly.');const old=(await chrome.storage.local.get('job')).job;if(['running','paused'].includes(old?.status))throw Error('Stop the current task first.');
   const config=AuroraEngine.config(m.config),queue=AuroraEngine.initial(config);if(!queue.length)throw Error('All targets are excluded.');
   await chrome.storage.local.set({config:m.config});const tab=await taskTab(queue[0].url);
   const job={version:3,id:crypto.randomUUID(),config,queue,tabId:tab.id,status:'running',counts:{},done:0,previewed:0,skipped:0,nextAt:Date.now()+2000,message:`Preview ${config.action} task started. Nothing will be clicked.`};
   await save(job);await log(job.message);await dlog('info',job.message,{action:config.action,mode:config.mode,target:String(config.target||'').slice(0,200),limit:config.limit,perUser:config.perUser,delay:config.delay,dailyCap:config.dailyCap,preview:true,steps:queue.length});await schedule(job);return{ok:true,message:job.message};
  }
  if(m.action==='resume')return resumeTask();
  const {job}=await chrome.storage.local.get('job');if(!job)throw Error('Create a task first.');
  if(m.action!=='pause'&&m.action!=='stop')throw Error('Unknown action.');
  job.status=m.action==='pause'?'paused':'stopped';job.message=job.status+'.';await chrome.alarms.clear('step');
  await save(job);await dlog('info','You pressed '+m.action);return{ok:true,message:job.message};
 })().then(respond,e=>respond({ok:false,error:e.message}));return true;
});
// Housekeeping: keep the activity history from growing without bound.
async function prune(){const {history=[]}=await chrome.storage.local.get('history');if(history.length>HISTORY_MAX)await chrome.storage.local.set({history:history.slice(-HISTORY_MAX)});}
chrome.runtime.onInstalled.addListener(async d=>{prune();await dlog('info',`Extension ${d.reason} v${chrome.runtime.getManifest().version}`);});
chrome.runtime.onStartup.addListener(async()=>{prune();const {job}=await chrome.storage.local.get('job');if(job?.status==='running'){job.status='paused';job.message='The browser restarted. Press Resume to continue.';await save(job);await dlog('warn','Browser restarted while a task was running; paused');await notify('Aurora paused — needs you','The browser restarted. Open Aurora and press Resume.');}});
