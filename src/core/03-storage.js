    // Durable storage, record lifecycle and statement reconciliation.
    const ACCOUNT_KINDS=['pf','ppf','nps','investments','debts','gratuityAccounts'];
    let financeDB=null, storageBackend='loading', storageRevision=0, saveQueue=Promise.resolve(), pendingSaves=0, lastAccepted=null, persistenceDirty=false;
    let accountPages={}, auditPage=0;
    let cloudRecovery=null, cloudCommittedState=null, cloudSaveBlocked=false;
    function storageMessage(message,error=false){const status=document.getElementById('cloudSyncStatus');if(status){status.textContent=message;status.hidden=message==='All changes synced';}const e=document.getElementById('storageHealth');if(e){e.textContent=message;e.style.color=error?'var(--danger)':'var(--text-muted)';}}
    function openFinanceDB(){return new Promise((resolve,reject)=>{
      if(!window.indexedDB)return reject(new Error('IndexedDB is unavailable'));
      // Never import an older device's unencrypted records into a fresh vault.
      const r=indexedDB.open('PersonalFinanceTracker:encrypted-v1:'+window.financeCloud.uid,1);
      r.onupgradeneeded=()=>{const db=r.result;db.createObjectStore('records');db.createObjectStore('changes',{keyPath:'sequence',autoIncrement:true});};
      r.onerror=()=>reject(r.error);r.onblocked=()=>reject(new Error('Close other tracker windows and reload to finish opening storage.'));
      r.onsuccess=()=>{r.result.onversionchange=()=>{r.result.close();storageLoadFailed=true;storageMessage('Storage changed in another window. Reload before editing.',true);};resolve(r.result);};
    });}
    function readStoredFinance(){return new Promise((resolve,reject)=>{const r=financeDB.transaction('records').objectStore('records').get('current');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
    function readPendingCloudSync(){return new Promise((resolve,reject)=>{const r=financeDB.transaction('records').objectStore('records').get('cloudSync');r.onsuccess=()=>resolve(Boolean(r.result?.pending));r.onerror=()=>reject(r.error);});}
    function financeDiff(previous,next){
      const changes=[];
      for(const key of new Set([...Object.keys(previous||{}),...Object.keys(next)])){
        if(['lastUpdate','schemaVersion','auditLog'].includes(key))continue;
        const before=previous?.[key],after=next[key];
        if(Array.isArray(before)&&Array.isArray(after)&&[...before,...after].every(r=>r&&typeof r==='object'&&r.id)){
          const old=new Map(before.map(r=>[r.id,JSON.stringify(r)]));
          for(const row of after){const current=JSON.stringify(row),was=old.get(row.id);if(current!==was)changes.push({collection:key,id:row.id,action:was?'Updated':'Added',before:was?JSON.parse(was):null,after:row});old.delete(row.id);}
          for(const [id,row] of old)changes.push({collection:key,id,action:'Deleted',before:JSON.parse(row),after:null});
        }else if(JSON.stringify(before)!==JSON.stringify(after))changes.push({collection:key,action:'Updated',before:before??null,after:after??null});
      }return changes;
    }
    function withFinanceWriteLock(operation){return navigator.locks?navigator.locks.request('pft-write:'+window.financeCloud.uid,operation):operation();}
    function commitFinance(snapshot,action='Update',importedAudit=null,lockHeld=false){if(!lockHeld)return withFinanceWriteLock(()=>commitFinance(snapshot,action,importedAudit,true));return new Promise((resolve,reject)=>{
      const tx=financeDB.transaction(['records','changes'],'readwrite');let failure;
      const records=tx.objectStore('records'),log=tx.objectStore('changes'),read=records.get('current');
      read.onsuccess=()=>{
        try {
        const existing=read.result;
        if((existing?.revision||0)!==storageRevision){failure=new Error('Records changed in another tracker window. Export this session, then reload before editing.');tx.abort();return;}
        const changes=existing?financeDiff(existing.data,snapshot):[];
        if(action==='Imported backup'&&existing)records.put({at:new Date().toISOString(),data:existing.data},'recovery');
        if(action==='Clear all data')records.delete('recovery');
        const revision=storageRevision+1;
        records.put({revision,data:snapshot},'current');
        const reviewRestore=syncRecord?.pending?syncRecord.envelope?.reviewRestore:null;
        if(reviewRestore){records.put(reviewRestore,'backupReviewRestore:v1');if(action==='Imported backup')for(const id of reviewRestore.discardOps||[])records.delete('reviewOp:v1:'+id);}
        else records.delete('backupReviewRestore:v1');
        if(syncRecord){const queued=records.get('cloudSync');queued.onsuccess=()=>{if(syncRecord.pending&&queued.result)syncRecord.baseRevision=Math.max(syncRecord.baseRevision,queued.result.baseRevision);records.put(syncRecord,'cloudSync');};}
        if(action==='Clear all data'){log.clear();changes.length=0;}
        if(importedAudit?.length)log.add({at:new Date().toISOString(),action:'Imported backup history',changes:[],importedHistory:importedAudit});
        if(changes.length||!existing||action!=='Update')log.add({at:new Date().toISOString(),action,changes,actor:{email:window.financeCloud?.email||'',role:window.financeCloud?.role||''}});
        tx.oncomplete=()=>{storageRevision=revision;resolve(true);};
        } catch(error){failure=error;try{tx.abort();}catch(ignored){}reject(error);}
      };
      tx.onabort=()=>reject(failure||tx.error||new Error('Save transaction aborted'));tx.onerror=()=>{};
    });}
    let syncRecord=null,syncBusy=false,syncTimer=null,startupRevisionTimer=null;
    function readSync(){return new Promise((resolve,reject)=>{const r=financeDB.transaction('records').objectStore('records').get('cloudSync');r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error);});}
    function syncStatus(){renderCloudUpdated();if(window.financeStartupChecking){storageMessage('Saved on device · Checking cloud revision');return;}storageMessage(syncRecord?.pending?(navigator.onLine?'Saved on device · Waiting to sync':'Saved on device · Offline'):(navigator.onLine?'All changes synced':'Offline · Showing saved records'));}
    function renderCloudUpdated(){
      let value=window.financeCloud?.updatedAt?.()||syncRecord?.lastCloudUpdated||null;
      if(value&&!Number.isNaN(Date.parse(value))){try{trackerStorage.setItem('lastCloudUpdated',value);}catch(_){} }
      else {try{value=trackerStorage.getItem('lastCloudUpdated');}catch(_){} }
      const profile=document.querySelector('.cloud-account-panel');if(profile)profile.dataset.syncState=value&&!Number.isNaN(Date.parse(value))&&!syncRecord?.pending&&!cloudSaveBlocked&&!window.financeStartupChecking&&navigator.onLine?'synced':'pending';
    }
    async function syncCloud(){
      if(window.financeStartupChecking||window.financeCloud?.deleting||window.financeCloud?.canEdit===false||window.financeCloud?.accessValid?.()===false||syncBusy||!syncRecord?.pending||!navigator.onLine||cloudSaveBlocked)return;
      syncBusy=true;
      try{
        await saveQueue;
        const sent=JSON.parse(JSON.stringify(syncRecord));
        window.financeCloud.resume(sent.baseRevision);
        storageMessage('Saved on device · Syncing…');
        const revision=await window.financeCloud.save(sent.envelope,{clearHistory:sent.clearHistory});
        await new Promise((resolve,reject)=>{const tx=financeDB.transaction('records','readwrite'),store=tx.objectStore('records'),r=store.get('cloudSync');r.onsuccess=()=>{const latest=r.result;if(!latest)return;latest.baseRevision=revision;latest.lastCloudUpdated=window.financeCloud?.updatedAt?.()||new Date().toISOString();if(latest.token===sent.token){latest.pending=false;latest.clearHistory=false;if(latest.envelope)delete latest.envelope.reviewRestore;}store.put(latest,'cloudSync');syncRecord=latest;};tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});
        syncStatus();
      }catch(error){
        if(error.code==='tracker/conflict'){cloudSaveBlocked=true;storageMessage('Saved on device · Another device has newer changes. Export this device’s backup before refreshing cloud records.',true);}
        else storageMessage('Saved on device · Sync will retry when connected');
      }finally{syncBusy=false;clearTimeout(syncTimer);if(syncRecord?.pending&&!cloudSaveBlocked)syncTimer=setTimeout(syncCloud,15000);}
    }
    function readStartupSnapshot(){return new Promise((resolve,reject)=>{
      const tx=financeDB.transaction('records','readonly'),store=tx.objectStore('records'),values=[];
      for(const [index,key]of ['current','cloudSync','forceRemoteRead'].entries()){const request=store.get(key);request.onsuccess=()=>{values[index]=request.result||null;};}
      tx.oncomplete=()=>resolve(values);tx.onabort=()=>reject(tx.error||new Error('Device snapshot could not be read'));
    });}
    async function loadData(){
      await window.financeCloudReady;
      try{
        financeDB=await openFinanceDB();storageBackend='IndexedDB';
        const [cached,savedSync,forceRemote]=await readStartupSnapshot();storageRevision=cached?.revision||0;syncRecord=savedSync;
        let envelope,openingCached=false,freshCloud=false;
        window.PFTPerformance?.mark('device-read');
        if(window.financeCloud?.canEdit!==false&&cached&&syncRecord&&(syncRecord.pending||!navigator.onLine))envelope=syncRecord.pending?syncRecord.envelope:{data:cached.data,recovery:syncRecord.envelope?.recovery||null};
        else if(!forceRemote&&window.financeCloud?.role==='owner'&&cached&&syncRecord&&window.financeCloud.checkRevision){
          try{validateBackup(cached.data);envelope={data:cached.data,recovery:syncRecord.envelope?.recovery||null};openingCached=true;window.financeCloud.resume(syncRecord.baseRevision||0);window.financeStartupChecking=true;}catch(_){envelope=await window.financeCloud.load();freshCloud=true;syncRecord={baseRevision:window.financeCloud.revision(),pending:false,envelope,lastCloudUpdated:window.financeCloud?.updatedAt?.()||null};}
        }
        else try{envelope=await window.financeCloud.load();freshCloud=true;syncRecord={baseRevision:window.financeCloud.revision(),pending:false,envelope,lastCloudUpdated:window.financeCloud?.updatedAt?.()||null};}
        catch(error){if(window.financeCloud?.role!=='owner'||!cached||!syncRecord)throw error;envelope={data:cached.data,recovery:syncRecord.envelope?.recovery||null};}
        cloudRecovery=envelope?.recovery||null;state=validateBackup(envelope?.data||createEmptyState());
        cloudCommittedState=JSON.parse(JSON.stringify(state));
        if(window.financeCloud?.canEdit!==false){syncStallionPmsFromInvestments();}
        if(!openingCached||JSON.stringify(state)!==JSON.stringify(cached.data))await commitFinance(state,'Opened cloud account');
        if(forceRemote&&freshCloud)await new Promise((resolve,reject)=>{const tx=financeDB.transaction('records','readwrite');tx.objectStore('records').delete('forceRemoteRead');tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});
        window.PFTPerformance?.mark(openingCached?'cached-records-ready':'cloud-records-ready');
        lastAccepted=JSON.parse(JSON.stringify(state));initTheme();syncStatus();setTimeout(syncCloud,0);
      }catch(error){storageLoadFailed=true;storageMessage('Records could not be loaded. '+error.message,true);window.financeCloud.lock(error);}
    }
    async function verifyStartupRevision(){
      if(!window.financeStartupChecking||!navigator.onLine||!financeDB)return;
      clearTimeout(startupRevisionTimer);
      try{const expected=syncRecord?.baseRevision||0,revision=await window.financeCloud.checkRevision();if(!financeDB)return;window.financeStartupChecking=false;
        if(revision!==expected){cloudSaveBlocked=true;storageMessage('Saved records · New cloud records need review',true);}
        else{window.PFTPerformance?.mark('cloud-verified');syncStatus();void syncCloud();}
      }catch(_){if(financeDB)startupRevisionTimer=setTimeout(verifyStartupRevision,15000);}
    }
    function saveData(action='Update',importedAudit=null,reviewRestore=null){
      if(typeof action!=='string')action='Update';
      if(window.financeCloud?.deleting||window.financeCloud?.canEdit===false||window.financeCloud?.accessValid?.()===false){if(lastAccepted)state=JSON.parse(JSON.stringify(lastAccepted));scheduleAllViewsRefresh();return Promise.resolve(false);}
      if(window.financeCloud?.canManage===false&&['Imported backup','Clear all data','Restored recovery snapshot'].includes(action)){if(lastAccepted)state=JSON.parse(JSON.stringify(lastAccepted));return Promise.resolve(false);}
      if(action==='Clear all data'&&!navigator.onLine)return Promise.resolve(false);
      if(storageLoadFailed)return Promise.resolve(false);
      let snapshot;
      try{recalculateHouseExpenses();snapshot=validateBackup(state);snapshot.lastUpdate=new Date().toLocaleString();}
      catch(error){if(lastAccepted)state=JSON.parse(JSON.stringify(lastAccepted));showImportStatus('Change rejected: '+error.message,true);scheduleAllViewsRefresh();return Promise.resolve(false);}
      state=snapshot;lastAccepted=JSON.parse(JSON.stringify(snapshot));snapshot=lastAccepted;pendingSaves++;persistenceDirty=true;scheduleAllViewsRefresh();
      const operation=saveQueue.then(async()=>{
        try{
          const previous=syncRecord;
          const recovery=action==='Imported backup'?{at:new Date().toISOString(),data:cloudCommittedState}:action==='Clear all data'?null:cloudRecovery;
          syncRecord={baseRevision:previous?.baseRevision||0,pending:true,token:crypto.randomUUID(),lastCloudUpdated:previous?.lastCloudUpdated||window.financeCloud?.updatedAt?.()||null,clearHistory:action==='Clear all data'||previous?.clearHistory===true,envelope:{data:snapshot,recovery}};const inheritedRestore=reviewRestore===false?null:reviewRestore||(!['Imported backup','Clear all data','Resolved device/cloud differences','Restored dated snapshot','Restored recovery snapshot'].includes(action)?(previous?.pending?previous.envelope?.reviewRestore:null):null);if(inheritedRestore)syncRecord.envelope.reviewRestore=inheritedRestore;syncRecord.envelope.mutationId=syncRecord.token;
          try{await commitFinance(snapshot,action,importedAudit);if(syncRecord?.envelope?.reviewRestore||window.financeReviews?.hasRestore?.())await window.financeReviews?.refreshJournal?.();}catch(error){syncRecord=previous;throw error;}
          cloudRecovery=recovery;cloudCommittedState=JSON.parse(JSON.stringify(snapshot));
          document.getElementById('lastUpdate').textContent=snapshot.lastUpdate;persistenceDirty=pendingSaves>1;syncStatus();setTimeout(syncCloud,0);if(typeof CustomEvent==='function')window.dispatchEvent?.(new CustomEvent('pft:record-saved',{detail:{action}}));return true;
        }catch(error){persistenceDirty=true;showImportStatus('Device save failed. Export a backup before closing. '+error.message,true);storageMessage('Not saved · Export a backup',true);return false;}
        finally{pendingSaves--;}
      });saveQueue=operation;return operation;
    }
    window.addEventListener('online',()=>{void verifyStartupRevision();syncCloud();});
    window.addEventListener('offline',syncStatus);
    window.financeBridge={
      pendingSync:async()=>{await saveQueue;return Boolean(syncRecord?.pending)||(financeDB?await readPendingCloudSync():false);},
      settle:()=>saveQueue,dirty:()=>persistenceDirty||pendingSaves>0,
      reset(){clearTimeout(syncTimer);clearTimeout(startupRevisionTimer);window.financeStartupChecking=false;state=createEmptyState();lastAccepted=null;if(financeDB){financeDB.close();financeDB=null;}},
      exportUnsaved(){const blob=new Blob([JSON.stringify(makeDeviceRecoveryBackup(),null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='finance-unsaved-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},
      async refreshRemote(){await saveQueue;if(!navigator.onLine){alert('Connect to the internet to refresh cloud records.');return;}if(syncRecord?.pending){if(!confirm('This device has changes waiting to sync. Export a backup first. Replace this device’s pending changes with the latest cloud records?'))return;await window.financeCloud.load();await new Promise((resolve,reject)=>{const tx=financeDB.transaction('records','readwrite');tx.objectStore('records').delete('cloudSync');tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});}await new Promise((resolve,reject)=>{const tx=financeDB.transaction('records','readwrite');tx.objectStore('records').put(true,'forceRemoteRead');tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});location.reload();},
      async retry(){await saveQueue;await syncCloud();}
    };

    async function readChangeLog(limit=20,offset=0){
      await saveQueue;if(!financeDB)return [];
      return new Promise((resolve,reject)=>{const rows=[];let skipped=0;const request=financeDB.transaction('changes').objectStore('changes').openCursor(null,'prev');request.onerror=()=>reject(request.error);request.onsuccess=()=>{const cursor=request.result;if(!cursor||rows.length>=limit)return resolve(rows);if(skipped++>=offset)rows.push(cursor.value);cursor.continue();};});
    }
    function allAccounts(kind){return [...(state[kind]||[]),...(state.archivedAccounts||[]).filter(a=>a.kind===kind).map(a=>a.record)];}
    function validateBackup(input){
      if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Backup must be an object');
      const copy=JSON.parse(JSON.stringify(input)),archives=copy.archivedAccounts||[];
      if(!Array.isArray(archives))throw new Error('archivedAccounts must be an array');
      const seen=new Set();
      for(const item of archives){
        if(!item||!ACCOUNT_KINDS.includes(item.kind)||!item.record||!validCalendarDate(item.archivedDate))throw new Error('Invalid archived account');
        const id=item.kind+':'+item.record.id;if(seen.has(id))throw new Error('Duplicate archived account');seen.add(id);
        if(!Array.isArray(copy[item.kind]))copy[item.kind]=[];if(item.archivedDate<item.record.date)throw new Error('Archive date precedes account opening');copy[item.kind].push(item.record);
      }
      const data=validateBackupCore(copy);
      data.archivedAccounts=archives.map(item=>({...item,record:data[item.kind].find(r=>r.id===item.record.id)}));
      for(const item of archives)data[item.kind]=data[item.kind].filter(r=>r.id!==item.record.id);
      data.reconciliations=data.reconciliations||[];
      if(!Array.isArray(data.reconciliations))throw new Error('reconciliations must be an array');
      const ids=new Set();
      for(const row of data.reconciliations){if(!row||typeof row.id!=='string'||ids.has(row.id)||!validCalendarDate(row.date)||!ACCOUNT_KINDS.includes(row.kind)||typeof row.accountId!=='string'||!['statementBalance','trackerBalance','difference'].every(k=>typeof row[k]==='number'&&Number.isFinite(row[k]))||row.statementBalance<0||row.trackerBalance<0||Math.abs(row.difference-(row.statementBalance-row.trackerBalance))>0.01||typeof row.notes!=='string'||row.notes.length>240)throw new Error('Invalid reconciliation record');ids.add(row.id);}
      if(data.auditLog!==undefined){if(!Array.isArray(data.auditLog)||data.auditLog.some(r=>!r||typeof r.action!=='string'||!Array.isArray(r.changes)||!Number.isFinite(Date.parse(r.at))))throw new Error('Invalid change log');delete data.auditLog;}
      delete data.backupMetadata;delete data.reviewMetadata;delete data.backupFormat;delete data.backupVersion;delete data.backupKind;
      return data;
    }
    async function archiveAccount(kind,id){
      if(!ACCOUNT_KINDS.includes(kind))return;
      const record=state[kind].find(r=>r.id===id);if(!record)return;
      if(kind==='debts'&&record.remaining>0){alert('Only a fully repaid debt can be archived.');return;}
      if(!confirm('Archive this account? It will leave current totals and projections. Its recorded history will remain available.'))return;
      state.archivedAccounts=state.archivedAccounts||[];
      state.archivedAccounts.push({kind,record:JSON.parse(JSON.stringify(record)),archivedDate:localDateKey()});state[kind]=state[kind].filter(r=>r.id!==id);
      await saveData('Archived '+kind+' account');refreshAllPageViews();renderRecordTools();
    }
    async function restoreArchivedAccount(index){
      const row=state.archivedAccounts?.[index];if(!row)return;
      if(state[row.kind].some(r=>r.id===row.record.id)){alert('An active account already has this ID.');return;}
      if(['pf','ppf','nps'].includes(row.kind))row.record.contributionsThrough=currentMonthKey();
      state[row.kind].push(row.record);state.archivedAccounts.splice(index,1);
      await saveData('Restored '+row.kind+' account');refreshAllPageViews();renderRecordTools();
    }
    function renderRecordTools(){
      const select=document.getElementById('recordAccount');if(!select)return;
      const old=select.value;select.innerHTML=ACCOUNT_KINDS.flatMap(kind=>(state[kind]||[]).map(r=>`<option value="${kind}:${r.id}">${analyticEscape(kind.toUpperCase()+' · '+(r.member||'')+' '+(r.account||r.name||r.type||r.scheme||r.id))}</option>`)).join('');if([...select.options].some(o=>o.value===old))select.value=old;
      const archives=state.archivedAccounts||[];
      document.getElementById('archiveList').innerHTML=archives.length?archives.map((a,i)=>`<p>${analyticEscape(a.kind.toUpperCase()+' · '+(a.record.member||'')+' '+(a.record.account||a.record.name||a.record.type||''))} · ${a.archivedDate} <button class="btn-small" onclick="viewArchivedAccount(${i})">View history</button> <button class="btn-small" onclick="restoreArchivedAccount(${i})">Restore</button></p>`).join(''):'No archived accounts.';
      renderReconciliations();populateStatementPayments();
    }
    function recordReconciliation(){
      const [kind,id]=document.getElementById('recordAccount').value.split(':'),record=state[kind]?.find(r=>r.id===id);if(!record){alert('Select an account.');return;}
      if(kind==='gratuityAccounts'){alert('Gratuity is an estimate, not a statement balance.');return;}
      const input=document.getElementById('statementBalance'),statement=Number(input.value),notes=document.getElementById('statementNotes').value.trim();
      if(!input.value.trim()||!Number.isFinite(statement)||statement<0||notes.length>240){alert('Enter a valid statement balance and a note of up to 240 characters.');return;}
      const tracker=kind==='debts'?record.remaining:record.current;
      state.reconciliations=state.reconciliations||[];state.reconciliations.push({id:generateId(),kind,accountId:id,date:localDateKey(),statementBalance:statement,trackerBalance:tracker,difference:Math.round((statement-tracker)*100)/100,notes});
      saveData('Recorded statement comparison');renderReconciliations();
    }
    function renderReconciliations(){const el=document.getElementById('reconciliationList');if(!el)return;const rows=(state.reconciliations||[]).slice().reverse();const page=accountPages.reconciliation||0,start=page*8;el.innerHTML=rows.slice(start,start+8).map(r=>`<p>${analyticEscape(r.date+' · '+r.kind.toUpperCase()+' · '+(allAccounts(r.kind).find(a=>a.id===r.accountId)?.member||r.accountId))}: tracker ${formatCurrency(r.trackerBalance)} · statement ${formatCurrency(r.statementBalance)} · <strong>${Math.abs(r.difference)<0.01?'Matched':'Difference '+formatCurrency(r.difference)}</strong>${r.notes?' · '+analyticEscape(r.notes):''}</p>`).join('')||'No statement checks yet.';if(rows.length>8)el.innerHTML+=`<button class="btn-small" onclick="accountPages.reconciliation=Math.max(0,${page}-1);renderReconciliations()" ${page===0?'disabled':''}>Previous</button> ${page+1} / ${Math.ceil(rows.length/8)} <button class="btn-small" onclick="accountPages.reconciliation=${page}+1;renderReconciliations()" ${start+8>=rows.length?'disabled':''}>Next</button>`;}
    async function renderChangeLog(){const el=document.getElementById('changeLogList');try{const rows=await readChangeLog(9,auditPage*8);el.innerHTML=rows.slice(0,8).map(r=>`<details><summary>${analyticEscape(r.at.replace('T',' ').slice(0,19)+' · '+r.action)} · ${r.changes.length} change(s)</summary><pre style="white-space:pre-wrap;overflow-wrap:anywhere;max-height:260px;overflow:auto">${analyticEscape(JSON.stringify(r.changes.length?r.changes.slice(0,50):r.importedHistory?{importedEntries:r.importedHistory.length,note:'Full imported history is included in JSON export.'}:[],null,2))}</pre></details>`).join('')||'No change log available.';el.innerHTML+=`<p><button class="btn-small" onclick="auditPage=Math.max(0,auditPage-1);renderChangeLog()" ${auditPage===0?'disabled':''}>Previous</button> Page ${auditPage+1} <button class="btn-small" onclick="auditPage++;renderChangeLog()" ${rows.length<=8?'disabled':''}>Next</button></p>`;}catch(error){el.textContent=error.message;}}
    function pageAccountRows(kind,rows){
      const keys={pf:['member','account','employee','employer','invested','current','epsCurrent','gain','rate'],ppf:['member','account','monthly','invested','current','gain','rate'],nps:['member','account','scheme','monthly','invested','current','gain','absolute','cagr','xirr'],debts:['type','principal','rate','emi','remaining','remainingEmis','status']};
      const choice=tableSortChoices[kind==='debts'?'debtsBody':kind+'Body'],field=keys[kind]?.[choice?.column];
      const value=r=>field==='gain'?r.current-r.invested:field==='absolute'?npsAbsoluteReturn(r):field==='cagr'?npsCagr(r,localDateKey()):field==='xirr'?npsXirr(r,localDateKey()):field==='remainingEmis'?remainingEmiEstimate(r).count:field==='status'?(r.remaining<=0?'Paid off':'Active'):r[field];
      if(field)rows=rows.slice().sort((a,b)=>{const x=value(a),y=value(b);if(x==null||y==null)return x==null?(y==null?0:1):-1;const cmp=typeof x==='number'&&typeof y==='number'?x-y:String(x).localeCompare(String(y),'en',{numeric:true,sensitivity:'base'});return choice.direction==='desc'?-cmp:cmp;});
const total=Math.max(1,Math.ceil(rows.length/8));const page=Math.max(0,Math.min(accountPages[kind]||0,total-1));accountPages[kind]=page;return rows.slice(page*8,page*8+8);}
    function renderAccountPager(kind,bodyId,render){const body=document.getElementById(bodyId),table=body?.closest('table');if(!table)return;let pager=document.getElementById('accountPager-'+kind);if(!pager){pager=document.createElement('div');pager.id='accountPager-'+kind;pager.style='display:flex;gap:10px;align-items:center;padding:10px;flex-wrap:wrap';table.parentElement.after(pager);}const count=profileRows(state[kind]||[]).length,page=accountPages[kind]||0;pager.innerHTML=count>8?`<button class="btn-small" data-direction="-1" ${page===0?'disabled':''}>Previous</button><span>${page*8+1}–${Math.min(count,page*8+8)} of ${count}</span><button class="btn-small" data-direction="1" ${(page+1)*8>=count?'disabled':''}>Next</button>`:'';pager.onclick=e=>{const button=e.target.closest('[data-direction]');if(button){accountPages[kind]+=Number(button.dataset.direction);render();}};}
    function datedInterestEntries(){return ['pf','ppf'].flatMap(kind=>allAccounts(kind).flatMap(a=>(a.interestCredits||[]).map(c=>({id:a.id+'-'+c.financialYearStartYear,date:c.creditedDate,member:a.member,accountName:a.account||a.scheme||kind.toUpperCase(),investmentType:kind,amount:c.amount,financialYear:financialYearLabel(c.financialYearStartYear)}))));}
    window.addEventListener('beforeunload',event=>{if(pendingSaves||persistenceDirty){event.preventDefault();event.returnValue='Changes are still being saved.';}});

    function archivedExpenseGuard(id){const expense=state.expenses.find(r=>r.id===id);if(expense?.loanId&&(state.archivedAccounts||[]).some(a=>a.kind==='debts'&&a.record.id===expense.loanId)){alert('Restore the archived debt in Settings before editing or deleting its EMI payments.');return true;}return false;}
    function viewArchivedAccount(index,page=0){
      const a=state.archivedAccounts[index],el=document.getElementById('archivedRecordDetails');if(!a||!el)return;
      const records=[...(state.retirementContributions||[]).filter(r=>r.investmentType===a.kind&&r.accountId===a.record.id),...(state.investmentContributions||[]).filter(r=>a.kind==='investments'&&r.investmentId===a.record.id),...(state.stallionContributions||[]).filter(r=>a.kind==='investments'&&r.stallionId===a.record.id),...(state.stallionProfitHistory||[]).filter(r=>a.kind==='investments'&&r.stallionId===a.record.id),...(state.expenses||[]).filter(r=>a.kind==='debts'&&r.loanId===a.record.id),...(a.record.interestCredits||[]).map(r=>({...r,date:r.creditedDate}))].sort((x,y)=>String(y.date).localeCompare(String(x.date)));
      el.innerHTML=`<details open><summary>${analyticEscape(a.kind.toUpperCase()+' · '+(a.record.member||a.record.type||''))} · archived record</summary><pre style="white-space:pre-wrap">${analyticEscape(JSON.stringify(a.record,null,2))}</pre><h3>Recorded history · ${records.length}</h3>${records.slice(page*8,page*8+8).map(r=>`<p>${analyticEscape(r.date)} · ${formatCurrency(r.amount??r.profit??0)}${r.profit!==undefined?' gain / loss snapshot':''}</p>`).join('')||'No dated entries.'}<p><button class="btn-small" onclick="viewArchivedAccount(${index},${page-1})" ${page===0?'disabled':''}>Previous</button> ${page+1} / ${Math.max(1,Math.ceil(records.length/8))} <button class="btn-small" onclick="viewArchivedAccount(${index},${page+1})" ${(page+1)*8>=records.length?'disabled':''}>Next</button></p></details>`;
    }
    function populateStatementPayments(){
      const select=document.getElementById('statementPayment');if(!select)return;const [kind,id]=document.getElementById('recordAccount').value.split(':');const old=select.value;
      const rows=kind==='debts'?state.expenses.filter(r=>r.loanId===id&&r.category==='EMI Payment'&&r.repaymentType!=='part-payment').sort((a,b)=>b.date.localeCompare(a.date)):[];
      select.innerHTML='<option value="">Choose a recorded EMI</option>'+rows.map(r=>`<option value="${r.id}">${r.date} · ${formatCurrency(r.amount)}</option>`).join('');if(rows.some(r=>r.id===old))select.value=old;
      document.getElementById('statementSplitPanel').hidden=kind!=='debts';
    }
    async function correctStatementPayment(){
      const id=document.getElementById('statementPayment').value,row=state.expenses.find(r=>r.id===id),loan=state.debts.find(d=>d.id===row?.loanId);if(!row||!loan){alert('Choose an EMI for an active debt. Restore archived debt before correcting payments.');return;}
      const text=document.getElementById('statementPrincipal').value,principal=Number(text),interest=Math.round((row.amount-principal)*100)/100;
      if(!text.trim()||!Number.isFinite(principal)||principal<0||interest<0){alert('Principal must be between zero and the EMI amount.');return;}
      const loanSnapshot=JSON.stringify(loan),rows=(state.expenses||[]).filter(r=>r.category==='EMI Payment'&&r.loanId===loan.id).map(r=>[r,JSON.stringify(r)]);
      row.principalPaid=principal;row.interestPaid=interest;row.interestOverride=true;
      const error=rebuildDebtRepaymentHistory(loan.id);
      if(error){Object.assign(loan,JSON.parse(loanSnapshot));for(const [entry,snapshot] of rows)Object.assign(entry,JSON.parse(snapshot));alert(error);return;}
      if(await saveData('Corrected EMI split from statement')){refreshAllPageViews();showImportStatus('EMI split updated. Total expense is unchanged; outstanding principal has been corrected.');}
    }

    function paginateHistoryTable(bodyId,reset=false){
      const body=document.getElementById(bodyId),table=body?.closest('table');if(!table)return;
      const rows=Array.from(body.rows).filter(r=>r.cells.length>1&&r.cells[0].colSpan===1),key='history-'+bodyId,total=Math.max(1,Math.ceil(rows.length/8));
      if(reset)accountPages[key]=0;const page=Math.min(Math.max(0,accountPages[key]||0),total-1);accountPages[key]=page;
      rows.forEach((row,i)=>{row.hidden=i<page*8||i>=page*8+8;});
      let pager=document.getElementById(key);if(!pager){pager=document.createElement('div');pager.id=key;pager.style='display:flex;gap:10px;align-items:center;padding:10px';table.parentElement.after(pager);}
      const html=rows.length>8?`<button class="btn-small" data-delta="-1" ${page===0?'disabled':''}>Previous</button><span>${page*8+1}–${Math.min(rows.length,page*8+8)} of ${rows.length}</span><button class="btn-small" data-delta="1" ${page+1===total?'disabled':''}>Next</button>`:'';
      if(pager._renderedHTML!==html){pager.innerHTML=html;pager._renderedHTML=html;}pager.onclick=e=>{const b=e.target.closest('[data-delta]');if(b){accountPages[key]+=Number(b.dataset.delta);paginateHistoryTable(bodyId);}};
    }

    // Backup care and mobile record editing.
    let recoveryAvailable=false, recoveryBusy=false, dataOperationBusy=false;
    function readRecovery(){
      return Promise.resolve(cloudRecovery);
    }
    function readLocalRecovery(){
      if(!financeDB){try{return Promise.resolve(JSON.parse(trackerStorage.getItem('personalFinanceRecovery')||'null'));}catch(error){return Promise.reject(error);}}
      return new Promise((resolve,reject)=>{const request=financeDB.transaction('records').objectStore('records').get('recovery');request.onsuccess=()=>resolve(request.result||null);request.onerror=()=>reject(request.error);});
    }
    async function renderRecovery(){
      const label=document.getElementById('recoveryStatus'),button=document.getElementById('restoreRecoveryBtn');if(!label)return;
      try{const snapshot=await readRecovery();recoveryAvailable=!!snapshot;label.textContent=snapshot?'Snapshot from '+new Date(snapshot.at).toLocaleString()+' · restores records from before the most recent import.':'A recovery snapshot will be kept automatically before your next successful import.';button.disabled=!snapshot||recoveryBusy;}
      catch(error){label.textContent='Recovery storage could not be read: '+error.message;button.disabled=true;}
    }
    async function restoreRecovery(){
      if(recoveryBusy||dataOperationBusy)return;
      if(!confirm('Restore the pre-import snapshot? This replaces current records. Export current records first if you want to keep them.'))return;
      recoveryBusy=true;dataOperationBusy=true;document.querySelector('.container').inert=true;const original=JSON.parse(JSON.stringify(state));
      try{await saveQueue;const snapshot=await readRecovery();if(!snapshot)throw new Error('No recovery snapshot is available');state=validateBackup(snapshot.data);storageLoadFailed=false;const saved=await saveData('Restored recovery snapshot');if(!saved){state=original;lastAccepted=JSON.parse(JSON.stringify(original));throw new Error('Restore could not be saved; current records were kept');}refreshImportedData();showImportStatus('Pre-import records restored and saved.');openDashboardAfterImport();}
      catch(error){showImportStatus(error.message,true);}
      finally{recoveryBusy=false;dataOperationBusy=false;document.querySelector('.container').inert=false;await renderRecovery();}
    }
    function readBackupCare(){try{return JSON.parse(trackerStorage.getItem('personalFinanceBackupCare')||'{}')||{};}catch(error){return {};}}
    function renderBackupCare(){
      const data=readBackupCare(),select=document.getElementById('backupReminderDays'),label=document.getElementById('backupCareStatus');if(!select||!label)return;
      const days=[0,7,30].includes(data.days)?data.days:7;select.value=String(days);
      const time=Date.parse(data.exportAt),valid=Number.isFinite(time),due=days>0&&(!valid||Date.now()-time>=days*86400000);
      label.textContent=(valid?'Last export requested: '+new Date(time).toLocaleString()+'.':'No backup export recorded in this browser.')+(due?' Backup reminder: export your latest records.':'');
      label.style.color=due?'var(--warning)':'var(--text-muted)';
    }
    function setBackupReminder(){const data=readBackupCare();data.days=Number(document.getElementById('backupReminderDays').value);try{trackerStorage.setItem('personalFinanceBackupCare',JSON.stringify(data));renderBackupCare();}catch(error){showImportStatus('Reminder preference could not be saved.',true);}}
    function recordBackupExport(){const data=readBackupCare();data.exportAt=new Date().toISOString();try{trackerStorage.setItem('personalFinanceBackupCare',JSON.stringify(data));renderBackupCare();}catch(error){showImportStatus('Backup download requested, but the export date could not be saved.',true);}}
    function runDataHealth(){
      const findings=[];let valid=true;
      try{validateBackup(state);}catch(error){valid=false;findings.push({level:'Error',text:error.message});}
      for(const kind of ['income','expenses']){
        const groups=new Map();for(const row of state[kind]||[]){const key=JSON.stringify([row.date,row.amount,row.member||'',row.source||row.category||'',row.subcategory||'',row.loanId||'']);const group=groups.get(key)||[];group.push(row.id);groups.set(key,group);}
        for(const ids of groups.values())if(ids.length>1)findings.push({level:'Review',text:`${kind}: ${ids.length} matching date/amount/category entries (${ids.slice(0,5).join(', ')}${ids.length>5?', …':''}). These may be legitimate separate receipts or payments.`});
      }
      for(const kind of ['pf','ppf'])for(const account of state[kind]||[])if(account.current<account.invested)findings.push({level:'Review',text:`${kind.toUpperCase()} · ${account.member||''} · ${account.account||account.id}: current balance is below invested amount. Check any withdrawals or balance corrections.`});
      for(const kind of ['pf','ppf','nps'])for(const a of state[kind]||[]){const monthly=retirementMonthlyAmount(a,kind);if(monthly>0&&a.contributionsThrough&&a.contributionsThrough<currentMonthKey())findings.push({level:'Review',text:`${kind.toUpperCase()} · ${a.account||a.id}: automatic contributions have not yet caught up to the current month.`});}
      for(const row of state.reconciliations||[]){if(!allAccounts(row.kind).some(a=>a.id===row.accountId))findings.push({level:'Information',text:`Statement check ${row.id} refers to a deleted account; the historical comparison is retained.`});}
      const target=document.getElementById('dataHealthResults');target.innerHTML=`<p><strong>${valid?'Structural validation passed.':'Structural validation needs attention.'}</strong> ${findings.length} finding(s). No data was changed.</p>`+findings.slice(0,100).map(f=>`<p><strong>${analyticEscape(f.level)}</strong> · ${analyticEscape(f.text)}</p>`).join('')+(findings.length>100?'<p>Showing the first 100 findings. Review entries, then run the check again.</p>':'');return{valid,findings};
    }
    function openRecordEditor(title,fields,validate,deleteRecord){
      const dialog=document.getElementById('recordEditorDialog'),form=document.getElementById('recordEditorForm');
      if(dialog.open)return Promise.resolve(null);
      document.getElementById('recordEditorTitle').textContent=title;document.getElementById('recordEditorError').textContent='';
      document.getElementById('recordEditorFields').innerHTML=fields.map(f=>`<div class="form-group" data-editor-field="${analyticEscape(f.key)}"><label for="recordEdit_${f.key}">${analyticEscape(f.label)}</label>${f.options?`<select id="recordEdit_${f.key}" name="${f.key}">${f.optional?`<option value="" ${String(f.value??'')===''?'selected':''}>${analyticEscape(f.placeholder||'-- Optional --')}</option>`:''}${[...new Set([...f.options,String(f.value??'')])].filter(Boolean).map(o=>`<option value="${analyticEscape(o)}" ${String(o)===String(f.value)?'selected':''}>${analyticEscape(f.optionLabels?.[o]||o)}</option>`).join('')}</select>`:f.type==='textarea'?`<textarea id="recordEdit_${f.key}" name="${f.key}" maxlength="${f.maxLength||240}" rows="3">${analyticEscape(String(f.value??''))}</textarea>`:`<input id="recordEdit_${f.key}" name="${f.key}" type="${f.type||'text'}" value="${analyticEscape(String(f.value??''))}" ${f.required===false?'':'required'} ${f.type==='number'?`step="any" min="${f.min??0}" ${f.max!==undefined?`max="${f.max}"`:''} inputmode="decimal"`:''} ${f.maxLength?`maxlength="${f.maxLength}"`:''}>`}</div>`).join('');
      for(const field of fields.filter(f=>f.autoCalc==='first-emi-extra')){const wrapper=document.querySelector(`[data-editor-field="${field.key}"]`),button=document.createElement('button'),help=document.createElement('small');button.type='button';button.className='btn-small';button.id=`recordEdit_${field.key}Recalculate`;button.textContent='Use calculated estimate';help.className='text-muted';help.textContent='Auto-estimated for days after one monthly cycle using actual days ÷ 365. Editable to match the bank. A first EMI under one month already uses pro-rata interest.';wrapper?.append(button,help);}
      const conditionalFields=fields.filter(f=>f.hideWhen),syncConditionalFields=()=>{const values=Object.fromEntries(new FormData(form));for(const field of conditionalFields){const condition=field.hideWhen,wrapper=document.querySelector(`[data-editor-field="${field.key}"]`);if(wrapper)wrapper.hidden=String(values[condition.key]??'')===String(condition.value);}};
      for(const field of conditionalFields)document.getElementById(`recordEdit_${field.hideWhen.key}`)?.addEventListener('change',syncConditionalFields);syncConditionalFields();
      for(const field of fields.filter(f=>f.autoCalc==='first-emi-extra')){
        const input=document.getElementById(`recordEdit_${field.key}`),recalculate=document.getElementById(`recordEdit_${field.key}Recalculate`);let manuallyEdited=false,initialized=false;
        const updateEstimate=force=>{if(manuallyEdited&&!force)return;const values=Object.fromEntries(new FormData(form));if(!initialized&&input.value!==''){initialized=true;manuallyEdited=true;return;}initialized=true;const firstEmiDate=values.firstEmiDate||firstLoanEmiDueDate({date:values.date,emiDueDay:values.emiDueDay?Number(values.emiDueDay):undefined});input.value=firstEmiDate?PFT_LOAN_LEDGER.estimateExtraFirstEmiInterest({principal:Number(values.principal),rate:Number(values.rate),date:values.date,firstEmiDate}).toFixed(2):'';};
        input?.addEventListener('input',()=>{manuallyEdited=true;});
        for(const key of ['principal','rate','date','firstEmiDate']){const source=document.getElementById(`recordEdit_${key}`);source?.addEventListener('input',()=>updateEstimate(false));source?.addEventListener('change',()=>updateEstimate(false));}
        recalculate?.addEventListener('click',()=>{manuallyEdited=false;initialized=true;updateEstimate(true);});updateEstimate(false);
      }
      const memberField=fields.find(f=>f.key==='member'&&/^Family member/i.test(f.label));
      if(memberField){
        const names=profileMemberNames(),select=document.getElementById('recordEdit_member');
        // Preserve historical assignments, including a removed member or an unassigned record.
        const creating=!/^Edit\b/i.test(title);
        if(creating&&!memberField.value&&select){const preferred=preferredEntryMember(names);if(preferred)select.value=preferred;}
        if(select&&names.length===1&&(creating||String(memberField.value||'')===names[0])){
          select.value=names[0];select.closest('.form-group').hidden=true;
        }
      }
      const previousFocus=document.activeElement;
      dialog.querySelector('[data-record-delete]')?.remove();
      const remove=deleteRecord?document.createElement('button'):null;
      if(remove){remove.type='button';remove.className='btn-small btn-danger';remove.dataset.recordDelete='';remove.textContent='Delete';remove.setAttribute('aria-label','Delete transaction');remove.title='Delete transaction';form.querySelector('.record-editor-actions').prepend(remove);}
      const initialFocus=dialog.querySelector('button[aria-label*="Close"],button.modal-close-button,button');
      initialFocus?.setAttribute('autofocus','');
      dialog.showModal();
      initialFocus?.focus({preventScroll:true});
      return new Promise(resolve=>{
        const finish=value=>{remove?.remove();form.onsubmit=null;dialog.oncancel=null;document.getElementById('cancelRecordEditor').onclick=null;dialog.close();previousFocus?.focus();resolve(value);};
        if(remove)remove.onclick=()=>{finish(null);deleteRecord();};
        document.getElementById('cancelRecordEditor').onclick=()=>finish(null);document.getElementById('closeRecordEditor').onclick=()=>finish(null);dialog.oncancel=event=>{event.preventDefault();finish(null);};
        form.onsubmit=event=>{event.preventDefault();if(!form.reportValidity())return;const values=Object.fromEntries(new FormData(form));for(const f of fields){if(f.type==='date'&&!(f.required===false&&values[f.key]==='')&&!validCalendarDate(values[f.key])){document.getElementById('recordEditorError').textContent='Enter a valid calendar date.';return;}}
          const error=validate?.(values);if(error){document.getElementById('recordEditorError').textContent=error;return;}finish(values);};
      });
    }
    async function editPlannedAdjustment(row){
      const id=row.id,original=JSON.stringify(row);
      const values=await openRecordEditor('Edit planned change',[{key:'date',label:'Date',type:'date',value:row.date},{key:'category',label:'Investment',value:row.category,maxLength:80},{key:'type',label:'Change',value:row.type,options:['add','withdraw']},{key:'amount',label:'Amount ₹',type:'number',min:0.01,value:row.amount},{key:'notes',label:'Description',type:'textarea',maxLength:120,value:row.notes||''}],v=>!v.category.trim()?'Enter an investment name.':null);
      if(!values)return;const current=state.projectionAdjustments.find(r=>r.id===id);if(!current||JSON.stringify(current)!==original){alert('This record changed while editing. Reopen it and try again.');return;}
      Object.assign(current,{date:values.date,category:values.category.trim(),type:values.type,amount:Number(values.amount),notes:values.notes});await saveData('Edited planned change');renderGrowthProjection();
    }

    // Storage
    function syncStallionPmsFromInvestments() {
      const existingById=new Map(state.stallionPms.map(row=>[row.id,row]));
      const validIds=new Set(allAccounts('investments').filter(row=>row.type==='Stallion PMS').map(row=>row.id));
      for(const inv of state.investments){
        if(inv.type!=='Stallion PMS')continue;
        const existing=existingById.get(inv.id);
        const values={member:inv.member,name:inv.name,invested:inv.invested,profit:inv.current-inv.invested};
        if(existing)Object.assign(existing,values);
        else{const row={id:inv.id,...values,createdDate:inv.date};state.stallionPms.push(row);existingById.set(inv.id,row);}
      }
      state.stallionPms=state.stallionPms.filter(row=>validIds.has(row.id));
    }

    // Tab Navigation
    const pageNav=document.querySelector('.nav-tabs');
    const mobileNavReveal=document.getElementById('mobileNavReveal');
    const mobileNavItems=document.getElementById('mobileNavItems');
    const mobileNavPrevious=document.getElementById('mobileNavPrevious');
    const mobileNavNext=document.getElementById('mobileNavNext');
    let mobileNavStart=0;
    function refreshMobileNavPages(ensureActive=false){
      const mobile=window.matchMedia('(max-width:700px)').matches;
      const tabs=[...document.querySelectorAll('.nav-tab')];
      const count=4;
      const maximum=Math.max(0,tabs.length-count);
      mobileNavStart=Math.max(0,Math.min(mobileNavStart,maximum));
      if(ensureActive){
        const index=tabs.findIndex(tab=>tab.classList.contains('active'));
        if(index>=0&&(index<mobileNavStart||index>=mobileNavStart+count))mobileNavStart=Math.min(maximum,Math.floor(index/count)*count);
      }
      mobileNavItems?.style.setProperty('--mobile-nav-count',String(count));
      tabs.forEach((tab,index)=>{tab.hidden=mobile&&(index<mobileNavStart||index>=mobileNavStart+count);});
      if(mobileNavPrevious)mobileNavPrevious.disabled=!mobile||mobileNavStart===0;
      if(mobileNavNext)mobileNavNext.disabled=!mobile||mobileNavStart>=maximum;
    }
    function moveMobileNavPages(direction){
      if(!window.matchMedia('(max-width:700px)').matches)return;
      mobileNavStart+=direction*4;
      refreshMobileNavPages();
    }
    mobileNavPrevious?.addEventListener('click',()=>moveMobileNavPages(-1));
    mobileNavNext?.addEventListener('click',()=>moveMobileNavPages(1));
    refreshMobileNavPages(true);
    let mobileNavLastY=Math.max(0,window.scrollY),mobileNavDownDistance=0,mobileNavUpDistance=0;
    function setMobileNavHidden(hidden){
      const isMobile=window.matchMedia('(max-width:700px)').matches;
      const shouldHide=Boolean(hidden&&isMobile);
      document.body.classList.toggle('mobile-nav-hidden',shouldHide);
      if(pageNav){pageNav.inert=shouldHide;pageNav.setAttribute('aria-hidden',String(shouldHide));}
      if(mobileNavReveal){mobileNavReveal.setAttribute('aria-hidden',String(!shouldHide));mobileNavReveal.tabIndex=shouldHide?0:-1;}
    }
    window.addEventListener('scroll',()=>{
      const y=Math.max(0,window.scrollY),delta=y-mobileNavLastY;
      if(!window.matchMedia('(max-width:700px)').matches){setMobileNavHidden(false);mobileNavDownDistance=mobileNavUpDistance=0;mobileNavLastY=y;return;}
      if(y<=48){mobileNavDownDistance=mobileNavUpDistance=0;setMobileNavHidden(false);}
      else if(delta>0){mobileNavDownDistance+=delta;mobileNavUpDistance=0;if(mobileNavDownDistance>=16){if(pageNav?.contains(document.activeElement))document.activeElement.blur();setMobileNavHidden(true);}}
      else if(delta<0){mobileNavUpDistance+=-delta;mobileNavDownDistance=0;if(mobileNavUpDistance>=8)setMobileNavHidden(false);}
      mobileNavLastY=y;
    },{passive:true});
    mobileNavReveal?.addEventListener('click',()=>{setMobileNavHidden(false);pageNav?.querySelector('.nav-tab.active')?.focus({preventScroll:true});});
    window.addEventListener('resize',()=>{refreshMobileNavPages(true);if(!window.matchMedia('(max-width:700px)').matches)setMobileNavHidden(false);});
    const pageSwipeIgnoreSelector='button,a,input,select,textarea,summary,[contenteditable="true"],[role="button"],[role="dialog"],[aria-modal="true"],[role="listbox"],dialog,canvas,#familyProfileMenu,.nav-tabs,.table-wrapper,.investment-returns-chart-scroll,.modal,.dialog';
    let pageSwipeStart=null;
    function hasHorizontalScrollArea(target){
      for(let node=target;node&&node!==document.body;node=node.parentElement){
        const overflow=getComputedStyle(node).overflowX;
        if((overflow==='auto'||overflow==='scroll')&&node.scrollWidth>node.clientWidth+8)return true;
      }
      return false;
    }
    document.addEventListener('touchstart',event=>{
      pageSwipeStart=null;
      if(!window.matchMedia('(max-width:700px)').matches||event.touches.length!==1)return;
      const touch=event.touches[0],target=event.target instanceof Element?event.target:null;
      if(!target||touch.clientX<24||touch.clientX>window.innerWidth-24||target.closest(pageSwipeIgnoreSelector)||hasHorizontalScrollArea(target))return;
      pageSwipeStart={x:touch.clientX,y:touch.clientY,time:Date.now()};
    },{passive:true});
    document.addEventListener('touchend',event=>{
      if(!pageSwipeStart||!window.matchMedia('(max-width:700px)').matches||event.changedTouches.length!==1){pageSwipeStart=null;return;}
      const start=pageSwipeStart;pageSwipeStart=null;
      const touch=event.changedTouches[0],dx=touch.clientX-start.x,dy=touch.clientY-start.y;
      if(Date.now()-start.time>700||Math.abs(dx)<65||Math.abs(dx)<Math.abs(dy)*1.35)return;
      const tabs=[...document.querySelectorAll('.nav-tab')],activeIndex=tabs.findIndex(tab=>tab.classList.contains('active'));
      if(activeIndex<0)return;
      const nextIndex=dx<0?activeIndex-1:activeIndex+1;
      if(nextIndex>=0&&nextIndex<tabs.length)tabs[nextIndex].click();
    },{passive:true});
    document.querySelectorAll('[data-open-tab]').forEach(button=>button.addEventListener('click',()=>document.querySelector(`.nav-tab[data-tab="${button.dataset.openTab}"]`)?.click()));
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        setMobileNavHidden(false);
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        tab.classList.add('active');
        const tabId = tab.dataset.tab;
        try{trackerStorage.setItem('activePage',tabId);}catch(_){}
        const layoutTitle=document.getElementById('layoutPageTitle');
        if(layoutTitle)layoutTitle.textContent=tab.getAttribute('aria-label')||tab.textContent.trim().replace(/\s+/g,' ');
        refreshMobileNavPages(true);
        const tabContent = document.getElementById(tabId);
        if (tabContent) {
          tabContent.classList.add('active');
          if(window.matchMedia('(max-width:700px)').matches)window.scrollTo({top:0,behavior:'instant'});
          renderStartupPage(tabId);
          if (tabId === 'analytics') renderCharts();
          if (tabId === 'reports'){populateReportFinancialYears();if(document.getElementById('reportStartDate')?.value)renderRangeReport();}
          if (tabId === 'growth-projection') renderGrowthProjection();
        } else {
          console.warn(' Tab content not found for:', tabId);
        }
      });
    });

    // Format Currency
    function formatCurrency(amount) {
      return '₹' + Math.round(amount).toLocaleString('en-IN');
    }
    function formatProjectionLakh(amount) {
      const value=Number(amount);
      if(!Number.isFinite(value))return '—';
      const lakhs=Math.round(Math.abs(value)/100000*10)/10;
      const label=Number.isInteger(lakhs)?String(lakhs):lakhs.toFixed(1);
      return `${value<0?'-':''}₹${label}L`;
    }

    // Generate ID
    function generateId() {
      return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    function scheduledEmiDueDate(paymentDate,dueDay){
      if(!validCalendarDate(paymentDate)||!Number.isInteger(Number(dueDay))||Number(dueDay)<1||Number(dueDay)>31)return null;
      const [year,month]=paymentDate.split('-').map(Number),lastDay=new Date(Date.UTC(year,month,0)).getUTCDate();
      return `${year}-${String(month).padStart(2,'0')}-${String(Math.min(Number(dueDay),lastDay)).padStart(2,'0')}`;
    }
    function nextLoanDueMonth(date,dueDay){
      const [year,month]=date.split('-').map(Number),next=new Date(Date.UTC(year,month,1));
      return scheduledEmiDueDate(next.toISOString().slice(0,10),dueDay);
    }
    function firstLoanEmiDueDate(debt){
      if(debt.firstEmiDate&&validCalendarDate(debt.firstEmiDate))return debt.firstEmiDate;
      let due=scheduledEmiDueDate(debt.date,debt.emiDueDay);
      if(!due)return null;
      const start=Date.parse(debt.date+'T00:00:00Z');
      while((Date.parse(due+'T00:00:00Z')-start)/86400000<30)due=nextLoanDueMonth(due,debt.emiDueDay);
      return due;
    }
    function nextLoanEmiDueDate(debt){
      let due=firstLoanEmiDueDate(debt);
      if(!due||Number(debt.remaining)<=0)return null;
      const payments=(state.expenses||[]).filter(row=>row.category==='EMI Payment'&&row.loanId===debt.id&&row.repaymentType!=='part-payment'&&validCalendarDate(row.date)).sort((a,b)=>a.date.localeCompare(b.date));
      for(const payment of payments)if(payment.date>=due)due=nextLoanDueMonth(payment.date,debt.emiDueDay??Number(debt.firstEmiDate?.slice(-2)));
      return due;
    }
    function loanDueDateLabel(debt){
      const due=nextLoanEmiDueDate(debt);
      return Number(debt.remaining)<=0?'Paid off':due?calendarDate(due).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}):'Not set';
    }
    function confirmLateEmiPaymentDate(debt,paymentDate){
      if(!debt?.emiDueDay||!validCalendarDate(paymentDate))return true;
      const dueDate=scheduledEmiDueDate(paymentDate,debt.emiDueDay);
      if(!dueDate||paymentDate<=dueDate)return true;
      const display=value=>calendarDate(value).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
      return confirm(`This Monthly EMI is dated ${display(paymentDate)}, after its scheduled due date (${display(dueDate)}). Recorded part payments are prorated within the EMI interval; late-payment fees are not added. Continue with this date?`);
    }




