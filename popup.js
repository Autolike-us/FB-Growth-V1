/* Aurora toolbar popup: a quick look and the two safety buttons. Everything else lives in the dashboard (dashboard.html).
   It only reads what the studio already saves (job, daily, config, license, dark) and sends the same Pause / Stop messages the dashboard sends. */
(()=>{
const $=id=>document.getElementById(id);
const today=()=>new Date().toDateString(); // same day key the background worker uses for the daily counter
const DASH=chrome.runtime.getURL('dashboard.html');
const ACTIVE=['running','paused'];
const CHIP={ready:['Ready',''],running:['● Running','run'],paused:['🔔 Needs you','bad'],completed:['✓ Done','run'],stopped:['Stopped','warn']};

async function openDashboard(){
  try{
    const tabs=await chrome.tabs.query({url:DASH+'*'});
    if(tabs[0]){await chrome.tabs.update(tabs[0].id,{active:true});if(tabs[0].windowId!=null)await chrome.windows.update(tabs[0].windowId,{focused:true});}
    else await chrome.tabs.create({url:DASH});
  }catch{await chrome.tabs.create({url:DASH});}
  window.close();
}
async function control(action){
  const b=$(action);b.disabled=true;
  try{await chrome.runtime.sendMessage({action});}catch{}
  await paint();
}
function licenseChip(lic,cfg){
  const el=$('lic');
  if(!cfg||!cfg.enforce){el.hidden=true;return;}
  const st=lic&&lic.status,when=lic&&lic.trialEndsAt?new Date(lic.trialEndsAt):null;
  let text='No license — preview only',cls='warn';
  if(st==='active'){text='● License active';cls='ok';}
  else if(st==='trial'){const d=when?Math.max(0,Math.ceil((when-Date.now())/86400000)):null;text='● Free trial'+(d!=null?' · '+d+' day'+(d===1?'':'s')+' left':'');cls='ok';}
  else if(st&&st!=='none'&&st!=='pending'){text={expired:'Trial ended',invalid:'Invalid key',device_limit:'Device limit',wrong_plan:'Not in your plan'}[st]||'License needs attention';cls='bad';}
  el.hidden=false;el.textContent=text;el.className='chip lic '+cls;
}
async function paint(){
  const {job,daily,config,license,dark}=await chrome.storage.local.get(['job','daily','config','license','dark']);
  document.body.classList.toggle('dark',!!dark);
  const st=job?.status||'ready',c=CHIP[st]||CHIP.ready;
  const chip=$('chip');chip.textContent=c[0];chip.className='chip '+c[1];
  document.body.dataset.status=st;
  const active=ACTIVE.includes(st),done=Number(job?.done??job?.liked??0),limit=Number(job?.config?.limit)||0,skipped=Number(job?.skipped||0);
  // alert when the studio paused itself or finished
  const al=$('alert');al.hidden=!(st==='paused'||st==='completed');
  if(!al.hidden){al.className='alert '+(st==='paused'?'bad':'ok');$('alertTitle').textContent=st==='paused'?'Aurora paused — it needs you':(job.config?.dry?'Preview complete — nothing was sent':'Session complete');$('alertText').textContent=(job?.message||'').slice(0,160)+(st==='paused'?' Open the dashboard to review and resume.':'');}
  // the task
  $('taskKind').textContent=job&&st!=='ready'?(job.config?.dry?'Preview · nothing is sent':'Live task'):'No task running';
  $('taskTitle').textContent=job&&st!=='ready'?(st==='paused'?'Waiting for you':(job.message||'Working…').slice(0,90)):'Start one in the dashboard.';
  $('taskBar').hidden=!(job&&limit);$('bar').style.width=limit?Math.min(100,Math.round(done/limit*100))+'%':'0%';
  $('done').textContent=job&&limit?`${done} of ${limit} done${skipped?` · ${skipped} skipped`:''}`:'';
  const left=job?.queue?.length||0,secs=left*(Number(job?.config?.delay)||20)*1.2;
  $('eta').textContent=active&&left?`about ${secs<90?'1':Math.round(secs/60)} min left`:'';
  $('pause').disabled=st!=='running';$('stop').disabled=!active;
  // today
  const n=daily?.day===today()?Number(daily.count)||0:0,cap=Number(job?.config?.dailyCap??config?.dailyCap)||0;
  $('todayN').textContent=String(n);$('todayOf').textContent=cap?` of ${cap} daily limit`:' live actions';
  $('todayBarWrap').hidden=!cap;$('todayBar').style.width=cap?Math.min(100,Math.round(n/cap*100))+'%':'0%';
  $('mode').textContent=job?.config&&active?(job.config.dry?'Preview only':'Live'):'';
  licenseChip(license,globalThis.AuroraLicenseConfig);
  $('open').classList.toggle('attention',st==='paused');
}
$('open').onclick=openDashboard;
$('pause').onclick=()=>control('pause');
$('stop').onclick=()=>control('stop');
chrome.storage.onChanged.addListener((ch,area)=>{if(area==='local'&&(ch.job||ch.daily||ch.license||ch.dark||ch.config))paint();});
paint();
})();
