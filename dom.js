// Controls are selected by accessible labels, scoped to a single post/header.
(()=>{const S=AuroraSelectors;
const D=globalThis.AuroraDOM={
 visible(e){return !!e?.isConnected&&!!e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden'&&getComputedStyle(e).display!=='none';},
 text(e){return String(e?.getAttribute('aria-label')||e?.innerText||e?.textContent||'').trim().replace(/\s+/g,' ');},
 controls(root){return [...(root?.querySelectorAll('button,[role="button"]')||[])].filter(e=>this.visible(e)&&!e.disabled&&e.getAttribute('aria-disabled')!=='true');},
 button(root,...labels){const matches=this.controls(root).filter(e=>labels.includes(this.text(e)));return matches.length===1?matches[0]:null;},
 scope(){return [...document.querySelectorAll('[role="main"],main')].find(e=>this.visible(e))||null;},
 dialogs(){return [...document.querySelectorAll('[role="dialog"],[role="alertdialog"]')].filter(e=>this.visible(e));},
 ownControls(root){return this.controls(root).filter(e=>{if(e.closest('[aria-label*="Comment by" i],[data-testid*="comment" i]'))return false;const a=e.closest('[role="article"]');return !a||a===root||!root.contains(a);});},
 postRoot(url){
  const key=S.pageKey(url),main=this.scope();if(!main||!S.postURL(url))return null;
  const linksMatch=e=>[...e.querySelectorAll('a[href]')].some(a=>S.postURL(a.href)&&S.pageKey(a.href)===key);
  const all=[...document.querySelectorAll('[role="article"]')].filter(e=>this.visible(e)&&!e.parentElement?.closest('[role="article"]'));
  const matched=all.filter(a=>linksMatch(a)&&!a.matches('[aria-label*="Comment by" i],[data-testid*="comment" i]')&&this.reactionButton(a)&&this.ownControls(a).some(e=>/^(Share|Share this post)$/.test(this.text(e))));if(matched.length===1)return matched[0];
  const dialogs=this.dialogs().filter(linksMatch);if(dialogs.length===1)return dialogs[0];
  if(!S.postURL(location.href)||S.pageKey(location.href)!==key)return null;
  const inside=all.filter(a=>main.contains(a));
  // Some permalinks expose comment rows as articles but no article for the post itself.
  // A post action row must contain reaction + Comment + Share, excluding Like/Reply rows.
  const rows=[];
  for(const reaction of this.controls(main).filter(e=>/^(Like|Love|Care|Haha|Wow|Sad|Angry|Remove (?:Like|Love|Care|Haha|Wow|Sad|Angry))$/.test(this.text(e)))){
   if(reaction.closest('[aria-label*="Comment by" i],[data-testid*="comment" i]'))continue;
   for(let node=reaction.parentElement;node&&main.contains(node);node=node.parentElement){
    const controls=this.controls(node),labels=controls.map(e=>this.text(e));
    const hearts=controls.filter(e=>/^(Like|Love|Care|Haha|Wow|Sad|Angry|Remove (?:Like|Love|Care|Haha|Wow|Sad|Angry))$/.test(this.text(e)));
    if(hearts.length!==1)break;
    if(labels.some(t=>/^(Comment|Comment on this post|Leave a comment)$/.test(t))&&labels.some(t=>/^(Share|Share this post)$/.test(t))){rows.push(node);break;}
    if(node===main)break;
   }
  }
  const unique=[...new Set(rows)];
  if(unique.length===1){
   let root=unique[0];
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
  if(inside.length===0&&/\/(reel|watch|videos)/.test(location.pathname)&&this.reactionButton(main))return main;
  return null;
 },
 header(){const main=this.scope();if(!main)return null;return main.querySelector('[data-pagelet="ProfileTiles"],[data-pagelet="ProfileHeader"],[data-pagelet="PageHeader"],[data-pagelet="GroupHeader"]')||main;},
 headerControls(){return this.controls(this.header()).filter(e=>!e.closest('[role="article"]'));},
 headerButton(...labels){const buttons=this.headerControls().filter(e=>labels.includes(this.text(e)));return buttons.length===1?buttons[0]:null;},
 author(root){return [...root.querySelectorAll('h2 a[href],h3 a[href],strong a[href],a[data-profile-link]')].filter(e=>this.visible(e)).map(e=>S.profileURL(e.href)).find(Boolean)||null;},
 actor(){return [...document.querySelectorAll('[role="banner"] a[href],nav a[href],[role="navigation"] a[href]')].filter(e=>this.visible(e)&&(/^(Your profile|Profile|Account)$/i.test(e.getAttribute('aria-label')||'')||e.querySelector('img[alt="Your profile"],img[alt="Your profile picture"]'))).map(e=>S.profileURL(e.href)).find(Boolean)||null;},
 reactionButton(root){const arr=this.ownControls(root).filter(e=>/^(Like|Love|Care|Haha|Wow|Sad|Angry|Remove (?:Like|Love|Care|Haha|Wow|Sad|Angry))$/.test(this.text(e)));return arr.length===1?arr[0]:null;},
 reacted(button){if(!button)return null;if(button.getAttribute('aria-pressed')==='true'||/^Remove |^(Love|Care|Haha|Wow|Sad|Angry)$/.test(this.text(button)))return true;if(button.getAttribute('aria-pressed')==='false'||this.text(button)==='Like')return false;return null;},
 commentRows(root){return [...root.querySelectorAll('[role="article"]')].filter(e=>e!==root&&this.visible(e));},
 field(root){const arr=[...root.querySelectorAll('textarea,[contenteditable="true"][role="textbox"],div[contenteditable="true"][aria-label]')].filter(e=>this.visible(e)&&/comment/i.test(e.getAttribute('aria-label')||e.getAttribute('placeholder')||''));return arr.length===1?arr[0]:null;},
 fieldText(f){return 'value'in f?f.value:f.innerText;},
 type(f,text){f.focus();if('value'in f){const proto=f.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(f,text);f.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:text}));}else{document.execCommand('selectAll',false);if(!document.execCommand('insertText',false,text)){f.textContent=text;f.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:text}));}}},
 warning(){if(/\/(?:login|checkpoint|recover)(?:[/?]|$)/.test(location.pathname)||document.querySelector('input[type="password"]'))return 'Sign in or complete verification on Facebook, then resume.';const lang=document.documentElement.lang;if(lang&&!/^en(?:-|$)/i.test(lang))return 'Use Facebook in English so action labels can be verified.';const zones=[...document.querySelectorAll('[role="alert"],[role="alertdialog"],[role="dialog"],h1,h2')].filter(e=>this.visible(e));for(const e of zones){const text=e.innerText||e.textContent||'';if(/temporarily blocked|you.re temporarily blocked|we limit how often|you can.t use this feature|account restricted|try again later|confirm your identity|security check|enter the code|captcha|verify you.re human/i.test(text))return 'Facebook requested a restriction or verification. Check the task tab before resuming.';}return null;}
};})();
