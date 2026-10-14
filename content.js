(()=>{if(globalThis.__auroraFBActions)return;globalThis.__auroraFBActions=true;const S=AuroraSelectors,D=AuroraDOM;let locked=false,trace=[];const wait=ms=>new Promise(r=>setTimeout(r,ms));const T=(...v)=>trace.push(v.join(' ').slice(0,200));
async function active(id){const warning=D.warning();if(warning)throw Error(warning);const {job}=await chrome.storage.local.get('job');if(job?.id!==id||job.status!=='running')throw Error('Task stopped or paused.');}
async function until(fn,id,ms=10000){for(let t=0;t<ms;t+=250){await active(id);const value=fn();if(value)return value;await wait(250);}return null;}
async function receipt(key,status){const {receipts={}}=await chrome.storage.local.get('receipts');receipts[key]={status,phase:'dispatch',time:Date.now()};await chrome.storage.local.set({receipts});}
async function perform(key,id,click,confirm,message){const {receipts={}}=await chrome.storage.local.get('receipts');if(receipts[key])return{message:'Skipped: Aurora already attempted this action. Check Facebook; no duplicate sent.'};await active(id);await receipt(key,'attempted');await active(id);try{await click();}catch(e){if(e.noClick===true){const {receipts={}}=await chrome.storage.local.get('receipts');delete receipts[key];await chrome.storage.local.set({receipts});T('No click dispatched; cleared preparation receipt');}throw e;}T('Action dispatched');if(!await until(confirm,id,9000))throw Error('Action was sent but its outcome is unknown. Check Facebook manually. Aurora will not automatically repeat it.');await receipt(key,'confirmed');return{performed:true,message};}
async function collectPosts(s,c,id){const read=()=>D.feedPosts();const root=await until(()=>D.scope(),id,12000);if(!root)throw Error('Facebook did not render this page.');await until(()=>read().length,id,12000);const posts=new Map();let stale=0;for(let i=0;i<20&&posts.size<c.perUser&&stale<3;i++){await active(id);const before=posts.size;for(const u of read())posts.set(S.pageKey(u),u);stale=posts.size===before?stale+1:0;if(posts.size>=c.perUser)break;D.scrollFeed(root);await wait(600);}if(!posts.size){if(/content isn.t available|this page isn.t available|no posts yet|no posts to show|private group|join this group to see/i.test(root.innerText))return{posts:[],note:'Skipped: unavailable, empty or private feed.'};throw Error('No posts appeared. Load an accessible page/group/hashtag and resume.');}return{posts:[...posts.values()].slice(0,c.perUser),note:'Collected rendered post links with bounded scrolling.'};}
async function account(s,c,id){const header=()=>D.header(),button=(...labels)=>D.headerButton(...labels);if(!await until(header,id))throw Error('Facebook did not render this page.');const known=['Follow','Following','Message','Add friend','Add Friend','Join group','Join Group','Joined','Friends','Requested','Contact us','Edit profile','Edit Page','Manage','Cancel request','Cancel Request'];if(!header().querySelector('h1,[role="heading"][aria-level="1"]')&&!D.headerControls().some(e=>known.includes(D.text(e))))throw Error('Cannot verify the rendered page/profile/group header. Nothing submitted. Controls seen: '+D.describeControls(header()));if(AuroraEngine.excluded(s.url,s.label,c))return{message:'Skipped: excluded target.'};if(button('Edit profile','Edit Page','Manage'))return{message:'Skipped: your own profile/page.'};const who=D.actor()||'browser',key=who+':'+c.action+':'+S.pageKey(s.url)+(['follow','unfollow'].includes(c.action)?':'+id:'');
if(c.action==='follow'){if(button('Following','Requested','Friends'))return{message:'Skipped: already following or requested.'};let target=button('Follow');if(!target){const menu=button('More','Options');if(c.dry)return{message:'Skipped: Follow is not visible. Open the profile menu and try again.'};if(menu){await active(id);menu.click();await until(()=>D.dialogs().length||document.querySelector('[role="menu"]'),id,3000);const root=[...document.querySelectorAll('[role="menu"]'),...D.dialogs()].filter(e=>D.visible(e));target=root.map(r=>D.button(r,'Follow')).find(Boolean);}}if(!target)throw Error('Follow control unavailable. Open the target profile/page menu and resume.');if(c.dry)return{preview:true,message:'Preview: follow '+s.label+'. No change made.'};return perform(key,id,()=>target.click(),()=>button('Following','Requested')||D.dialogs().some(d=>/following/i.test(d.innerText)),'Followed/requested '+s.label+'.');}
if(c.action==='unfollow'){let following=button('Following');if(!following)return{message:'Skipped: Following control is not visible; no unfollow sent.'};if(c.dry)return{preview:true,message:'Preview: unfollow '+s.label+'. No change made.'};return perform(key,id,async()=>{following.click();const choice=await until(()=>[...D.dialogs(),...document.querySelectorAll('[role="menu"]')].map(r=>D.button(r,'Unfollow')).find(Boolean)||button('Follow'),id,5000);if(!choice)throw Error('Unfollow menu was not found. Check Facebook manually.');if(D.text(choice)==='Unfollow'){await active(id);choice.click();const confirm=await until(()=>D.dialogs().map(d=>D.button(d,'Unfollow','Confirm')).find(Boolean)||button('Follow'),id,3000);if(confirm&&D.text(confirm)!=='Follow'){await active(id);confirm.click();}}},()=>button('Follow'),'Unfollowed '+s.label+'.');}
if(c.action==='friend'){const sent=/^(Friends|Cancel request|Friend request sent|Request sent)\b/i,add=/^Add friend\b/i;if(D.headerMatch(sent))return{message:'Skipped: already friends or requested.'};const target=D.headerMatch(add);if(!target)return{message:'Skipped: friend requests are unavailable for this profile.'};if(c.dry)return{preview:true,message:'Preview: send a friend request to '+s.label+'. No change made.'};return perform(key,id,()=>{D.reveal(target);target.click();},()=>D.headerMatch(sent),'Sent a friend request to '+s.label+'.');}
if(c.action==='join'){if(button('Joined','Leave group','Member'))return{message:'Skipped: already a member.'};if(button('Cancel request','Cancel Request','Request sent'))return{message:'Skipped: a membership request is pending.'};const target=button('Join group','Join Group');if(!target)throw Error('Join group control unavailable.');if(c.dry)return{preview:true,message:'Preview: join/request membership in '+s.label+'. No change made.'};return perform(key,id,async()=>{target.click();const outcome=await until(()=>button('Joined','Member','Cancel request','Cancel Request','Request sent')||D.dialogs().find(d=>/membership questions|answer.*questions|group rules|agree to/i.test(d.innerText)),id,5000);if(outcome?.getAttribute?.('role')==='dialog')throw Error('Group requires membership questions or rules. Complete them manually; Aurora will not answer or agree for you.');},()=>button('Joined','Member','Cancel request','Cancel Request','Request sent'),'Joined/requested membership in '+s.label+'.');}throw Error('Unsupported account action.');}
async function likePost(root,key,s,c,id){
 let target=await until(()=>D.reactionButton(root()),id,4000);if(!target)throw Error('Cannot identify a unique post reaction control. Use Check page.');
 if(D.reacted(target))return{message:'Skipped: post already has your reaction.'};if(D.reacted(target)!==false)throw Error('Cannot read the post reaction state. No click sent.');
 if(c.dry)return{preview:true,message:'Preview: '+c.reaction+' on the target post. No change made.'};
 const {receipts={}}=await chrome.storage.local.get('receipts');const prior=receipts[key];
 // Old releases wrote an attempted receipt before merely opening the chooser.
 let blockedPrior=prior;
 if(prior?.status==='attempted'&&!prior.phase){
  const {debugLog=[]}=await chrome.storage.local.get('debugLog');
  const exact='Step failed: The reaction chooser did not expose '+c.reaction+'. No fallback Like was sent.';
  const index=debugLog.findLastIndex(e=>e.m===exact&&e.t>=prior.time&&e.t-prior.time<30000&&!String(e.d||'').includes('Action dispatched'));
  const before=index>=0?debugLog.slice(0,index).findLast(e=>/^Step engage https:/.test(e.m)):null;
  const address=before?.m?.match(/^Step engage (https:\/\/\S+)/)?.[1];
  if(address&&S.pageKey(address)===S.pageKey(s.url)){delete receipts[key];await chrome.storage.local.set({receipts});blockedPrior=null;T('Removed legacy chooser-only receipt; log proves no reaction click');}
 }
 if(blockedPrior)return{message:'Skipped: Aurora already attempted this reaction. Check Facebook; no duplicate sent.'};
 await active(id);D.reveal(target);
 const reachable=await until(()=>{const next=D.reactionButton(root());if(next&&next!==target){target=next;D.reveal(target);}return D.point(target);},id,3000);
 T('reaction layout',JSON.stringify(D.controlLayout(target)));
 if(!reachable)throw Error('The post reaction control is covered or outside the visible post. No click sent. Scroll the post or close the overlay, then resume.');
 let pick=target,method='Like control';
 if(c.reaction!=='Like'){
  let choice=null;
  // The palette sometimes does not open on the first hover; re-hover up to twice before giving up (nothing is clicked yet).
  for(let attempt=0;attempt<3&&!choice;attempt++){await active(id);if(attempt){D.unhover(target);await wait(700);D.reveal(target);await wait(300);}D.hover(target);choice=await until(()=>D.reactionChoice(c.reaction,target),id,attempt?3500:5000);}
  if(!choice){
   const palette=D.reactionPalette(target);if(palette){
    // Hovering native icons can expose a tooltip even when there is no accessible label.
    for(const item of palette.items){await active(id);D.hover(item);await wait(250);const text=[...document.querySelectorAll('[role="tooltip"]')].filter(e=>D.visible(e)).map(e=>e.textContent.trim());if(text.includes(c.reaction)){choice={element:item,method:'native tooltip'};break;}}
   }
  }
  if(!choice){T('palette candidates',D.reactionPalette(target)?.items.length||0);throw Error('The reaction chooser did not expose '+c.reaction+'. No reaction click was sent. You can resume after opening the palette.');}
  pick=choice.element;method=choice.method;
 }
 const confirmationScope=root();
 T('reaction choice',c.reaction,method);
 return perform(key,id,async()=>{let point=null;if(c.reaction!=='Like')await wait(350);
  // The palette animates open and Facebook draws tooltips over it: wait for the icon to settle instead of failing on the first look.
  for(let t=0;t<14&&!point;t++){await active(id);if(c.reaction!=='Like'){const ch=D.reactionChoice(c.reaction,target);if(ch)pick=ch.element;}point=D.point(pick)||(c.reaction!=='Like'?D.pointByReaction(pick,c.reaction):null);if(!point){if(t===6&&c.reaction!=='Like')D.hover(target);await wait(250);}}
  if(!point)throw Object.assign(Error('The reaction choice is covered or outside the visible post. No click sent.'),{noClick:true});if(c.reaction==='Like'){pick.click();return;}const result=await chrome.runtime.sendMessage({action:'nativeReactionClick',jobId:id,url:s.url,reaction:c.reaction,x:point.x,y:point.y});if(!result?.ok)throw Object.assign(Error(result?.error||'Native reaction input returned no result.'),{noClick:result?.noClick===true});},()=>{const scope=root()||(confirmationScope?.isConnected?confirmationScope:null);const b=(target.isConnected&&D.selectedReaction(target)?target:null)||D.reactionButton(scope);const selected=D.selectedReaction(b);if(selected)T('selected reaction',selected);return selected===c.reaction;},'Reacted '+c.reaction+' to post.');
}
async function commentPost(root,key,c,id){
 let field=D.field(root());
 const opener=()=>D.ownControls(root()).filter(e=>/^(Comment|Comments|Comment on this post|Leave a comment|Write a comment)/i.test(D.text(e)))[0]||null;
 if(!field){
  const target=opener();
  if(c.dry&&target)return{preview:true,message:'Preview: comment control available; editor not opened. Nothing typed or posted.'};
  if(target){await active(id);D.reveal(target);await wait(400);target.click();field=await until(()=>D.field(root()),id,6000);}
 }
 if(!field){T('No comment editor. Opener:',opener()?D.text(opener()):'none','| dialogs',D.dialogs().length,'| editable boxes:',[...document.querySelectorAll('[contenteditable="true"],textarea')].filter(e=>D.visible(e)).map(e=>(e.getAttribute('aria-label')||e.getAttribute('placeholder')||e.tagName).slice(0,36)).join(' ; ')||'none');return{message:'Skipped: a unique comment editor is unavailable.'};}
 if(c.dry)return{preview:true,message:'Preview: comment on target post. Nothing typed or posted.'};
 if(D.fieldText(field).trim())throw Error('Comment box already contains a draft. Clear it manually before resuming.');
 const {receipts={}}=await chrome.storage.local.get('receipts');if(receipts[key])return{message:'Skipped: comment previously attempted. No duplicate sent.'};
 const want=c.comment.replace(/\s*[\r\n]+\s*/g,' ').trim(),norm=t=>String(t||'').replace(/\s+/g,' ');
 const hasText=()=>D.commentRows(root()).some(r=>r.innerText?.includes(want))||norm(root()?.innerText).includes(want)&&!D.fieldText(D.field(root())||{value:''}).trim();
 if(D.commentRows(root()).some(r=>r.innerText?.includes(want)))return{message:'Skipped: matching comment already visible.'};
 await active(id);await wait(900+Math.random()*1300);
 T('Typing comment');await D.typeHuman(field,want,()=>active(id));
 if(D.fieldText(field).trim()!==want)throw Error('Comment did not type correctly. Nothing submitted.');
 await wait(600+Math.random()*900);
 // Also confirm when the editor emptied and the text now appears one more time on the page than before (the comment can render outside the post box).
 const occ=t=>(document.body.innerText.split(want).length-1)-(t?(D.fieldText(t).split(want).length-1):0),before=occ(field),emptied=()=>!field.isConnected||!D.fieldText(field).trim();
 return perform(key,id,async()=>{const submit=D.submitFor(field);T('Send via',submit?'button '+D.text(submit):'Enter key');await active(id);if(submit)submit.click();else{for(const type of ['keydown','keypress','keyup'])field.dispatchEvent(new KeyboardEvent(type,{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true}));}},()=>(hasText()&&(!D.field(root())||!D.fieldText(D.field(root())).trim()))||(emptied()&&occ(null)>before),'Posted your comment.');
}
async function sharePost(root,key,c,id){
 const shares=D.ownControls(root()).filter(e=>/^(Share|Share this post|Share reel|Share, send this to friends|Send this to friends)/i.test(D.text(e)));
 if(!shares.length)return{message:'Skipped: no Share control on this post.'};
 if(c.dry)return{preview:true,message:'Preview: share target post to your feed using Facebook’s current audience. No change made.'};
 const menus=()=>[...D.dialogs(),...document.querySelectorAll('[role="menu"]')].filter(e=>D.visible(e)&&/share/i.test(e.innerText||''));
 const feedButton=m=>D.controls(m).find(e=>/^(Share now|Share to Feed|Share to your feed)/i.test(D.text(e)))||D.button(m,'Share');
 return perform(key,id,async()=>{
  D.reveal(shares[0]);await wait(500);shares[0].click();
  const menu=await until(()=>menus()[0],id,6000);if(!menu)throw Error('Share dialog unavailable. Nothing automatically submitted.');
  if(/Share to a group|Send in Messenger/.test(menu.querySelector('h1,h2,[role="heading"]')?.textContent||''))throw Error('Unexpected share destination. Review it manually.');
  const send=feedButton(menu);if(!send)throw Error('Feed share submit button unavailable. Review Facebook manually.');
  await wait(500+Math.random()*700);await active(id);send.click();
 },()=>[...document.querySelectorAll('[role="alert"],[role="status"]')].some(e=>D.visible(e)&&/post (?:was )?shared|shared to your|shared successfully|shared/i.test(e.innerText))||!menus().length,'Shared post to your feed.');
}
async function engage(s,c,id){const root=()=>D.postRoot(s.url);if(!await until(root,id,12000))throw Error('Post content did not render as a unique target. No action sent.');const author=D.author(root());if(author&&AuroraEngine.excluded(author,'',c))return{message:'Skipped: excluded post author.'};const who=D.actor()||'browser',key=who+':'+c.action+':'+S.pageKey(s.url)+(c.action==='like'?':'+c.reaction:'');
if(c.action==='like')return likePost(root,key,s,c,id);
if(c.action==='comment')return commentPost(root,key,c,id);
if(c.action==='share')return sharePost(root,key,c,id);throw Error('Unsupported post action.');}
// Feed mode: work down the page the way a person does. Take the first post not handled yet, react/comment in place, then scroll on.
const feedIgnored=new Set();
async function closeDialogs(id,s){
 for(let n=0;n<3;n++){const d=D.dialogs().find(x=>D.button(x,'Close'));if(!d)break;await active(id);D.button(d,'Close').click();await wait(600);}
 // A post dialog can change the address bar; step back so the feed (and its scroll position) is still there for the next post.
 if(s&&S.pageKey(location.href)!==S.pageKey(s.url)){history.back();await wait(1200);}
}
async function feed(s,c,id,seen){D.lenient=true;try{return await feedRun(s,c,id,seen);}finally{D.lenient=false;}}
async function feedRun(s,c,id,seen){
 await closeDialogs(id);
 if(!await until(()=>D.feedRows().length,id,12000))throw Error('No posts appeared (no Like/Comment/Share bars found). '+D.probe());
 let idle=0,sawRows=false;
 for(let i=0;i<80;i++){
  await active(id);
  const rows=D.feedRows();if(rows.length)sawRows=true;
  const o=rows.find(r=>{const k=D.rowKey(r);return !seen.has(k)&&!feedIgnored.has(k);});
  if(!o){
   D.advance(rows);await wait(2200);
   idle=D.feedRows().some(r=>{const k=D.rowKey(r);return !seen.has(k)&&!feedIgnored.has(k);})?0:idle+1;
   if(idle>=5){if(!sawRows)throw Error('No posts appeared. '+D.probe());return{end:true,message:'End of feed: no more new posts here.'};}
   continue;
  }
  idle=0;
  const key=D.rowKey(o),find=()=>D.feedRows().find(r=>D.rowKey(r)===key)||null;
  o.row.scrollIntoView({block:'center',behavior:'instant'});await wait(600);
  const cur=find();if(!cur){feedIgnored.add(key);continue;}
  const url=[...cur.box.querySelectorAll('a[href]')].map(a=>S.postURL(a.href)).find(Boolean)||s.url;
  const author=D.author(cur.box);
  if(author&&AuroraEngine.excluded(author,'',c))return{key,url,message:'Skipped: excluded post author.'};
  const who=D.actor()||'browser',pk=S.pageKey(url)===S.pageKey(s.url)?key:S.pageKey(url);
  T('Feed post',key);
  let r;
  try{
   if(c.action==='like')r=await likePost(()=>find()?.row,who+':like:'+pk+':'+c.reaction,s,c,id);
   else if(c.action==='share')r=await sharePost(()=>find()?.row,who+':share:'+pk,c,id);
   else r=await commentPost(()=>D.dialogs().find(d=>D.field(d))||find()?.box,who+':comment:'+pk,c,id);
  }catch(e){
   // Errors that guarantee no click was sent (or an unconfirmed one) skip this post instead of pausing the whole task.
   if(/No click sent|No reaction click was sent/.test(e.message))return{key,url,message:'Skipped: '+e.message};
   if(/outcome is unknown/.test(e.message)){
    // The action was sent, so count it (never exceed your limit) and say plainly that it was not confirmed.
    if(c.action==='comment')return{key,url,performed:true,message:'Comment sent but could not confirm it appeared. Check this post on Facebook.'};
    if(c.action==='share')return{key,url,performed:true,message:'Share sent but could not confirm it. Check Facebook.'};
    const b=D.reactionButton(find()?.row);if(b&&D.reacted(b)===true)return{key,url,performed:true,message:'Reacted to post (could not confirm it is '+c.reaction+'; check Facebook).'};return{key,url,message:'Skipped: reaction click was sent but could not be confirmed. Check this post on Facebook.'};}
   throw e;
  }finally{if(c.action!=='like')await closeDialogs(id,s);}
  return{...r,key,url};
 }
 return{end:true,message:'Stopped after scrolling 80 times without finishing this feed.'};
}
async function step(s,c,id,seen=[]){await active(id);if(S.pageKey(location.href)!==S.pageKey(s.url))throw Error('Facebook changed targets. Nothing submitted.');T('Step',s.kind,c.action);if(s.kind==='feed')return feed(s,c,id,new Set(seen));if(s.kind==='posts')return collectPosts(s,c,id);if(s.kind==='account')return account(s,c,id);if(s.kind==='engage')return engage(s,c,id);throw Error('Unknown task step.');}
globalThis.AuroraDiagnose=()=>{const root=D.postRoot(location.href),mark=x=>x?'✓':'✗';return['Aurora Facebook page check','English interface: '+mark(/^en/.test(document.documentElement.lang)),'Page container: '+mark(D.scope()),'Profile/group header: '+mark(D.header()?.querySelector('h1,[role="heading"]')),'Unique post container: '+mark(root),'Article elements: '+document.querySelectorAll('[role="article"]').length,'Main containers: '+document.querySelectorAll('[role="main"],main').length,'Discoverable feed posts: '+D.feedPosts().length,'Recognized post links: '+[...document.querySelectorAll('a[href]')].filter(a=>S.postURL(a.href)).length,'Post reaction control: '+mark(root&&D.reactionButton(root)),'Reaction layout: '+JSON.stringify(D.controlLayout(root&&D.reactionButton(root))),'Selected reaction: '+(root&&D.selectedReaction(D.reactionButton(root))||'not identifiable'),'Comment editor: '+mark(root&&D.field(root)),'Visible dialogs: '+D.dialogs().length,'Warning: '+(D.warning()||'none')].join('\n');};
chrome.runtime.onMessage.addListener((m,s,reply)=>{if(m.action!=='step'||s.id!==chrome.runtime.id||s.tab||!s.url?.startsWith('chrome-extension://'+chrome.runtime.id+'/'))return;if(locked){reply({wait:'Waiting for the current step.'});return;}locked=true;trace=[];step(m.step,m.config,m.jobId,m.seen).then(r=>reply({...r,trace}),e=>reply({error:e.message,trace,diag:AuroraDiagnose(),stack:String(e.stack||'').split('\n').slice(0,4).join('\n')})).finally(()=>locked=false);return true;});})();
