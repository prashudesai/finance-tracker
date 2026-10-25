import {reviewValues,reviewPatch,applyReviewPatch,reviewBackup,parseReviewBackup} from './review-model.js?v=83';
export async function installReviewSync(api){
 const db=financeDB,identity=window.financeCloud.uid,opPrefix='reviewOp:v1:';
 let disposed=false,busy=false,resetting=false,inFlight=Promise.resolve(),pending=[],shared={},revision=0,epoch='initial',timer=null,lastError=null,received=false,restoreJournal=null,viewCache=null;
 async function getRestoreJournal(){return new Promise((resolve,reject)=>{const r=db.transaction('records').objectStore('records').get('backupReviewRestore:v1');r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error);});}
 const get=key=>new Promise((resolve,reject)=>{const r=db.transaction('records').objectStore('records').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 const allOps=()=>new Promise((resolve,reject)=>{const r=db.transaction('records').objectStore('records').getAll(IDBKeyRange.bound(opPrefix,opPrefix+'\uffff'));r.onsuccess=()=>resolve(r.result.sort((a,b)=>(a.at||0)-(b.at||0)||a.id.localeCompare(b.id)));r.onerror=()=>reject(r.error);});
 const persist=(added=[],removed=[],clearRestore=false)=>new Promise((resolve,reject)=>{const tx=db.transaction('records','readwrite'),records=tx.objectStore('records'),r=records.get('sharedReviews:v1');let failure;const guard=records.get('backupReviewRestore:v1');guard.onsuccess=()=>{if(added.length&&guard.result){failure=Error('A backup restore is pending in another window. Finish syncing it before changing reviews.');tx.abort();}};r.onsuccess=()=>{const cached=r.result;if(cached?.revision>revision){shared=reviewValues(cached.shared);revision=cached.revision;epoch=cached.epoch||'initial';}records.put({shared,revision,epoch},'sharedReviews:v1');if(clearRestore)records.delete('backupReviewRestore:v1');for(const op of added)records.put(op,opPrefix+op.id);for(const op of removed)records.delete(opPrefix+op.id);};tx.oncomplete=resolve;tx.onabort=()=>reject(failure||tx.error);tx.onerror=()=>{};});
 const [cache,storedOps,journal]=await Promise.all([get('sharedReviews:v1'),allOps(),getRestoreJournal()]);restoreJournal=journal;if(cache){shared=reviewValues(cache.shared||{});revision=cache.revision||0;epoch=cache.epoch||'initial';}
 pending=storedOps;
 if(restoreJournal&&(!syncRecord?.pending||syncRecord.envelope?.reviewRestore?.id!==restoreJournal.id)){restoreJournal=null;await persist([],[],true);}
 function current(){return viewCache||(viewCache=restoreJournal?reviewValues(restoreJournal.values):applyReviewPatch(shared,pending,false));}
 function publish(){viewCache=null;document.dispatchEvent(new Event('finance-review-changed'));}
 function status(){return lastError?.message||(restoreJournal?'Backup reviews restored on device · waiting for records to sync':pending.length?(navigator.onLine?'Review changes waiting to sync':'Review changes saved on device · offline'):!navigator.onLine?'Offline · showing saved shared reviews':received?'Reviews synced across devices':'Checking shared reviews…');}
 let lastOpAt=Math.max(0,...pending.map(p=>p.at||0));
 let localQueue=Promise.resolve();const serial=fn=>{const task=localQueue.then(fn);localQueue=task.catch(()=>{});return task;};
 async function flush(){
  if(disposed||busy||resetting||restoreJournal||!navigator.onLine||window.financeCloud.canEdit===false||window.financeCloud.accessValid?.()===false||lastError?.code==='tracker/review-conflict')return;
  busy=true;
  try{
   await localQueue;pending=await allOps();if(!pending.length)return;
   const sent=pending.slice();inFlight=api.save(sent);const response=await inFlight;if(disposed)return;received=true;
   await serial(async()=>{if(response.revision>=revision){shared=reviewValues(response.values);revision=response.revision;epoch=response.epoch;}const ids=new Set(sent.map(x=>x.id));pending=pending.filter(x=>!ids.has(x.id));lastError=null;await persist([],sent);publish();});
  }catch(error){lastError=error;document.dispatchEvent(new Event('finance-review-changed'));}
  finally{busy=false;clearTimeout(timer);if(!disposed&&pending.length&&navigator.onLine&&!/permission-denied|unauthenticated|tracker\/review-conflict/.test(lastError?.code||''))timer=setTimeout(flush,10000);}
 }
 async function setGroups(groups){
  if(resetting||restoreJournal)throw Error('Finish syncing the backup import or clearing records before changing reviews.');
  if(disposed||window.financeCloud.uid!==identity||window.financeCloud.accessValid?.()===false)throw Error('Account access changed. Reload.');
  if(window.financeCloud.canEdit===false)throw Error('Viewer access can read shared reviews but cannot change them.');
  // Capture only the user's field-level edits. Independent changes from another window are preserved.
  const at=lastOpAt=Math.max(Date.now(),lastOpAt+1),view=current(),patch=Object.entries(groups).flatMap(([group,value])=>reviewPatch(group,view[group]||{},value)).map(p=>({...p,id:crypto.randomUUID(),epoch,at}));
  if(!patch.length)return;
  return serial(async()=>{const old=pending;pending=[...pending,...patch];viewCache=null;try{if(pending.length>500)throw Error('Too many review changes are waiting. Reconnect and sync first.');reviewValues(current());await persist(patch);lastError=null;publish();}catch(error){pending=old;viewCache=null;throw error;}queueMicrotask(flush);});
 }
 const setGroup=(group,value)=>setGroups({[group]:value});
 window.financeReviews={get:group=>JSON.parse(JSON.stringify(current()[group]||{})),setGroup,setGroups,status,problem:()=>Boolean(lastError),pending:()=>pending.length>0||Boolean(restoreJournal),export:()=>reviewValues(current()),
  parseBackup:parseReviewBackup,
  async backup(){await localQueue;pending=await allOps();restoreJournal=await getRestoreJournal();viewCache=null;return reviewBackup(current());},
  async prepareRestore(values){
   if(window.financeCloud.canManage!==true)throw Error('Only the owner can restore shared reviews.');
   if(resetting||restoreJournal)throw Error('Finish the pending restore before importing another review backup.');
   const validated=reviewValues(values);resetting=true;clearTimeout(timer);
   try{await inFlight.catch(()=>{});await localQueue;if(navigator.onLine){try{const result=await api.load();shared=reviewValues(result.values);revision=result.revision;epoch=result.epoch;received=true;await persist();publish();}catch(error){if(!/unavailable|deadline-exceeded|network-request-failed/.test(error.code||'')&&!(error instanceof TypeError&&/fetch|network/i.test(error.message)))throw error;}}return {id:crypto.randomUUID(),values:validated,baseRevision:revision,epoch,discardOps:(await allOps()).map(op=>op.id)};}catch(error){resetting=false;throw error;}
  },
  hasRestore:()=>Boolean(restoreJournal),
  async inspectRestore(){if(!restoreJournal)throw Error('No backup review restore is pending.');return {backup:reviewValues(restoreJournal.values),cloud:(await api.load()).values};},
  async resolveRestore(keepBackup){
   if(window.financeCloud.canManage!==true||!restoreJournal||busy||syncBusy||!navigator.onLine)throw Error('Wait for current saves and connect as the owner before resolving this import.');
   await saveQueue;const latest=await api.load(),beforeBlocked=cloudSaveBlocked;
   const descriptor=keepBackup?{...restoreJournal,id:crypto.randomUUID(),baseRevision:latest.revision,epoch:latest.epoch}:null;
   const ok=await saveData(keepBackup?'Retried backup review restore':'Kept cloud reviews after backup import',null,descriptor||false);
   if(!ok){cloudSaveBlocked=beforeBlocked;throw Error('The resolution could not be saved.');}
   shared=reviewValues(latest.values);revision=latest.revision;epoch=latest.epoch;await persist();publish();cloudSaveBlocked=false;syncCloud();
  },
  cancelRestore(){resetting=false;queueMicrotask(flush);},
  async refreshJournal(){try{restoreJournal=await getRestoreJournal();pending=await allOps();if(restoreJournal)lastError=null;publish();}catch(error){lastError=error;}},
  async retry(){lastError=null;await flush();},
  async reload(discard=false){if(restoreJournal)throw Error('Finish syncing imported records or resolve the financial cloud conflict first.');await localQueue;if(busy)throw Error('Wait for the review save to finish before reloading.');const ops=await allOps();if(ops.length&&!discard)throw Error('Export pending review changes before replacing them.');const result=await api.load();received=true;shared=reviewValues(result.values);revision=result.revision;epoch=result.epoch;pending=[];lastError=null;await persist([],discard?ops:[]);publish();},
  exportPending(){return {shared,pending,epoch,restore:restoreJournal};}};
 const stop=api.subscribe(result=>{if(disposed)return;if(!result.fromCache)received=true;serial(async()=>{if(result.revision>=revision){shared=reviewValues(result.values);revision=result.revision;epoch=result.epoch;await persist();publish();}}).catch(error=>{lastError=error;});},error=>{lastError=error;document.dispatchEvent(new Event('finance-review-changed'));});
 const online=()=>flush();window.addEventListener('online',online);publish();queueMicrotask(flush);
 const saveFinancial=window.financeCloud.save;
 window.financeCloud.save=async function(envelope,options){const result=await saveFinancial.call(this,envelope,options);if(envelope.reviewRestore){const response=await api.load();await serial(async()=>{shared=reviewValues(response.values);revision=response.revision;epoch=response.epoch;received=true;restoreJournal=null;lastError=null;pending=await allOps();await persist([],[],true);publish();});queueMicrotask(flush);}
 if(options?.clearHistory){resetting=true;clearTimeout(timer);try{await inFlight.catch(()=>{});await localQueue;const reset=await api.reset('clear-'+(envelope.mutationId||crypto.randomUUID()));const ops=await allOps();shared=reviewValues(reset.values);pending=[];revision=reset.revision;epoch=reset.epoch;restoreJournal=null;await persist([],ops,true);publish();}finally{resetting=false;}}return result;};
 const oldReset=window.financeBridge.reset;window.financeBridge.reset=function(){disposed=true;clearTimeout(timer);stop?.();window.removeEventListener('online',online);return oldReset.apply(this,arguments);};
 return window.financeReviews;
}
