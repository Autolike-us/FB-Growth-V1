// The studio's License box: hidden when checks are off; blocks Start until a valid key is activated.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ROOT=path.join(__dirname,'..'),has=n=>fs.existsSync(path.join(ROOT,n)),read=n=>fs.readFileSync(path.join(ROOT,n),'utf8');let passed=0;
const check=(n,v)=>{assert(v,n);passed++;console.log('PASS '+n);};
const stub=()=>{const store={};window.__sent=[];window.chrome={storage:{local:{get:async k=>{const o={};[].concat(k||[]).forEach(x=>{if(x in store)o[x]=store[x];});return o;},set:async o=>Object.assign(store,o),remove:async k=>{[].concat(k).forEach(x=>delete store[x]);}},onChanged:{addListener(){}}},runtime:{getManifest:()=>({version:'9.9.9'}),sendMessage:async m=>{window.__sent.push(m);return{ok:true};},getURL:x=>x},permissions:{contains:async()=>true}};};
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-crashpad-for-testing']});
try{
 const open=async(file,enforced)=>{const ctx=await browser.newContext({viewport:{width:1280,height:1000}}),pg=await ctx.newPage();pg.setDefaultTimeout(20000);pg.on('pageerror',e=>{throw e;});
  await pg.setContent(read(file).replace(/<script src="[^"]*"><\/script>/g,'').replace(/<link[^>]*stylesheet[^>]*>/,''));await pg.evaluate(stub);
  await pg.addStyleTag({content:read('style.css').replace(/@import[^;]*;/g,'')});
  for(const f of ['selectors.js','engine.js','report.js','license-config.js','license.js'])if(has(f))await pg.addScriptTag({content:f==='license-config.js'?read(f).replace(/"enforce":\s*true/,'"enforce": false'):read(f)});
  if(enforced)await pg.evaluate(()=>{AuroraLicenseConfig.enforce=true;AuroraLicenseConfig.siteUrl='https://aurora.test';let ok=false;AuroraLicense.check=async()=>ok?{allowed:true,status:'trial',trialEndsAt:'2099-01-05T00:00:00Z',message:''}:{allowed:false,status:'none',message:'Add your Aurora license key to start.'};AuroraLicense.activate=async k=>{if(k==='AUR-GOOD-GOOD-GOOD'){ok=true;return{ok:true,status:'trial',message:'Free trial: 3 days left.'};}return{ok:false,status:'invalid',message:'License key not found.'};};});
  await pg.addScriptTag({content:read('dashboard.js')});await pg.waitForTimeout(500);return{ctx,pg};};
 const shown=(pg,s)=>pg.evaluate(q=>{const e=document.querySelector(q);return !!e&&!e.hidden&&getComputedStyle(e).display!=='none';},s);
 for(const file of ['dashboard.html']){
  let {ctx,pg}=await open(file,false);
  check(file+': License box is hidden while checks are off (development builds)',!await shown(pg,'#licenseBar')&&!await pg.isDisabled('#start'));await ctx.close();
  ({ctx,pg}=await open(file,true));
  check(file+': License box shows "No license" with a key field and a trial link',await shown(pg,'#licenseBar')&&/No license/i.test(await pg.textContent('#licChip'))&&await shown(pg,'#licForm')&&(await pg.getAttribute('#licGet','href'))==='https://aurora.test/signup');
  check(file+': the License box advertises the 3-day trial with no subscription or payment method',await shown(pg,'#licNote')&&/no subscription/i.test(await pg.textContent('#licNote'))&&/payment method/i.test(await pg.textContent('#licNote')));
  check(file+': without a license Preview can still start, but a live task cannot',!await pg.isDisabled('#start')&&(await pg.uncheck('#dry'),await pg.isDisabled('#start'))&&(await pg.check('#dry'),!await pg.isDisabled('#start')));
  await pg.uncheck('#dry');
  await pg.fill('#licKey','AUR-BAD0-BAD0-BAD0');await pg.click('#licGo');await pg.waitForTimeout(300);
  check(file+': a wrong key keeps live Start disabled and explains why',await pg.isDisabled('#start')&&/not found/i.test(await pg.textContent('#notice')));
  await pg.fill('#licKey','AUR-GOOD-GOOD-GOOD');await pg.click('#licGo');await pg.waitForTimeout(400);
  check(file+': a good key unlocks live Start and shows the trial',!await pg.isDisabled('#start')&&/Free trial/i.test(await pg.textContent('#licChip'))&&/ends/i.test(await pg.textContent('#licText'))&&!await shown(pg,'#licForm')&&await shown(pg,'#licChange'));
  await pg.click('#licChange');check(file+': "Change key" brings the field back',await shown(pg,'#licForm'));
  await ctx.close();
 }
 console.log('\n'+passed+' license UI checks passed');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
