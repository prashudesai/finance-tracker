const fs=require('node:fs'),path=require('node:path');
const manifests=new Map();
exports.logicalURL=(root,url)=>{
 const pathname=url.split('?')[0];if(!pathname.startsWith('/assets/'))return pathname;
 if(!manifests.has(root))manifests.set(root,JSON.parse(fs.readFileSync(path.join(root,'asset-manifest.json'),'utf8')));
 return '/'+(Object.entries(manifests.get(root)).find(([,built])=>'/'+built===pathname)?.[0]||pathname.slice(1));
};
