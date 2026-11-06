// "Post to groups" tab: write one post, choose groups (all or by hand), optionally have Aurora Reply write a different wording for each group,
// then start an assisted or automatic run. Needs the helpers dashboard.js already defines ($, send, tab, render, licenseOk, canRun).
(()=>{
const API='https://getaurorastudios.com/api';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const G={groups:[],sel:new Set(),texts:{},last:{},lists:{},flags:{},q:'',ack:false,busy:false,delayTouched:false};
const section=document.createElement('section');section.id='groups';section.hidden=true;section.className='card';
section.innerHTML=`<div class="card-head"><h2>Post to groups</h2><span class="hint" id="gpUsage"></span></div>
<p class="hint">Write one post and send it to the groups you choose, one at a time, at a calm pace. You stay in control: in <b>Assisted</b> mode Aurora fills the post box and <b>you press Post</b>.</p>
<h3 class="gp-h">1 · Your post</h3>
<textarea id="gpText" maxlength="5000" rows="5" placeholder="Write the post that goes into every group you choose"></textarea>
<div class="gp-row"><label class="gp-radio"><input type="radio" name="gpVar" value="same" checked> Same text in every group</label><label class="gp-radio"><input type="radio" name="gpVar" value="ai"> Different wording for each group <small>(uses Aurora Reply credits, 1 per group)</small></label></div>
<div id="gpAi" hidden class="gp-box"><label for="gpKey">Your Aurora Reply key</label><input id="gpKey" placeholder="AUR-XXXX-XXXX-XXXX" autocomplete="off"><div class="gp-row"><button type="button" id="gpWrite">✦ Write the versions</button><span class="hint" id="gpWriteNote"></span></div><p class="hint">Aurora keeps every fact, price, date and link, and only changes the wording. Works for posts up to 700 characters. You can edit every version below.</p></div>
<h3 class="gp-h">2 · Choose groups <small>(groups you are already a member of)</small></h3>
<div class="gp-row"><label class="gp-radio"><input type="radio" name="gpHow" value="single" checked> One post per group <small>(Aurora goes to each group in turn)</small></label><label class="gp-radio"><input type="radio" name="gpHow" value="multi"> Several groups in one post <small>(Facebook's own “Add groups”, up to 9 at a time)</small></label></div>
<div id="gpMulti" hidden class="gp-box">Aurora opens the first group's post box, then uses Facebook's <b>Add groups</b> list to tick the other groups by name, writes your text once and posts once. Everyone in those groups sees the same text. <label for="gpBatch">Groups per post</label><input id="gpBatch" type="number" min="2" max="9" value="5"></div>
<div class="gp-row"><button type="button" id="gpLoad">⟳ Load my groups</button><button type="button" id="gpAll">☑ Select all</button><button type="button" id="gpNone">Clear all</button><input id="gpSearch" placeholder="Search your groups…" aria-label="Search your groups"><select id="gpLists" aria-label="Saved lists"><option value="">Saved lists…</option></select><button type="button" id="gpSaveList">Save selection as a list</button><button type="button" id="gpDelList" hidden>Delete list</button></div>
<div class="gp-row"><select id="gpFilter" aria-label="Filter groups"><option value="all">Show all groups</option><option value="noapproval">Hide groups that need admin approval</option><option value="approval">Only groups that need admin approval</option><option value="nobans">Hide groups that ban promotion</option></select><button type="button" id="gpCheck" title="Opens each chosen group and reads its rules. Posts nothing.">🔍 Check rules of the chosen groups</button></div>
<p class="hint">Facebook does not tell us which groups hold posts for admins or ban promotion until we look. Aurora reads each group's rules during a run (or when you press “Check rules”) and remembers it here.</p>
<div id="gpEmpty" class="gp-box">No groups loaded yet. Press <b>Load my groups</b>: Aurora opens your Facebook “Groups” page and reads the names. It does not post anything.</div>
<table id="gpTable" hidden><thead><tr><th></th><th>Group</th><th>What Aurora knows</th><th>Last post by you</th></tr></thead><tbody></tbody></table>
<p class="hint" id="gpCount"></p>
<details id="gpVersions" hidden><summary>Check or edit the text for each group</summary><div id="gpVerList"></div></details>
<h3 class="gp-h">3 · Pace &amp; safety</h3>
<div class="gp-row"><label class="gp-radio"><input type="radio" name="gpMode" value="assist" checked> ✋ <b>Assisted</b> (recommended): Aurora fills the box, you press Post</label><label class="gp-radio"><input type="radio" name="gpMode" value="auto"> ⚡ <b>Automatic</b>: Aurora presses Post too</label></div>
<div id="gpWarn" hidden class="gp-warn"><b>Before you use Automatic mode</b><p>Facebook's rules do not allow automation, and group posting is closely watched. Your account can be limited (for example blocked from posting in groups) or banned, and group admins can remove you for promotion. Aurora spaces posts out and stops on warnings, but it cannot remove this risk. Assisted mode is much safer.</p><label class="gp-radio"><input type="checkbox" id="gpAck"> I understand and accept this risk.</label></div>
<div class="gp-row"><div><label for="gpDelay">Wait between groups (minutes)</label><input id="gpDelay" type="number" min="1" max="1440" value="2"></div><div><label for="gpCap">Max groups per day (0 = no limit)</label><input id="gpCap" type="number" min="0" max="50" value="5"></div></div>
<div class="gp-row"><label class="gp-radio"><input type="checkbox" id="gpRules" checked> Read each group's rules first and skip groups that ban promotion</label></div>
<div id="gpEst" class="gp-note"></div>
<div class="gp-row"><label class="gp-radio"><input type="checkbox" id="gpDry" checked> Preview only (opens each group and checks the post box, but posts nothing)</label></div>
<div class="gp-row"><button type="button" id="gpStart" class="gp-go">✦ Start</button><span id="gpMsg" class="hint" role="status"></span></div>`;
document.getElementById('history').before(section);
const nav=document.createElement('button');nav.id='groupsTab';nav.innerHTML='▤ &nbsp; Post to groups';document.getElementById('studioTab').after(nav);
const $=id=>document.getElementById(id);
nav.onclick=()=>{tab('groups');open();};
const store={get:k=>chrome.storage.local.get(k),set:o=>chrome.storage.local.set(o)};
const fmtAgo=t=>{if(!t)return '—';const d=Math.floor((Date.now()-t)/864e5);return d<1?'today':d===1?'yesterday':d+' days ago';};
const fmtDur=s=>s<90?'a minute':s<5400?Math.round(s/60)+' minutes':(Math.round(s/360)/10)+' hours';
const mode=()=>document.querySelector('input[name=gpMode]:checked').value;
const variation=()=>document.querySelector('input[name=gpVar]:checked').value;
const how=()=>document.querySelector('input[name=gpHow]:checked').value;
const flagOf=g=>G.flags[g.id]||{};
const shown=()=>{const f=$('gpFilter').value;return G.groups.filter(g=>(!G.q||g.name.toLowerCase().includes(G.q))&&(f==='all'||(f==='noapproval'&&!flagOf(g).approval)||(f==='approval'&&flagOf(g).approval)||(f==='nobans'&&!flagOf(g).promoBan)));};

async function open(){
 const x=await store.get(['gpGroups','groupLists','receipts','replyKey','gpAck','gpFlags','gpLoad']);G.flags=x.gpFlags||{};adoptLoad(x.gpLoad,x.gpGroups);
 if(!G.groups.length&&x.gpGroups?.list?.length)G.groups=x.gpGroups.list;
 G.lists=x.groupLists||{};G.ack=!!x.gpAck;$('gpAck').checked=G.ack;if(x.replyKey&&!$('gpKey').value)$('gpKey').value=x.replyKey;
 G.last={};for(const [k,v] of Object.entries(x.receipts||{})){const m=k.match(/^post:([^:]+):/);if(m&&v.status==='confirmed')G.last[m[1]]=Math.max(G.last[m[1]]||0,v.time||0);}
 paint();
}
function paintLists(){const sel=$('gpLists');const cur=sel.value;sel.innerHTML='<option value="">Saved lists…</option>'+Object.keys(G.lists).map(n=>`<option value="${esc(n)}">${esc(n)} (${G.lists[n].length})</option>`).join('');sel.value=G.lists[cur]?cur:'';$('gpDelList').hidden=!sel.value;}
function paint(){
 $('gpEmpty').hidden=G.groups.length>0;$('gpTable').hidden=!G.groups.length;
 $('gpTable').tBodies[0].innerHTML=shown().map(g=>{const recent=G.last[g.id]&&Date.now()-G.last[g.id]<7*864e5;const fl=flagOf(g),chips=(fl.approval?'<span class="gp-warnchip" title="Posts here wait for an admin to approve them">⏳ admin approval</span> ':'')+(fl.promoBan?'<span class="gp-warnchip gp-bad" title="The rules forbid promotion">🚫 bans promotion</span> ':'')+(fl.rulesRead&&!fl.approval&&!fl.promoBan?'<span class="gp-okchip">✓ rules read</span>':'');return `<tr><td><input type="checkbox" data-g="${esc(g.id)}" ${G.sel.has(g.id)?'checked':''} aria-label="Select ${esc(g.name)}"></td><td><b>${esc(g.name)}</b></td><td>${chips||'<span class="gp-dim">not checked yet</span>'}</td><td>${fmtAgo(G.last[g.id])}${recent?' <span class="gp-warnchip" title="You posted here in the last 7 days. Posting again soon can look like spam.">⚠ recent</span>':''}</td></tr>`;}).join('');
 paintLists();paintCounts();
}
function chosen(){return G.groups.filter(g=>G.sel.has(g.id));}
function paintCounts(){
 const n=chosen().length;$('gpCount').textContent=n?`${n} group${n===1?'':'s'} selected`:'No groups selected yet.';
 $('gpVersions').hidden=!n;
 $('gpVerList').innerHTML=chosen().map(g=>`<label class="gp-ver">${esc(g.name)}</label><textarea data-t="${esc(g.id)}" rows="3" maxlength="5000">${esc(G.texts[g.id]??$('gpText').value)}</textarea>`).join('');
 const delay=Math.max(1,+$('gpDelay').value||2)*60,cap=+$('gpCap').value||0,multi=how()==='multi',batch=Math.max(2,Math.min(9,+$('gpBatch').value||5)),posts=multi?Math.ceil(n/batch):n,total=Math.max(0,posts-1)*delay*1.2+posts*20,days=cap>0?Math.ceil(n/cap):1;
 $('gpEst').textContent=n?(multi?`${n} group${n===1?'':'s'} in ${posts} post${posts===1?'':'s'} of up to ${batch} groups. `:'')+`It takes about ${fmtDur(total)}${multi?'':` for ${n} group${n===1?'':'s'}`}, with ${$('gpDelay').value||2} minute${+$('gpDelay').value===1?'':'s'} between ${multi?'posts':'groups'}.`+(days>1?` Your limit of ${cap} groups a day means Aurora stops after ${cap} and you press Resume the next day (about ${days} days in all).`:'')+(mode()==='assist'?' In Assisted mode you press Post each time, so it also depends on you.':''):'';
 $('gpWarn').hidden=mode()!=='auto';$('gpMulti').hidden=!multi;$('gpWrite').disabled=multi;
 $('gpWriteNote').textContent=n?`Uses ${n} credit${n===1?'':'s'}.`:'';
}
$('gpTable').addEventListener('change',e=>{const id=e.target.dataset?.g;if(!id)return;e.target.checked?G.sel.add(id):G.sel.delete(id);paintCounts();});
$('gpAll').onclick=()=>{for(const g of shown())G.sel.add(g.id);paint();};
$('gpNone').onclick=()=>{G.sel.clear();paint();};
$('gpSearch').oninput=e=>{G.q=e.target.value.trim().toLowerCase();paint();};
$('gpDelay').oninput=$('gpCap').oninput=paintCounts;
$('gpText').oninput=()=>{for(const t of document.querySelectorAll('#gpVerList textarea')){if(!(t.dataset.t in G.texts))t.value=$('gpText').value;}};
document.querySelectorAll('input[name=gpMode]').forEach(r=>r.onchange=()=>{if(!G.delayTouched)$('gpDelay').value=mode()==='auto'?5:2;paintCounts();});
$('gpDelay').addEventListener('input',()=>{G.delayTouched=true;});
document.querySelectorAll('input[name=gpHow]').forEach(r=>r.onchange=()=>{if(how()==='multi'){document.querySelector('input[name=gpVar][value=same]').checked=true;$('gpAi').hidden=true;}paintCounts();});
$('gpBatch').oninput=paintCounts;$('gpFilter').onchange=paint;
document.querySelectorAll('input[name=gpVar]').forEach(r=>r.onchange=()=>{$('gpAi').hidden=variation()!=='ai';});
$('gpVerList').addEventListener('input',e=>{if(e.target.dataset?.t)G.texts[e.target.dataset.t]=e.target.value;});
$('gpAck').onchange=()=>{G.ack=$('gpAck').checked;store.set({gpAck:G.ack});};
$('gpLists').onchange=()=>{const n=$('gpLists').value;$('gpDelList').hidden=!n;if(!n)return;G.sel=new Set(G.lists[n].filter(id=>G.groups.some(g=>g.id===id)));paint();$('gpLists').value=n;$('gpDelList').hidden=false;};
$('gpSaveList').onclick=async()=>{const ids=chosen().map(g=>g.id);if(!ids.length){$('gpMsg').textContent='Tick some groups first.';return;}const name=(prompt('Name this list (for example “Local groups”):')||'').trim().slice(0,40);if(!name)return;G.lists[name]=ids;await store.set({groupLists:G.lists});paintLists();$('gpLists').value=name;$('gpDelList').hidden=false;$('gpMsg').textContent=`Saved “${name}” with ${ids.length} groups.`;};
$('gpDelList').onclick=async()=>{const n=$('gpLists').value;if(!n)return;delete G.lists[n];await store.set({groupLists:G.lists});paintLists();};
// Loading the groups runs in the background and brings this window back when it is done: the result arrives through storage.
function adoptLoad(l,cache){
 if(l&&l.state==='done'&&Array.isArray(l.groups)&&l.groups.length&&(!cache||l.time>=(cache.time||0))){G.groups=l.groups;store.set({gpGroups:{list:l.groups,time:l.time}});}
 else if(!G.groups.length&&cache?.list?.length)G.groups=cache.list;
}
function paintLoad(l){
 if(!l)return;const stale=l.state==='running'&&Date.now()-l.time>4*60*1000;
 if(l.state==='running'&&!stale){$('gpLoad').disabled=true;$('gpMsg').textContent=`Reading your Facebook groups… ${l.n||0} found so far. This window comes back by itself when it is done.`;}
 else if(l.state==='done'){$('gpLoad').disabled=false;adoptLoad(l,null);$('gpMsg').textContent=`Done: found ${l.n} group${l.n===1?'':'s'}.`;paint();}
 else if(l.state==='error'||stale){$('gpLoad').disabled=false;$('gpMsg').textContent=stale?'Loading took too long. Try again.':l.error;}
}
try{chrome.storage.onChanged.addListener((ch,area)=>{if(area==='local'&&ch.gpLoad)paintLoad(ch.gpLoad.newValue);if(area==='local'&&ch.gpFlags){G.flags=ch.gpFlags.newValue||{};if(!section.hidden)paint();}});}catch{}
$('gpLoad').onclick=async()=>{
 $('gpLoad').disabled=true;$('gpMsg').textContent='Starting… Aurora opens your Facebook groups page and reads the names.';
 try{const r=await chrome.runtime.sendMessage({action:'listGroups'});if(!r?.ok)throw Error(r?.error||'No answer from Aurora.');}
 catch(e){$('gpMsg').textContent=e.message;$('gpLoad').disabled=false;}
};
// different wording per group, written by Aurora Reply (1 credit per version)
async function installId(){const x=await store.get('gpInstall');if(x.gpInstall)return x.gpInstall;const id=crypto.randomUUID();await store.set({gpInstall:id});return id;}
$('gpWrite').onclick=async()=>{
 const text=$('gpText').value.trim(),list=chosen(),key=$('gpKey').value.trim().toUpperCase();
 if(!text){$('gpWriteNote').textContent='Write the post first.';return;}if(!list.length){$('gpWriteNote').textContent='Choose the groups first.';return;}
 if(!/^AUR-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(key)){$('gpWriteNote').textContent='Paste your Aurora Reply key (from your account page).';return;}
 $('gpWrite').disabled=true;await store.set({replyKey:key});const iid=await installId();const out=[];let note='';
 try{
  while(out.length<list.length){
   const want=Math.min(6,list.length-out.length);$('gpWriteNote').textContent=`Writing ${out.length+1}–${out.length+want} of ${list.length}…`;
   const res=await fetch(API+'/reply/variants',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key,installId:iid,platform:'facebook',text,count:want})});
   const j=await res.json().catch(()=>({}));if(!res.ok||!j.ok)throw Error(j.message||'Could not write the versions. Try again.');
   out.push(...j.variants);if(j.usage)note=` ${j.usage.used} of ${j.usage.limit} credits used.`;if(j.variants.length<want)break;
  }
  list.forEach((g,i)=>{G.texts[g.id]=out[i]||text;});paintCounts();$('gpVersions').open=true;
  $('gpWriteNote').textContent=out.length<list.length?`Wrote ${out.length} of ${list.length} (you ran out of credits); the rest use your own text.${note}`:`Done: read every version below, you can edit them.${note}`;
 }catch(e){$('gpWriteNote').textContent=e.message;}finally{$('gpWrite').disabled=false;}
};
// start (or, with check=true, only read the rules of the chosen groups: a preview that posts nothing)
async function begin(check){
 const msg=t=>{$('gpMsg').textContent=t;};
 const text=$('gpText').value.trim()||(check?'Rules check':''),list=chosen(),dry=check||$('gpDry').checked,auto=!check&&mode()==='auto',multi=!check&&how()==='multi';
 if(!text)return msg('Write the post first.');if(!list.length)return msg('Choose at least one group.');
 if(auto&&!G.ack)return msg('Tick the box to accept the risk before using Automatic mode.');
 if(!dry&&typeof licenseOk!=='undefined'&&!licenseOk)return msg('Live tasks need a license key. Preview works without one — or add your key in the Studio tab (free 3-day trial, no card needed).');
 const config={action:'post',mode:'groups',dry,postMode:auto?'auto':'assist',autoAck:auto&&G.ack,postText:text,postHow:multi?'multi':'single',batchSize:Math.max(2,Math.min(9,+$('gpBatch').value||5)),
  groupList:list.map(g=>({id:g.id,name:g.name,text:(G.texts[g.id]??text).trim()||text})),
  delay:dry?10:Math.round(Math.max(1,+$('gpDelay').value||2)*60),dailyCap:check?0:Math.max(0,+$('gpCap').value||0),ignoreRules:check?false:!$('gpRules').checked};
 if(!dry&&!G.armed){G.armed=setTimeout(()=>{G.armed=null;$('gpStart').textContent='✦ Start';},15000);$('gpStart').textContent='Confirm: post to '+list.length+' group'+(list.length===1?'':'s');return msg(`Live: ${auto?'Aurora will press Post':'Aurora fills the box and you press Post'} in ${list.length} group${list.length===1?'':'s'}. Click Confirm within 15 seconds.`);}
 clearTimeout(G.armed);G.armed=null;$('gpStart').textContent='✦ Start';
 $('gpStart').disabled=true;$('gpCheck').disabled=true;msg('Starting…');
 try{const r=await chrome.runtime.sendMessage({action:'start',config});if(!r?.ok)msg(r?.error||'Could not start.');else{notice(r.message||'Started.');await render();tab('studio');msg('');}}catch(e){msg(e.message);}finally{$('gpStart').disabled=false;$('gpCheck').disabled=false;}
}
$('gpStart').onclick=()=>begin(false);
$('gpCheck').onclick=()=>begin(true);
globalThis.AuroraGroupsUI={G,open,paint};
})();
