// "A different comment on each post": the picker, the engine's validation, and the form checkbox.
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
const ROOT=path.join(__dirname,'..'),read=n=>fs.readFileSync(path.join(ROOT,n),'utf8');let passed=0;
const check=(n,v)=>{if(!v){console.error('FAIL '+n);process.exitCode=1;throw new Error('FAIL '+n);}passed++;console.log('PASS '+n);};
const MAX=(/maxlength="(\d+)" rows="3" placeholder="Write the exact comment/.exec(read('dashboard.html'))||[])[1]*1;
(async()=>{
 // ---- the picker (comments.js)
 const store={};const ctx={globalThis:null,chrome:{storage:{local:{get:async k=>({[k]:store[k]}),set:async o=>Object.assign(store,o)}}},crypto:require('node:crypto').webcrypto,Math};ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(read('comments.js'),ctx);
 const AC=ctx.AuroraComments;
 check('split: one comment per line, spaces tidied, blank lines and repeats dropped',JSON.stringify(AC.split(' Love this!\n\nlove  this!\nSuch a  great shot \r\nThanks'))==='["Love this!","Such a great shot","Thanks"]');
 const base={commentMany:true,commentList:['a','b','c'],commentSeed:'s1',comment:'a'};
 const r1=[];for(const k of ['p1','p2','p3'])r1.push(await AC.pick(base,k));
 check('three posts get three different comments (no repeats until all were used)',new Set(r1).size===3);
 check('the same post always gets the same comment (a retry or resume never changes it)',await AC.pick(base,'p2')===r1[1]&&await AC.pick(base,'p1')===r1[0]);
 const r2=[];for(const k of ['p4','p5','p6'])r2.push(await AC.pick(base,k));
 check('the next round uses all three again, and does not start with the comment just used',new Set(r2).size===3&&r2[0]!==r1[2]);
 let rnd=0;for(let t=0;t<30;t++){const st=[];for(const k of ['x1','x2','x3'])st.push(await AC.pick({...base,commentSeed:'t'+t},k));if(st.join()!=='a,b,c')rnd++;}
 check('the order is random, not always the same',rnd>5);
 check('a new task (new seed) starts fresh',(await AC.pick({...base,commentSeed:'fresh'},'p1'))!==undefined&&store.commentUse.seed==='fresh'&&Object.keys(store.commentUse.picks).length===1);
 check('with the option off, or one comment only, the single comment is used unchanged',await AC.pick({commentMany:false,comment:'solo'},'k')==='solo'&&await AC.pick({commentMany:true,commentList:[],comment:'solo'},'k')==='solo');
 const one=[];for(const k of ['q1','q2','q3'])one.push(await AC.pick({commentMany:true,commentList:['only','two'],commentSeed:'s2',comment:'only'},k));
 check('with two comments they alternate fairly (no comment twice in a row)',one[0]!==one[1]&&one[1]!==one[2]);

 // ---- the engine (engine.js): validation
 const ec={globalThis:null,crypto:require('node:crypto').webcrypto,AuroraSelectors:{pageKey:()=>null,profileName:n=>String(n).replace(/^\/@?|\/$/g,''),postURL:()=>null,discoverSlug:()=>null}};ec.globalThis=ec;vm.createContext(ec);vm.runInContext(read('engine.js'),ec);
 const E=ec.AuroraEngine,cfg=o=>E.config({action:'comment',mode:'posts',target:'x',perUser:1,limit:3,delay:20,dailyCap:0,maxAge:0,scanLimit:10,exclude:'',dry:true,reaction:'Like',...o});
 let c=cfg({comment:'Love this!\nSuch a great shot\nThanks',commentMany:true});
 check('engine: one comment per line becomes a list of three, with a task seed',c.commentMany===true&&JSON.stringify(c.commentList)==='["Love this!","Such a great shot","Thanks"]'&&typeof c.commentSeed==='string'&&c.commentSeed.length>8&&c.comment==='Love this!');
 const err=f=>{try{f();return '';}catch(e){return e.message;}};
 check('engine: fewer than two comments asks for at least two',/at least two comments/.test(err(()=>cfg({comment:'only one',commentMany:true}))));
 check('engine: a comment that is too long is refused on its own',/Each comment must be 1–\d+ characters/.test(err(()=>cfg({comment:'ok\n'+'x'.repeat(MAX+1),commentMany:true}))));
 check('engine: every comment may use the full length (the limit is per comment, not for the whole box)',cfg({comment:'a'.repeat(MAX)+'\n'+'b'.repeat(MAX),commentMany:true}).commentList.length===2);
 c=cfg({comment:'Single comment'});
 check('engine: without the option the old behaviour is unchanged (one exact comment, no list)',c.commentMany===false&&c.commentList===undefined&&c.comment==='Single comment');
 check('engine: the old length limit still applies to a single comment',/Enter your comment text/.test(err(()=>cfg({comment:'x'.repeat(MAX+1)})))&&/Enter your comment text/.test(err(()=>cfg({comment:''}))));
 c=cfg({action:'like',comment:'a\nb',commentMany:true});
 check('engine: the option only matters for comment tasks',c.commentMany===false&&c.commentList===undefined);

 // ---- the form (dashboard.html)
 const html=read('dashboard.html');
 check('dashboard: the checkbox explains one comment per line',/id="commentMany"/.test(html)&&/one comment per line/i.test(html));
 const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-crashpad-for-testing']});
 const pg=await (await b.newContext({viewport:{width:1280,height:900}})).newPage();const errors=[];pg.on('pageerror',e=>errors.push(e.message));
 await pg.setContent(html.replace(/<script[^>]*><\/script>/g,'').replace(/<link[^>]*>/g,''));
 await pg.evaluate(()=>{const store={history:[],config:null};window.chrome={storage:{local:{get:async k=>{const o={};[].concat(k||[]).forEach(x=>{if(x in store)o[x]=store[x];});return o;},set:async o=>Object.assign(store,o),remove:async()=>{}},onChanged:{addListener(){}}},runtime:{id:'x',getManifest:()=>({name:'Aurora',version:'1.2.0'}),getURL:x=>x,sendMessage:async()=>({ok:true}),onMessage:{addListener(){}}},permissions:{contains:async()=>true},tabs:{query:async()=>[]},alarms:{}};window.__store=store;});
 await pg.addStyleTag({content:read('style.css').replace(/@import[^;]*;/g,'')});
 for(const f of ['selectors.js','engine.js','comments.js','report.js'])await pg.addScriptTag({content:read(f)});
 await pg.addScriptTag({content:'globalThis.AuroraLicenseConfig={enforce:false,siteUrl:"https://x.test"};'});await pg.addScriptTag({content:read('dashboard.js')});await pg.waitForTimeout(250);
 await pg.selectOption('#action','comment');await pg.waitForTimeout(80);
 check('dashboard: for a comment task the box shows the usual limit and text',await pg.evaluate(()=>document.getElementById('comment').maxLength)===MAX&&await pg.isVisible('#commentMany'));
 await pg.check('#commentMany');await pg.waitForTimeout(80);
 check('dashboard: ticking "a different comment on each post" lets the box take several comments (one per line)',await pg.evaluate(()=>document.getElementById('comment').maxLength)>MAX&&/One comment per line/.test(await pg.getAttribute('#comment','placeholder'))&&/chosen at random/.test(await pg.textContent('#commentGroup .hint')));
 await pg.fill('#comment','one\ntwo\nthree');
 check('dashboard: the form hands the option to the engine (it is part of the saved settings)',await pg.evaluate(()=>{try{const s=settings();return s.commentMany===true&&s.comment==='one\ntwo\nthree';}catch{return false;}}));
 await pg.uncheck('#commentMany');await pg.waitForTimeout(80);
 check('dashboard: unticking restores the single-comment box',await pg.evaluate(()=>document.getElementById('comment').maxLength)===MAX&&/Write the exact comment/.test(await pg.getAttribute('#comment','placeholder'))&&/Uses this exact text/.test(await pg.textContent('#commentGroup .hint')));
 check('no uncaught page errors',!errors.length);
 await b.close();console.log(`\n${passed} comment-variant checks passed`);
})().catch(e=>{console.error(e.message);process.exit(1);});
