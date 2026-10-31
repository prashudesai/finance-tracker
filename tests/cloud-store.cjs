const fs=require('./app-source.cjs').fs,assert=require('assert/strict');
(async()=>{
 const source=fs.readFileSync(require('path').join(__dirname,'../dist/firebase-store.js'),'utf8');
 const {createCloudStore}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const raw=crypto.getRandomValues(new Uint8Array(32));const key=await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt','decrypt']);
 const vault={encrypt:async(scope,value)=>{const iv=crypto.getRandomValues(new Uint8Array(12));const data=new TextEncoder().encode(JSON.stringify(value));const ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(scope)},key,data));return Buffer.from(Uint8Array.from([...iv,...ct])).toString('base64');},decrypt:async(scope,value)=>{const data=Uint8Array.from(atob(value),c=>c.charCodeAt(0));return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:data.slice(0,12),additionalData:new TextEncoder().encode(scope)},key,data.slice(12))));},proof:async(scope,value)=>{const k=await crypto.subtle.importKey('raw',raw,{name:'HMAC',hash:'SHA-256'},false,['sign']);return Buffer.from(await crypto.subtle.sign('HMAC',k,new TextEncoder().encode(scope+'\0'+JSON.stringify(value)))).toString('base64');}};
 const db=new Map();let who='a',online=true,failStage=false,failPublish=false,dropStagedChunk=false;const events=[];
 const api={canCleanup:true,currentUid:()=>who,online:()=>online,get:async p=>structuredClone(db.get(p)||null),put:async rows=>{if(failStage)throw Error('stage failed');for(const r of rows)if(!dropStagedChunk)db.set(r.path,structuredClone(r.data));},remove:async paths=>{for(const p of paths)db.delete(p);},publish:async(p,expected,next)=>{if(failPublish)throw Error('publish failed');const old=db.get(p);if(next.mutationId&&old?.mutationId===next.mutationId){if(old.mutationProof!==next.mutationProof)throw Error("conflict");return {acknowledged:old};}if((old?.revision||0)!==expected)throw Error('conflict');db.set(p,{...next,previous:!next.resetHistory&&old?{generation:old.generation,count:old.count}:null});return old;}};
 const results=[];async function test(name,fn){try{await fn();results.push({name,status:'PASS'});}catch(e){results.push({name,status:'FAIL',error:e.stack});}}
 const a=createCloudStore(api,'a','a',vault);
 await test('New Google account starts empty',async()=>assert.equal(await a.load(),null));
 await test('Snapshot round trip preserves Unicode and financial decimals',async()=>{const value={data:{member:'Alex ₹ 日本語',amount:8.25,rows:[{id:'1',amount:1250}]}};await a.save(value);assert.deepEqual(await a.load(),value);});
 await test('Unverified staging cannot publish a cloud pointer',async()=>{
   const before=structuredClone(db.get('users/a/tracker/current'));dropStagedChunk=true;
   try{await assert.rejects(()=>a.save({data:{broken:true}}),/upload is incomplete/);}
   finally{dropStagedChunk=false;}
   assert.deepEqual(db.get('users/a/tracker/current'),before);
   assert.equal((await a.load()).data.member,'Alex ₹ 日本語');
 });
 await test('Cloud chunks contain ciphertext, not financial text',async()=>{const chunks=[...db.values()].filter(v=>v.payload);assert(chunks.length);assert(!chunks.some(v=>atob(v.payload).includes('Alex')));assert.equal(db.get('users/a/tracker/current').format,2);});
 await test('Different Google UID gets isolated records',async()=>{who='b';const b=createCloudStore(api,'b','b',vault);assert.equal(await b.load(),null);await b.save({data:{member:'B'}});assert.equal((await b.load()).data.member,'B');who='a';assert.equal((await a.load()).data.member,'Alex ₹ 日本語');});
 await test('Account switch blocks saves from old session',async()=>{who='b';await assert.rejects(()=>a.save({data:{secret:'a'}}),/account changed/);who='a';});
 await test('Stale browser cannot overwrite newer records',async()=>{const stale=createCloudStore(api,'a','a',vault);await stale.load();await a.save({data:{newer:true}});await assert.rejects(()=>stale.save({data:{stale:true}}),/conflict/);assert.equal((await a.load()).data.newer,true);});
 await test('Large import splits below document size and round trips',async()=>{const value={data:{rows:Array.from({length:12000},(_,i)=>({id:'i'+i,member:'Jamie',amount:i+.25}))}};await a.save(value);assert.deepEqual(await a.load(),value);assert.ok([...db.values()].filter(v=>v.payload).every(v=>v.payload.length<=240000));});
 await test('Offline save does not change cloud records',async()=>{const before=JSON.stringify([...db]);online=false;await assert.rejects(()=>a.save({data:{offline:true}}),/offline/);online=true;assert.equal(JSON.stringify([...db]),before);});
 await test('Failed staging cannot publish partial data',async()=>{const before=db.get('users/a/tracker/current').generation;failStage=true;await assert.rejects(()=>a.save({data:{bad:true}}));failStage=false;assert.equal(db.get('users/a/tracker/current').generation,before);});
 await test('Failed publication leaves authoritative pointer intact',async()=>{const before=db.get('users/a/tracker/current').generation;failPublish=true;await assert.rejects(()=>a.save({data:{bad:true}}));failPublish=false;assert.equal(db.get('users/a/tracker/current').generation,before);});
 await test('Import recovery is part of the same atomic snapshot',async()=>{const recovery={at:'2026-10-21',data:{income:[{amount:100}]}};await a.save({data:{income:[]},recovery});assert.deepEqual((await a.load()).recovery,recovery);});
 await test('Snapshot cleanup bounds successful save history',async()=>{for(let i=0;i<8;i++)await a.save({data:{number:i}});const generations=new Set([...db.keys()].filter(p=>p.startsWith('users/a/snapshots/')).map(p=>p.split('/')[3]));assert.ok(generations.size<=2);});
 await test('Tampered snapshot is rejected before display',async()=>{const meta=db.get('users/a/tracker/current'),key=`users/a/snapshots/${meta.generation}/chunks/0`,old=db.get(key);db.set(key,{payload:btoa('tampered')});await assert.rejects(()=>a.load(),/verification failed/);db.set(key,old);});
 await test('Missing chunk is rejected before display',async()=>{const meta=db.get('users/a/tracker/current'),key=`users/a/snapshots/${meta.generation}/chunks/0`,old=db.get(key);db.delete(key);await assert.rejects(()=>a.load(),/incomplete/);db.set(key,old);});
 await test('Owner can reset an incomplete cloud snapshot without affecting other accounts',async()=>{
   const old=db.get('users/a/tracker/current'),path=`users/a/snapshots/${old.generation}/chunks/0`;
   db.delete(path);
   const other=structuredClone(db.get('users/b/tracker/current'));
   await a.resetBrokenSnapshot({data:{fresh:true},mutationId:'fresh-reset-1'});
   const mobile=createCloudStore(api,'a','a',vault);
   assert.equal((await mobile.load()).data.fresh,true);
   assert.deepEqual(db.get('users/b/tracker/current'),other);
 });
 await test('Reset refuses to erase a healthy cloud snapshot or run as a member',async()=>{
   await assert.rejects(()=>a.resetBrokenSnapshot({data:{wrong:true}}),/now complete/);
   const meta=db.get('users/a/tracker/current'),chunk=`users/a/snapshots/${meta.generation}/chunks/0`,value=db.get(chunk);
   db.delete(chunk);api.canCleanup=false;
   try{await assert.rejects(()=>a.resetBrokenSnapshot({data:{wrong:true}}),/Only the tracker owner/);}
   finally{api.canCleanup=true;db.set(chunk,value);}
 });
 await test('Clearing data drops prior cloud generations',async()=>{await a.save({data:{},recovery:null},{clearHistory:true});assert.equal(db.get('users/a/tracker/current').previous,null);assert.equal(new Set([...db.keys()].filter(p=>p.startsWith('users/a/snapshots/')).map(p=>p.split('/')[3])).size,1);});
 await test('Cloud timestamp matches committed pointer and survives reload',async()=>{await a.save({data:{timestamp:true}});const expected=db.get('users/a/tracker/current').updatedAt;assert.equal(a.updatedAt,expected);const reload=createCloudStore(api,'a','a',vault);await reload.load();assert.equal(reload.updatedAt,expected);});
 await test('Failed publication cannot advance cloud timestamp',async()=>{const before=a.updatedAt;failPublish=true;await assert.rejects(()=>a.save({data:{bad:true}}));failPublish=false;assert.equal(a.updatedAt,before);});
 await test('Lost acknowledgement retry keeps committed revision and timestamp',async()=>{const retry=createCloudStore(api,'a','a',vault);await retry.load();const base=retry.revision;const envelope={data:{retry:true},mutationId:'retry-id'};await retry.save(envelope);const meta=structuredClone(db.get('users/a/tracker/current'));meta.updatedAt='2026-01-01T00:00:00.000Z';db.set('users/a/tracker/current',structuredClone(meta));retry.resume(base);await retry.save(envelope);assert.equal(retry.revision,meta.revision);assert.equal(retry.updatedAt,meta.updatedAt);assert.deepEqual(db.get('users/a/tracker/current'),meta);assert.equal(new Set([...db.keys()].filter(p=>p.startsWith('users/a/snapshots/')).map(p=>p.split('/')[3])).size,2);});
 await test('Reusing a mutation ID for different data cannot overwrite cloud',async()=>{await a.load();const before=structuredClone(db.get('users/a/tracker/current'));await assert.rejects(()=>a.save({data:{different:true},mutationId:'retry-id'}),/conflict/);assert.deepEqual(db.get('users/a/tracker/current'),before);});
 await test('Lost response after publication retains readable data and retries safely',async()=>{const fresh=createCloudStore(api,'a','a',vault);await fresh.load();const original=api.publish;api.publish=async(...args)=>{await original(...args);throw Error('response lost');};const value={data:{committedBeforeDisconnect:true},mutationId:'lost-response'};await assert.rejects(()=>fresh.save(value),/response lost/);api.publish=original;const pointer=structuredClone(db.get('users/a/tracker/current'));assert(db.has(`users/a/snapshots/${pointer.generation}/chunks/0`));await fresh.save(value);assert.equal(fresh.revision,pointer.revision);assert.equal(fresh.updatedAt,pointer.updatedAt);assert.deepEqual(await fresh.load(),value);});
 await test('Invalid UID is rejected',()=>assert.throws(()=>createCloudStore(api,'../other')));
 console.log(JSON.stringify({passed:results.filter(r=>r.status==='PASS').length,failed:results.filter(r=>r.status==='FAIL').length,results},null,2));if(results.some(r=>r.status==='FAIL'))process.exitCode=1;
})();

