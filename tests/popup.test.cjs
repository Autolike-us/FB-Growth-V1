// Toolbar popup (popup.html + popup.js): a quick look and the two safety buttons. Loaded as injected HTML with a stubbed chrome.* API.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path');
const ROOT=path.join(__dirname,'..'),read=n=>fs.readFileSync(path.join(ROOT,n),'utf8');let passed=0;
const check=(n,v)=>{if(!v){console.error('FAIL '+n);process.exitCode=1;throw new Error('FAIL '+n);}passed++;console.log('PASS '+n);};
const DASH='chrome-extension://x/dashboard.html';
(async()=>{
 const html=read('popup.html'),js=read('popup.js'),css=read('popup.css');
 check('popup.html is small: only the license config and popup.js are loaded, nothing remote',(html.match(/<script[^>]*>/g)||[]).length===2&&/src="license-config\.js"/.test(html)&&/src="popup\.js"/.test(html)&&!/https?:\/\/[^"']*\.js/.test(html));
 check('the popup can only look, Pause and Stop: it never sends start or resume',!/action:'(start|resume|save|skipTarget|previewProfile)'|control\('(start|resume)'\)/.test(js)&&/control\('pause'\)/.test(js)&&/control\('stop'\)/.test(js));
 check('the support links (Report / Contact / Telegram) are in the popup footer',/id="reportIssue"/.test(html)&&/id="contactUs"/.test(html)&&/id="joinTelegram" href="https:\/\/t\.me\//.test(html));
 const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-crashpad-for-testing']});
 const errors=[];
 async function open(store,{enforce=true,tabs=[]}={}){
  const ctx=await b.newContext({viewport:{width:380,height:640}}),pg=await ctx.newPage();pg.on('pageerror',e=>errors.push(e.message));
  await pg.setContent(html.replace(/<script[^>]*><\/script>/g,'').replace(/<link[^>]*>/g,''));
  await pg.addStyleTag({content:css});
  await pg.evaluate(([s,tabs,enforce])=>{const store=s;window.__sent=[];window.__created=[];window.__updated=[];window.__tabs=tabs;
   window.chrome={storage:{local:{get:async k=>{const o={};[].concat(k||[]).forEach(x=>{if(x in store)o[x]=store[x];});return o;},set:async o=>Object.assign(store,o)},onChanged:{addListener(){}}},
    runtime:{id:'x',getURL:x=>'chrome-extension://x/'+x,sendMessage:async m=>{window.__sent.push(m);return{ok:true};}},
    tabs:{query:async()=>window.__tabs,create:async o=>{window.__created.push(o.url);},update:async(id,o)=>{window.__updated.push(id);}},windows:{update:async()=>{}}};
   globalThis.AuroraLicenseConfig={enforce};window.close=()=>{window.__closed=true;};},[store,tabs,enforce]);
  await pg.addScriptTag({content:js});await pg.waitForTimeout(120);return{ctx,pg};
 };
 const T=()=>new Date().toDateString();
 const txt=(pg,s)=>pg.evaluate(s=>document.querySelector(s).textContent.trim().replace(/\s+/g,' '),s);
 const shown=(pg,s)=>pg.evaluate(s=>{const e=document.querySelector(s);return !!e&&!e.hidden&&getComputedStyle(e).display!=='none';},s);
 const off=(pg,s)=>pg.evaluate(s=>document.querySelector(s).disabled,s);

 // idle
 let {ctx,pg}=await open({license:{status:'none'}});
 check('idle: says Ready and that no task is running; Pause and Stop are off',/Ready/.test(await txt(pg,'#chip'))&&/No task running/.test(await txt(pg,'#taskKind'))&&await off(pg,'#pause')&&await off(pg,'#stop')&&!await shown(pg,'#alert'));
 check('idle: Today shows 0 and the Open dashboard button is ready',await txt(pg,'#todayN')==='0'&&!await off(pg,'#open'));
 check('idle: no license shows "preview only" so the person knows live tasks need a key',/No license — preview only/.test(await txt(pg,'#lic')));
 check('layout: 360px wide, no sideways scrolling, nothing fixed or sticky',await pg.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth&&[...document.querySelectorAll('body *')].every(e=>!['fixed','sticky'].includes(getComputedStyle(e).position))&&getComputedStyle(document.body).width==='360px'));
 await ctx.close();

 // running
 const job={status:'running',done:7,skipped:1,message:'Reacting to post 7 of 12',config:{action:'like',limit:12,delay:20,dry:false,dailyCap:40},queue:[1,2,3,4]};
 ({ctx,pg}=await open({job,daily:{day:T(),count:14},license:{status:'trial',trialEndsAt:new Date(Date.now()+24*86400000-3600000).toISOString()}}));
 check('running: chip, task text and progress (7 of 12 done · 1 skipped, about 58%)',/Running/.test(await txt(pg,'#chip'))&&/Reacting to post 7 of 12/.test(await txt(pg,'#taskTitle'))&&/7 of 12 done · 1 skipped/.test(await txt(pg,'#done'))&&await pg.evaluate(()=>document.getElementById('bar').style.width)==='58%');
 check('running: Today shows the daily count against the daily limit (14 of 40)',await txt(pg,'#todayN')==='14'&&/of 40 daily limit/.test(await txt(pg,'#todayOf'))&&await shown(pg,'#todayBarWrap')&&await pg.evaluate(()=>document.getElementById('todayBar').style.width)==='35%');
 check('running: Pause and Stop are on; license shows the trial days left',!await off(pg,'#pause')&&!await off(pg,'#stop')&&/Free trial · 24 days left/.test(await txt(pg,'#lic'))&&/Live/.test(await txt(pg,'#mode')));
 await pg.click('#pause');await pg.waitForTimeout(80);await pg.click('#stop');await pg.waitForTimeout(80);
 check('Pause and Stop send exactly the same messages the dashboard sends',JSON.stringify(await pg.evaluate(()=>window.__sent))==='[{"action":"pause"},{"action":"stop"}]');
 await ctx.close();

 // yesterday's counter is not today's
 ({ctx,pg}=await open({job:{...job,config:{...job.config,dailyCap:0}},daily:{day:'Mon Jan 01 2001',count:99},license:{status:'active'}}));
 check("yesterday's daily counter is not shown as today's; no limit means no limit bar",await txt(pg,'#todayN')==='0'&&!await shown(pg,'#todayBarWrap')&&/License active/.test(await txt(pg,'#lic')));
 await ctx.close();

 // paused: needs the person
 ({ctx,pg}=await open({job:{...job,status:'paused',message:'It asked to verify it is you.'},license:{status:'active'}}));
 check('paused: a clear "needs you" alert, Pause is off, Stop is on, and Open dashboard is highlighted to resume there',/needs you/i.test(await txt(pg,'#alertTitle'))&&/verify it is you/.test(await txt(pg,'#alertText'))&&/dashboard to review and resume/.test(await txt(pg,'#alertText'))&&await off(pg,'#pause')&&!await off(pg,'#stop')&&await pg.evaluate(()=>document.getElementById('open').classList.contains('attention')));
 await ctx.close();

 // completed preview
 ({ctx,pg}=await open({job:{...job,status:'completed',config:{...job.config,dry:true},message:'Done'},license:{status:'active'}}));
 check('a finished preview says nothing was sent',/Preview complete — nothing was sent/.test(await txt(pg,'#alertTitle'))&&/Preview/.test(await txt(pg,'#taskKind')));
 await ctx.close();

 // dark + license variants
 ({ctx,pg}=await open({dark:true,license:{status:'expired'}}));
 check('dark mode follows the studio setting; an ended trial is flagged',await pg.evaluate(()=>document.body.classList.contains('dark'))&&/Trial ended/.test(await txt(pg,'#lic')));
 await ctx.close();
 ({ctx,pg}=await open({license:{status:'none'}},{enforce:false}));
 check('development builds (license checks off) show no license chip',!await shown(pg,'#lic'));
 await ctx.close();

 // opening the dashboard
 ({ctx,pg}=await open({license:{status:'active'}},{tabs:[]}));
 await pg.click('#open');await pg.waitForTimeout(120);
 check('Open dashboard opens the dashboard page in a new tab and closes the popup',JSON.stringify(await pg.evaluate(()=>window.__created))===JSON.stringify([DASH])&&await pg.evaluate(()=>window.__closed===true));
 await ctx.close();
 ({ctx,pg}=await open({license:{status:'active'}},{tabs:[{id:42,windowId:1}]}));
 await pg.click('#open');await pg.waitForTimeout(120);
 check('if the dashboard is already open it is brought to the front instead of opening a second copy',JSON.stringify(await pg.evaluate(()=>window.__updated))==='[42]'&&(await pg.evaluate(()=>window.__created)).length===0);
 await ctx.close();
 check('no uncaught page errors',!errors.length);
 await b.close();console.log(`\n${passed} popup checks passed`);
})().catch(e=>{console.error(e.message);process.exit(1);});
