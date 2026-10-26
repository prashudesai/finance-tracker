// Canonical files stay readable; production HTML uses deterministic, immutable assets.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),zlib=require('zlib'),esbuild=require('esbuild');
const root=path.resolve(__dirname,'..'),source=path.join(root,'src'),dist=path.join(root,'dist');
const digest=s=>crypto.createHash('sha256').update(s).digest('hex').slice(0,16);
const order=JSON.parse(fs.readFileSync(path.join(source,'core-order.json'),'utf8'));
const assets=JSON.parse(fs.readFileSync(path.join(source,'runtime-assets.json'),'utf8'));
fs.mkdirSync(path.join(dist,'runtime'),{recursive:true});
for(const name of assets){const content=name==='app-core.js'?order.map(p=>fs.readFileSync(path.join(source,p),'utf8')).join(''):fs.readFileSync(path.join(source,name),'utf8');fs.writeFileSync(path.join(dist,'runtime',name),name.endsWith('.css')?content.replaceAll("url('./images/","url('../images/"):content);}
const screenCSS=new Map();let printCSS='';
for(const logical of ['tracker-enhancements.css',...assets.filter(x=>x.endsWith('.css')).map(x=>'runtime/'+x),'app-style.css','workbench.css','cash-flow.css']){const parts=require('./css-partition.cjs')(fs.readFileSync(path.join(dist,logical),'utf8'));screenCSS.set(logical,parts.critical);printCSS+=parts.secondary;}
fs.writeFileSync(path.join(dist,'print.css'),printCSS);
const out=path.join(dist,'assets');fs.mkdirSync(out,{recursive:true});
const previous=fs.readdirSync(out),generated=new Set(),manifest={},visiting=new Set();
function compile(logical){
 logical=logical.split('?')[0].replace(/^\.\//,'');if(manifest[logical])return manifest[logical];
 if(visiting.has(logical))throw Error('Cyclic static imports need a bundle: '+logical);visiting.add(logical);
 let input=screenCSS.get(logical)??fs.readFileSync(path.join(dist,logical),'utf8');
 if(logical==='boot.js')input=input.replace('/*APP_ASSETS*/{}',JSON.stringify({chart:'./'+compile('runtime/chart-3.9.1.js'),pdf:'./'+compile('vendor/jspdf.umd.min.js'),workbenchCSS:'./'+compile('workbench.css'),cashFlowCSS:'./'+compile('cash-flow.css')}));
 input=input.replace(/\/\/[#@] sourceMappingURL=[^\n]*/g,'');
 if(logical.endsWith('.js'))input=input.replace(/(\bfrom\s*['"]|\bimport\s*['"])(\.[^'"]+)(['"])/g,(all,start,url,end)=>{const target=path.posix.normalize(path.posix.join(path.posix.dirname(logical),url.split('?')[0]));return start+'./'+path.posix.basename(compile(target))+end;});
 if(logical.endsWith('.css'))input=input.replace(/url\((['"]?)(\.{1,2}\/[^'"\)]+)\1\)/g,(all,q,url)=>{const target=path.posix.normalize(path.posix.join(path.posix.dirname(logical),url));return 'url('+q+'../'+target+q+')';});
 let result=esbuild.transformSync(input,{loader:logical.endsWith('.css')?'css':'js',minifyWhitespace:true,minifySyntax:true,minifyIdentifiers:logical.startsWith('vendor/')||logical==='runtime/chart-3.9.1.js',legalComments:'eof',sourcemap:'external',sourcesContent:false,sourcefile:'/'+logical,target:logical.endsWith('.css')?'chrome100':'es2020',charset:'utf8'});
 // Re-minifying an already-minified vendor can make its compressed payload larger.
 if((logical.startsWith('vendor/')||logical==='runtime/chart-3.9.1.js')&&zlib.gzipSync(result.code).length>=zlib.gzipSync(input).length){result={code:input,map:JSON.stringify({version:3,sources:['/'+logical],names:[],mappings:'AAAA'+(';AACA'.repeat(Math.max(0,input.split('\n').length-1)))})};}
 const ext=path.posix.extname(logical),name=path.posix.basename(logical,ext)+'.'+digest(result.code+result.map)+ext;
 const map=JSON.parse(result.map);map.file=name;
 fs.writeFileSync(path.join(out,name),result.code+(ext==='.css'?'\n/*# sourceMappingURL='+name+'.map */':'\n//# sourceMappingURL='+name+'.map')+'\n');
 fs.writeFileSync(path.join(out,name+'.map'),JSON.stringify(map)+'\n');generated.add(name);generated.add(name+'.map');manifest[logical]='assets/'+name;visiting.delete(logical);return manifest[logical];
}
fs.writeFileSync(path.join(dist,'boot.js'),fs.readFileSync(path.join(source,'boot.js')));
let html=fs.readFileSync(path.join(source,'index.html'),'utf8');
html=html.replace(/((?:src|href)=["'])\.\/([^"']+\.(?:js|css))(?:\?[^"']*)?(["'])/g,(_,start,logical,end)=>start+'./'+compile(logical)+end);
let worker=fs.readFileSync(path.join(source,'service-worker.js'),'utf8');
const rawShell=JSON.parse(worker.match(/const APP_SHELL = (\[[^\n]+\])/)[1].replaceAll("'",'"'));
const shell=[...new Set([...rawShell.map(p=>/\.(?:js|css)(?:\?|$)/.test(p)?compile(p):p),...Object.values(manifest)])];
const staticDigests=shell.filter(p=>!p.startsWith('assets/')).map(p=>[p,digest(p==='index.html'?html:fs.readFileSync(path.join(dist,p)))]);
const release=digest(JSON.stringify(manifest)+JSON.stringify(staticDigests)+worker);
worker=worker.replace(/const CACHE_NAME = '[^']+';/,"const CACHE_NAME = 'personal-finance-tracker-shell-cloud-v87-"+release+"';");
worker=worker.replace(/const APP_SHELL = \[[^\n]+\]\.map/, 'const APP_SHELL = '+JSON.stringify(shell)+'.map');
fs.writeFileSync(path.join(dist,'index.html'),html);fs.writeFileSync(path.join(dist,'service-worker.js'),worker);
fs.writeFileSync(path.join(dist,'asset-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
for(const name of previous)if(!generated.has(name))fs.unlinkSync(path.join(out,name));
console.log('Built canonical runtime and '+Object.keys(manifest).length+' minified content-addressed assets with source maps.');
