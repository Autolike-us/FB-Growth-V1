// Post to groups: reads a group's rules, opens its post box, puts the text in once, and either waits for the person to press Post (assisted)
// or presses it (automatic). Also lists the groups the person belongs to. Loaded after content.js, which hands it the helpers it needs.
(()=>{if(globalThis.AuroraGroupPost)return;const S=AuroraSelectors,D=AuroraDOM;const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const norm=t=>String(t||'').replace(/\s+/g,' ').trim();
const hash=t=>{let h=5381;for(const ch of String(t))h=((h<<5)+h+ch.charCodeAt(0))|0;return (h>>>0).toString(36);};

/* ---------- group rules ---------- */
const BAN=/\b(no|not allowed|prohibit\w*|forbid\w*|ban\w*|don.?t|do not|never|without permission)\b[^.\n]{0,60}\b(self[- ]?promo\w*|promot\w*|advertis\w*|spam\w*|solicit\w*|selling|business (posts|links|ads))\b|\b(self[- ]?promo\w*|promotion\w*|advertis\w*|spam\w*|solicitation)\b[^.\n]{0,60}\b(not allowed|prohibited|forbidden|banned|will be removed|is not permitted|are not permitted|not permitted)\b/i;
function readRules(){
 const text=document.body.innerText||'';const at=text.search(/group rules/i);
 if(at<0)return{found:false,blocked:false,reason:''};
 const block=text.slice(at,at+4000),m=block.match(BAN);
 return{found:true,blocked:!!m,reason:m?norm(block.slice(Math.max(0,m.index-20),m.index+m[0].length+40)).slice(0,160):''};
}

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

/* ---------- the step ---------- */
const state={key:null,startedAt:0};
const MAX_WAIT=15*60*1000;
async function rules(s,c,H){
 await H.until(()=>document.body.innerText.length>200,H.id,12000);
 const r=readRules();
 if(r.blocked)return{blocked:true,message:`Skipped ${s.label}: its rules forbid promotion (“${r.reason}”). Nothing was posted.`};
 return{blocked:false,message:r.found?`Rules of ${s.label} read: no ban on promotion found.`:`Rules of ${s.label} could not be read; continuing.`};
}
const POSTED_PENDING=/pending|awaiting|waiting for (admin|approval)|submitted for approval|admins? (will|must) (review|approve)|post is being reviewed/i;
async function outcome(s,H,snippet,{auto}){
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
async function post(s,c,H){
 const{id,T,active,until}=H;
 if(!await until(()=>document.querySelector('[role="main"]')||D.scope(),id,15000))throw Error('Facebook did not render this group.');
 await sleep(800);
 const text=s.text,snippet=norm(text).slice(0,40),key='post:'+s.gid+':'+hash(text);
 const resuming=state.key===key;
 if(!resuming){
  if(D.headerMatch(/^Join( group)?$/i))return{message:`Skipped ${s.label}: you are not a member of this group.`};
  if(D.headerMatch(/^(Cancel request|Request sent)\b/i))return{message:`Skipped ${s.label}: your request to join is still pending.`};
  const {receipts={}}=await chrome.storage.local.get('receipts');
  if(receipts[key])return{message:`Skipped ${s.label}: Aurora already posted or tried this exact text here. Nothing sent again.`};
 }
 if(c.dry){
  const l=await until(launcher,id,8000);
  if(!l)throw Error('Cannot find the “Write something…” box in this group. Check that you can post here.');
  return{preview:true,message:`Preview: would open the post box in ${s.label} and ${c.postMode==='auto'?'post your text':'fill in your text for you to post'}. Nothing was posted.`};
 }
 let d=composer();
 if(resuming){
  // assisted: waiting for the person to press Post (or to close the box to skip this group)
  if(d){
   const b=boxOf(d);
   if(Date.now()-state.startedAt>MAX_WAIT){state.key=null;throw Error(`You did not post in ${s.label} within 15 minutes. Press Resume to continue with the next group, or Stop.`);}
   if(b&&boxText(b).includes(snippet))return{wait:`Your text is in the ${s.label} box. Read it, then press Post yourself. (Close the box to skip this group.)`};
   return{wait:`Waiting for you in ${s.label}…`};
  }
  const o=await outcome(s,H,snippet,{auto:false});
  if(o.unsure)return{wait:`Finish or discard the box in ${s.label}…`};
  state.key=null;
  if(o.posted){const {receipts={}}=await chrome.storage.local.get('receipts');receipts[key]={status:'confirmed',phase:'posted',time:Date.now()};await chrome.storage.local.set({receipts});return{performed:true,message:o.pending?`Submitted to ${s.label} (the admins must approve it first).`:`Posted in ${s.label}.`};}
  return{message:`Skipped ${s.label}: the box was closed and no post appeared.`};
 }
 if(!d){
  const l=await until(launcher,id,8000);
  if(!l)throw Error('Cannot find the “Write something…” box in this group. Check that you can post here, then resume.');
  await active(id);D.reveal(l);await sleep(500);clickLike(l);T('post box clicked');
  d=await until(composer,id,8000);
  if(!d)throw Error('The post box did not open. Nothing was posted.');
 }
 const box=await until(()=>boxOf(d),id,5000);
 if(!box)throw Error('The post box has no text area. Nothing was posted.');
 await active(id);
 if(!await typeOnce(box,text))throw Error('Could not put your text into the post box. Nothing was posted.');
 T('text placed');
 state.key=key;state.startedAt=Date.now();
 if(c.postMode!=='auto')return{wait:`Your text is in the ${s.label} box. Read it, then press Post yourself. (Close the box to skip this group.)`};
 // automatic: a short, human pause, then press Post exactly once
 await sleep(1200+Math.random()*1600);await active(id);
 const btn=await until(()=>postButton(composer()),id,6000);
 if(!btn){state.key=null;throw Error('The Post button is missing or disabled. Nothing was posted. Check the group and resume.');}
 const {receipts={}}=await chrome.storage.local.get('receipts');receipts[key]={status:'attempted',phase:'dispatch',time:Date.now()};await chrome.storage.local.set({receipts});
 await active(id);clickLike(btn);T('Post pressed');
 for(let t=0;t<20000&&composer();t+=500)await sleep(500);
 state.key=null;
 if(composer())throw Error(`Post was pressed in ${s.label} but the box did not close, so the result is unknown. Check the group. Aurora will not post it again.`);
 const o=await outcome(s,H,snippet,{auto:true});
 if(!o.posted)throw Error(`Post was sent in ${s.label} but could not be confirmed. Check the group. Aurora will not post it again.`);
 receipts[key]={status:'confirmed',phase:'posted',time:Date.now()};await chrome.storage.local.set({receipts});
 return{performed:true,message:o.pending?`Submitted to ${s.label} (the admins must approve it first).`:`Posted in ${s.label}.`};
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
async function listGroups(){
 const map=new Map();let stale=0;
 for(let i=0;i<40&&stale<4;i++){const before=map.size;readGroups(map);stale=map.size===before?stale+1:0;window.scrollBy(0,Math.max(700,innerHeight));await sleep(900);}
 readGroups(map);
 return[...map.values()].slice(0,300);
}
chrome.runtime.onMessage.addListener((m,s,reply)=>{
 if(m.action!=='listGroups'||s.id!==chrome.runtime.id||s.tab)return;
 if(!/\/groups\/(joins|feed)?\/?$/.test(location.pathname)&&!/\/groups\/joins/.test(location.pathname)){reply({error:'Open facebook.com/groups/joins first.'});return;}
 listGroups().then(groups=>reply({groups}),e=>reply({error:e.message}));return true;
});

globalThis.AuroraGroupPost={run(s,c,H){return s.kind==='grules'?rules(s,c,H):post(s,c,H);},readRules,typeOnce,launcher,composer,state};
})();
