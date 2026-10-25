const fs=require('./app-source.cjs').fs,vm=require('vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(require('path').join(__dirname,'../dist/index.html'),'utf8');
const start=src.indexOf('    function refreshMobileNavPages('),end=src.indexOf("    mobileNavPrevious?.addEventListener",start);
let width=390,active=0;const tabs=Array.from({length:8},(_,i)=>({hidden:false,classList:{contains:()=>i===active}}));
const context={window:{matchMedia:q=>({matches:q.includes('max-width')?width<=700:width>=480})},document:{querySelectorAll:()=>tabs},mobileNavItems:{style:{setProperty(){}}},mobileNavPrevious:{},mobileNavNext:{},mobileNavStart:0};
vm.createContext(context);vm.runInContext(src.slice(start,end),context);
let checks=0;function check(run){run();checks++;}
for(const size of [320,375,390,430,480,700]){width=size;active=0;context.mobileNavStart=0;context.refreshMobileNavPages(true);const count=4;
check(()=>{assert.equal(tabs.filter(t=>!t.hidden).length,count);assert.equal(context.mobileNavPrevious.disabled,true);});
const reached=new Set();for(let n=0;n<5;n++){tabs.forEach((t,i)=>{if(!t.hidden)reached.add(i)});context.moveMobileNavPages(1);}check(()=>{assert.equal(reached.size,8);assert.equal(context.mobileNavNext.disabled,true);});
for(let i=0;i<8;i++){active=i;context.refreshMobileNavPages(true);check(()=>assert.equal(tabs[i].hidden,false));}
for(let n=0;n<5;n++)context.moveMobileNavPages(-1);check(()=>{assert.equal(context.mobileNavStart,0);assert.equal(context.mobileNavPrevious.disabled,true);});}
width=1024;context.refreshMobileNavPages(true);check(()=>{assert.equal(tabs.filter(t=>!t.hidden).length,8);assert.equal(context.mobileNavNext.disabled,true);});
for(const m of src.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if(!/\bsrc=/.test(m[1]))new vm.Script(m[2]);
console.log(JSON.stringify({passed:checks,failed:0,method:'Node navigation state simulation; no browser capture'}));
