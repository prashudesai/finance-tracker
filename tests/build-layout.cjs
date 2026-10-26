const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'dist'),src=path.join(root,'src');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');const assets=require('../src/runtime-assets.json');
const firebaseVersion=require('../node_modules/firebase/package.json').version;
for(const name of ['firebase-app.js','firebase-auth.js','firebase-firestore.js']){
 let expected=fs.readFileSync(path.join(root,'node_modules/firebase',name),'utf8');
 expected=expected.replaceAll(`https://www.gstatic.com/firebasejs/${firebaseVersion}/firebase-app.js`,'./firebase-app.js');
 assert.equal(fs.readFileSync(path.join(dist,'vendor',name),'utf8'),expected,'Firebase vendor drift: '+name);
}
const before=new Map(['index.html',...assets.map(x=>'runtime/'+x)].map(p=>[p,fs.readFileSync(path.join(dist,p))]));
execFileSync(process.execPath,[path.join(root,'tools/build.cjs')]);for(const[p,bytes]of before)assert.deepEqual(fs.readFileSync(path.join(dist,p)),bytes,'Generated output drift: '+p);
for(const[p,digest]of Object.entries(require('../src/migration-baseline.json')))if(p.includes('chart-'))assert.equal(hash(fs.readFileSync(path.join(dist,p))),digest,'Vendor changed during extraction: '+p);
assert.equal(hash(fs.readFileSync(path.join(dist,'runtime/app-core.js'))),hash(require('../src/core-order.json').map(p=>fs.readFileSync(path.join(src,p),'utf8')).join('')));
const html=fs.readFileSync(path.join(dist,'index.html'),'utf8'),worker=fs.readFileSync(path.join(dist,'service-worker.js'),'utf8');
assert(html.length<150000);assert(!/<script\s*>([\s\S]+?)<\/script>/.test(html));
const icon192='icons/icon-192.9e1b24ddae720af1.png',icon512='icons/icon-512.11926f609d950641.png',webmanifest=JSON.parse(fs.readFileSync(path.join(dist,'manifest.webmanifest'),'utf8'));
assert(html.includes('rel="preconnect" href="https://identitytoolkit.googleapis.com" crossorigin'));assert(html.includes('./'+icon192));assert(fs.existsSync(path.join(dist,icon192)));assert(fs.existsSync(path.join(dist,icon512)));
assert.deepEqual(webmanifest.icons.map(icon=>icon.src),['./'+icon192,'./'+icon512]);assert(worker.includes(icon192)&&worker.includes(icon512));
const manifest=require('../dist/asset-manifest.json');for(const asset of assets){const built=manifest['runtime/'+asset];assert(built);assert(worker.includes(built));if(asset!=='chart-3.9.1.js')assert(html.includes('./'+built));assert(fs.existsSync(path.join(dist,built+'.map')));}
assert(!html.includes('vendor/jspdf.umd.min.js'));assert(!html.includes('runtime/chart-3.9.1.js'));
assert(html.indexOf(manifest['runtime/bootstrap-2.js'])<html.indexOf(manifest['runtime/app-core.js']));
for(const name of assets.filter(x=>x.endsWith('.css'))){const css=fs.readFileSync(path.join(dist,'runtime',name),'utf8');for(const m of css.matchAll(/url\(['"]?(\.\.\/images\/[^'")]+)['"]?\)/g))assert(fs.existsSync(path.resolve(dist,'runtime',m[1])));}
assert(fs.readFileSync(path.join(dist,'runtime/app-core.js'),'utf8').includes('@page{size:A4'));
for(const [logical,built]of Object.entries(manifest)){
 assert.match(built,/\.[a-f0-9]{16}\.(js|css)$/);const code=fs.readFileSync(path.join(dist,built),'utf8'),map=JSON.parse(fs.readFileSync(path.join(dist,built+'.map'),'utf8'));assert.equal(map.version,3);assert(map.sources.every(source=>fs.existsSync(path.join(dist,source.replace(/^\//,'')))));assert(worker.includes(built));
 for(const match of code.matchAll(/(?:from\s*|import\s*)['"](\.\/[^'"]+\.js)['"]/g))assert(fs.existsSync(path.resolve(dist,path.dirname(built),match[1])),logical+' missing import '+match[1]);
}
const shell=JSON.parse(worker.match(/const APP_SHELL = (\[[^\n]+\])/)[1]);const staticDigests=shell.filter(p=>!p.startsWith('assets/')).map(p=>[p,hash(p==='index.html'?html:fs.readFileSync(path.join(dist,p))).slice(0,16)]);const release=hash(JSON.stringify(manifest)+JSON.stringify(staticDigests)+fs.readFileSync(path.join(src,'service-worker.js'),'utf8')).slice(0,16);assert(worker.includes('shell-cloud-v87-'+release));
assert(html.includes('media="print"'));assert(fs.readFileSync(path.join(dist,'print.css'),'utf8').includes('@media print'));
const split=require('../tools/css-partition.cjs')('@media print{body{display:block}}@media print,screen{.shared{color:red}}.screen{content:"{x}"}');assert(split.secondary.includes('display:block'));assert(split.critical.includes('@media print,screen'));assert(split.critical.includes('.screen'));
const headers=require('../firebase.json').hosting.headers;assert(headers.some(h=>h.source==='/assets/**'&&h.headers.some(v=>v.value.includes('immutable'))));assert(headers.some(h=>h.source==='/icons/icon-192.*.png'&&h.headers.some(v=>v.value.includes('immutable'))));assert(headers.some(h=>h.source==='/icons/icon-512.*.png'&&h.headers.some(v=>v.value.includes('immutable'))));assert(headers.some(h=>h.source==='/'&&h.headers.some(v=>v.value==='no-cache')));
console.log('PASS deterministic hashed build, source agreement, source maps, offline coverage, image paths, print CSS and cache policy');
