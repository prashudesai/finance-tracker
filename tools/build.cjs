// Preserve classic-script ordering and hoisting while keeping editable source by feature.
const fs=require('fs'),path=require('path');const root=path.resolve(__dirname,'..'),source=path.join(root,'src'),dist=path.join(root,'dist');
const order=JSON.parse(fs.readFileSync(path.join(source,'core-order.json'),'utf8'));const assets=JSON.parse(fs.readFileSync(path.join(source,'runtime-assets.json'),'utf8'));
fs.mkdirSync(path.join(dist,'runtime'),{recursive:true});
for(const name of assets){const content=name==='app-core.js'?order.map(p=>fs.readFileSync(path.join(source,p),'utf8')).join(''):fs.readFileSync(path.join(source,name),'utf8');fs.writeFileSync(path.join(dist,'runtime',name),name.endsWith('.css')?content.replaceAll("url('./images/","url('../images/"):content);}
fs.writeFileSync(path.join(dist,'index.html'),fs.readFileSync(path.join(source,'index.html')));
console.log('Built HTML shell and '+assets.length+' ordered runtime assets.');
