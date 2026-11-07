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
c=cfg({postHow:'multi',batchSize:3,groupList:Array.from({length:7},(_,i)=>({id:'g'+i,name:'Group '+i,text:'ignored'}))});q=E.initial(c);
check('engine: several-groups mode plans one step per batch (the first group opens the box, the rest are ticked by name) and ignores per-group text',q.length===3&&q.every(x=>x.kind==='mpost')&&q[0].gids.join()==='g0,g1,g2'&&q[0].names.join()==='Group 1,Group 2'&&q[2].gids.join()==='g6'&&q[0].text===c.postText);
check('engine: a batch is at most 9 groups',cfg({postHow:'multi',batchSize:50,groupList:Array.from({length:20},(_,i)=>({id:'g'+i,name:'G'+i}))}).batchSize===9);
const sh=(o={})=>E.config({action:'shareg',dry:false,postMode:'assist',delay:120,dailyCap:5,postText:'Fresh out of the oven!',items:[{url:'https://www.facebook.com/reel/111',title:'Sourdough'},{url:'https://www.facebook.com/sunrisebakery/posts/pfbid0abc',title:'Loaf'},{url:'https://m.facebook.com/reel/111?x=1'}],groupList:[{id:'bakers',name:'Bread Bakers'},{id:'foodies',name:'Local Foodies',text:'Own caption'}],...o});
let sc=sh();check('share: links are cleaned and duplicates dropped, groups get the shared caption or their own, the limit is items × groups',sc.items.length===2&&sc.items[0].kind==='reel'&&sc.items[1].kind==='post'&&sc.groupList[0].text==='Fresh out of the oven!'&&sc.groupList[1].text==='Own caption'&&sc.limit===4);
let sq=E.initial(sc);check('share: the plan is a rules check per group (once) and one share per item and group, spread out item by item',sq.map(x=>x.kind[0]+(x.gid||'')).join()==='gbakers,sbakers,gfoodies,sfoodies,sbakers,sfoodies'.replace(/s(\w+)/g,'s$1')&&sq.filter(x=>x.kind==='grules').length===2&&sq[1].url==='https://www.facebook.com/reel/111'&&/Sourdough → Bread Bakers/.test(sq[1].label)&&sq[3].text==='Own caption');
check('share: group by group puts every item of one group together',E.initial(sh({shareOrder:'group',ignoreRules:true})).map(x=>x.gid+':'+x.itemKey).join()==='bakers:post:111,bakers:post:pfbid0abc,foodies:post:111,foodies:post:pfbid0abc');
check('share: an empty caption is fine, a bad link, no items, too many shares and automatic without the risk box are refused',(()=>{if(sh({postText:''}).postText!=='')return false;const bad=[{items:[{url:'https://example.com/x'}]},{items:[]},{items:Array.from({length:31},(_,i)=>({url:'https://www.facebook.com/reel/'+(1000+i)}))},{postMode:'auto'},{delay:30}];for(const o of bad)try{sh(o);return false;}catch{}return true;})());
{const job={config:sh(),queue:E.initial(sh()),skipped:0,finished:[]};const rules=job.queue.shift();E.expand(job,rules,{blocked:true});check('share: a group whose rules ban promotion loses all its shares',job.queue.every(q=>q.gid!=='bakers')&&job.skipped===2);}
// ---- page: a made-up group page with an editor that draws edits late, like Facebook's ----
const GROUP=(extra='',member='Joined')=>`<!doctype html><html lang="en"><body><main role="main"><h1>Bread Bakers</h1><div role="button" tabindex="0">${member}</div>
<div id="launch" role="button" tabindex="0"><span>Write something...</span></div><div role="feed" id="feed"><div role="article"><p>An older post</p></div></div>${extra}</main>
<script>window.model='';window.presses=0;window.pending=${/PENDING/.test(extra)};
function draw(ed,pb){ed.textContent=window.model;pb.setAttribute('aria-disabled',window.model?'false':'true');}
document.getElementById('launch').addEventListener('click',()=>{if(document.querySelector('[role=dialog]'))return;
 const d=document.createElement('div');d.setAttribute('role','dialog');d.innerHTML='<div role="textbox" contenteditable="true" data-lexical-editor="true" aria-label="Create a public post"></div><div role="button" id="postbtn" aria-disabled="true" tabindex="0">Post</div><div role="button" id="closebtn" tabindex="0">Close</div>';document.body.append(d);
 const ed=d.querySelector('[role=textbox]'),pb=d.querySelector('#postbtn');window.model='';
 ed.addEventListener('input',e=>{const t=e.inputType,data=e.data;ed.textContent=window.model;setTimeout(()=>{if(t==='insertText')window.model+=data;else if(/^delete/.test(t))window.model=window.model.slice(0,-1);draw(ed,pb);},80);});
 ed.addEventListener('paste',e=>{e.preventDefault();const t=e.clipboardData.getData('text/plain');setTimeout(()=>{window.model+=t;draw(ed,pb);},80);});
 pb.addEventListener('click',()=>{if(pb.getAttribute('aria-disabled')==='true')return;window.presses++;const t=window.model;d.remove();setTimeout(()=>{const a=document.createElement('div');a.setAttribute('role','article');a.innerHTML=window.pending?'<p>Your post is pending admin approval</p>':'<p>'+t+'</p>';document.getElementById('feed').prepend(a);},300);});
 d.querySelector('#closebtn').addEventListener('click',()=>d.remove());});
</script></body></html>`;
const MOCK=`window.data={job:{id:'test',status:'running'},receipts:{},history:[]};window.listeners=[];
window.chrome={runtime:{id:'extension',onMessage:{addListener:f=>listeners.push(f)},sendMessage:async()=>({ok:true}),getManifest:()=>({version:'9'})},storage:{local:{get:async k=>{const o={};[].concat(k||[]).forEach(x=>{if(x in data)o[x]=structuredClone(data[x]);});return o;},set:async o=>Object.assign(data,structuredClone(o)),remove:async()=>{}}}};
const nt=window.setTimeout;window.setTimeout=(f,ms,...a)=>nt(f,Math.min(ms||0,1500)*0.5,...a);`;
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

 // flags learned from rules
 const RULES=t=>`<!doctype html><html lang="en"><body><main role="main"><h1>Bread Bakers</h1><div role="button">Joined</div><div role="article"><p>hi there this is a long enough page body to count as rendered, hi there hi there hi there hi there hi there hi there hi there hi there hi</p></div><h2>Group rules</h2><p>${t}</p></main></body></html>`;
 await open(RULES('1. Be kind. 2. All posts must be approved by an admin before they appear.'),'https://www.facebook.com/groups/bakers/about');r=await step('grules',{url:'https://www.facebook.com/groups/bakers/about'});
 check('flags: a group that holds posts for admins is remembered (and a friendly group is not marked as banning promotion)',r.blocked===false&&/held for admin approval/.test(r.message)&&await pg.evaluate(()=>data.gpFlags.bakers.approval===true&&data.gpFlags.bakers.promoBan===false));
 await open(RULES('No self-promotion. Be kind.'),'https://www.facebook.com/groups/bakers/about');await step('grules',{url:'https://www.facebook.com/groups/bakers/about'});
 check('flags: a group that bans promotion is remembered as such',await pg.evaluate(()=>data.gpFlags.bakers.promoBan===true));
 // a post that lands in the admin queue teaches the same thing
 await open(GROUP('<!--PENDING-->'));await step('gpost');await pg.evaluate(()=>document.getElementById('postbtn').click());await pg.waitForTimeout(500);r=await step('gpost');
 check('flags: a post that went to the admins marks the group as needing approval',r.performed&&await pg.evaluate(()=>data.gpFlags.bakers.approval===true));
 // link preview
 const LINK=GROUP().replace('</script></body></html>',`setInterval(()=>{const d=document.querySelector('[role=dialog]');if(!d)return;const ok=window.NEEDSPACE?/youtu\\.be\\/\\S+ $/.test(window.model):/youtu\\.be/.test(window.model);if(ok&&!d.querySelector('#rm')){const x=document.createElement('div');x.id='rm';x.setAttribute('role','button');x.setAttribute('aria-label','Remove link preview');x.textContent='x';d.append(x);}},40);</script></body></html>`);
 const YT='Watch our video https://youtu.be/abc123';
 await open(LINK);r=await step('gpost',{text:YT});check('link preview: a link whose preview shows up by itself is left alone and no tip is added',r.wait&&!/space bar/.test(r.wait)&&(await model()).model===YT);
 await open(LINK);await pg.evaluate(()=>{window.NEEDSPACE=true;});r=await step('gpost',{text:YT});m=await model();
 check('link preview: when Facebook only builds the preview after a space, Aurora types one and the preview appears (text still there once)',r.wait&&!/space bar/.test(r.wait)&&m.model.trim()===YT&&await pg.evaluate(()=>!!document.getElementById('rm')));
 await open(GROUP());r=await step('gpost',{text:YT});check('link preview: if it never appears, the person is told how to fix it (and the text is still in the box once)',r.wait&&/space bar/.test(r.wait)&&(await model()).model.trim()===YT);
 // Facebook's own "Add groups" (several groups in one post)
 const MG=`<!doctype html><html lang="en"><body><main role="main"><h1>Bread Bakers</h1><div role="button" tabindex="0">Joined</div>
<div id="launch" role="button" tabindex="0"><span>Write something...</span></div><div role="feed" id="feed"><div role="article"><p>An older post</p></div></div></main>
<script>
window.model='';window.presses=0;window.picked=[];window.names=['Noticias de todo','Datos Curiosos','Mundo Increible','Noticias de Mexico'];
function draw(){const ed=document.querySelector('[role=textbox]'),pb=document.getElementById('postbtn');if(!ed)return;ed.textContent=window.model;pb.setAttribute('aria-disabled',window.model?'false':'true');}
function composer(d){d.innerHTML='<div role="button" id="addg" tabindex="0">+ Add groups</div><div role="textbox" contenteditable="true" data-lexical-editor="true" aria-label="Create a public post"></div><div role="button" id="postbtn" aria-disabled="true" tabindex="0">Post</div><div role="button" id="closebtn" tabindex="0">Close</div>';
 const ed=d.querySelector('[role=textbox]'),pb=d.querySelector('#postbtn');ed.textContent=window.model;draw();
 ed.addEventListener('input',e=>{const data=e.data;ed.textContent=window.model;setTimeout(()=>{window.model+=data;draw();},80);});
 pb.addEventListener('click',()=>{if(pb.getAttribute('aria-disabled')==='true')return;window.presses++;const t=window.model;d.remove();setTimeout(()=>{const a=document.createElement('div');a.setAttribute('role','article');a.innerHTML='<p>'+t+'</p>';document.getElementById('feed').prepend(a);},300);});
 d.querySelector('#closebtn').addEventListener('click',()=>d.remove());d.querySelector('#addg').addEventListener('click',()=>add(d));}
function add(d){d.innerHTML='<h2>Add groups</h2><input placeholder="Search groups"><div>Select groups</div><div>Post in up to 9 groups that you are in.</div><div id="rows"></div><div role="button" id="done" tabindex="0">Done</div>';
 const rows=d.querySelector('#rows');for(const n of window.names){const r=document.createElement('div');r.innerHTML='<span>'+n+'</span><div role="checkbox" aria-checked="'+window.picked.includes(n)+'" tabindex="0"></div>';r.addEventListener('click',()=>{const c=r.querySelector('[role=checkbox]'),on=c.getAttribute('aria-checked')!=='true';c.setAttribute('aria-checked',String(on));window.picked=on?window.picked.concat(n):window.picked.filter(x=>x!==n);});rows.append(r);}
 d.querySelector('input').addEventListener('input',e=>{for(const r of rows.children)r.style.display=r.textContent.toLowerCase().includes(e.target.value.toLowerCase())?'':'none';});
 d.querySelector('#done').addEventListener('click',()=>composer(d));}
document.getElementById('launch').addEventListener('click',()=>{if(document.querySelector('[role=dialog]'))return;const d=document.createElement('div');d.setAttribute('role','dialog');document.body.append(d);window.model='';composer(d);});
</script></body></html>`;
 const mstep=(over={},cfg={})=>step('mpost',{label:'Bread Bakers +3 more',gid:'bakers',gids:['bakers','g1','g2','g3'],names:['Noticias de todo','Datos Curiosos','Not In The List'],text:TEXT,...over},{postHow:'multi',...cfg});
 await open(MG);r=await mstep();m=await model();
 check('several groups: Aurora opens Add groups, ticks the groups by name (searching for them), presses Done, writes the text once, and waits for the person',r.wait&&/2 groups chosen|3 groups chosen/.test(r.wait)&&m.model===TEXT&&m.presses===0&&(await pg.evaluate(()=>window.picked.slice().sort().join('|')))==='Datos Curiosos|Noticias de todo');
 check('several groups: a name that is not in Facebook’s list is reported, not guessed',/could not find: Not In The List/.test(r.wait));
 await pg.evaluate(()=>document.getElementById('postbtn').click());await pg.waitForTimeout(500);r=await mstep();
 check('several groups: after Post, one step counts every group reached and writes a receipt for each',r.performed===true&&r.count===3&&/Posted in Bread Bakers and 2 other groups/.test(r.message)&&await pg.evaluate(()=>['bakers','g1','g2','g3'].every(g=>Object.keys(data.receipts).some(k=>k.startsWith('post:'+g+':')))));
 await open(MG);r=await mstep({names:['Noticias de todo']},{postMode:'auto'});
 check('several groups, automatic: presses Post once for all the groups',r.performed===true&&r.count===2&&(await model()).presses===1);
 await open(MG);r=await mstep({names:['Nope One','Nope Two']});check('several groups: if none of the chosen groups can be found nothing is posted',/None of the chosen groups could be found/.test(r.error||'')&&(await model()).presses===0);
 await open(GROUP());r=await mstep();check('several groups: if the post box has no Add groups button there is a clear error and nothing is posted',/no “Add groups” button/.test(r.error||''));
 r=await step('mpost',{label:'Bread Bakers +3 more',gid:'bakers',gids:['bakers','g1','g2','g3'],names:['A','B','C'],text:TEXT},{postHow:'multi',dry:true});check('several groups: a preview only checks the post box and says how many groups it would add',r.preview&&r.count===4&&/add 3 more groups/.test(r.message));

 // sharing an existing reel to a group (Facebook's own Share → Share to a group)
 const SHAREPAGE=(opts='')=>`<!doctype html><html lang="en"><body><main role="main"><h1>Your reel</h1><div role="article"><p>Sourdough in 30 sec</p>
<div role="button" tabindex="0" aria-label="Like">Like</div><div role="button" tabindex="0" aria-label="Comment">Comment</div>${/OUTSIDE|NOSHARE|COUNTS/.test(opts)?'':'<div id="sharebtn" role="button" tabindex="0" aria-label="Share">Share</div>'}${/COUNTS/.test(opts)?'<div role="button" tabindex="0" aria-label="Share, 0 shares" style="position:absolute;top:2600px">Share</div><div id="sharebtn" role="button" tabindex="0" aria-label="Share, 22K shares">22K</div><div role="button" aria-label="Shared with Public">Public</div>':''}</div></main>${/OUTSIDE/.test(opts)?'<div role="complementary"><div id="sharebtn" role="button" tabindex="0" aria-label="Share"><span>icon</span></div></div>':''}
<script>window.model='';window.presses=0;window.chosen='';window.pending=${/PENDING/.test(opts)};
function draw(){const ed=document.querySelector('[role=textbox]'),pb=document.getElementById('postbtn');if(!ed)return;ed.textContent=window.model;pb.setAttribute('aria-disabled','false');}
function menu(d){d.innerHTML='<h4>Share</h4><div>Sharing to Feed (Read-only)</div><div role="button" tabindex="0">Share now</div><div role="button" tabindex="0">Share to Feed</div>${/NOGROUP/.test(opts)?'':'<div role="button" id="grp" tabindex="0">Share to a group</div>'}<div role="button" tabindex="0">Send in Messenger</div>';const g=d.querySelector('#grp');if(g)g.addEventListener('click',()=>pick(d));}
function pick(d){d.innerHTML='<div aria-hidden="true"><div role="textbox" contenteditable="true" aria-label="Say something about this"></div></div><h4>Share to a group</h4><input type="search" placeholder="Search for groups"><div id="res"></div>';const res=d.querySelector('#res');
 for(const n of ['Bread Bakers','Local Foodies Austin','Austin Small Business Owners']){const li=document.createElement('div');li.setAttribute('role','listitem');const r=document.createElement('div');r.setAttribute('role','button');r.tabIndex=0;r.innerHTML='<span>'+n+'</span><span>Public group</span>';r.addEventListener('click',()=>{window.chosen=n;compose(d);});li.append(r);res.append(li);}
 d.querySelector('input').addEventListener('input',e=>{for(const r of res.children)r.style.display=r.textContent.toLowerCase().includes(e.target.value.toLowerCase())?'':'none';});}
function compose(d){d.innerHTML='<h4>Share to a group</h4><div role="textbox" contenteditable="true" data-lexical-editor="true" aria-label="Say something about this"></div><div role="button" id="postbtn" aria-disabled="false" tabindex="0">Post</div><div role="button" id="closebtn" tabindex="0">Close</div>';
 window.model='';const ed=d.querySelector('[role=textbox]'),pb=d.querySelector('#postbtn');
 ed.addEventListener('input',e=>{const t=e.inputType,data=e.data;ed.textContent=window.model;setTimeout(()=>{if(t==='insertText')window.model+=data;else if(/^delete/.test(t))window.model=window.model.slice(0,-1);draw();},80);});
 pb.addEventListener('click',()=>{window.presses++;d.remove();setTimeout(()=>{const a=document.createElement('div');a.setAttribute('role','alert');a.textContent=window.pending?'Your post is pending admin approval':'Shared to '+window.chosen;document.body.append(a);},300);});
 d.querySelector('#closebtn').addEventListener('click',()=>d.remove());}
if(/OPEN/.test('${opts}'))setTimeout(()=>{const d=document.createElement('div');d.setAttribute('role','dialog');document.body.append(d);/OPENPICK/.test('${opts}')?pick(d):menu(d);},50);
document.addEventListener('click',e=>{if(e.target.closest('#sharebtn')&&!document.querySelector('[role=dialog]')){const d=document.createElement('div');d.setAttribute('role','dialog');document.body.append(d);menu(d);}});
</script></body></html>`;
 const REEL='https://www.facebook.com/reel/111';
 const sstep=(over={},cfg={})=>step('sharepair',{url:REEL,label:'Sourdough → Bread Bakers',gid:'bakers',gname:'Bread Bakers',itemKey:'post:111',text:'Fresh out of the oven!',...over},{action:'shareg',...cfg});
 const smodel=()=>pg.evaluate(()=>({model:window.model,presses:window.presses,chosen:window.chosen,dialogs:document.querySelectorAll('[role=dialog]').length}));
 await open(SHAREPAGE(),REEL);r=await sstep({},{dry:true});check('share: a preview finds the Share button and shares nothing',r.preview&&/would share this to Bread Bakers/.test(r.message)&&(await smodel()).dialogs===0);
 await open(SHAREPAGE(),REEL);r=await sstep();m=await smodel();
 check('share, assisted: Aurora clicks Share, picks “Share to a group”, searches and chooses the group, puts the caption in once, and waits for the person',r.wait&&/ready with your caption/.test(r.wait)&&m.chosen==='Bread Bakers'&&m.model==='Fresh out of the oven!'&&m.presses===0);
 r=await sstep();check('share, assisted: while the box is open it keeps waiting and does not start again',r.wait&&(await smodel()).model==='Fresh out of the oven!');
 await pg.evaluate(()=>document.getElementById('postbtn').click());await pg.waitForTimeout(600);r=await sstep();
 check('share, assisted: after the person presses Post the share is confirmed from Facebook’s message and counted',r.performed===true&&/Shared to Bread Bakers/.test(r.message)&&await pg.evaluate(()=>Object.keys(data.receipts).some(k=>k.startsWith('g:share:post:111:bakers:'))));
 r=await sstep();check('share: the same item to the same group is never shared twice',!r.performed&&/already shared to Bread Bakers/.test(r.message));
 await open(SHAREPAGE(),REEL);await sstep();await pg.evaluate(()=>document.getElementById('closebtn').click());r=await sstep();
 check('share, assisted: closing the box skips this share and counts nothing',!r.performed&&/no share was confirmed/.test(r.message));
 await open(SHAREPAGE('PENDING'),REEL);await sstep();await pg.evaluate(()=>document.getElementById('postbtn').click());await pg.waitForTimeout(600);r=await sstep();
 check('share: a group that holds posts for admins is reported as sent to the admins, and remembered',r.performed&&/admins must approve/.test(r.message)&&await pg.evaluate(()=>data.gpFlags.bakers.approval===true));
 await open(SHAREPAGE(),REEL);r=await sstep({},{postMode:'auto'});
 check('share, automatic: presses Post once and confirms the share',r.performed===true&&(await smodel()).presses===1&&/Shared to Bread Bakers/.test(r.message));
 await open(SHAREPAGE(),REEL);r=await sstep({gname:'Nope Group'});check('share: a group that is not in Facebook’s list is reported and nothing is shared',/Could not find the group “Nope Group”/.test(r.error||'')&&(await smodel()).presses===0);
 await open(SHAREPAGE('NOGROUP'),REEL);r=await sstep();check('share: if Facebook offers no “Share to a group” for this item the error says so',/no “Share to a group” option/.test(r.error||''));
 await open(SHAREPAGE('NOSHARE'),REEL);r=await sstep();check('share: an item without a Share button gives a clear error',/Cannot find the Share button/.test(r.error||''));
 await open(SHAREPAGE('COUNTS'),REEL);r=await sstep();check('share: Share buttons labelled with a counter (“Share, 22K shares”) are found; the one on screen is used, not the neighbour below; “Shared with Public” is ignored',r.wait&&(await smodel()).chosen==='Bread Bakers');
 await open(SHAREPAGE('OPEN'),REEL);await pg.waitForTimeout(150);r=await sstep();check('share: if Facebook\u2019s Share window is already open the step carries on from it instead of failing',r.wait&&(await smodel()).chosen==='Bread Bakers');
 await open(SHAREPAGE('OPENPICK'),REEL);await pg.waitForTimeout(150);r=await sstep();check('share: if the group list is already open (with the caption box still mounted but hidden underneath) the step picks the group from it',r.wait&&(await smodel()).chosen==='Bread Bakers');
 await open(SHAREPAGE('OUTSIDE'),REEL);r=await sstep();check('share: a Share button outside the main area (as on a reel page) is found, and the group row is clicked on the inner button',r.wait&&(await smodel()).chosen==='Bread Bakers');
 await open(SHAREPAGE('NOSHARE'),REEL);r=await sstep();check('share: when the Share button is missing the error lists the buttons Aurora did see, so a report shows what is on the page',/Buttons seen: .*Like.*Comment/.test(r.error||''));
 await open(SHAREPAGE('NOGROUP'),REEL);r=await sstep();check('share: when the menu has no “Share to a group” the error lists the options seen',/Options seen: .*Share to Feed/.test(r.error||''));
 await open(SHAREPAGE(),REEL);r=await sstep({text:''});m=await smodel();check('share: with no caption nothing is typed and the share is still ready for the person',r.wait&&/ready\./.test(r.wait)&&m.model==='');
 // group list
 await open('<!doctype html><html lang="en"><body><main role="main"><a href="/groups/feed/">Your feed</a><a href="/groups/discover/">Discover</a><a href="/groups/create/">Create new group</a><a href="https://www.facebook.com/groups/bakers/">Bread Bakers</a><a href="/groups/123456789/">Local Foodies Austin<br>Last active 2 days ago</a><a href="/groups/bakers/">Bread Bakers</a><a href="/groups/joins/">See all</a></main></body></html>','https://www.facebook.com/groups/joins/');
 r=await send({action:'listGroups'});check('group list: real groups are listed once with their names; feed, discover, create and "see all" are ignored',r.groups&&r.groups.length===2&&r.groups[0].id==='bakers'&&r.groups[1].name==='Local Foodies Austin',JSON.stringify(r));
 await open(GROUP());r=await send({action:'listGroups'});check('group list: refuses to read anywhere but the groups page',/groups\/joins/.test(r.error||''));
 // reels and posts on the profile
 await open('<!doctype html><html lang="en"><body><main role="main"><div role="article"><a href="https://www.facebook.com/reel/111"><img src="https://x/1.jpg"></a><span>Sourdough in 30 sec</span></div><div role="article"><a href="/reel/222/?s=x"><img src="https://x/2.jpg"></a><span>Shaping a loaf</span></div><div role="article"><a href="https://www.facebook.com/sunrisebakery/posts/pfbid0abc">2d</a><span>Saturday pre-orders are open</span></div><a href="/reel/111">dup</a></main></body></html>','https://www.facebook.com/me/');
 r=await send({action:'listItems',kind:'reel'});check('items: the reels on the profile are listed once each with a title and picture',r.items&&r.items.length===2&&r.items[0].url==='https://www.facebook.com/reel/111'&&r.items[0].title==='Sourdough in 30 sec'&&r.items[0].thumb==='https://x/1.jpg'&&r.items.every(i=>i.kind==='reel'),JSON.stringify(r));
 r=await send({action:'listItems',kind:'post'});check('items: posts and reels are kept apart',r.items&&r.items.length===1&&r.items[0].kind==='post'&&/pfbid0abc/.test(r.items[0].url));
 // ---- the "Post to groups" tab ----
 const ui=await (await browser.newContext({viewport:{width:1200,height:1000}})).newPage();ui.on('pageerror',e=>{throw e;});
 await ui.setContent(read('dashboard.html').replace(/<script src="[^"]*"><\/script>/g,'').replace(/<link[^>]*stylesheet[^>]*>/,''));
 await ui.evaluate(()=>{const store={},ls=[];window.__set=async o=>{const ch={};for(const [k,v] of Object.entries(o)){ch[k]={newValue:v,oldValue:store[k]};store[k]=v;}ls.forEach(f=>f(ch,'local'));};window.prompt=()=>'Local groups';window.__sent=[];window.__groups=[{id:'bakers',name:'Bread Bakers'},{id:'123456789',name:'Local Foodies Austin'},{id:'smallbiz',name:'Austin Small Business Owners'},{id:'neighbors',name:'East Side Neighbors'}];window.chrome={storage:{local:{get:async k=>{const o={};[].concat(k||[]).forEach(x=>{if(x in store)o[x]=store[x];});return o;},set:async o=>window.__set(o),remove:async()=>{}},onChanged:{addListener:f=>ls.push(f)}},runtime:{getManifest:()=>({version:'9.9.9'}),getURL:x=>x,sendMessage:async m=>{window.__sent.push(m);if(m.action==='listGroups'){setTimeout(()=>window.__set({gpLoad:{state:'running',n:2,time:Date.now()}}),20);setTimeout(()=>window.__set({gpLoad:{state:'done',n:4,groups:window.__groups,time:Date.now()}}),80);return{ok:true,started:true};}return{ok:true,message:'Started.'};}},permissions:{contains:async()=>true}};});
 await ui.addStyleTag({content:read('style.css').replace(/@import[^;]*;/g,'')});for(const f of ['selectors.js','engine.js','report.js','dashboard.js','groupsui.js'])await ui.addScriptTag({content:read(f)});await ui.waitForTimeout(500);
 await ui.click('#groupsTab');await ui.waitForTimeout(150);
 check('tab: "Post to groups" opens its own page and hides the studio form',await ui.evaluate(()=>!document.getElementById('groups').hidden&&document.getElementById('studio').hidden));
 check('tab: before loading, it says no groups are loaded and shows no table',await ui.evaluate(()=>!document.getElementById('gpEmpty').hidden&&document.getElementById('gpTable').hidden));
 check('tab: the delay starts at 2 minutes for Assisted mode',await ui.inputValue('#gpDelay')==='2');
 await ui.click('#gpLoad');await ui.waitForTimeout(40);
 check('tab: while loading, the button is disabled and the message shows progress from the background',await ui.isDisabled('#gpLoad')&&/found so far/.test(await ui.textContent('#gpMsg')));
 await ui.waitForTimeout(250);
 check('tab: when the background finishes, the groups appear by themselves (no need to guess) and the button is back',await ui.locator('#gpTable tbody tr').count()===4&&/Bread Bakers/.test(await ui.textContent('#gpTable'))&&!(await ui.isDisabled('#gpLoad'))&&/Done: found 4 groups/.test(await ui.textContent('#gpMsg')));
 await ui.evaluate(()=>__set({gpLoad:{state:'error',error:'No groups were found on the page.',time:Date.now()}}));
 check('tab: a failed load shows the reason and re-enables the button',/No groups were found/.test(await ui.textContent('#gpMsg'))&&!(await ui.isDisabled('#gpLoad')));
 await ui.evaluate(()=>__set({gpLoad:{state:'done',n:4,groups:__groups,time:Date.now()}}));
 await ui.click('#gpAll');check('tab: Select all ticks every group and shows the count',await ui.locator('#gpTable input:checked').count()===4&&/4 groups selected/.test(await ui.textContent('#gpCount')));
 await ui.click('#gpNone');await ui.fill('#gpSearch','austin');check('tab: search narrows the list; Select all then ticks only what is shown',await ui.locator('#gpTable tbody tr').count()===2&&(await ui.click('#gpAll'),await ui.locator('#gpTable input:checked').count()===2));
 await ui.fill('#gpSearch','');await ui.locator('#gpTable input[data-g="bakers"]').check();check('tab: groups can also be ticked one by one',/3 groups selected/.test(await ui.textContent('#gpCount')));
 await ui.click('#gpSaveList');await ui.waitForTimeout(100);check('tab: a selection can be saved as a named list and chosen again',await ui.evaluate(()=>[...document.querySelectorAll('#gpLists option')].some(o=>/Local groups \(3\)/.test(o.textContent)))&&(await ui.click('#gpNone'),await ui.selectOption('#gpLists','Local groups'),await ui.locator('#gpTable input:checked').count()===3));
 await ui.fill('#gpText','Fresh sourdough Saturday!');await ui.fill('#gpDelay','10');await ui.fill('#gpCap','2');await ui.waitForTimeout(100);
 const est=await ui.textContent('#gpEst');check('tab: the estimate says how long it takes and, with a daily limit, that it needs a second day',/3 groups/.test(est)&&/limit of 2 groups a day/.test(est)&&/2 days/.test(est),est);
 await ui.evaluate(()=>__set({gpFlags:{smallbiz:{approval:true,rulesRead:true},neighbors:{promoBan:true,rulesRead:true},bakers:{rulesRead:true}}}));await ui.click('#gpNone');
 check('tab: what Aurora learned shows next to each group (admin approval, bans promotion, rules read)',/admin approval/.test(await ui.textContent('#gpTable'))&&/bans promotion/.test(await ui.textContent('#gpTable'))&&/rules read/.test(await ui.textContent('#gpTable')));
 await ui.selectOption('#gpFilter','noapproval');check('tab: the filter can hide groups that need admin approval',await ui.locator('#gpTable tbody tr').count()===3&&!/Small Business/.test(await ui.textContent('#gpTable')));
 await ui.selectOption('#gpFilter','approval');check('tab: the filter can show only the groups that need admin approval',await ui.locator('#gpTable tbody tr').count()===1&&/Small Business/.test(await ui.textContent('#gpTable')));
 await ui.selectOption('#gpFilter','nobans');check('tab: the filter can hide groups that ban promotion',await ui.locator('#gpTable tbody tr').count()===3&&!/East Side/.test(await ui.textContent('#gpTable')));
 await ui.selectOption('#gpFilter','noapproval');await ui.click('#gpAll');check('tab: Select all only ticks what the filter shows',await ui.locator('#gpTable input:checked').count()===3);
 await ui.selectOption('#gpFilter','all');await ui.click('#gpNone');await ui.locator('#gpTable input[data-g="bakers"]').check();await ui.locator('#gpTable input[data-g="123456789"]').check();await ui.locator('#gpTable input[data-g="smallbiz"]').check();
 await ui.click('#gpCheck');await ui.waitForTimeout(200);const chk=await ui.evaluate(()=>__sent.filter(m=>m.action==='start').pop());
 check('tab: "Check rules" starts a preview that posts nothing (rules on, one group at a time, short wait)',chk&&chk.config.dry===true&&chk.config.ignoreRules===false&&chk.config.postHow==='single'&&chk.config.delay===10&&chk.config.groupList.length===3);
 await ui.click('#groupsTab');await ui.check('input[name=gpHow][value=multi]');
 check('tab: "Several groups in one post" shows its box, keeps the wording the same for all, and turns off the per-group AI wording',await ui.evaluate(()=>!document.getElementById('gpMulti').hidden&&document.querySelector('input[name=gpVar][value=same]').checked&&document.getElementById('gpWrite').disabled));
 await ui.fill('#gpBatch','2');await ui.waitForTimeout(100);check('tab: the estimate counts posts, not groups, in that mode',/3 groups in 2 posts of up to 2 groups/.test(await ui.textContent('#gpEst')),await ui.textContent('#gpEst'));
 await ui.check('#gpDry');await ui.fill('#gpText','Fresh sourdough Saturday!');await ui.click('#gpStart');await ui.waitForTimeout(200);const mm=await ui.evaluate(()=>__sent.filter(m=>m.action==='start').pop());
 check('tab: the start message says several-groups mode and the batch size, and the engine accepts it',mm.config.postHow==='multi'&&mm.config.batchSize===2&&E.initial(E.config(JSON.parse(JSON.stringify(mm.config)))).length===2);
 await ui.click('#groupsTab');await ui.check('input[name=gpHow][value=single]');await ui.uncheck('#gpDry');
 await ui.check('input[name=gpMode][value=assist]');await ui.fill('#gpDelay','7');await ui.check('input[name=gpMode][value=auto]');check('tab: switching to Automatic keeps a delay you typed, but defaults to 5 minutes if you did not',await ui.inputValue('#gpDelay')==='7');
 await ui.check('input[name=gpMode][value=assist]');await ui.fill('#gpDelay','10');
 await ui.check('input[name=gpMode][value=auto]');check('tab: choosing Automatic shows the account-risk warning',await ui.evaluate(()=>!document.getElementById('gpWarn').hidden));
 const nStart=()=>ui.evaluate(()=>__sent.filter(m=>m.action==='start').length);let n0=await nStart();
 await ui.uncheck('#gpDry');await ui.click('#gpStart');check('tab: Automatic will not start until the risk box is ticked',/accept the risk/.test(await ui.textContent('#gpMsg'))&&await nStart()===n0);
 await ui.check('#gpAck');await ui.click('#gpStart');check('tab: a live run asks for a second click to confirm',/Confirm/.test(await ui.textContent('#gpStart'))&&await nStart()===n0);
 await ui.click('#gpStart');await ui.waitForTimeout(200);const st=await ui.evaluate(()=>__sent.filter(m=>m.action==='start').pop());
 check('tab: the start message carries the post, the chosen groups with their text, automatic mode, the risk confirmation, the pace and the limit',st&&st.config.action==='post'&&st.config.postMode==='auto'&&st.config.autoAck===true&&st.config.groupList.length===3&&st.config.groupList.every(g=>g.text==='Fresh sourdough Saturday!')&&st.config.delay===600&&st.config.dailyCap===2&&st.config.dry===false&&st.config.ignoreRules===false);
 check('tab: and that configuration is accepted by the engine',(()=>{try{const e=E.config(JSON.parse(JSON.stringify(st.config)));return e.limit===3;}catch(x){console.log(x.message);return false;}})());
 await ui.click('#groupsTab');await ui.check('input[name=gpVar][value=ai]');check('tab: "different wording" shows the Aurora Reply key box and the credit cost',await ui.evaluate(()=>!document.getElementById('gpAi').hidden)&&/Uses 3 credits/.test(await ui.textContent('#gpWriteNote')));
 // share tab
 await ui.click('#shareTab');await ui.waitForTimeout(150);
 check('share tab: opens the same page in "share" mode: item picker and order shown, the "several groups" choice hidden, the caption is optional',await ui.evaluate(()=>!document.getElementById('gpItems').hidden&&!document.getElementById('gpOrderRow').hidden&&document.getElementById('gpHowRow').hidden&&!document.getElementById('gpTextHint').hidden&&/What to share/.test(document.getElementById('gpH1').textContent)));
 check('share tab: the menu entry is highlighted and the other one is not',await ui.evaluate(()=>document.getElementById('shareTab').classList.contains('selected')&&!document.getElementById('groupsTab').classList.contains('selected')));
 await ui.evaluate(()=>{window.__itemsReply={state:'done',kind:'reel',n:3,items:[{url:'https://www.facebook.com/reel/111',kind:'reel',title:'Sourdough in 30 sec',thumb:''},{url:'https://www.facebook.com/reel/222',kind:'reel',title:'Shaping a loaf',thumb:''},{url:'https://www.facebook.com/reel/333',kind:'reel',title:'Butter day',thumb:''}],time:Date.now()};});
 await ui.evaluate(()=>{const f=chrome.runtime.sendMessage;chrome.runtime.sendMessage=async m=>{if(m.action==='listItems'){window.__sent.push(m);setTimeout(()=>__set({gpItemsLoad:{state:'running',kind:m.kind,n:2,time:Date.now()}}),20);setTimeout(()=>__set({gpItemsLoad:window.__itemsReply}),80);return{ok:true,started:true};}return f(m);};});
 await ui.click('#gpItemLoad');await ui.waitForTimeout(40);check('share tab: while loading, progress shows and the button is disabled',await ui.isDisabled('#gpItemLoad')&&/found so far/.test(await ui.textContent('#gpMsg')));
 await ui.waitForTimeout(250);check('share tab: the reels appear as cards by themselves when loading finishes',await ui.locator('#gpItemGrid .gp-th').count()===3&&/Done: found 3 reels/.test(await ui.textContent('#gpMsg')));
 await ui.locator('#gpItemGrid input').nth(0).check();await ui.locator('#gpItemGrid input').nth(2).check();
 await ui.click('.gp-tab[data-tab=paste]');await ui.fill('#gpPaste','https://www.facebook.com/reel/444 https://www.facebook.com/sunrisebakery/posts/pfbid0xyz not-a-link');await ui.click('#gpPasteAdd');
 check('share tab: pasted links are checked: reel and post links are added and selected, other text is reported',/2 links added; 1 not recognised/.test(await ui.textContent('#gpMsg'))&&await ui.locator('#gpItemGrid .gp-th').count()===2&&/4 items selected/.test(await ui.textContent('#gpItemCount')));
 await ui.click('#gpNone');await ui.locator('#gpTable input[data-g="bakers"]').check();await ui.locator('#gpTable input[data-g="123456789"]').check();await ui.fill('#gpCap','4');await ui.fill('#gpText','Fresh out of the oven!');await ui.waitForTimeout(100);
 const sest=await ui.textContent('#gpEst');check('share tab: the estimate says items × groups = shares, and how many days the daily limit needs',/4 items × 2 groups = 8 shares/.test(sest)&&/limit of 4 a day/.test(sest)&&/2 days/.test(sest),sest);
 await ui.check('#gpDry');await ui.selectOption('#gpOrder','group');await ui.click('#gpStart');await ui.waitForTimeout(200);const ss=await ui.evaluate(()=>__sent.filter(m=>m.action==='start').pop());
 check('share tab: the start message is a "share to groups" task with the chosen items, groups, caption and order, and the engine accepts it',ss.config.action==='shareg'&&ss.config.items.length===4&&ss.config.groupList.length===2&&ss.config.postText==='Fresh out of the oven!'&&ss.config.shareOrder==='group'&&E.initial(E.config(JSON.parse(JSON.stringify(ss.config)))).filter(x=>x.kind==='sharepair').length===8);
 await ui.click('#shareTab');await ui.locator('#gpItemGrid input').first().uncheck();await ui.click('.gp-tab[data-tab=reel]');await ui.locator('#gpItemGrid input').nth(0).uncheck();await ui.locator('#gpItemGrid input').nth(2).uncheck();await ui.click('.gp-tab[data-tab=paste]');for(const i of await ui.locator('#gpItemGrid input').all())await i.uncheck();
 await ui.click('#gpStart');check('share tab: with no item chosen it asks for one',/Choose at least one reel or post/.test(await ui.textContent('#gpMsg')));
 await ui.click('#groupsTab');check('post tab: going back shows the post writing form again',await ui.evaluate(()=>document.getElementById('gpItems').hidden&&!document.getElementById('gpHowRow').hidden&&/Your post/.test(document.getElementById('gpH1').textContent)));
 console.log('\n'+passed+' group-posting checks passed');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
