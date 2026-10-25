import {REVIEW_GROUPS,reviewValues,reviewPatch,applyReviewPatch} from './review-model.js?v=83';
export async function installReviewSync(api){
 const db=financeDB,identity=window.financeCloud.uid,opPrefix='reviewOp:v1:';
 let disposed=false,busy=false,resetting=false,inFlight=Promise.resolve(),pending=[],shared={},revision=0,epoch='initial',timer=null,lastError=null,legacy={},received=false,importRequested=false;
 const get=key=>new Promise((resolve,reject)=>{const r=db.transaction('records').objectStore('records').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 const allOps=()=>new Promise((resolve,reject)=>{const r=db.transaction('records').objectStore('records').getAll(IDBKeyRange.bound(opPrefix,opPrefix+'\uffff'));r.onsuccess=()=>resolve(r.result.sort((a,b)=>(a.at||0)-(b.at||0)||a.id.localeCompare(b.id)));r.onerror=()=>reject(r.error);});
 const persist=(added=[],removed=[])=>new Promise((resolve,reject)=>{const tx=db.transaction('records','readwrite'),records=tx.objectStore('records'),r=records.get('sharedReviews:v1');r.onsuccess=()=>{const cached=r.result;if(cached?.revision>revision){shared=reviewValues(cached.shared);revision=cached.revision;epoch=cached.epoch||'initial';}records.put({shared,revision,epoch,legacy},'sharedReviews:v1');for(const op of added)records.put(op,opPrefix+op.id);for(const op of removed)records.delete(opPrefix+op.id);};tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);tx.onerror=()=>{};});
 const cache=await get('sharedReviews:v1');if(cache){shared=reviewValues(cache.shared||{});revision=cache.revision||0;epoch=cache.epoch||'initial';legacy=cache.legacy||{};}else for(const key of REVIEW_GROUPS){try{const v=JSON.parse(trackerStorage.getItem('workbench:'+key)||'{}');if(v&&typeof v==='object'&&!Array.isArray(v))legacy[key]=v;}catch(_) {}}
 pending=await allOps();
 function current(){return applyReviewPatch(shared,pending,false);}
 function publish(){const values=current();try{for(const key of REVIEW_GROUPS)trackerStorage.setItem('workbench:'+key,JSON.stringify(values[key]||{}));}catch(_){}document.dispatchEvent(new Event('finance-review-changed'));}
 function status(){return lastError?.message||(pending.length?(navigator.onLine?'Review changes waiting to sync':'Review changes saved on device · offline'):!navigator.onLine?'Offline · showing saved shared reviews':received?'Reviews synced across devices':'Checking shared reviews…');}
 let lastOpAt=Math.max(0,...pending.map(p=>p.at||0));
 let localQueue=Promise.resolve();const serial=fn=>{const task=localQueue.then(fn);localQueue=task.catch(()=>{});return task;};
 async function flush(){
  if(disposed||busy||resetting||!navigator.onLine||window.financeCloud.canEdit===false||window.financeCloud.accessValid?.()===false||lastError?.code==='tracker/review-conflict')return;
  busy=true;
  try{
   await localQueue;pending=await allOps();if(!pending.length)return;
   const sent=pending.slice();inFlight=api.save(sent);const response=await inFlight;if(disposed)return;received=true;
   await serial(async()=>{if(response.revision>=revision){shared=reviewValues(response.values);revision=response.revision;epoch=response.epoch;}const ids=new Set(sent.map(x=>x.id));pending=pending.filter(x=>!ids.has(x.id));lastError=null;await persist([],sent);publish();});
  }catch(error){lastError=error;document.dispatchEvent(new Event('finance-review-changed'));}
  finally{busy=false;clearTimeout(timer);if(!disposed&&pending.length&&navigator.onLine&&!/permission-denied|unauthenticated|tracker\/review-conflict/.test(lastError?.code||''))timer=setTimeout(flush,10000);}
 }
 async function setGroups(groups){
  if(resetting)throw Error('Records are being cleared. Try again when complete.');
  if(disposed||window.financeCloud.uid!==identity||window.financeCloud.accessValid?.()===false)throw Error('Account access changed. Reload.');
  if(window.financeCloud.canEdit===false)throw Error('Viewer access can read shared reviews but cannot change them.');
  // Capture only the user's field-level edits. Independent changes from another window are preserved.
  const at=lastOpAt=Math.max(Date.now(),lastOpAt+1),view=current(),patch=Object.entries(groups).flatMap(([group,value])=>reviewPatch(group,view[group]||{},value)).map(p=>({...p,id:crypto.randomUUID(),epoch,at}));
  if(!patch.length)return;
  return serial(async()=>{const old=pending;pending=[...pending,...patch];try{if(pending.length>500)throw Error('Too many review changes are waiting. Reconnect and sync first.');reviewValues(current());await persist(patch);lastError=null;publish();}catch(error){pending=old;throw error;}queueMicrotask(flush);});
 }
 const setGroup=(group,value)=>setGroups({[group]:value});
 window.financeReviews={get:group=>current()[group]||{},setGroup,setGroups,status,problem:()=>Boolean(lastError),pending:()=>pending.length>0,export:()=>current(),
  async importDeviceMarks(){for(const key of REVIEW_GROUPS){const values=legacy[key];if(values&&Object.keys(values).length){await setGroup(key,{...values,...current()[key]});delete legacy[key];await persist();}}},
  hasLegacy:()=>Object.values(legacy).some(v=>Object.keys(v).length),async retry(){lastError=null;await flush();},
  async reload(discard=false){await localQueue;if(busy)throw Error('Wait for the review save to finish before reloading.');const ops=await allOps();if(ops.length&&!discard)throw Error('Export pending review changes before replacing them.');const result=await api.load();received=true;shared=reviewValues(result.values);revision=result.revision;epoch=result.epoch;pending=[];lastError=null;await persist([],discard?ops:[]);publish();},
  exportPending(){return {shared,pending,epoch};}};
 const stop=api.subscribe(result=>{if(disposed)return;if(!result.fromCache)received=true;serial(async()=>{if(result.revision>=revision){shared=reviewValues(result.values);revision=result.revision;epoch=result.epoch;await persist();publish();}}).then(()=>{if(!result.fromCache&&!importRequested&&window.financeCloud.canEdit!==false){importRequested=true;window.financeReviews.importDeviceMarks().catch(error=>{lastError=error;});}}).catch(error=>{lastError=error;});},error=>{lastError=error;document.dispatchEvent(new Event('finance-review-changed'));});
 const online=()=>flush();window.addEventListener('online',online);publish();queueMicrotask(flush);
 const saveFinancial=window.financeCloud.save;
 window.financeCloud.save=async function(envelope,options){const result=await saveFinancial.call(this,envelope,options);if(options?.clearHistory){resetting=true;clearTimeout(timer);try{await inFlight.catch(()=>{});await localQueue;const reset=await api.reset('clear-'+(envelope.mutationId||crypto.randomUUID()));const ops=await allOps();shared=reviewValues(reset.values);pending=[];revision=reset.revision;epoch=reset.epoch;legacy={};await persist([],ops);publish();}finally{resetting=false;}}return result;};
 const oldReset=window.financeBridge.reset;window.financeBridge.reset=function(){disposed=true;clearTimeout(timer);stop?.();window.removeEventListener('online',online);return oldReset.apply(this,arguments);};
 return window.financeReviews;
}
