// The dashboard's fourth stat card, "Today": confirmed live actions counted by the background worker for today's date.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path');
const ROOT=path.join(__dirname,'..'),read=n=>fs.readFileSync(path.join(ROOT,n),'utf8');let passed=0;
const check=(n,v)=>{if(!v){console.error('FAIL '+n);process.exitCode=1;throw new Error('FAIL '+n);}passed++;console.log('PASS '+n);};
(async()=>{
 const html=read('dashboard.html');
 check('dashboard.html has the Today stat and a Help & support link in the menu',/<small>TODAY<\/small><strong id="todayN">0<\/strong>/.test(html)&&/id="helpLink" href="https:\/\/t\.me\//.test(html));
 const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-crashpad-for-testing']});
 const errors=[];
 async function run(daily){
  const ctx=await b.newContext({viewport:{width:1280,height:800}}),pg=await ctx.newPage();pg.on('pageerror',e=>errors.push(e.message));
  await pg.setContent(html.replace(/<script[^>]*><\/script>/g,'').replace(/<link[^>]*>/g,''));
  await pg.evaluate(daily=>{const store={daily,history:[],config:null};window.chrome={storage:{local:{get:async k=>{const o={};[].concat(k||[]).forEach(x=>{if(x in store)o[x]=store[x];});return o;},set:async o=>Object.assign(store,o),remove:async()=>{}},onChanged:{addListener(){}}},runtime:{id:'x',getManifest:()=>({name:'Aurora',version:'1.1.0'}),getURL:x=>x,sendMessage:async()=>({ok:true}),onMessage:{addListener(){}}},permissions:{contains:async()=>true},tabs:{query:async()=>[]},alarms:{}};},daily);
  await pg.addStyleTag({content:read('style.css').replace(/@import[^;]*;/g,'')});
  for(const f of ['selectors.js','engine.js','report.js'])await pg.addScriptTag({content:read(f)});
  await pg.addScriptTag({content:'globalThis.AuroraLicenseConfig={enforce:false,siteUrl:"https://x.test"};'});
  await pg.addScriptTag({content:read('dashboard.js')});await pg.waitForTimeout(200);
  const v=await pg.textContent('#todayN');await ctx.close();return v.trim();
 };
 check("Today shows today's count from the daily counter",await run({day:new Date().toDateString(),count:14})==='14');
 check("yesterday's count is not shown as today's",await run({day:'Mon Jan 01 2001',count:14})==='0');
 check('no counter yet shows 0',await run(undefined)==='0');
 check('no uncaught page errors',!errors.length);
 await b.close();console.log(`\n${passed} today-stat checks passed`);
})().catch(e=>{console.error(e.message);process.exit(1);});
