const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'dist'),src=path.join(root,'src');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');const assets=require('../src/runtime-assets.json');
const before=new Map(['index.html',...assets.map(x=>'runtime/'+x)].map(p=>[p,fs.readFileSync(path.join(dist,p))]));
execFileSync(process.execPath,[path.join(root,'tools/build.cjs')]);for(const[p,bytes]of before)assert.deepEqual(fs.readFileSync(path.join(dist,p)),bytes,'Generated output drift: '+p);
for(const[p,digest]of Object.entries(require('../src/migration-baseline.json')))if(p.includes('chart-'))assert.equal(hash(fs.readFileSync(path.join(dist,p))),digest,'Vendor changed during extraction: '+p);
assert.equal(hash(fs.readFileSync(path.join(dist,'runtime/app-core.js'))),hash(require('../src/core-order.json').map(p=>fs.readFileSync(path.join(src,p),'utf8')).join('')));
const html=fs.readFileSync(path.join(dist,'index.html'),'utf8'),worker=fs.readFileSync(path.join(dist,'service-worker.js'),'utf8');
assert(html.length<150000);assert(!/<script\s*>([\s\S]+?)<\/script>/.test(html));
for(const asset of assets){assert(html.includes('./runtime/'+asset+'?v=80'));assert(worker.includes('runtime/'+asset+'?v=80'));}
assert(html.indexOf('runtime/chart-3.9.1.js')<html.indexOf('runtime/bootstrap-2.js'));assert(html.indexOf('runtime/bootstrap-2.js')<html.indexOf('runtime/app-core.js'));
for(const name of assets.filter(x=>x.endsWith('.css'))){const css=fs.readFileSync(path.join(dist,'runtime',name),'utf8');for(const m of css.matchAll(/url\(['"]?(\.\.\/images\/[^'")]+)['"]?\)/g))assert(fs.existsSync(path.resolve(dist,'runtime',m[1])));}
assert(fs.readFileSync(path.join(dist,'runtime/app-core.js'),'utf8').includes('@page{size:A4'));
console.log('PASS deterministic build, unchanged core/vendor bytes, ordered assets, offline asset coverage, image paths and print CSS');
