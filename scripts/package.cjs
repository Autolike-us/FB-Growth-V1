// Builds dist/<name>-<version>.zip containing only what Chrome needs (no tests, no git data).
// Usage: npm run package   (no dependencies; works on Windows, macOS and Linux)
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const root=path.join(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
const name=require(path.join(root,'package.json')).name;
if(!process.argv.includes('--dev')&&!/enforce:\s*true|"enforce":\s*true/.test(fs.readFileSync(path.join(root,'license-config.js'),'utf8'))){console.error('Refusing to package: license enforcement is off. Run `node scripts/configure-license.cjs --api https://your-site --jwk \'{...}\'` first, or pass --dev for an unlocked test build.');process.exit(1);}
const files=[];
for(const f of fs.readdirSync(root)){if(/\.(js|html|css|json|md)$/.test(f)&&!['package.json','package-lock.json'].includes(f))files.push(f);}
for(const f of fs.existsSync(path.join(root,'icons'))?fs.readdirSync(path.join(root,'icons')):[])files.push('icons/'+f);
const table=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;return c>>>0;});
const crc32=b=>{let c=0xFFFFFFFF;for(const x of b)c=table[(c^x)&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0;};
const parts=[],central=[];let offset=0;
const dosTime=0,dosDate=((2026-1980)<<9)|(1<<5)|1;
for(const f of files){
  const data=fs.readFileSync(path.join(root,f)),comp=zlib.deflateRawSync(data,{level:9}),nameBuf=Buffer.from(f),crc=crc32(data);
  const lh=Buffer.alloc(30);lh.writeUInt32LE(0x04034b50,0);lh.writeUInt16LE(20,4);lh.writeUInt16LE(0x0800,6);lh.writeUInt16LE(8,8);lh.writeUInt16LE(dosTime,10);lh.writeUInt16LE(dosDate,12);lh.writeUInt32LE(crc,14);lh.writeUInt32LE(comp.length,18);lh.writeUInt32LE(data.length,22);lh.writeUInt16LE(nameBuf.length,26);
  parts.push(lh,nameBuf,comp);
  const ch=Buffer.alloc(46);ch.writeUInt32LE(0x02014b50,0);ch.writeUInt16LE(20,4);ch.writeUInt16LE(20,6);ch.writeUInt16LE(0x0800,8);ch.writeUInt16LE(8,10);ch.writeUInt16LE(dosTime,12);ch.writeUInt16LE(dosDate,14);ch.writeUInt32LE(crc,16);ch.writeUInt32LE(comp.length,20);ch.writeUInt32LE(data.length,24);ch.writeUInt16LE(nameBuf.length,28);ch.writeUInt32LE(offset,42);
  central.push(ch,nameBuf);offset+=30+nameBuf.length+comp.length;
}
const cd=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(cd.length,12);end.writeUInt32LE(offset,16);
fs.mkdirSync(path.join(root,'dist'),{recursive:true});
const out=path.join(root,'dist',`${name}-${manifest.version}.zip`);
fs.writeFileSync(out,Buffer.concat([...parts,cd,end]));
console.log(`Built ${path.relative(root,out)} (${files.length} files). Unzip it and load the folder with chrome://extensions → Load unpacked.`);
