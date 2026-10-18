// The footer must offer the Telegram bug / feature channel next to Report an issue and Contact us (dashboard + popup).
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const TG='https://t.me/+GqmNSvnMJxhhMzJh';
for(const f of ['dashboard.html','popup.html']){
 const h=fs.readFileSync(path.join(__dirname,'..',f),'utf8');
 assert(h.includes('id="joinTelegram" href="'+TG+'"'),f+': Telegram link present');
 assert(h.includes('id="reportIssue"')&&h.includes('id="contactUs"'),f+': email links still present');
 console.log('PASS '+f+' has Report / Contact / Telegram links');
}
