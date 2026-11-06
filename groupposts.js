// Post to groups: reads a group's rules, opens its post box, puts the text in once, and either waits for the person to press Post (assisted)
// or presses it (automatic). Also lists the groups the person belongs to. Loaded after content.js, which hands it the helpers it needs.
(()=>{if(globalThis.AuroraGroupPost)return;const S=AuroraSelectors,D=AuroraDOM;const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const norm=t=>String(t||'').replace(/\s+/g,' ').trim();
const hash=t=>{let h=5381;for(const ch of String(t))h=((h<<5)+h+ch.charCodeAt(0))|0;return (h>>>0).toString(36);};

/* ---------- group rules ---------- */
const BAN=/\b(no|not allowed|prohibit\w*|forbid\w*|ban\w*|don.?t|do not|never|without permission)\b[^.\n]{0,60}\b(self[- ]?promo\w*|promot\w*|advertis\w*|spam\w*|solicit\w*|selling|business (posts|links|ads))\b|\b(self[- ]?promo\w*|promotion\w*|advertis\w*|spam\w*|solicitation)\b[^.\n]{0,60}\b(not allowed|prohibited|forbidden|banned|will be removed|is not permitted|are not permitted|not permitted)\b/i;
// "All posts must be approved by an admin" (rules) or the "Pending admin approval" banner (you already have a post waiting) mean this group holds posts for admins.
const APPROVAL=/(posts?|content|submissions?)[^.\n]{0,50}\b(must|need(?:s)?|have to|will|are|is)\b[^.\n]{0,30}\b(approved|reviewed|approval|moderated)\b|\badmin approval\b|\bapproved by (an? )?(admin|moderator)s?\b|pending admin approval/i;
function readRules(){
 const text=document.body.innerText||'';const at=text.search(/group rules/i),approval=APPROVAL.test(text);
 if(at<0)return{found:false,blocked:false,reason:'',approval};
 const block=text.slice(at,at+4000),m=block.match(BAN);
 return{found:true,blocked:!!m,reason:m?norm(block.slice(Math.max(0,m.index-20),m.index+m[0].length+40)).slice(0,160):'',approval};
}
/* What Aurora has learned about each group, shown as chips and filters in the studio (promoBan, approval). */
async function saveFlags(gid,patch){try{const {gpFlags={}}=await chrome.storage.local.get('gpFlags');gpFlags[gid]={...gpFlags[gid],...patch,time:Date.now()};await chrome.storage.local.set({gpFlags});}catch{}}

/* ---------- the post box ---------- */
const LAUNCH=/^(write something|create a public post|create post|what.?s on your mind|share something|start a discussion|write a post)/i;
function launcher(){
 const main=document.querySelector('[role="main"]')||document.body;
 const cands=[...main.querySelectorAll('[role="button"],div[tabindex="0"],span')].filter(e=>!e.closest('[role="dialog"]')&&D.visible(e)&&LAUNCH.test(D.text(e))&&D.text(e).length<80);
 const el=cands[0];return el?(el.closest('[role="button"]')||el):null;
}
const composer=()=>D.dialogs().find(d=>d.querySelector('[contenteditable="true"][role="textbox"],textarea'))||null;
const boxOf=d=>d&&[...d.querySelectorAll('[contenteditable="true"][role="textbox"],textarea')].find(e=>D.visible(e))||null;
const postButton=d=>d&&[...d.querySelectorAll('[role="button"],button')].find(b=>D.visible(b)&&/^post$/i.test(D.text(b))&&b.getAttribute('aria-disabled')!=='true'&&!b.disabled)||null;
const boxText=b=>norm(b?('value' in b?b.value:b.textContent):'');
function clickLike(el){const r=el.getBoundingClientRect(),o={bubbles:true,cancelable:true,composed:true,view:window,clientX:r.left+r.width/2,clientY:r.top+r.height/2,button:0};for(const t of ['pointerover','pointerdown','mousedown','pointerup','mouseup','click']){try{el.dispatchEvent(t.startsWith('pointer')?new PointerEvent(t,{...o,pointerType:'mouse',isPrimary:true}):new MouseEvent(t,o));}catch{}}}

/* Put the text in ONCE. Facebook's editor draws an edit a moment after the event; trying a second way too early types the text twice inside the editor
   and leaves it there after Posting. So: one insert, look for it, and only if nothing appeared try one paste. Never write into the editor's DOM. */
async function typeOnce(el,text){
 el.focus();
 if('value' in el){const proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,text);el.dispatchEvent(new Event('input',{bubbles:true}));return norm(el.value).includes(norm(text).slice(0,40));}
 const probe=norm(text).slice(0,40),landed=()=>norm(el.textContent).includes(probe);
 const waitFor=async(fn,ms)=>{for(let t=0;t<ms;t+=50){if(fn())return true;await sleep(50);}return fn();};
 const sel=getSelection(),range=document.createRange();range.selectNodeContents(el);sel.removeAllRanges();sel.addRange(range);
 try{document.execCommand('insertText',false,text);}catch{}
 let ok=await waitFor(landed,700);
 if(!ok){try{const dt=new DataTransfer();dt.setData('text/plain',text);el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}));}catch{}ok=await waitFor(landed,700);}
 return ok;
}

/* ---------- link preview (a YouTube link should show its picture card, not a bare link) ---------- */
const URL_RE=/https?:\/\/\S+/i;
const hasPreview=d=>!!d&&[...d.querySelectorAll('[aria-label]')].some(e=>/remove (the )?(link )?(preview|attachment)|dismiss (the )?(link )?preview/i.test(e.getAttribute('aria-label')||'')&&D.visible(e));
async function ensurePreview(box,text,H){
 if(!URL_RE.test(text))return'none';
 const {id,T,active}=H;
 const seen=async ms=>{for(let t=0;t<ms;t+=250){await active(id);if(hasPreview(composer()))return true;await sleep(250);}return false;};
 if(await seen(5000)){T('link preview ready');return'ok';}
 T('link preview missing; nudging');
 const caret=()=>{box.focus();const sel=getSelection(),r=document.createRange();r.selectNodeContents(box);r.collapse(false);sel.removeAllRanges();sel.addRange(r);};
 caret();try{document.execCommand('insertText',false,' ');}catch{}
 if(await seen(5000)){T('link preview ready after a space');return'ok';}
 // take the space and the last character of the link away and type them back, as a person fixing it would
 try{caret();document.execCommand('delete');await sleep(300);const ch=box.textContent.trim().slice(-1);if(ch){caret();document.execCommand('delete');await sleep(300);caret();document.execCommand('insertText',false,ch+' ');}}catch{}
 if(await seen(6000)){T('link preview ready after retyping');return'ok';}
 T('link preview did not appear');return'missing';
}
const PV_TIP=' If the link has no picture card, click at the end of the link and press the space bar.';

/* ---------- Facebook's own "post in several groups at once" (Add groups, up to 9) ---------- */
const addDialog=()=>D.dialogs().find(d=>/add groups/i.test(d.innerText||'')&&/select groups|post in up to|search groups/i.test(d.innerText||''))||null;
const btn=(d,re)=>d&&[...d.querySelectorAll('[role="button"],button')].find(b=>D.visible(b)&&re.test(norm(D.text(b))))||null;
const isChecked=e=>!!e&&(e.getAttribute?.('aria-checked')==='true'||e.checked===true);
function findRow(d,name){
 const want=norm(name).toLowerCase();
 const boxes=[...d.querySelectorAll('[role="checkbox"],input[type="checkbox"]')];
 let best=null;
 for(const cb of boxes){
  let row=cb;for(let i=0;i<6&&row&&row!==d;i++){const t=norm(row.innerText||'');if(t.length>1)break;row=row.parentElement;}
  for(let i=0;i<4&&row&&row.parentElement&&row.parentElement!==d&&norm(row.parentElement.innerText||'').split('\n').length<=3&&row.parentElement.querySelectorAll('[role="checkbox"],input[type="checkbox"]').length<=1;i++)row=row.parentElement;
  const first=norm(String(row?.innerText||'').split('\n')[0]).toLowerCase();
  if(first===want)return{cb,row};
  if(!best&&first&&(first.includes(want)||want.includes(first)))best={cb,row};
 }
 return best;
}
const searchBox=d=>d&&d.querySelector('input[type="search"],input[placeholder*="Search" i],input[aria-label*="Search" i],[role="searchbox"]');
function setSearch(el,v){if(!el)return;if('value' in el){Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));}}
async function chooseGroups(names,H){
 const {id,T,active}=H;let d=addDialog();if(!d)throw Error('The “Add groups” list did not open. Nothing was posted.');
 const missing=[];let ticked=0;
 for(const name of names){
  await active(id);d=addDialog()||d;
  let hit=findRow(d,name);
  const sb=searchBox(d);
  if(!hit&&sb){setSearch(sb,name.slice(0,40));await sleep(1100);hit=findRow(addDialog()||d,name);}
  if(!hit){missing.push(name);T('group not found in list: '+name.slice(0,30));continue;}
  if(!isChecked(hit.cb)){D.reveal(hit.cb);clickLike(hit.cb);await sleep(600);if(!isChecked(hit.cb)&&hit.row&&hit.row!==hit.cb){clickLike(hit.row);await sleep(600);}}
  if(isChecked(hit.cb))ticked++;else{missing.push(name);T('could not tick: '+name.slice(0,30));}
  if(sb&&sb.value){setSearch(sb,'');await sleep(500);}
 }
 return{ticked,missing};
}
async function addGroups(s,H){
 const {id,T,active,until}=H;
 const names=(s.names||[]).filter(Boolean);
 const d=composer();const open=btn(d,/^\+?\s*add groups\b/i);
 if(!open)throw Error('This post box has no “Add groups” button, so Facebook’s multi-group posting is not available here. Nothing was posted.');
 await active(id);clickLike(open);T('Add groups clicked');
 if(!await until(addDialog,id,6000))throw Error('The “Add groups” list did not open. Nothing was posted.');
 await sleep(900);
 const r=await chooseGroups(names,H);
 const done=btn(addDialog(),/^done$/i);if(!done)throw Error('The Done button of the group list was not found. Nothing was posted.');
 await active(id);clickLike(done);
 if(!await until(()=>!addDialog()&&composer(),id,6000))throw Error('The group list did not close. Nothing was posted.');
 T('groups ticked '+r.ticked+' of '+names.length);
 return r;
}

/* ---------- the step ---------- */
const state={key:null,startedAt:0,note:'',count:1,names:[]};
const MAX_WAIT=15*60*1000;
async function rules(s,c,H){
 await H.until(()=>document.body.innerText.length>200,H.id,12000);
 const r=readRules();await saveFlags(s.gid,{promoBan:r.blocked,approval:r.approval,rulesRead:r.found});
 if(r.blocked)return{blocked:true,message:`Skipped ${s.label}: its rules forbid promotion (“${r.reason}”). Nothing was posted.`};
 return{blocked:false,message:(r.found?`Rules of ${s.label} read: no ban on promotion found.`:`Rules of ${s.label} could not be read; continuing.`)+(r.approval?' Posts here are held for admin approval.':'')};
}
const POSTED_PENDING=/pending|awaiting|waiting for (admin|approval)|submitted for approval|admins? (will|must) (review|approve)|post is being reviewed/i;
async function outcome(s,H,snippet){
 // the box has closed: did the post appear (or go to the admins)?
 for(let t=0;t<15000;t+=500){
  await H.active(H.id);
  const page=norm(document.body.innerText);
  if(D.dialogs().some(d=>/discard|unsaved|leave/i.test(d.innerText||'')))return{unsure:true};
  if(page.includes(snippet))return{posted:true,pending:POSTED_PENDING.test(page)};
  if(POSTED_PENDING.test(page))return{posted:true,pending:true};
  await sleep(500);
 }
 return{posted:false};
}
async function record(s,key,H,o){
 const {receipts={}}=await chrome.storage.local.get('receipts');
 const now=Date.now();receipts[key]={status:'confirmed',phase:'posted',time:now};
 for(const gid of (s.gids||[s.gid]))receipts['post:'+gid+':'+hash(s.text)]={status:'confirmed',phase:'posted',time:now};
 await chrome.storage.local.set({receipts});
 await saveFlags(s.gid,{approval:!!o.pending});
}
const doneMsg=(s,o)=>{
 const n=state.count||1,where=s.kind==='mpost'?(n>1?`${s.label.split(' +')[0]} and ${n-1} other group${n===2?'':'s'}`:s.label.split(' +')[0]):s.label;
 const miss=state.missing?.length?` (could not find: ${state.missing.slice(0,3).join(', ')}${state.missing.length>3?'…':''})`:'';
 return o.pending?`Submitted to ${where} (the admins must approve it first).${miss}`:`Posted in ${where}.${miss}`;
};
async function post(s,c,H){
 const{id,T,active,until}=H;
 if(!await until(()=>document.querySelector('[role="main"]')||D.scope(),id,15000))throw Error('Facebook did not render this group.');
 await sleep(800);
 const multi=s.kind==='mpost';
 const text=s.text,snippet=norm(text).slice(0,40),key=(multi?'mpost:'+(s.gids||[]).join(',')+':':'post:'+s.gid+':')+hash(text);
 const resuming=state.key===key;
 if(!resuming){
  if(D.headerMatch(/^Join( group)?$/i))return{message:`Skipped ${s.label}: you are not a member of this group.`};
  if(D.headerMatch(/^(Cancel request|Request sent)\b/i))return{message:`Skipped ${s.label}: your request to join is still pending.`};
  const {receipts={}}=await chrome.storage.local.get('receipts');
  if(receipts[key])return{message:`Skipped ${s.label}: Aurora already posted or tried this exact text here. Nothing sent again.`};
  if(APPROVAL.test(document.body.innerText||''))await saveFlags(s.gid,{approval:true});
 }
 if(c.dry){
  const l=await until(launcher,id,8000);
  if(!l)throw Error('Cannot find the “Write something…” box in this group. Check that you can post here.');
  return{preview:true,count:multi?(s.gids||[]).length:1,message:multi?`Preview: would open the post box in ${s.label.split(' +')[0]}, add ${(s.names||[]).length} more group${(s.names||[]).length===1?'':'s'} with Facebook’s “Add groups”, and ${c.postMode==='auto'?'post your text':'fill in your text for you to post'}. Nothing was posted.`:`Preview: would open the post box in ${s.label} and ${c.postMode==='auto'?'post your text':'fill in your text for you to post'}. Nothing was posted.`};
 }
 let d=composer();
 if(resuming){
  // assisted: waiting for the person to press Post (or to close the box to skip this group)
  if(d){
   const b=boxOf(d);
   if(Date.now()-state.startedAt>MAX_WAIT){state.key=null;throw Error(`You did not post in ${s.label} within 15 minutes. Press Resume to continue with the next group, or Stop.`);}
   if(b&&boxText(b).includes(snippet))return{wait:`Your text is in the ${s.label} box. Read it, then press Post yourself. (Close the box to skip.)${state.note}`};
   return{wait:`Waiting for you in ${s.label}…`};
  }
  if(addDialog())return{wait:`Finish choosing groups in the “Add groups” list, then press Done…`};
  const o=await outcome(s,H,snippet);
  if(o.unsure)return{wait:`Finish or discard the box in ${s.label}…`};
  state.key=null;
  if(o.posted){await record(s,key,H,o);return{performed:true,count:state.count,message:doneMsg(s,o)};}
  return{message:`Skipped ${s.label}: the box was closed and no post appeared.`};
 }
 if(!d){
  const l=await until(launcher,id,8000);
  if(!l)throw Error('Cannot find the “Write something…” box in this group. Check that you can post here, then resume.');
  await active(id);D.reveal(l);await sleep(500);clickLike(l);T('post box clicked');
  d=await until(composer,id,8000);
  if(!d)throw Error('The post box did not open. Nothing was posted.');
 }
 state.count=1;state.missing=[];
 if(multi){const r=await addGroups(s,H);state.count=1+r.ticked;state.missing=r.missing;if(!r.ticked)throw Error('None of the chosen groups could be found in Facebook’s “Add groups” list ('+(s.names||[]).slice(0,3).join(', ')+'…). Nothing was posted.');d=composer();if(!d)throw Error('The post box closed. Nothing was posted.');}
 const box=await until(()=>boxOf(composer()),id,5000);
 if(!box)throw Error('The post box has no text area. Nothing was posted.');
 await active(id);
 if(!await typeOnce(box,text))throw Error('Could not put your text into the post box. Nothing was posted.');
 T('text placed');
 const pv=await ensurePreview(box,text,H);
 state.key=key;state.startedAt=Date.now();state.note=pv==='missing'?PV_TIP:'';
 const groupsNote=multi?` ${state.count} group${state.count===1?'':'s'} chosen${state.missing.length?` (could not find: ${state.missing.slice(0,3).join(', ')})`:''}.`:'';
 if(c.postMode!=='auto')return{wait:`Your text is in the ${s.label} box.${groupsNote} Read it, then press Post yourself. (Close the box to skip.)${state.note}`};
 // automatic: a short, human pause, then press Post exactly once
 await sleep(1200+Math.random()*1600);await active(id);
 const b2=await until(()=>postButton(composer()),id,6000);
 if(!b2){state.key=null;throw Error('The Post button is missing or disabled. Nothing was posted. Check the group and resume.');}
 const {receipts={}}=await chrome.storage.local.get('receipts');receipts[key]={status:'attempted',phase:'dispatch',time:Date.now()};await chrome.storage.local.set({receipts});
 await active(id);clickLike(b2);T('Post pressed');
 for(let t=0;t<20000&&composer();t+=500)await sleep(500);
 state.key=null;
 if(composer())throw Error(`Post was pressed in ${s.label} but the box did not close, so the result is unknown. Check the group. Aurora will not post it again.`);
 const o=await outcome(s,H,snippet);
 if(!o.posted)throw Error(`Post was sent in ${s.label} but could not be confirmed. Check the group. Aurora will not post it again.`);
 await record(s,key,H,o);
 return{performed:true,count:state.count,message:doneMsg(s,o)+(pv==='missing'?' (the link may have posted without a picture card)':'')};
}

/* ---------- the groups the person belongs to ---------- */
const GENERIC=/^(groups?|see all|create (new )?group|discover|your groups|your feed|joined|manage|notifications?|more|see more|join|\d+)$/i;
function readGroups(map){
 for(const a of document.querySelectorAll('a[href*="/groups/"]')){
  const u=S.groupURL(a.href);if(!u)continue;const id=new URL(u).pathname.split('/')[2];if(map.has(id))continue;
  const lines=String(a.innerText||a.getAttribute('aria-label')||'').split('\n').map(norm).filter(Boolean);const name=lines.find(l=>!GENERIC.test(l)&&l.length>1&&l.length<=120);
  if(name)map.set(id,{id,name});
 }
}
async function listGroups(onProgress){
 const map=new Map();let stale=0;
 const scroller=()=>[document.scrollingElement,...document.querySelectorAll('[role="main"],div')].find(e=>e&&e.scrollHeight>e.clientHeight+200&&/auto|scroll|visible/.test(getComputedStyle(e).overflowY)&&e.clientHeight>300)||document.scrollingElement;
 for(let i=0;i<40&&stale<4;i++){const before=map.size;readGroups(map);stale=map.size===before?stale+1:0;try{onProgress&&onProgress(map.size);}catch{}const sc=scroller();sc.scrollBy(0,Math.max(700,innerHeight));window.scrollBy(0,Math.max(700,innerHeight));await sleep(900);}
 readGroups(map);
 const links=[...document.querySelectorAll('a[href*="/groups/"]')];
 return{groups:[...map.values()].slice(0,300),diag:{groupLinks:links.length,sample:links.slice(0,6).map(a=>(a.getAttribute('href')||'').replace(/^https?:\/\/[^/]+/,'').slice(0,60)),path:location.pathname}};
}
chrome.runtime.onMessage.addListener((m,s,reply)=>{
 if(m.action!=='listGroups'||s.id!==chrome.runtime.id||s.tab)return;
 if(!/\/groups\/(joins|feed)?\/?$/.test(location.pathname)&&!/\/groups\/joins/.test(location.pathname)){reply({error:'Open facebook.com/groups/joins first.'});return;}
 listGroups(n=>{try{chrome.runtime.sendMessage({action:'gpProgress',n});}catch{}}).then(r=>reply(r),e=>reply({error:e.message}));return true;
});

globalThis.AuroraGroupPost={run(s,c,H){return s.kind==='grules'?rules(s,c,H):post(s,c,H);},readRules,typeOnce,launcher,composer,state,hasPreview};
})();
