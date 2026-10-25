// Observe only the small cloud pointer; downloading records remains an explicit action.
export function watchCloudChanges({subscribe, baseline, ownMutation, notify, active, timers=globalThis}) {
  let stop=null, retry=null, disposed=false, generation=0, failures=0;
  const pause=()=>{generation++;stop?.();stop=null;timers.clearTimeout(retry);retry=null;};
  function start(){
    if(disposed||stop||!active())return;
    const epoch=++generation;
    stop=subscribe(metadata=>{
      if(disposed||epoch!==generation||!active())return;
      failures=0;
      if(!metadata){notify(null);return;}
      if(!Number.isInteger(metadata.revision))return;
      if(metadata.revision<=baseline()||ownMutation(metadata.mutationId)){notify(null);return;}
      notify({revision:metadata.revision});
    },error=>{
      if(disposed||epoch!==generation)return;
      pause();
      const denied=/permission-denied|unauthenticated/.test(error?.code||'');
      notify({error:denied?'Cloud access changed. Reload to check your access.':'Live checks paused. Your saved device records are kept.'});
      if(!denied&&active())retry=timers.setTimeout(start,Math.min(120000,5000*2**Math.min(failures++,5)));
    });
  }
  return {resume(){if(!active())pause();else start();},dispose(){disposed=true;pause();}};
}

export function installCloudNotice(subscribe) {
  const banner=document.createElement('aside');
  banner.id='cloudChangeNotice';banner.hidden=true;banner.setAttribute('aria-label','Cloud records');
  banner.style.cssText='position:fixed;bottom:90px;left:12px;right:12px;max-width:680px;margin:auto;z-index:12000;padding:16px;border:1px solid #52bfa1;border-radius:16px;background:#12352f;color:#fff;box-shadow:0 12px 35px #0006;display:flex;flex-wrap:wrap;gap:10px;align-items:center';
  // Inline display must not override the hidden attribute.
  const message=document.createElement('span');message.setAttribute('role','status');message.style.flex='1 1 260px';
  const button=(text,action)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.className='btn btn-secondary';b.style.cssText='min-height:44px;border-radius:10px';b.onclick=action;banner.append(b);return b;};
  banner.append(message);document.body.append(banner);
  let latest=null,busy=false;
  function paint(){
    banner.hidden=!latest;banner.style.display=latest?'flex':'none';
    const pending=Boolean(syncRecord?.pending||cloudSaveBlocked||persistenceDirty||pendingSaves);
    message.textContent=latest?.error||(pending?'New cloud records found. This device also has changes. Review both versions before replacing anything.':'New records are available from another device. Finish your form before loading them.');
    load.disabled=busy||pending||Boolean(latest?.error);review.hidden=!pending;backup.hidden=!pending;
  }
  const load=button('Load latest',async()=>{
    if(busy)return;busy=true;paint();
    try{
      await window.financeBridge.settle();
      if(await window.financeBridge.pendingSync()||window.financeBridge.dirty()){paint();return;}
      if(!confirm('Load the latest cloud records? This reloads the tracker and clears unfinished form entries.'))return;
      // Recheck after confirmation; the bridge also protects pending saves in other tabs.
      if(await window.financeBridge.pendingSync()||window.financeBridge.dirty())return;
      await window.financeBridge.refreshRemote();
    }catch(error){latest={error:error.message||'Unable to load cloud records. Try again when connected.'};}
    finally{busy=false;paint();}
  });
  const review=button('Review differences',()=>window.openTrackerConflictReview?.());
  const backup=button('Export device backup',()=>window.financeBridge.exportUnsaved());
  const watcher=watchCloudChanges({subscribe,baseline:()=>syncRecord?.baseRevision||0,
    ownMutation:id=>Boolean(id&&id===syncRecord?.token),
    active:()=>!document.hidden&&navigator.onLine&&window.financeCloud?.accessValid?.()!==false,
    notify:value=>{latest=value;paint();}});
  const resume=()=>watcher.resume();
  const statusTimer=setInterval(()=>{if(latest&&!document.hidden)paint();},1000);
  document.addEventListener('visibilitychange',resume);window.addEventListener('online',resume);window.addEventListener('offline',resume);
  const previousReset=window.financeBridge.reset;
  const originalSync=syncCloud, originalSave=window.financeCloud.save;
  let attempts=0,lastError=null,retrying=false;
  window.financeCloud.save=async function(...args){
    lastError=null;
    try{return await originalSave.apply(this,args);}
    catch(error){lastError=error;throw error;}
  };
  syncCloud=async function(){
    if(retrying||syncBusy)return;
    retrying=true;
    const sentToken=syncRecord?.token;
    try{
      await originalSync();
      clearTimeout(syncTimer);
      if(!syncRecord?.pending){attempts=0;return;}
      if(cloudSaveBlocked||!navigator.onLine||window.financeCloud?.deleting||window.financeCloud?.canEdit===false||window.financeCloud?.accessValid?.()===false)return;
      if(/permission-denied|unauthenticated/.test(lastError?.code||'')){
        cloudSaveBlocked=true;storageMessage('Saved on device · Cloud access needs attention. Export a backup before reloading.',true);return;
      }
      // Spread reconnect retries across devices; a newer local save can still trigger an immediate attempt.
      const delay=!lastError&&syncRecord.token!==sentToken?500:retryDelay(attempts++);
      syncTimer=setTimeout(()=>syncCloud(),delay);
    }finally{retrying=false;paint();}
  };
  window.financeBridge.reset=function(){watcher.dispose();clearInterval(statusTimer);document.removeEventListener('visibilitychange',resume);window.removeEventListener('online',resume);window.removeEventListener('offline',resume);banner.remove();return previousReset.apply(this,arguments);};
  watcher.resume();paint();
}

export function retryDelay(attempt,random=Math.random){
  const steps=[2000,5000,15000,30000,60000,120000];
  return Math.round(steps[Math.min(Math.max(0,attempt),steps.length-1)]*(0.9+random()*0.2));
}
