// Post to groups, offline: the plan (engine), the page steps on a made-up group page, the group list, and the "Post to groups" tab.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const ROOT=path.join(__dirname,'..'),read=n=>fs.readFileSync(path.join(ROOT,n),'utf8');let passed=0;const check=(n,v)=>{assert(v,n);passed++;console.log('PASS '+n);};
// ---- engine: configuration and the step plan ----
const c0=vm.createContext({URL,URLSearchParams,crypto:{randomUUID:()=>'x'}});for(const f of ['selectors.js','engine.js'])vm.runInContext(read(f),c0);const E=c0.AuroraEngine;
const base={action:'post',dry:false,postText:'Fresh sourdough Saturday!',postMode:'assist',delay:600,dailyCap:5,groupList:[{id:'bakers',name:'Bread Bakers'},{id:'123456',name:'Local Foodies',text:'Different wording here'},{id:'bakers',name:'dup'}]};
const cfg=(o={})=>E.config({...JSON.parse(JSON.stringify(base)),...o});
let c=cfg();check('engine: duplicate groups are dropped and each group gets its own text (or the shared one)',c.groupList.length===2&&c.groupList[0].text==='Fresh sourdough Saturday!'&&c.groupList[1].text==='Different wording here'&&c.limit===2);
let q=E.initial(c);check('engine: each group is planned as a rules check, then the post (in order)',q.map(s=>s.kind).join()==='grules,gpost,grules,gpost'&&q[1].url==='https://www.facebook.com/groups/bakers/'&&q[2].url==='https://www.facebook.com/groups/123456/about'&&q[3].text==='Different wording here');
check('engine: "skip the rules check" plans only the posts',E.initial(cfg({ignoreRules:true})).map(s=>s.kind).join()==='gpost,gpost');
check('engine: automatic mode is refused without the risk confirmation, accepted with it',(()=>{try{cfg({postMode:'auto',delay:600});return false;}catch(e){return /risk/.test(e.message);}})()&&cfg({postMode:'auto',autoAck:true,delay:600,dailyCap:5}).postMode==='auto');
check('engine: automatic mode needs at least 5 minutes between groups and a daily limit of 1 to 15',(()=>{for(const o of [{delay:120},{dailyCap:0},{dailyCap:40}])try{cfg({postMode:'auto',autoAck:true,...o});return false;}catch{}return true;})());
check('engine: bad input is refused (no text, no groups, too many groups, bad group id, assisted wait under a minute)',(()=>{const bad=[{postText:' '},{groupList:[]},{groupList:Array.from({length:51},(_,i)=>({id:'g'+i,name:'g'}))},{groupList:[{id:'a b',name:'x'}]},{delay:30}];for(const o of bad)try{cfg(o);return false;}catch{}return true;})());
check('engine: a preview may use a short wait',cfg({dry:true,delay:10}).delay===10);
{const job={config:cfg(),queue:E.initial(c),skipped:0,finished:[]};const rules=job.queue.shift();const more=E.expand(job,rules,{blocked:true});check('engine: a group whose rules ban promotion loses its post step and counts as skipped',more.length===0&&job.queue.length===2&&job.queue[0].kind==='grules'&&job.skipped===1&&job.finished[0].note==='group rules');
 const job2={config:cfg(),queue:E.initial(c),skipped:0};const r2=job2.queue.shift();E.expand(job2,r2,{blocked:false});check('engine: a group whose rules are fine keeps its post step',job2.queue.length===3&&job2.queue[0].kind==='gpost');}
// ---- page: a made-up group page with an editor that draws edits late, like Facebook's ----
const GROUP=(extra='',member='Joined')=>`<!doctype html><html lang="en"><body><main role="main"><h1>Bread Bakers</h1><div role="button" tabindex="0">${member}</div>
<div id="launch" role="button" tabindex="0"><span>Write something...</span></div><div role="feed" id="feed"><div role="article"><p>An older post</p></div></div>${extra}</main>
<script>window.model='';window.presses=0;window.pending=${/PENDING/.test(extra)};
function draw(ed,pb){ed.textContent=window.model;pb.setAttribute('aria-disabled',window.model?'false':'true');}
document.getElementById('launch').addEventListener('click',()=>{if(document.querySelector('[role=dialog]'))return;
 const d=document.createElement('div');d.setAttribute('role','dialog');d.innerHTML='<div role="textbox" contenteditable="true" data-lexical-editor="true" aria-label="Create a public post"></div><div role="button" id="postbtn" aria-disabled="true" tabindex="0">Post</div><div role="button" id="closebtn" tabindex="0">Close</div>';document.body.append(d);
 const ed=d.querySelector('[role=textbox]'),pb=d.querySelector('#postbtn');window.model='';
 ed.addEventListener('input',e=>{const data=e.data;ed.textContent=window.model;setTimeout(()=>{window.model+=data;draw(ed,pb);},80);});
 ed.addEventListener('paste',e=>{e.preventDefault();const t=e.clipboardData.getData('text/plain');setTimeout(()=>{window.model+=t;draw(ed,pb);},80);});
 pb.addEventListener('click',()=>{if(pb.getAttribute('aria-disabled')==='true')return;window.presses++;const t=window.model;d.remove();setTimeout(()=>{const a=document.createElement('div');a.setAttribute('role','article');a.innerHTML=window.pending?'<p>Your post is pending admin approval</p>':'<p>'+t+'</p>';document.getElementById('feed').prepend(a);},300);});
 d.querySelector('#closebtn').addEventListener('click',()=>d.remove());});
</script></body></html>`;
const MOCK=`window.data={job:{id:'test',status:'running'},receipts:{},history:[]};window.listeners=[];
window.chrome={runtime:{id:'extension',onMessage:{addListener:f=>listeners.push(f)},sendMessage:async()=>({ok:true}),getManifest:()=>({version:'9'})},storage:{local:{get:async k=>{const o={};[].concat(k||[]).forEach(x=>{if(x in data)o[x]=structuredClone(data[x]);});return o;},set:async o=>Object.assign(data,structuredClone(o)),remove:async()=>{}}}};
const nt=window.setTimeout;window.setTimeout=(f,ms,...a)=>nt(f,ms>1500?Math.min(ms,1500):ms,...a);`;
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--no-proxy-server']});
try{
 const ctx=await browser.newContext({viewport:{width:1200,height:900}}),pg=await ctx.newPage();pg.on('pageerror',e=>{throw e;});
 const open=async(html,url='https://www.facebook.com/groups/bakers/')=>{await pg.unroute('**/*');await pg.route('**/*',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:html}));await pg.goto(url);await pg.addScriptTag({content:MOCK});for(const f of ['selectors.js','engine.js','dom.js','comments.js','content.js','groupposts.js'])await pg.addScriptTag({content:read(f)});};
 const send=(m)=>pg.evaluate(m=>new Promise(r=>{let done=false;for(const f of listeners){const ret=f(m,{id:'extension',url:'chrome-extension://extension/dashboard.html'},x=>{if(!done){done=true;r(x);}});if(ret===true)break;}}),m);
 const step=(kind,over={},cfgOver={})=>send({action:'step',jobId:'test',step:{kind,url:'https://www.facebook.com/groups/bakers/',label:'Bread Bakers',gid:'bakers',text:'Fresh sourdough Saturday! Pre-order by Friday 6pm.',...over},config:{action:'post',dry:false,postMode:'assist',mode:'groups',exclude:[],perUser:1,limit:2,...cfgOver}});
 const model=()=>pg.evaluate(()=>({model:window.model,dom:(document.querySelector('[role=textbox]')||{}).textContent,presses:window.presses,dialogs:document.querySelectorAll('[role=dialog]').length}));
 const TEXT='Fresh sourdough Saturday! Pre-order by Friday 6pm.';
 // preview
 await open(GROUP());let r=await step('gpost',{}, {dry:true});check('preview: finds the post box, opens nothing, posts nothing',r.preview&&/Preview/.test(r.message)&&(await model()).dialogs===0);
 // assisted
 await open(GROUP());r=await step('gpost');let m=await model();
 check('assisted: the text is put in the box exactly once (even though the editor draws it late) and the step waits for the person',r.wait&&/press Post yourself/.test(r.wait)&&m.model===TEXT&&m.presses===0);
 r=await step('gpost');check('assisted: while the box stays open it keeps waiting and does not type again',r.wait&&(await model()).model===TEXT);
 await pg.evaluate(()=>document.getElementById('postbtn').click());await pg.waitForTimeout(600);r=await step('gpost');
 check('assisted: after the person presses Post the step confirms the post appeared and counts it',r.performed===true&&/Posted in Bread Bakers/.test(r.message)&&(await model()).presses===1);
 check('assisted: a confirmed receipt is saved so the same text is never posted to this group twice',await pg.evaluate(()=>Object.keys(data.receipts).some(k=>/^post:bakers:/.test(k)&&data.receipts[k].status==='confirmed')));
 r=await step('gpost');check('the same text is skipped the next time, not posted again',!r.performed&&/already posted or tried/.test(r.message));
 // assisted, closed without posting
 await open(GROUP());await step('gpost');await pg.evaluate(()=>document.getElementById('closebtn').click());r=await step('gpost');
 check('assisted: closing the box without posting skips the group and counts nothing',!r.performed&&/closed and no post appeared/.test(r.message)&&(await model()).presses===0);
 // admin approval
 await open(GROUP('<!--PENDING-->'));await step('gpost');await pg.evaluate(()=>document.getElementById('postbtn').click());await pg.waitForTimeout(600);r=await step('gpost');
 check('a group that holds posts for admins is reported as submitted, not as posted',r.performed&&/admins must approve/.test(r.message));
 // automatic
 await open(GROUP());r=await step('gpost',{},{postMode:'auto'});m=await model();
 check('automatic: types the text once, presses Post once, confirms the post, and saves a receipt',r.performed===true&&m.presses===1&&m.dialogs===0&&await pg.evaluate(()=>Object.values(data.receipts).some(v=>v.status==='confirmed')));
 const feed=await pg.evaluate(()=>[...document.querySelectorAll('[role=article] p')].map(p=>p.textContent));
 check('automatic: the group shows the post once, with the text once (not doubled)',feed.filter(t=>t===TEXT).length===1);
 // not a member
 await open(GROUP('','Join group'));r=await step('gpost');check('a group you are not a member of is skipped without opening anything',!r.performed&&/not a member/.test(r.message)&&(await model()).dialogs===0);
 // missing box
 await open('<!doctype html><html lang="en"><body><main role="main"><h1>Locked group</h1><div role="button">Joined</div><div role="feed"><div role="article"><p>x</p></div></div></main></body></html>');r=await step('gpost');
 check('no post box: a readable error, nothing posted',/Cannot find the “Write something/.test(r.error||''));
 // rules
 await open('<!doctype html><html lang="en"><body><main role="main"><h1>Bread Bakers</h1><div role="button">Joined</div><div role="article"><p>hi there this is a long enough page body to count as rendered, hi there hi there hi there hi there hi there hi there hi there hi there hi</p></div><h2>Group rules</h2><p>1. Be kind. 2. No self-promotion or advertising without permission. 3. No spam.</p></main></body></html>','https://www.facebook.com/groups/bakers/about');
 r=await step('grules',{url:'https://www.facebook.com/groups/bakers/about'});check('rules: "no self-promotion" is recognised and the group is blocked with the reason',r.blocked===true&&/forbid promotion/.test(r.message));
 await open('<!doctype html><html lang="en"><body><main role="main"><h1>Bread Bakers</h1><div role="button">Joined</div><div role="article"><p>hi there this is a long enough page body to count as rendered, hi there hi there hi there hi there hi there hi there hi there hi there hi</p></div><h2>Group rules</h2><p>1. Be kind. 2. Stay on topic. 3. Sales posts are welcome on Saturdays.</p></main></body></html>','https://www.facebook.com/groups/bakers/about');
 r=await step('grules',{url:'https://www.facebook.com/groups/bakers/about'});check('rules: friendly rules do not block',r.blocked===false);
 await open('<!doctype html><html lang="en"><body><main role="main"><h1>Bread Bakers</h1><div role="article"><p>a long enough page body to count as rendered, a long enough page body to count as rendered, a long enough page body to count as rendered, a long enough page body</p></div></main></body></html>','https://www.facebook.com/groups/bakers/about');
 r=await step('grules',{url:'https://www.facebook.com/groups/bakers/about'});check('rules: a page with no readable rules does not block (and says so)',r.blocked===false&&/could not be read/.test(r.message));
 // group list
 await open('<!doctype html><html lang="en"><body><main role="main"><a href="/groups/feed/">Your feed</a><a href="/groups/discover/">Discover</a><a href="/groups/create/">Create new group</a><a href="https://www.facebook.com/groups/bakers/">Bread Bakers</a><a href="/groups/123456789/">Local Foodies Austin<br>Last active 2 days ago</a><a href="/groups/bakers/">Bread Bakers</a><a href="/groups/joins/">See all</a></main></body></html>','https://www.facebook.com/groups/joins/');
 r=await send({action:'listGroups'});check('group list: real groups are listed once with their names; feed, discover, create and "see all" are ignored',r.groups&&r.groups.length===2&&r.groups[0].id==='bakers'&&r.groups[1].name==='Local Foodies Austin',JSON.stringify(r));
 await open(GROUP());r=await send({action:'listGroups'});check('group list: refuses to read anywhere but the groups page',/groups\/joins/.test(r.error||''));
 // ---- the "Post to groups" tab ----
 const ui=await (await browser.newContext({viewport:{width:1200,height:1000}})).newPage();ui.on('pageerror',e=>{throw e;});
 await ui.setContent(read('dashboard.html').replace(/<script src="[^"]*"><\/script>/g,'').replace(/<link[^>]*stylesheet[^>]*>/,''));
 await ui.evaluate(()=>{const store={};window.prompt=()=>'Local groups';window.__sent=[];window.chrome={storage:{local:{get:async k=>{const o={};[].concat(k||[]).forEach(x=>{if(x in store)o[x]=store[x];});return o;},set:async o=>Object.assign(store,o),remove:async()=>{}},onChanged:{addListener(){}}},runtime:{getManifest:()=>({version:'9.9.9'}),getURL:x=>x,sendMessage:async m=>{window.__sent.push(m);if(m.action==='listGroups')return{ok:true,groups:[{id:'bakers',name:'Bread Bakers'},{id:'123456789',name:'Local Foodies Austin'},{id:'smallbiz',name:'Austin Small Business Owners'},{id:'neighbors',name:'East Side Neighbors'}]};return{ok:true,message:'Started.'};}},permissions:{contains:async()=>true}};});
 await ui.addStyleTag({content:read('style.css').replace(/@import[^;]*;/g,'')});for(const f of ['selectors.js','engine.js','report.js','dashboard.js','groupsui.js'])await ui.addScriptTag({content:read(f)});await ui.waitForTimeout(500);
 await ui.click('#groupsTab');await ui.waitForTimeout(150);
 check('tab: "Post to groups" opens its own page and hides the studio form',await ui.evaluate(()=>!document.getElementById('groups').hidden&&document.getElementById('studio').hidden));
 check('tab: before loading, it says no groups are loaded and shows no table',await ui.evaluate(()=>!document.getElementById('gpEmpty').hidden&&document.getElementById('gpTable').hidden));
 await ui.click('#gpLoad');await ui.waitForTimeout(300);
 check('tab: Load my groups lists the four groups with their last-post column',await ui.locator('#gpTable tbody tr').count()===4&&/Bread Bakers/.test(await ui.textContent('#gpTable')));
 await ui.click('#gpAll');check('tab: Select all ticks every group and shows the count',await ui.locator('#gpTable input:checked').count()===4&&/4 groups selected/.test(await ui.textContent('#gpCount')));
 await ui.click('#gpNone');await ui.fill('#gpSearch','austin');check('tab: search narrows the list; Select all then ticks only what is shown',await ui.locator('#gpTable tbody tr').count()===2&&(await ui.click('#gpAll'),await ui.locator('#gpTable input:checked').count()===2));
 await ui.fill('#gpSearch','');await ui.locator('#gpTable input[data-g="bakers"]').check();check('tab: groups can also be ticked one by one',/3 groups selected/.test(await ui.textContent('#gpCount')));
 await ui.click('#gpSaveList');await ui.waitForTimeout(100);check('tab: a selection can be saved as a named list and chosen again',await ui.evaluate(()=>[...document.querySelectorAll('#gpLists option')].some(o=>/Local groups \(3\)/.test(o.textContent)))&&(await ui.click('#gpNone'),await ui.selectOption('#gpLists','Local groups'),await ui.locator('#gpTable input:checked').count()===3));
 await ui.fill('#gpText','Fresh sourdough Saturday!');await ui.fill('#gpDelay','10');await ui.fill('#gpCap','2');await ui.waitForTimeout(100);
 const est=await ui.textContent('#gpEst');check('tab: the estimate says how long it takes and, with a daily limit, that it needs a second day',/3 groups/.test(est)&&/limit of 2 posts a day/.test(est)&&/2 days/.test(est),est);
 await ui.check('input[name=gpMode][value=auto]');check('tab: choosing Automatic shows the account-risk warning',await ui.evaluate(()=>!document.getElementById('gpWarn').hidden));
 await ui.uncheck('#gpDry');await ui.click('#gpStart');check('tab: Automatic will not start until the risk box is ticked',/accept the risk/.test(await ui.textContent('#gpMsg'))&&await ui.evaluate(()=>!__sent.some(m=>m.action==='start')));
 await ui.check('#gpAck');await ui.click('#gpStart');check('tab: a live run asks for a second click to confirm',/Confirm/.test(await ui.textContent('#gpStart'))&&await ui.evaluate(()=>!__sent.some(m=>m.action==='start')));
 await ui.click('#gpStart');await ui.waitForTimeout(200);const st=await ui.evaluate(()=>__sent.find(m=>m.action==='start'));
 check('tab: the start message carries the post, the chosen groups with their text, automatic mode, the risk confirmation, the pace and the limit',st&&st.config.action==='post'&&st.config.postMode==='auto'&&st.config.autoAck===true&&st.config.groupList.length===3&&st.config.groupList.every(g=>g.text==='Fresh sourdough Saturday!')&&st.config.delay===600&&st.config.dailyCap===2&&st.config.dry===false&&st.config.ignoreRules===false);
 check('tab: and that configuration is accepted by the engine',(()=>{try{const e=E.config(JSON.parse(JSON.stringify(st.config)));return e.limit===3;}catch(x){console.log(x.message);return false;}})());
 await ui.click('#groupsTab');await ui.check('input[name=gpVar][value=ai]');check('tab: "different wording" shows the Aurora Reply key box and the credit cost',await ui.evaluate(()=>!document.getElementById('gpAi').hidden)&&/Uses 3 credits/.test(await ui.textContent('#gpWriteNote')));
 console.log('\n'+passed+' group-posting checks passed');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
