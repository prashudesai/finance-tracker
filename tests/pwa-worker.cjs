const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const path=require('path');
const source=fs.readFileSync(process.env.WORKER_SOURCE||path.join(__dirname,'../dist/service-worker.js'),'utf8');
const origin='https://tracker.example';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const unhandled=[];process.on('unhandledRejection',e=>unhandled.push(e.message));
function harness(options={}){
 const handlers={},stores=new Map(),calls=[];let skipped=0,claimed=0,failWrites=false,openDelay=0;
 let network=async url=>new Response(String(url).includes('.js')?'/* asset */':'tracker-v1',{headers:{'Content-Type':String(url).endsWith('.html')||String(url).endsWith('/')?'text/html':'application/octet-stream'}});
 const key=x=>new URL(typeof x==='string'?x:x.url,origin+'/').href;
 function cache(name){if(!stores.has(name))stores.set(name,new Map());const map=stores.get(name);return{
  async match(r){return map.get(key(r))?.clone();},
  async put(r,response){if(failWrites)throw Error('QuotaExceededError');map.set(key(r),response.clone());},
  async addAll(urls){const rows=await Promise.all(urls.map(async u=>{const r=await network(key(u));if(!r.ok)throw Error('Precache failed');return[key(u),r];}));for(const[u,r]of rows)map.set(u,r.clone());}
 };}
 const caches={async open(n){if(openDelay)await pause(openDelay);return cache(n);},async keys(){return [...stores.keys()];},async delete(n){return stores.delete(n);},async match(r){for(const n of stores.keys()){const result=await cache(n).match(r);if(result)return result;}}};
 const self={location:new URL(origin+'/service-worker.js'),registration:{scope:origin+'/'},clients:{claim:async()=>{claimed++;}},skipWaiting:async()=>{skipped++;},addEventListener:(n,f)=>handlers[n]=f};
 const context={self,caches,URL,Request,Response,Promise,AbortController,console,setTimeout:(f,ms)=>setTimeout(f,Math.min(ms,35)),clearTimeout,fetch:async(r,init)=>{calls.push(key(r));return network(key(r),init);}};
 vm.runInNewContext(source,context);
 async function lifecycle(type,data={}){const jobs=[];handlers[type]?.({...data,waitUntil:p=>jobs.push(p)});await Promise.all(jobs);}
 async function request(url='/',mode='navigate',method='GET'){
  let response;const jobs=[];const startErrors=unhandled.length;
  handlers.fetch({request:{url:new URL(url,origin).href,mode,method},respondWith:p=>response=Promise.resolve(p),waitUntil:p=>jobs.push(Promise.resolve(p))});
  if(!response)return{intercepted:false};const result=await response;const text=await result.text();await Promise.all(jobs);await pause(15);
  return{intercepted:true,status:result.status,text,errors:unhandled.slice(startErrors)};
 }
 return{stores,calls,lifecycle,request,cache,setNetwork:f=>network=f,setFailWrites:v=>failWrites=v,setOpenDelay:v=>openDelay=v,get skipped(){return skipped;},get claimed(){return claimed;}};
}
const results=[];
async function test(name,fn){try{await fn();results.push({name,status:'PASS'});}catch(e){results.push({name,status:'FAIL',error:e.message});}}
(async()=>{
 await test('Initial install precaches the shell and icons',async()=>{const h=harness();await h.lifecycle('install');assert((await h.request('/')).text.includes('tracker'));h.setNetwork(async()=>{throw Error('offline')});assert.equal((await h.request('/')).text,'tracker-v1');});
 await test('Offline query URL uses the same shell',async()=>{const h=harness();await h.lifecycle('install');h.setNetwork(async()=>{throw Error('offline')});assert.equal((await h.request('/?source=installed')).text,'tracker-v1');});
 await test('Online navigation keeps the installed release until update activation',async()=>{const h=harness();await h.lifecycle('install');h.setNetwork(async()=>new Response('tracker-v2',{headers:{'Content-Type':'text/html'}}));await h.request('/');h.setNetwork(async()=>{throw Error('offline')});assert.equal((await h.request('/')).text,'tracker-v1');});
 await test('Server 503 uses cached shell',async()=>{const h=harness();await h.lifecycle('install');h.setNetwork(async()=>new Response('unavailable',{status:503}));assert.equal((await h.request('/')).text,'tracker-v1');});
 await test('Installed shell remains available while auth and API routes bypass cache',async()=>{const h=harness();await h.lifecycle('install');h.setNetwork(async()=>new Response('sign in',{status:401}));assert.equal((await h.request('/')).status,200);h.setNetwork(async()=>{throw Error('offline')});assert.equal((await h.request('/index.html')).text,'tracker-v1');});
 await test('Redirected login response never replaces the shell',async()=>{const h=harness();await h.lifecycle('install');h.setNetwork(async()=>{const r=new Response('login',{headers:{'Content-Type':'text/html'}});Object.defineProperty(r,'redirected',{value:true});return r;});await h.request('/');h.setNetwork(async()=>{throw Error('offline')});assert.equal((await h.request('/index.html')).text,'tracker-v1');});
 await test('Non-HTML successful response never replaces the shell',async()=>{const h=harness();await h.lifecycle('install');h.setNetwork(async()=>new Response('{"error":"gateway"}',{headers:{'Content-Type':'application/json'}}));await h.request('/');h.setNetwork(async()=>{throw Error('offline')});assert.equal((await h.request('/index.html')).text,'tracker-v1');});
 for(const url of ['/backup.json','/api/records','/auth/callback'])await test('Unrelated request bypasses cache: '+url,async()=>{const h=harness();assert.equal((await h.request(url,'cors')).intercepted,false);});
 await test('Unrelated navigation bypasses shell',async()=>{const h=harness();assert.equal((await h.request('/auth/callback')).intercepted,false);});
 await test('Cross-origin and POST requests remain untouched',async()=>{const h=harness();assert.equal((await h.request('https://other.example/file.js','cors')).intercepted,false);assert.equal((await h.request('/','navigate','POST')).intercepted,false);});
 await test('Cache writes survive response consumption and worker lifetime',async()=>{const h=harness();await h.lifecycle('install');h.setOpenDelay(5);h.setNetwork(async()=>new Response('new asset'));for(const map of h.stores.values())map.delete(origin+'/icons/icon-512.png');const r=await h.request('/icons/icon-512.png','cors');assert.deepEqual(r.errors,[]);});
 await test('Cache quota failure does not reject an online navigation',async()=>{const h=harness();await h.lifecycle('install');h.setFailWrites(true);h.setNetwork(async()=>new Response('tracker-v2',{headers:{'Content-Type':'text/html'}}));const r=await h.request('/');assert.equal(r.text,'tracker-v1');assert.deepEqual(r.errors,[]);});
 await test('Slow navigation falls back to cached shell promptly',async()=>{const h=harness();await h.lifecycle('install');h.setNetwork(()=>new Promise(()=>{}));const r=await Promise.race([h.request('/'),pause(180).then(()=>{throw Error('navigation hung');})]);assert.equal(r.text,'tracker-v1');});
 await test('Install does not force takeover while an old form is open',async()=>{const h=harness();await h.lifecycle('install');assert.equal(h.skipped,0);});
 await test('Explicit update request enables activation',async()=>{const h=harness();await h.lifecycle('message',{data:{type:'SKIP_WAITING'}});assert.equal(h.skipped,1);});
 await test('Activation removes own obsolete cache and preserves unrelated caches',async()=>{const h=harness();await h.lifecycle('install');await h.cache('personal-finance-tracker-shell-obsolete').put('/',new Response('old'));await h.cache('another-app').put('/',new Response('other'));await h.lifecycle('activate');assert(!h.stores.has('personal-finance-tracker-shell-obsolete'));assert(h.stores.has('another-app'));assert.equal(h.claimed,1);});
 await test('Offline fallback never reads another app cache',async()=>{const h=harness();await h.cache('another-app').put('/',new Response('wrong app'));await h.lifecycle('install');h.setNetwork(async()=>{throw Error('offline')});assert.equal((await h.request('/')).text,'tracker-v1');});
 await test('Cached icon avoids a network request',async()=>{const h=harness();await h.lifecycle('install');const count=h.calls.length;await h.request('/icons/icon-192.png','cors');assert.equal(h.calls.length,count);});
 await test('Redirect during precache blocks installation',async()=>{const h=harness();h.setNetwork(async()=>{const r=new Response('login',{headers:{'Content-Type':'text/html'}});Object.defineProperty(r,'redirected',{value:true});return r;});await assert.rejects(h.lifecycle('install'));});
 await test('Failed precache blocks new installation',async()=>{const h=harness();h.setNetwork(async()=>new Response('bad',{status:500}));await assert.rejects(h.lifecycle('install'));assert.equal(h.skipped,0);});
 const report={passed:results.filter(r=>r.status==='PASS').length,failed:results.filter(r=>r.status==='FAIL').length,results};console.log(JSON.stringify(report,null,2));if(report.failed)process.exitCode=1;
})();
