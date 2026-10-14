// Controls are selected by accessible labels, scoped to a single post/header.
(()=>{const S=AuroraSelectors;
const D=globalThis.AuroraDOM={
 visible(e){return !!e?.isConnected&&!!e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden'&&getComputedStyle(e).display!=='none';},
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
 // Facebook's sticky headers, chat docks and lazy layout shifts can cover the control at one alignment; try several before giving up.
 async clear(e,pause=200){for(const block of ['center','start','end','center']){if(!e?.isConnected)return null;e.scrollIntoView({block,inline:'nearest',behavior:'instant'});if(block==='start')scrollBy({top:-140,behavior:'instant'});if(block==='end')scrollBy({top:140,behavior:'instant'});await new Promise(r=>setTimeout(r,pause));const p=this.point(e);if(p)return p;}return null;},
 coveredBy(e){if(!e?.isConnected)return 'detached';const r=e.getBoundingClientRect(),h=document.elementFromPoint(Math.min(innerWidth-1,Math.max(0,r.left+r.width/2)),Math.min(innerHeight-1,Math.max(0,r.top+r.height/2)));if(!h)return 'offscreen';const d=h.closest('[role="dialog"],[role="banner"],[role="complementary"]');return (d?d.getAttribute('role')+' ':'')+h.tagName.toLowerCase()+(h.getAttribute('aria-label')?' "'+h.getAttribute('aria-label')+'"':'')+(d?.innerText?' ('+d.innerText.slice(0,60).replace(/\s+/g,' ')+')':'');},
 scrollFeed(root){
  const feed=root.querySelector('[role="feed"]')||root,anchor=feed.querySelector('[role="article"],[data-pagelet*="FeedUnit"],a[href*="/reel/"]')||feed;
  for(let p=anchor;p;p=p.parentElement){if(/auto|scroll/.test(getComputedStyle(p).overflowY)&&p.scrollHeight>p.clientHeight+1){p.scrollBy({top:Math.max(300,p.clientHeight*.8),behavior:'instant'});return;}}
  window.scrollBy({top:Math.max(500,innerHeight*.8),behavior:'instant'});
 },
 text(e){return String(e?.getAttribute('aria-label')||e?.innerText||e?.textContent||'').trim().replace(/\s+/g,' ');},
 controls(root){return [...(root?.querySelectorAll('button,[role="button"]')||[])].filter(e=>this.visible(e)&&!e.disabled&&e.getAttribute('aria-disabled')!=='true');},
 button(root,...labels){const matches=this.controls(root).filter(e=>labels.includes(this.text(e)));return matches.length===1?matches[0]:null;},
 scope(){return [...document.querySelectorAll('[role="main"],main')].find(e=>this.visible(e))||null;},
 dialogs(){return [...document.querySelectorAll('[role="dialog"],[role="alertdialog"]')].filter(e=>this.visible(e));},
 ownControls(root){return this.controls(root).filter(e=>{if(e.closest('[aria-label*="Comment by" i],[data-testid*="comment" i]'))return false;const a=e.closest('[role="article"]');return !a||a===root||!root.contains(a);});},
 postRoot(url){
  const key=S.pageKey(url),photo=/^\/photo(?:\.php|\/)?$/.test(location.pathname),media=/\/(?:reel|watch|videos)(?:\/|$)/.test(location.pathname);
  // Photo/reel viewers can live beside an empty main node rather than inside it.
  const current=S.pageKey(location.href)===key;
  const main=(photo||media)&&current?document.body:this.scope();if(!main||!S.postURL(url))return null;
  const linksMatch=e=>[...e.querySelectorAll('a[href]')].some(a=>S.postURL(a.href)&&S.pageKey(a.href)===key);
  const all=[...document.querySelectorAll('[role="article"]')].filter(e=>this.visible(e)&&!e.parentElement?.closest('[role="article"]'));
  const postDialogs=current?this.dialogs().filter(d=>this.reactionButton(d)&&this.ownControls(d).some(e=>/^(Share|Share this post|Share reel)$/.test(this.text(e)))):[];
  const matched=all.filter(a=>linksMatch(a)&&(!postDialogs.length||postDialogs.some(d=>d.contains(a)))&&!a.matches('[aria-label*="Comment by" i],[data-testid*="comment" i]')&&this.reactionButton(a)&&this.ownControls(a).some(e=>/^(Share|Share this post)$/.test(this.text(e))));if(matched.length===1)return matched[0];
  const dialogs=this.dialogs().filter(linksMatch);if(dialogs.length===1)return dialogs[0];
  if(!S.postURL(location.href)||S.pageKey(location.href)!==key)return null;
  const inside=all.filter(a=>main.contains(a));
  // Some permalinks expose comment rows as articles but no article for the post itself.
  // A post action row must contain reaction + Comment + Share, excluding Like/Reply rows.
  const rows=[];
  const search=postDialogs.length===1?postDialogs[0]:main;
  for(const reaction of this.controls(search).filter(e=>this.reactionControl(e)&&(!media||this.viewport(e)))){
   if(reaction.closest('[aria-label*="Comment by" i],[data-testid*="comment" i]'))continue;
   for(let node=reaction.parentElement;node&&search.contains(node);node=node.parentElement){
    const controls=this.controls(node),labels=controls.map(e=>this.text(e));
    const hearts=controls.filter(e=>this.reactionControl(e));
    if(hearts.length!==1)break;
    if(labels.some(t=>/^(Comment|Comments|Comment on this post|Leave a comment|Comment on this reel)$/.test(t))&&labels.some(t=>/^(Share|Share this post|Share reel)$/.test(t))){rows.push(node);break;}
    if(node===search)break;
   }
  }
  const unique=[...new Set(rows)];
  if(unique.length===1){
   let root=unique[0];
   // The URL identifies the active reel. Keep its isolated action rail, excluding adjacent reels.
   if(media)return root;
   for(let parent=root.parentElement;parent&&main.contains(parent);parent=parent.parentElement){
    const otherRows=unique.filter(r=>parent.contains(r));if(otherRows.length!==1)break;
    root=parent;
    if(linksMatch(root)||this.author(root)||root.querySelector('[data-ad-preview="message"],[data-ad-comet-preview="message"]'))return root;
    if(parent===main)break;
   }
   return root;
  }
  // Keep the existing single-article layout, but never mistake a comment-only article for a post.
  if(inside.length===1&&this.reactionButton(inside[0])&&this.ownControls(inside[0]).some(e=>/^(Share|Share this post)$/.test(this.text(e)))&&(this.field(inside[0])||this.ownControls(inside[0]).some(e=>/^(Comment|Comment on this post|Leave a comment)$/.test(this.text(e))))&&!inside[0].matches('[aria-label*="Comment by" i]'))return inside[0];
  return null;
 },
 header(){const main=this.scope();if(!main)return null;return main.querySelector('[data-pagelet="ProfileTiles"],[data-pagelet="ProfileHeader"],[data-pagelet="PageHeader"],[data-pagelet="GroupHeader"]')||main;},
 headerControls(){return this.controls(this.header()).filter(e=>!e.closest('[role="article"]'));},
 headerButton(...labels){const buttons=this.headerControls().filter(e=>labels.includes(this.text(e)));return buttons.length===1?buttons[0]:null;},
 author(root){return [...root.querySelectorAll('h2 a[href],h3 a[href],strong a[href],a[data-profile-link]')].filter(e=>this.visible(e)).map(e=>S.profileURL(e.href)).find(Boolean)||null;},
 actor(){return [...document.querySelectorAll('[role="banner"] a[href],nav a[href],[role="navigation"] a[href]')].filter(e=>this.visible(e)&&(/^(Your profile|Profile|Account)$/i.test(e.getAttribute('aria-label')||'')||e.querySelector('img[alt="Your profile"],img[alt="Your profile picture"]'))).map(e=>S.profileURL(e.href)).find(Boolean)||null;},
 reactionControl(e){return !/^(?:Like|Love|Care|Haha|Wow|Sad|Angry):|\d+\s*(?:people|person|reaction)|see who reacted/i.test(this.text(e))&&(/^(Like|Love|Care|Haha|Wow|Sad|Angry|(?:Remove |Change |You reacted with )(?:Like|Love|Care|Haha|Wow|Sad|Angry)(?: reaction)?)$/.test(this.text(e))||!!this.selectedReaction(e));},
 reactionButton(root){const arr=this.ownControls(root).filter(e=>this.reactionControl(e));return arr.length===1?arr[0]:null;},
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
 field(root){const arr=[...root.querySelectorAll('textarea,[contenteditable="true"][role="textbox"],div[contenteditable="true"][aria-label]')].filter(e=>this.visible(e)&&/comment/i.test(e.getAttribute('aria-label')||e.getAttribute('placeholder')||''));return arr.length===1?arr[0]:null;},
 fieldText(f){return 'value'in f?f.value:f.innerText;},
 type(f,text){f.focus();if('value'in f){const proto=f.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(f,text);f.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:text}));}else{document.execCommand('selectAll',false);if(!document.execCommand('insertText',false,text)){f.textContent=text;f.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:text}));}}},
 warning(){if(/\/(?:login|checkpoint|recover)(?:[/?]|$)/.test(location.pathname)||document.querySelector('input[type="password"]'))return 'Sign in or complete verification on Facebook, then resume.';const lang=document.documentElement.lang;if(lang&&!/^en(?:-|$)/i.test(lang))return 'Use Facebook in English so action labels can be verified.';const zones=[...document.querySelectorAll('[role="alert"],[role="alertdialog"],[role="dialog"],h1,h2')].filter(e=>this.visible(e));for(const e of zones){const text=e.innerText||e.textContent||'';if(/temporarily blocked|you.re temporarily blocked|we limit how often|you can.t use this feature|account restricted|try again later|confirm your identity|security check|enter the code|captcha|verify you.re human/i.test(text))return 'Facebook requested a restriction or verification. Check the task tab before resuming.';}return null;}
};})();
