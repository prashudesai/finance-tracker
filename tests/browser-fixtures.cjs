const fs=require('node:fs'),path=require('node:path');
const manifests=new Map();
exports.logicalURL=(root,url)=>{
 const pathname=url.split('?')[0];if(!pathname.startsWith('/assets/'))return pathname;
 if(!manifests.has(root))manifests.set(root,JSON.parse(fs.readFileSync(path.join(root,'asset-manifest.json'),'utf8')));
 return '/'+(Object.entries(manifests.get(root)).find(([,built])=>'/'+built===pathname)?.[0]||pathname.slice(1));
};
// Exercise the visible dropdown when a native-backed popover is installed.
exports.selectControl=async(page,selector,value)=>{
 const native=page.locator(selector),id=await native.getAttribute('id');
 const trigger=page.locator('#'+id+'PopoverTrigger');
 if(await trigger.isVisible()){
  await trigger.click();
  const panel=page.locator('#'+await trigger.getAttribute('aria-controls'));
  await panel.locator('[role=option]').evaluateAll((buttons,value)=>{const b=buttons.find(b=>b.dataset.value===String(value));if(!b)throw Error('Dropdown option missing: '+value);b.dataset.testSelect='true';},value);
  await panel.locator('[data-test-select=true]').click();
 }else await native.selectOption(value,{force:true});
};
