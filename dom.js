// Controls are selected by accessible labels, scoped to a single post/header.
(()=>{const S=AuroraSelectors;
const D=globalThis.AuroraDOM={
 visible(e){return !!e?.isConnected&&!e.closest('[hidden],[inert],[aria-hidden="true"]')&&!!e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden'&&getComputedStyle(e).display!=='none';},
 viewport(e){if(!this.visible(e))return false;const r=e.getBoundingClientRect();if(r.bottom<=0||r.top>=innerHeight||r.right<=0||r.left>=innerWidth)return false;for(let p=e.parentElement;p;p=p.parentElement){const s=getComputedStyle(p),b=p.getBoundingClientRect();if(/auto|scroll|hidden|clip/.test(s.overflowY)&&(r.bottom<=b.top||r.top>=b.bottom))return false;}return true;},
 point(e){
  if(!this.visible(e))return null;const r=e.getBoundingClientRect();
  // Try the visible portion too: a tall labelled wrapper can have its centre outside the dialog.
  const left=Math.max(0,r.left),right=Math.min(innerWidth,r.right),top=Math.max(0,r.top),bottom=Math.min(innerHeight,r.bottom);
  if(right<=left||bottom<=top)return null;
  for(const [fx,fy] of [[.5,.5],[.25,.25],[.75,.25],[.25,.75],[.75,.75]]){const x=left+(right-left)*fx,y=top+(bottom-top)*fy,hit=document.elementFromPoint(x,y);if(hit&&e.contains(hit))return{x,y,hit};}
  return null;
 },
 reveal(e){e?.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});},
 controlLayout(e){
  if(!e)return null;const r=e.getBoundingClientRect(),hit=document.elementFromPoint(Math.max(0,Math.min(innerWidth-1,r.left+r.width/2)),Math.max(0,Math.min(innerHeight-1,r.top+r.height/2)));
  // Structural evidence only; do not copy page text, profile names or arbitrary attributes.
  return {tag:e.tagName,role:e.getAttribute('role'),inDialog:!!e.closest('[role="dialog"]'),rect:[r.x,r.y,r.width,r.height].map(Math.round),inViewport:this.viewport(e),reachable:!!this.point(e),centreHit:hit?.tagName||null,centreHitRole:hit?.getAttribute('role')||null,auroraOverlay:!!hit?.closest('#aurora-panel-host')};
 },
 scrollFeed(root){
  const feed=root.querySelector('[role="feed"]')||root,anchor=feed.querySelector('[role="article"],[data-pagelet*="FeedUnit"],a[href*="/reel/"]')||feed;
  for(let p=anchor;p;p=p.parentElement){if(/auto|scroll/.test(getComputedStyle(p).overflowY)&&p.scrollHeight>p.clientHeight+1){p.scrollBy({top:Math.max(300,p.clientHeight*.8),behavior:'instant'});return;}}
  window.scrollBy({top:Math.max(500,innerHeight*.8),behavior:'instant'});
 },
 text(e){return String(e?.getAttribute('aria-label')||e?.innerText||e?.textContent||'').trim().replace(/\s+/g,' ');},
 controls(root){return [...(root?.querySelectorAll('button,[role="button"]')||[])].filter(e=>this.visible(e)&&!e.disabled&&e.getAttribute('aria-disabled')!=='true');},
 button(root,...labels){const matches=this.controls(root).filter(e=>labels.includes(this.text(e)));return matches.length===1?matches[0]:null;},
 scope(){const mains=[...document.querySelectorAll('[role="main"],main')].filter(e=>this.visible(e));const score=e=>e.querySelectorAll('[role="article"],[role="feed"],[data-pagelet*="FeedUnit"],h1').length;return mains.sort((a,b)=>score(b)-score(a))[0]||null;},
 dialogs(){return [...document.querySelectorAll('[role="dialog"],[role="alertdialog"]')].filter(e=>this.visible(e));},
 ownControls(root){return this.controls(root).filter(e=>{if(e.closest('[aria-label*="Comment by" i],[data-testid*="comment" i]'))return false;const a=e.closest('[role="article"]');return !a||a===root||!root.contains(a);});},
 actionRows(root,media=false){
  const rows=[];
  for(const reaction of this.controls(root).filter(e=>this.reactionControl(e)&&(!media||this.viewport(e)))){
   if(reaction.closest('[aria-label*="Comment by" i],[data-testid*="comment" i]'))continue;
   for(let node=reaction.parentElement;node&&root.contains(node);node=node.parentElement){
    const controls=this.ownControls(node),labels=controls.map(e=>this.text(e));
    if(controls.filter(e=>this.reactionControl(e)).length!==1)break;
    const comment=labels.some(t=>/^(Comment|Comments|Comment on this post|Leave a comment|Comment on this reel)$/.test(t))||this.field(node);
    if(comment&&labels.some(t=>/^(Share|Share this post|Share reel)$/.test(t))){rows.push(node);break;}
    if(node===root)break;
   }
  }
  return [...new Set(rows)];
 },
 postRoot(url){
  if(!S.postURL(url))return null;
  const key=S.pageKey(url),current=S.pageKey(location.href)===key;
  const photo=/^\/photo(?:\.php|\/)?$/.test(location.pathname),media=/\/(?:reel|watch|videos)(?:\/|$)/.test(location.pathname);
  const linksMatch=e=>[...e.querySelectorAll('a[href]')].some(a=>!a.closest('[aria-label*="Comment by" i],[data-testid*="comment" i]')&&S.postURL(a.href)&&S.pageKey(a.href)===key);
  // Dialog posts frequently have their own article wrapper. Inspect their action rows
  // before the background feed; ownControls(dialog) intentionally excludes nested articles.
  const candidates=current?this.dialogs().filter(d=>this.actionRows(d,media).length):[];
  const foreground=candidates.filter(d=>!candidates.some(other=>other!==d&&d.contains(other)));
  if(foreground.length>1)return null;
  const main=foreground[0]||((photo||media)&&current?document.body:this.scope());if(!main)return null;
  const all=[...main.querySelectorAll('[role="article"]')].filter(e=>this.visible(e)&&!e.matches('[aria-label*="Comment by" i],[data-testid*="comment" i]'));
  const hasActions=a=>this.reactionButton(a)&&this.ownControls(a).some(e=>/^(Share|Share this post|Share reel)$/.test(this.text(e)))&&(this.field(a)||this.ownControls(a).some(e=>/^(Comment|Comments|Comment on this post|Leave a comment|Comment on this reel)$/.test(this.text(e))));
  const matched=all.filter(a=>linksMatch(a)&&hasActions(a));if(matched.length===1)return matched[0];if(matched.length>1)return null;
  if(!current)return null;
  const rows=this.actionRows(main,media);
  if(rows.length!==1)return null;
  let root=rows[0];
  if(media)return root;
  for(let parent=root.parentElement;parent&&main.contains(parent);parent=parent.parentElement){
   root=parent;
   if(root.matches('[role="article"]')&&this.reactionButton(root))return root;
   if(linksMatch(root)||this.author(root)||root.querySelector('[data-ad-preview="message"],[data-ad-comet-preview="message"]')||root===main)return root;
  }
  return root;
 },
 // Feed mode: locate posts by their action bar (Like + Comment/Share), not by role="article", which Facebook does not reliably set.
 feedRows(){
  const blocked='[role="dialog"],[role="alertdialog"],[data-pagelet*="Cover" i],[data-pagelet*="ProfileHeader" i],[aria-label*="Comment by" i],[aria-label*="Reply by" i],[data-testid*="comment" i]';
  const commentish=t=>/^(Comment|Comments|Leave a comment|Comment on this post|Write a comment)/i.test(t),shareish=t=>/^(Share|Share this post|Send this to friends)/i.test(t);
  // A reacted post exposes both "Remove Like" and "Change Like reaction"; only the first is the primary control.
  const primary=e=>this.reactionControl(e)&&!/^Change /i.test(this.text(e));
  const cands=[];
  for(const like of this.controls(document.body).filter(e=>primary(e)&&!e.closest(blocked))){
   for(let n=like.parentElement,depth=0;n&&n!==document.body&&depth<8;n=n.parentElement,depth++){
    const own=this.ownControls(n);
    if(own.filter(primary).length!==1)break;
    const labels=own.map(e=>this.text(e));
    if(labels.some(commentish)||labels.some(shareish)||this.field(n)){if(!cands.some(o=>o.row===n))cands.push({row:n,like});break;}
   }
  }
  // The post box is the largest ancestor that holds this action bar and no other post's: it carries the author, text and permalink.
  const out=cands.map(o=>{let box=o.row;for(let p=o.row.parentElement,i=0;p&&p!==document.body&&i<14;p=p.parentElement,i++){if(cands.some(x=>x!==o&&p.contains(x.row)))break;if(p.matches('[role="feed"],[role="main"],main'))break;box=p;if(p.matches('[role="article"]'))break;}return{...o,box};});
  return out.filter(o=>this.visible(o.row)).sort((a,b)=>a.row.getBoundingClientRect().top-b.row.getBoundingClientRect().top);
 },
 rowKey(o){
  if(this.keys?.has(o.row))return this.keys.get(o.row);
  const link=[...o.box.querySelectorAll('a[href]')].filter(l=>!l.closest('[aria-label*="Comment by" i],[data-testid*="comment" i]')).map(l=>S.postURL(l.href)).find(Boolean);
  let key=link?S.pageKey(link):null;
  if(!key){
   // No permalink rendered yet: identify by the post's own text (author + caption), never just the shared button labels.
   const rowText=String(o.row.innerText||'').replace(/\s+/g,' ').trim(),t=String(o.box.innerText||'').replace(/\s+/g,' ').trim().replace(rowText,'').trim().slice(0,200);
   if(t.length>=25){let h=0;for(const ch of t)h=(h*31+ch.codePointAt(0))|0;key='txt:'+h;}else key='pos:'+Math.round((scrollY+o.row.getBoundingClientRect().top)/40);
  }
  (this.keys??=new WeakMap).set(o.row,key);return key;
 },
 // Bring more of the feed into view: scrollIntoView moves whichever container actually scrolls, then nudge a little past the last post.
 advance(rows){
  const last=rows[rows.length-1];
  if(!last){window.scrollBy({top:Math.max(500,innerHeight*.8),behavior:'instant'});return;}
  last.box.scrollIntoView({block:'end',behavior:'instant'});
  for(let p=last.box.parentElement;p;p=p.parentElement){if(/auto|scroll/.test(getComputedStyle(p).overflowY)&&p.scrollHeight>p.clientHeight+1){p.scrollBy({top:Math.max(300,p.clientHeight*.6),behavior:'instant'});return;}}
  window.scrollBy({top:Math.max(300,innerHeight*.6),behavior:'instant'});
 },
 probe(){const seen=new Set(),out=[];for(const e of document.querySelectorAll('[aria-label],button,[role="button"]')){if(!this.visible(e))continue;const t=this.text(e).slice(0,40);if(/like|comment|share|react|send/i.test(t)&&!seen.has(t)){seen.add(t);out.push(t);}}return 'articles='+document.querySelectorAll('[role="article"]').length+'; controls: '+(out.slice(0,16).join(' | ')||'none');},
 feedArticles(){return [...document.querySelectorAll('[role="article"]')].filter(e=>this.visible(e)&&!e.parentElement?.closest('[role="article"]')&&!e.closest('[role="dialog"],[role="alertdialog"],[data-pagelet*="Cover" i],[data-pagelet*="ProfileHeader" i]')&&!e.matches('[aria-label*="Comment by" i],[aria-label*="Reply by" i]')).sort((a,b)=>a.getBoundingClientRect().top-b.getBoundingClientRect().top);},
 articleKey(a){
  if(this.keys?.has(a))return this.keys.get(a);
  const link=[...a.querySelectorAll('a[href]')].filter(l=>!l.closest('[aria-label*="Comment by" i],[data-testid*="comment" i]')).map(l=>S.postURL(l.href)).find(Boolean);
  let key=link?S.pageKey(link):null;
  if(!key){const t=String(a.innerText||'').replace(/\s+/g,' ').trim().slice(0,160);if(!t)return null;let h=0;for(const ch of t)h=(h*31+ch.codePointAt(0))|0;key='txt:'+h;}
  (this.keys??=new WeakMap).set(a,key);return key;
 },
 feedPosts(){
  const blocked='[aria-label*="Comment by" i],[data-testid*="comment" i],[data-pagelet*="Cover" i],[data-pagelet*="ProfileHeader" i],[data-pagelet*="PageHeader" i],[role="dialog"],[role="alertdialog"]';
  // Facebook can render its feed beside main or in a second main container.
  // Keep discovery tied to articles/FeedUnits/explicit feeds, never every link on the page.
  const cards=[...document.querySelectorAll('[role="article"],[data-pagelet*="FeedUnit"]')].filter(e=>this.visible(e)&&!e.closest(blocked));
  const links=cards.flatMap(card=>[...card.querySelectorAll('a[href]')]);
  for(const feed of document.querySelectorAll('[role="feed"]'))if(this.visible(feed)&&!feed.closest(blocked))links.push(...feed.querySelectorAll('a[href*="/reel/"]'));
  return [...new Set(links.filter(a=>this.visible(a)&&!a.closest(blocked)).map(a=>S.postURL(a.href)).filter(Boolean))];
 },
 // The whole main column: ProfileTiles is the Intro/Photos side panel (no Follow button), and newer headers carry no h1 or pagelet marker.
 header(){return this.scope();},
 headerControls(){return this.controls(this.header()).filter(e=>!e.closest('[role="article"]'));},
 // A page can show the same Follow/Message button twice (header and sticky bar); the first one in the document is the real header.
 // Match a header control by pattern: Facebook puts the person's name in some labels ("Add Friend Jane Doe").
 headerMatch(re){return this.headerControls().find(e=>re.test(this.text(e)))||null;},
 headerButton(...labels){const buttons=this.headerControls().filter(e=>labels.includes(this.text(e)));return buttons[0]||null;},
 author(root){return [...root.querySelectorAll('h2 a[href],h3 a[href],strong a[href],a[data-profile-link]')].filter(e=>this.visible(e)).map(e=>S.profileURL(e.href)).find(Boolean)||null;},
 actor(){return [...document.querySelectorAll('[role="banner"] a[href],nav a[href],[role="navigation"] a[href]')].filter(e=>this.visible(e)&&(/^(Your profile|Profile|Account)$/i.test(e.getAttribute('aria-label')||'')||e.querySelector('img[alt="Your profile"],img[alt="Your profile picture"]'))).map(e=>S.profileURL(e.href)).find(Boolean)||null;},
 reactionControl(e){return !/^(?:Like|Love|Care|Haha|Wow|Sad|Angry):|\d+\s*(?:people|person|reaction)|see who reacted/i.test(this.text(e))&&(/^(Like|Love|Care|Haha|Wow|Sad|Angry|(?:Remove |Change |You reacted with )(?:Like|Love|Care|Haha|Wow|Sad|Angry)(?: reaction)?)$/.test(this.text(e))||!!this.selectedReaction(e));},
 reactionButton(root){const arr=this.ownControls(root).filter(e=>this.reactionControl(e));return arr.length===1?arr[0]:this.lenient?this.looseLike(root):null;},
 // Feed mode only: Facebook's feed markup varies, so accept any labelled Like control in the post's own action row.
 looseLike(a){
  const names=/^(Like|Love|Care|Haha|Wow|Sad|Angry|(?:Remove |Change |You reacted with )(?:Like|Love|Care|Haha|Wow|Sad|Angry)(?: reaction)?)$/;
  const own=[...a.querySelectorAll('[role="button"],button,[aria-label],[tabindex="0"]')].filter(e=>this.visible(e)&&e.getAttribute('aria-disabled')!=='true'&&!e.closest('[aria-label*="Comment by" i],[aria-label*="Reply by" i],[data-testid*="comment" i]')&&(()=>{const ar=e.closest('[role="article"]');return !ar||ar===a||!a.contains(ar);})());
  const hits=own.filter(e=>names.test(this.text(e))||this.selectedReaction(e)),outer=hits.filter(e=>!hits.some(o=>o!==e&&e.contains(o)));
  const row=outer.filter(e=>{for(let p=e.parentElement;p&&p!==a;p=p.parentElement){const t=[...p.querySelectorAll('[role="button"],button,[aria-label]')].map(x=>this.text(x));if(t.some(x=>/^Comment/.test(x))&&t.some(x=>/^(Share|Send)/.test(x)))return true;}return false;});
  return (row.length?row:outer)[0]||null;
 },
 describeControls(a){return [...a.querySelectorAll('[role="button"],button,[aria-label]')].filter(e=>this.visible(e)).map(e=>this.text(e).slice(0,24)).filter(Boolean).slice(0,14).join(' | ');},

 reactionName(e){
  const names=['Like','Love','Care','Haha','Wow','Sad','Angry'];
  const values=[e.getAttribute('alt'),e.getAttribute('aria-label'),e.getAttribute('title'),e.getAttribute('data-reaction'),e.getAttribute('data-reaction-type'),e.textContent,...[...e.querySelectorAll('[aria-label],[title],img[alt]')].flatMap(n=>[n.getAttribute('aria-label'),n.getAttribute('title'),n.getAttribute('alt')])];
  for(const value of values){const text=String(value||'').trim();const name=names.find(n=>new RegExp('^(?:React with |Remove )?'+n+'(?: reaction)?$','i').test(text));if(name)return name;}
  return null;
 },
 hover(element){
  element.scrollIntoView({block:'nearest',inline:'nearest'});
  const point=this.point(element);if(!point)return;
  const {x:clientX,y:clientY,hit:target}=point;
  const common={bubbles:true,view:window,clientX,clientY,relatedTarget:document.body};
  target.dispatchEvent(new PointerEvent('pointerover',{...common,pointerType:'mouse',pointerId:1,isPrimary:true}));
  target.dispatchEvent(new PointerEvent('pointerenter',{...common,pointerType:'mouse',pointerId:1,isPrimary:true}));
  target.dispatchEvent(new MouseEvent('mouseover',common));target.dispatchEvent(new MouseEvent('mouseenter',common));
 },
 unhover(element){const r=element.getBoundingClientRect(),common={bubbles:true,view:window,clientX:r.left+r.width/2,clientY:r.top+r.height/2,relatedTarget:document.body};for(const t of [element,document.elementFromPoint(common.clientX,common.clientY)].filter(Boolean)){t.dispatchEvent(new PointerEvent('pointerout',{...common,pointerType:'mouse',pointerId:1,isPrimary:true}));t.dispatchEvent(new PointerEvent('pointerleave',{...common,pointerType:'mouse',pointerId:1,isPrimary:true}));t.dispatchEvent(new MouseEvent('mouseout',common));t.dispatchEvent(new MouseEvent('mouseleave',common));}},
 press(element){
  const r=element.getBoundingClientRect(),clientX=r.left+r.width/2,clientY=r.top+r.height/2;
  const hit=document.elementFromPoint(clientX,clientY);const target=hit&&element.contains(hit)?hit:element;
  // Exactly one click; pointer down/up are deliberately not sent (they can trigger another press).
  target.dispatchEvent(new PointerEvent('click',{bubbles:true,cancelable:true,composed:true,view:window,clientX,clientY,button:0,buttons:0,detail:1,pointerType:'mouse',pointerId:1,isPrimary:true}));
 },
 selectedReaction(button){
  if(!button||/^(?:Like|Love|Care|Haha|Wow|Sad|Angry):|\d+\s*(?:people|person|reaction)|see who reacted/i.test(this.text(button)))return null;
  const names=['Like','Love','Care','Haha','Wow','Sad','Angry'];
  const label=this.text(button);
  for(const name of names)if(new RegExp('^(?:Remove |Change |You reacted with )?'+name+'(?: reaction)?$','i').test(label)&&(name!=='Like'||button.getAttribute('aria-pressed')==='true'||/^Remove |^Change |^You reacted with /i.test(label)))return name;
  // Selected reaction graphics may be labelled while the outer control retains “Like”.
  const icons=[...button.querySelectorAll('img[alt],svg[aria-label],i[aria-label],[data-reaction]')].map(e=>this.reactionName(e)).filter(Boolean);
  const unique=[...new Set(icons)];if(unique.length===1&&(unique[0]!=='Like'||button.getAttribute('aria-pressed')==='true'))return unique[0];
  return null;
 },
 reactionPalette(target){
  const canonical=['Like','Love','Care','Haha','Wow','Sad','Angry'];
  const selector='button,[role="button"],[role="radio"],[role="menuitem"],[data-interactable*="|click|"]';
  const tr=target.getBoundingClientRect();
  const all=[...document.querySelectorAll(selector)].filter(e=>e!==target&&this.visible(e)&&!e.closest('[aria-label*="Comment by" i]')&&this.reactionName(e)&&Math.abs(e.getBoundingClientRect().top-tr.top)<220);
  const palettes=[];
  for(const item of all)for(let parent=item.parentElement,n=0;parent&&parent!==document.body&&n<8;parent=parent.parentElement,n++){
   if(parent.matches('[role="article"],[role="main"],main'))break;
   const items=all.filter(e=>parent.contains(e)).filter(e=>!all.some(a=>a!==e&&parent.contains(a)&&a.contains(e)));
   if(items.length!==7||!canonical.every(name=>items.filter(e=>this.reactionName(e)===name).length===1))continue;
   const sorted=canonical.map(name=>items.find(e=>this.reactionName(e)===name));if(!palettes.some(p=>p.items.every((e,j)=>e===sorted[j])))palettes.push({root:parent,items:sorted,names:canonical});break;
  }
  return palettes.length===1?palettes[0]:null;
 },
 pointByReaction(e,name){
  if(!this.visible(e))return null;const r=e.getBoundingClientRect(),sel='button,[role="button"],[role="radio"],[role="menuitem"],[data-interactable*="|click|"]';
  for(const [fx,fy] of [[.5,.5],[.5,.3],[.5,.7],[.3,.5],[.7,.5]]){const x=r.left+r.width*fx,y=r.top+r.height*fy;if(x<0||y<0||x>=innerWidth||y>=innerHeight)continue;const hit=document.elementFromPoint(x,y),ctl=hit?.closest(sel);if(hit&&ctl&&this.reactionName(ctl)===name&&!hit.closest('[aria-label*="Comment by" i]'))return{x,y,hit};}
  return null;
 },
 reactionChoice(name,target){
  const selector='button,[role="button"],[role="radio"],[role="menuitem"],[data-interactable*="|click|"]';
  const near=e=>{const r=e.getBoundingClientRect(),t=target.getBoundingClientRect();return r.width>0&&r.height>0&&Math.abs(r.top-t.top)<220&&r.right>t.left-100&&r.left<t.right+650;};
  const matches=[...document.querySelectorAll(selector)].filter(e=>e!==target&&this.visible(e)&&near(e)&&!e.closest('[aria-label*="Comment by" i]')&&this.reactionName(e)===name);
  const outer=matches.filter(e=>!matches.some(a=>a!==e&&a.contains(e)));if(outer.length===1)return {element:outer[0],method:'label'};
  const palette=this.reactionPalette(target);if(!palette)return null;
  const i=['Like','Love','Care','Haha','Wow','Sad','Angry'].indexOf(name);if(i<0)return null;
  return {element:palette.items[i],method:'native palette label'};
 },
 reacted(button){if(!button)return null;if(this.selectedReaction(button))return true;if(button.getAttribute('aria-pressed')==='true'||/^Remove |^(Love|Care|Haha|Wow|Sad|Angry)$/.test(this.text(button)))return true;if(button.getAttribute('aria-pressed')==='false'||this.text(button)==='Like')return false;return null;},
 commentRows(root){return [...root.querySelectorAll('[role="article"]')].filter(e=>e!==root&&this.visible(e));},
 field(root){const arr=[...root.querySelectorAll('textarea,[contenteditable="true"][role="textbox"],div[contenteditable="true"][aria-label]')].filter(e=>this.visible(e)&&/comment/i.test(e.getAttribute('aria-label')||e.getAttribute('placeholder')||'')&&!/repl/i.test(e.getAttribute('aria-label')||e.getAttribute('placeholder')||''));return arr.length===1||(this.lenient&&arr.length>1)?arr[0]:null;},
 // Types one character at a time with human-like, uneven pauses (longer at spaces and punctuation, an occasional hesitation).
 async typeHuman(f,text,tick){
  const wait=ms=>new Promise(r=>setTimeout(r,ms));f.focus();
  for(const ch of text){
   await tick?.();if(document.activeElement!==f&&!f.contains(document.activeElement))f.focus();
   if('value'in f){const proto=f.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(f,f.value+ch);f.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:ch}));}
   else if(!document.execCommand('insertText',false,ch)){f.textContent+=ch;f.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:ch}));}
   await wait(45+Math.random()*95+(/[\s.,!?]/.test(ch)?60+Math.random()*140:0)+(Math.random()<.04?300+Math.random()*400:0));
  }
 },
 // The send arrow sits next to the editor; look outward from it a few levels for a Comment/Post/Send control.
 submitFor(field){for(let p=field.parentElement,i=0;p&&p!==document.body&&i<7;p=p.parentElement,i++){const b=this.controls(p).find(e=>/^(Comment|Post|Send|Reply|Submit)$/i.test(this.text(e))&&!e.contains(field));if(b)return b;}return null;},
 fieldText(f){return 'value'in f?f.value:f.innerText;},
 type(f,text){f.focus();if('value'in f){const proto=f.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(f,text);f.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:text}));}else{document.execCommand('selectAll',false);if(!document.execCommand('insertText',false,text)){f.textContent=text;f.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:text}));}}},
 warning(){if(/\/(?:login|checkpoint|recover)(?:[/?]|$)/.test(location.pathname)||document.querySelector('input[type="password"]'))return 'Sign in or complete verification on Facebook, then resume.';const lang=document.documentElement.lang;if(lang&&!/^en(?:-|$)/i.test(lang))return 'Use Facebook in English so action labels can be verified.';const zones=[...document.querySelectorAll('[role="alert"],[role="alertdialog"],[role="dialog"],h1,h2')].filter(e=>this.visible(e));for(const e of zones){const text=e.innerText||e.textContent||'';if(/temporarily blocked|you.re temporarily blocked|we limit how often|you can.t use this feature|account restricted|try again later|confirm your identity|security check|enter the code|captcha|verify you.re human/i.test(text))return 'Facebook requested a restriction or verification. Check the task tab before resuming.';}return null;}
};})();
