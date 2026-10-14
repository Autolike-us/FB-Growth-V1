import os,json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent;SHOT=os.environ.get('SHOT_DIR')
MOCK='''window.data={job:null,history:[]};window.listeners=[];window.sent=[];
window.chrome={runtime:{id:'extension',onMessage:{addListener:f=>listeners.push(f)},sendMessage:async(m)=>{sent.push(m);return {ok:true,message:'ok'}},getURL:p=>'https://fixture.test/'+p,getManifest:()=>({name:'Aurora • Studio',version:'1.0.0'})},storage:{local:{get:async k=>{if(Array.isArray(k)){const o={};k.forEach(x=>o[x]=structuredClone(data[x]));return o;}if(typeof k==='string')return {[k]:structuredClone(data[k])};return structuredClone(data)},set:async x=>Object.assign(data,structuredClone(x)),remove:async k=>{delete data[k]}},onChanged:{addListener:()=>{}}}};
const nt=window.setTimeout;window.setTimeout=(f,ms,...a)=>nt(f,Math.min(ms,10),...a);'''
checks=[]
def check(n,c):
    assert c,n;checks.append(n)
with sync_playwright() as p:
    exe=os.environ.get('CHROMIUM_PATH') or next((x for x in ('/usr/bin/chromium','/opt/pw-browsers/chromium') if os.path.exists(x)),None)
    b=p.chromium.launch(headless=True,args=['--no-sandbox'],**({'executable_path':exe} if exe else {}))
    ctx=b.new_context();ctx.route('**/*',lambda r:r.fulfill(status=200,content_type='text/html',body='<html><body></body></html>'))
    for f in ('dashboard.html','popup.html'):
        pg=ctx.new_page();pg.set_viewport_size({'width':1200 if f=='dashboard.html' else 780,'height':900});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)) if "Unexpected token '<'" not in str(e) else None)
        pg.goto('https://fixture.test/'+f);pg.set_content((ROOT/f).read_text());pg.add_script_tag(content=MOCK);pg.add_style_tag(path=str(ROOT/'style.css'));pg.add_script_tag(path=str(ROOT/'report.js'));pg.add_script_tag(path=str(ROOT/'dashboard.js'));pg.wait_for_timeout(200);pg.evaluate('window.setTimeout=nt')
        check(f+' preview is on and cannot be turned off',pg.locator('#dry').is_checked() and pg.locator('#dry').is_disabled())
        check(f+' no platform name in title or brand',not any(w in (pg.title()+pg.inner_text('aside')).lower() for w in ('facebook','instagram','tiktok')))
        check(f+' has the same controls as the other editions',all(pg.locator('#'+i).count() for i in ('start','save','pause','resume','stop','presetSave','reset','debugTab','historyTab','theme','banner')))
        check(f+' reaction only for the react action',pg.locator('#reactionGroup').is_visible())
        pg.select_option('#action','comment');check(f+' comment box appears',pg.locator('#commentGroup').is_visible() and not pg.locator('#reactionGroup').is_visible())
        pg.select_option('#action','join');check(f+' joining forces groups source',pg.locator('#mode').input_value()=='groups')
        pg.select_option('#action','like');pg.select_option('#reaction','❤️ Love');pg.select_option('#mode','users');pg.fill('#target','cafe.lovers');pg.fill('#limit','3')
        pg.click('#start');pg.wait_for_timeout(200)
        s=[m for m in pg.evaluate('sent') if m.get('action')=='start']
        check(f+' start sends a locked preview config',len(s)==1 and s[0]['config']['dry'] is True and s[0]['config']['reaction']=='❤️ Love')
        pg.fill('#presetName','Morning');pg.click('#presetSave');pg.wait_for_timeout(100);check(f+' saved setups work',pg.evaluate("Object.keys(data.presets||{}).join()")=='Morning')
        pg.click('#reset');pg.click('#reset');pg.wait_for_timeout(100);check(f+' reset works',pg.locator('#target').input_value()=='' and pg.locator('#dry').is_checked())
        pg.click('#debugTab');pg.wait_for_timeout(200);check(f+' debug log tab works','Aurora debug report' in pg.inner_text('#debugText'))
        check(f+' no page errors',not errs)
        if SHOT:pg.click('#studioTab');pg.screenshot(path=f'{SHOT}/{f}.png',full_page=True)
    # floating panel
    pg=ctx.new_page();pg.set_viewport_size({'width':1200,'height':800});pg.goto('https://www.facebook.com/');pg.set_content('<body><button id="like">Like</button></body>')
    pg.add_script_tag(content=MOCK+"window.pageClicks=0;document.addEventListener('click',e=>{if(!e.composedPath().some(n=>n.id==='aurora-panel-host'))pageClicks++},true);")
    for f in ('report.js','content.js','panel.js'):pg.add_script_tag(path=str(ROOT/f))
    pg.wait_for_timeout(200)
    check('floating button sits bottom-right',pg.evaluate("(()=>{const r=document.getElementById('aurora-panel-host').getBoundingClientRect();return r.right>1100&&r.bottom>600})()"))
    check('page check never touches the page','Preview edition' in pg.evaluate('AuroraDiagnose()') and pg.evaluate('pageClicks')==0)
    if SHOT:pg.screenshot(path=f'{SHOT}/panel.png')
    b.close()
print(json.dumps({'passed':len(checks)}))
