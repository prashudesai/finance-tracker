// Legacy function-level tests inspect the composed application; browser tests load real assets.
const native=require('fs'),path=require('path');const index=path.resolve(__dirname,'../dist/index.html');
function readFileSync(file,options){const content=native.readFileSync(file,options);if(path.resolve(String(file))!==index)return content;let html=native.readFileSync(path.join(__dirname,'../src/index.html'),'utf8');
html=html.replace(/<link rel="stylesheet" href="\.\/runtime\/([^"?]+)(?:\?[^\"]*)?">/g,(_,name)=>'<style>'+native.readFileSync(path.join(path.dirname(index),'runtime',name),'utf8')+'</style>');
html=html.replace(/<script([^>]*?) src="\.\/runtime\/([^"?]+)(?:\?[^\"]*)?"><\/script>/g,(_,attrs,name)=>'<script'+attrs+'>'+native.readFileSync(path.join(path.dirname(index),'runtime',name),'utf8')+'</script>');
return Buffer.isBuffer(content)?Buffer.from(html):html;}
exports.fs={...native,readFileSync};
