// Bounded, account-scoped recovery points stored alongside device records.
export function recoveryRows(local,remote){
 const rows=[];
 for(const key of new Set([...Object.keys(local),...Object.keys(remote)])){
  if(['lastUpdate','schemaVersion'].includes(key))continue;
  const a=local[key],b=remote[key];
  if(JSON.stringify(a)===JSON.stringify(b))continue;
  if(Array.isArray(a)&&Array.isArray(b)&&[...a,...b].every(r=>r&&typeof r.id==='string')){
   const left=new Map(a.map(r=>[r.id,r])),right=new Map(b.map(r=>[r.id,r]));
   for(const id of new Set([...left.keys(),...right.keys()]))if(JSON.stringify(left.get(id))!==JSON.stringify(right.get(id)))rows.push({key,id,local:left.get(id),cloud:right.get(id)});
  }else rows.push({key,local:a,cloud:b});
 }
 return rows;
}
export function selectRecovery(local,rows,choices){
 const result=JSON.parse(JSON.stringify(local));
 rows.forEach((r,i)=>{
  if(!['local','cloud'].includes(choices[i]))throw Error('Choose a version for every difference.');
  const value=r[choices[i]];
  if(r.id!==undefined){const list=result[r.key];const at=list.findIndex(x=>x.id===r.id);if(at>=0)list.splice(at,1);if(value!==undefined)list.push(JSON.parse(JSON.stringify(value)));}
  else if(value===undefined)delete result[r.key];else result[r.key]=JSON.parse(JSON.stringify(value));
 });return result;
}
export function installRecordRecovery(){
 const get=key=>new Promise((resolve,reject)=>{const r=financeDB.transaction('records').objectStore('records').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 const put=(key,value)=>new Promise((resolve,reject)=>{const t=financeDB.transaction('records','readwrite');t.objectStore('records').put(value,key);t.oncomplete=resolve;t.onabort=()=>reject(t.error);t.onerror=()=>{};});
 const original=commitFinance;
 commitFinance=async function(snapshot,action='Update',audit=null,lockHeld=false){
  if(!lockHeld)return withFinanceWriteLock(()=>commitFinance(snapshot,action,audit,true));
  if(action==='Clear all data')await put('restorePoints',[]);
  else{
   const current=await readStoredFinance();
   if(current&&JSON.stringify(current.data)!==JSON.stringify(snapshot)){
    const points=await get('restorePoints')||[];
    if(!points.some(p=>p.revision===current.revision))points.unshift({at:new Date().toISOString(),action,revision:current.revision,data:current.data});
    while(points.length>5||JSON.stringify(points).length>5*1024*1024)points.pop();
    await put('restorePoints',points);
   }
  }
  return original(snapshot,action,audit,true);
 };
 const dialog=document.createElement('dialog');dialog.id='recordRecoveryDialog';dialog.style.cssText='width:min(720px,calc(100% - 24px));max-height:85dvh;overflow:auto;border-radius:16px;background:var(--bg-panel,#fff);color:var(--text-main,#17313a);padding:20px';document.body.append(dialog);
 const add=(tag,text,parent=dialog)=>{const e=document.createElement(tag);e.textContent=text;parent.append(e);return e;};
 const button=(text,fn,parent=dialog)=>{const b=add('button',text,parent);b.type='button';b.className='btn-small';b.style.margin='6px';b.onclick=fn;return b;};
 let busy=false;
 function open(title){if(busy||dataOperationBusy)return false;busy=true;dataOperationBusy=true;dialog.replaceChildren();const heading=add('h2',title);heading.id='recordRecoveryHeading';dialog.setAttribute('aria-labelledby',heading.id);button('Close',()=>dialog.close());dialog.showModal();return true;}
 dialog.addEventListener('close',()=>{busy=false;dataOperationBusy=false;});
 const fail=error=>add('p',error.message||String(error));
 async function replace(candidate,action,expectedRevision,cloudVersion){
  if(window.financeCloud.canManage===false)throw Error('Only the owner can replace records.');
  if(window.financeCloud.accessValid?.()===false)throw Error('Account access changed. Reload.');
  await saveQueue;
  if(storageRevision!==expectedRevision||pendingSaves||persistenceDirty)throw Error('Device records changed. Close this review and open it again.');
  const validated=validateBackup(candidate),before=state,oldSync=syncRecord,oldBlocked=cloudSaveBlocked;
  if(!confirm('Apply these reviewed records? Current device records will be kept as a restore point.'))return;
  if(cloudVersion!==undefined)syncRecord={...syncRecord,baseRevision:cloudVersion};
  state=validated;
  const ok=await saveData(action);
  if(!ok){state=before;lastAccepted=JSON.parse(JSON.stringify(before));syncRecord=oldSync;cloudSaveBlocked=oldBlocked;throw Error('Replacement could not be saved. Current records were kept.');}
  if(cloudVersion!==undefined)cloudSaveBlocked=false;
  refreshAllPageViews();dialog.close();syncCloud();
 }
 window.openRestorePoints=async()=>{
  if(!open('Restore saved records'))return;
  try{
   await saveQueue;const points=await get('restorePoints')||[];
   if(!points.length)add('p','No restore points yet. They are kept before records change on this device.');
   for(const point of points){const row=add('section','');add('h3',new Date(point.at).toLocaleString(),row);add('p','Before '+point.action,row);
    button('Preview',()=>{
     const candidate=validateBackup(point.data),diff=financeDiff(state,candidate),revision=storageRevision;
     const preview=add('details','',row);preview.open=true;add('summary',diff.length+' changes',preview);
     add('pre',JSON.stringify(diff,null,2),preview).style.cssText='white-space:pre-wrap;overflow-wrap:anywhere';
     button('Restore this version',()=>replace(candidate,'Restored dated snapshot',revision).catch(fail),preview);
    },row);
   }
  }catch(error){fail(error);}
 };
 const conflictReview=async()=>{
  if(!open('Choose device and cloud records'))return;
  try{
   await saveQueue;const revision=storageRevision,local=JSON.parse(JSON.stringify(state));
   const incoming=await window.financeCloud.inspectVersion();
   const cloud=validateBackup(incoming.envelope?.data||createEmptyState()),rows=recoveryRows(local,cloud),choices=[];
   if(!rows.length){add('p','Device and cloud records match.');return;}
   for(const [i,row]of rows.entries()){
    const item=add('details','');add('summary',row.key+(row.id?' · '+row.id:''),item);
    add('pre',JSON.stringify({device:row.local??'(absent)',cloud:row.cloud??'(absent)'},null,2),item).style.cssText='white-space:pre-wrap;overflow-wrap:anywhere';
    const label=add('label','Version to keep ',item),select=document.createElement('select');select.setAttribute('aria-label','Version for '+row.key+' '+(row.id||''));label.append(select);
    for(const [value,text]of [['','Choose a version'],['local','This device'],['cloud','Cloud']]){const option=add('option',text,select);option.value=value;}
    select.onchange=()=>choices[i]=select.value;
   }
   button('Validate and apply choices',()=>{try{const result=selectRecovery(local,rows,choices);validateBackup(result);replace(result,'Resolved device/cloud differences',revision,incoming.revision).catch(fail);}catch(error){fail(error);}});
  }catch(error){fail(error);}
 };
 const host=document.getElementById('settingsRecordsPanel');if(host){const details=add('details','',host);add('summary','Restore points and cloud conflicts',details);button('Restore points',()=>window.openRestorePoints(),details);button('Resolve cloud conflict',conflictReview,details);}
 window.resolveTrackerConflict=conflictReview;
 const reset=window.financeBridge.reset;window.financeBridge.reset=function(){if(dialog.open)dialog.close();dialog.remove();return reset.apply(this,arguments);};
}
