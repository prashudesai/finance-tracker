const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('path').join(__dirname,'../dist/cloud-notice.js'),'utf8').replaceAll('export function','function');
const context={};vm.createContext(context);vm.runInContext(source+';this.watch=watchCloudChanges;this.delay=retryDelay;',context);
let next,error,stops=0,subscriptions=0,visible=true,base=3,token='own',notices=[],timer,delay;
const watcher=context.watch({subscribe:(n,e)=>{next=n;error=e;subscriptions++;return()=>stops++;},baseline:()=>base,ownMutation:id=>id===token,notify:v=>notices.push(v),active:()=>visible,timers:{clearTimeout:()=>{timer=null;},setTimeout:(f,d)=>{timer=f;delay=d;return 1;}}});
watcher.resume();watcher.resume();assert.equal(subscriptions,1);
next({revision:3});assert.equal(notices.at(-1),null);
next({revision:4,mutationId:'own'});assert.equal(notices.at(-1),null);
next({revision:4,mutationId:'other'});assert.equal(notices.at(-1).revision,4);
const oldNext=next;visible=false;watcher.resume();assert.equal(stops,1);oldNext({revision:9});assert.equal(notices.at(-1).revision,4);
visible=true;watcher.resume();assert.equal(subscriptions,2);
error({code:'unavailable'});assert.equal(delay,5000);assert.match(notices.at(-1).error,/paused/);timer();assert.equal(subscriptions,3);
error({code:'permission-denied'});assert.equal(timer,null);assert.match(notices.at(-1).error,/access changed/);
watcher.dispose();watcher.resume();assert.equal(subscriptions,3);
console.log('PASS cloud pointer notifications, own writes, hidden-tab cleanup, stale callbacks, reconnect backoff and permission failures');

assert.equal(context.delay(0,()=>0.5),2000);assert.equal(context.delay(3,()=>0.5),30000);assert.equal(context.delay(99,()=>0.5),120000);
