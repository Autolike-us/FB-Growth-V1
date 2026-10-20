// URL identity is independent of Facebook's frequently changing CSS classes.
globalThis.AuroraSelectors={
 host(host){return /^(?:www\.|m\.|web\.|mbasic\.)?facebook\.com$/i.test(host);},
 url(value){try{const u=new URL(value,'https://www.facebook.com/');if(!this.host(u.hostname)||u.username||u.password)return null;u.protocol='https:';u.hostname='www.facebook.com';u.port='';u.hash='';return u;}catch{return null;}},
 postURL(value){
  const u=this.url(value);if(!u)return null;
  const clean=keys=>{const q=new URLSearchParams();for(const k of keys){const v=u.searchParams.get(k);if(v)q.set(k,v);}return u.origin+u.pathname.replace(/\/$/,'')+(q.size?'?'+q:'');};
  const story=u.searchParams.get('story_fbid'),photo=u.searchParams.get('fbid');
  const valid=id=>/^(?:\d+|pfbid[\w]+)$/.test(id||'');
  // Photo routes are real post-viewer destinations; do not rewrite them as text-post permalinks.
  if(/^\/photo(?:\.php|\/)?$/.test(u.pathname)&&valid(photo))return clean(['fbid','set','type']);
  if(valid(story))return 'https://www.facebook.com/permalink.php?story_fbid='+story+(u.searchParams.get('id')?'&id='+encodeURIComponent(u.searchParams.get('id')):'');
  if(/^\/watch\/?$/.test(u.pathname)&&/^\d+$/.test(u.searchParams.get('v')||''))return 'https://www.facebook.com/watch/?v='+u.searchParams.get('v');
  if(/\/(?:posts|permalink|videos|reel)\/(?:\d+|pfbid[\w]+)(?:\/|$)/.test(u.pathname))return u.origin+u.pathname.replace(/\/$/,'');
  return null;
 },
 profileURL(value){const u=this.url(value);if(!u)return null;if(u.pathname==='/profile.php'&&/^\d+$/.test(u.searchParams.get('id')||''))return u.origin+'/profile.php?id='+u.searchParams.get('id');const p=u.pathname.replace(/^\/|\/$/g,'');if(/^[\w.\-]+$/.test(p)&&!['me','home.php','login','login.php','checkpoint','recover','reel','reels','watch','groups','marketplace','search','hashtag','friends','notifications','messages','gaming','photo.php','permalink.php','story.php','settings','help','pages'].includes(p.toLowerCase()))return u.origin+'/'+p;return null;},
 groupURL(value){const u=this.url(value),m=u?.pathname.match(/^\/groups\/([\w.\-]+)\/?$/);return m&&!['feed','feeds','discover','joins','create'].includes(m[1])?u.origin+'/groups/'+m[1]:null;},
 pageKey(value){const u=this.url(value);if(!u)return null;const post=this.postURL(value);if(post){const p=new URL(post);const id=p.searchParams.get('story_fbid')||p.searchParams.get('fbid')||p.searchParams.get('v')||p.pathname.match(/\/(?:posts|permalink|videos|reel)\/([^/]+)/)?.[1];return 'post:'+id;}const g=this.groupURL(value);if(g)return 'group:'+new URL(g).pathname.split('/')[2];const profile=this.profileURL(value);if(profile)return 'profile:'+profile;const tag=u.pathname.match(/^\/hashtag\/([^/]+)/);if(tag)return 'tag:'+decodeURIComponent(tag[1]).toLowerCase();if(/^\/(?:home\.php)?$/.test(u.pathname)&&/(^|\.)facebook\.com$/.test(u.hostname))return 'home';return u.origin+u.pathname.replace(/\/$/,'')+u.search;}
};
