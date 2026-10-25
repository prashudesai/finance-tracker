import {initializeApp} from './vendor/firebase-app.js';
import {getAuth,GoogleAuthProvider,onAuthStateChanged,signInWithPopup,signOut} from './vendor/firebase-auth.js';
import {getFirestore,doc,getDocFromServer,writeBatch,runTransaction,onSnapshot,serverTimestamp} from './vendor/firebase-firestore.js';
import {installReviewSync} from './review-sync.js?v=83';
import {reviewValues,applyReviewPatch,validateReviewRestore} from './review-model.js?v=83';
import {installRecordSearch} from './record-search.js?v=82';
import {installAttention} from './attention.js?v=81';
import {installFinanceWorkbench} from './finance-workbench.js?v=79';
import {installExperience} from './experience.js?v=79';
import {installRecordRecovery} from './record-recovery.js?v=77';
import {installWorkProtection} from './work-protection.js?v=76';
import {installCloudNotice} from './cloud-notice.js?v=75';
import {initializeFamilyAccess} from './family-access.js?v=66';
import {initializeAccountPhoto} from './account-photo.js?v=66';
import {createCloudStore} from './firebase-store.js?v=66';
const config={apiKey:'AIzaSyBYhF_dyyOSyHyGletR58W7bYlL0xw8dQk',authDomain:'finance-tracker-bc7c9.firebaseapp.com',projectId:'finance-tracker-bc7c9',storageBucket:'finance-tracker-bc7c9.firebasestorage.app',messagingSenderId:'720970373789',appId:'1:720970373789:web:bb792be22a462f359cd274'};
const app=initializeApp(config),auth=getAuth(app),db=getFirestore(app),provider=new GoogleAuthProvider();
provider.setCustomParameters({prompt:'select_account'});
const gate=document.getElementById('cloudGate'),message=document.getElementById('cloudMessage'),login=document.getElementById('cloudLogin');
const accountLabel=document.getElementById('cloudAccountLabel');
function showError(error){document.body.classList.remove('cloud-loading');message.textContent=friendly(error);login.disabled=false;}
function friendly(error){
  const code=error?.code||'';
  if(code==='auth/popup-blocked')return 'Allow pop-ups for this website and try again. On iPhone, open the tracker in Safari.';
  if(code.includes('permission-denied'))return 'Cloud access is blocked. Create Firestore and deploy the included security rules, then reload.';
  if(code.includes('operation-not-allowed'))return 'Enable Google under Firebase Authentication → Sign-in method, then try again.';
  if(code.includes('unauthorized-domain'))return 'Add this website domain under Firebase Authentication → Settings → Authorized domains.';
  return error?.message||'Unable to connect. Check your internet connection and reload.';
}
login.addEventListener('click',async()=>{
  login.disabled=true;message.textContent='Opening Google sign-in…';
  try{await signInWithPopup(auth,provider);}
  catch(error){
    if(error.code==='auth/popup-closed-by-user'||error.code==='auth/cancelled-popup-request'){message.textContent='Sign-in cancelled. You can try again.';login.disabled=false;}
    else showError(error);
  }
});
const gateExport=document.getElementById('cloudEmergencyExport');
gateExport.addEventListener('click',()=>window.financeBridge?.exportUnsaved());
document.getElementById('cloudReload').addEventListener('click',()=>location.reload());
let initialUid;
function lock(error){
  window.closeSettingsTile?.(true);
  document.body.classList.remove('cloud-loading');
  document.querySelector('.container').inert=true;
  document.body.classList.add('cloud-pending');gate.hidden=false;login.hidden=true;
  message.textContent=friendly(error);
  gateExport.hidden=false;document.getElementById('cloudSaveRetry').hidden=false;
  document.getElementById('cloudRecoveryActions').hidden=false;
}
window.financeCloudLock=lock;
onAuthStateChanged(auth,async user=>{
  if(initialUid!==undefined){
    if(user?.uid!==initialUid){window.financeBridge?.reset();location.reload();}
    return;
  }
  if(!user){document.body.classList.remove('cloud-loading');login.hidden=false;message.textContent='';login.disabled=false;return;}
  initialUid=user.uid;document.body.classList.add('cloud-loading');login.hidden=true;message.textContent='Opening your tracker…';
  let family;try{family=await initializeFamilyAccess(db,user,lock);}catch(error){lock(error);return;}
  const assertAccess=()=>{if(!family.accessValid())throw new Error('Family access changed. Reload.');};
  const api={
    currentUid:()=>auth.currentUser?.uid,
    online:()=>navigator.onLine,
    get:async path=>{const snapshot=await getDocFromServer(doc(db,path));return snapshot.exists()?snapshot.data():null;},
    canCleanup:family.canManage,
    put:async records=>{assertAccess();if(!family.canEdit)throw new Error('Viewer access cannot save changes.');const batch=writeBatch(db);for(const record of records)batch.set(doc(db,record.path),record.data);await batch.commit();},
    remove:async paths=>{assertAccess();if(!family.canManage)return;const batch=writeBatch(db);for(const path of paths)batch.delete(doc(db,path));await batch.commit();},
    publish:async(path,expected,next)=>runTransaction(db,async transaction=>{
      assertAccess();if(!family.canEdit)throw new Error('Viewer access cannot save changes.');
      if(next.resetHistory&&!family.canManage)throw new Error('Only the owner can clear tracker history.');
      if(auth.currentUser?.uid!==user.uid)throw new Error('The signed-in account changed. Reload.');
      const ref=doc(db,path),snapshot=await transaction.get(ref),old=snapshot.exists()?snapshot.data():null;
      if(next.mutationId&&old?.mutationId===next.mutationId){if(old.digest!==next.digest)throw Object.assign(new Error('A save identifier was reused for different records.'),{code:'tracker/conflict'});return {acknowledged:old};}
      if((old?.revision||0)!==expected)throw Object.assign(new Error('Another device saved newer records.'),{code:'tracker/conflict'});
      if(next.reviewRestore)await applyBackupReviewRestore(transaction,next.reviewRestore);
      const {resetHistory,reviewRestore,...metadata}=next;transaction.set(ref,{...metadata,previous:!resetHistory&&old?{generation:old.generation,count:old.count}:null});return old;
    })
  };
  const store=createCloudStore(api,family.ownerUid,user.uid);
  // Read-only comparisons use a separate store so their load cannot change the writer revision.
  const inspect=()=>{assertAccess();return createCloudStore(api,family.ownerUid,user.uid).load();};
  window.financeCloud={uid:family.role==='owner'?user.uid:'shared:'+user.uid+'|'+family.ownerUid+'|'+family.role,ownerUid:family.ownerUid,ownerEmail:family.ownerEmail,inspect,email:user.email||'',role:family.role,canEdit:family.canEdit,canManage:family.canManage,accessValid:family.accessValid,displayName:user.displayName||'',load:store.load,save:(envelope,options)=>{assertAccess();if(!family.canEdit)throw new Error('Viewer access cannot save changes.');return store.save(envelope,options);},resume:store.resume,revision:()=>store.revision,updatedAt:()=>store.updatedAt,lock,
    showApp(){const label=document.getElementById('accountSignedInEmail');if(label)label.textContent=user.email||'Google account';document.body.classList.remove('cloud-pending','cloud-loading');gate.hidden=true;},
    async logout(){
      await window.financeBridge?.settle();
      if(window.financeBridge?.dirty())throw new Error('Some changes are not saved. Export them or reload before signing out.');
      document.querySelector('.container').inert=true;document.body.classList.add('cloud-pending');
      // Clear displayed records before the asynchronous sign-out transition.
      window.financeBridge?.reset();
      try{await signOut(auth);location.reload();}catch(error){lock(error);}
    }
  };
  accountLabel.textContent=(user.email||'Google account')+(family.role==='owner'?'':' · '+family.role+' · '+family.ownerEmail+'’s tracker');
  document.getElementById('cloudSignOut').addEventListener('click',()=>window.financeCloud.logout().catch(error=>alert(friendly(error))));
  document.getElementById('cloudSaveRetry').addEventListener('click',()=>window.financeBridge?.retry());
  document.getElementById('cloudRefresh').addEventListener('click',()=>window.financeBridge?.refreshRemote().catch(error=>alert(friendly(error))));
  window.financeCloud.inspectVersion=async()=>{assertAccess();const reader=createCloudStore(api,family.ownerUid,user.uid);const envelope=await reader.load();return {envelope,revision:reader.revision};};
  const reviewRef=doc(db,'users/'+family.ownerUid+'/reviews/current');
  const decodeReviews=snapshot=>{const data=snapshot.exists()?snapshot.data():null;return {values:reviewValues(data?JSON.parse(data.payload):{}),revision:data?.revision||0,epoch:data?.epoch||'initial',fromCache:snapshot.metadata?.fromCache===true};};
  async function applyBackupReviewRestore(transaction,input){
    assertAccess();if(!family.canManage)throw Error('Only the owner can restore shared reviews.');
    const restore=validateReviewRestore(input),current=decodeReviews(await transaction.get(reviewRef)),marker='restore-'+restore.id;
    if(current.epoch===marker)return;
    if(current.revision!==restore.baseRevision||current.epoch!==restore.epoch)throw Object.assign(Error('Shared reviews changed after the backup import was prepared. Review the cloud conflict before replacing records.'),{code:'tracker/conflict'});
    transaction.set(reviewRef,{format:1,revision:current.revision+1,epoch:marker,payload:JSON.stringify(restore.values),updatedBy:user.uid,updatedAt:serverTimestamp()});
  }
  async function saveReviews(patch){
    let observed=-1;
    for(let attempt=0;attempt<4;attempt++){
      try{return await runTransaction(db,async transaction=>{
        assertAccess();if(!family.canEdit)throw Error('Viewer access cannot change reviews.');
        const current=decodeReviews(await transaction.get(reviewRef));observed=current.revision;
        if(patch.some(p=>p.epoch!==current.epoch))throw Object.assign(Error('Shared reviews were reset. Export pending changes, then reload reviews.'),{code:'tracker/review-conflict'});
        const values=applyReviewPatch(current.values,patch),revision=current.revision+1;
        transaction.set(reviewRef,{format:1,revision,epoch:current.epoch,payload:JSON.stringify(values),updatedBy:user.uid,updatedAt:serverTimestamp()});return {values,revision,epoch:current.epoch};
      });}catch(error){
        if(!/permission-denied|aborted/.test(error.code||'')||attempt===3)throw error;
        assertAccess();const latest=decodeReviews(await getDocFromServer(reviewRef));if(!family.canEdit||latest.revision<=observed)throw error;
      }
    }
  }
  async function resetReviews(marker){
    let observed=-1;for(let attempt=0;attempt<4;attempt++){
      try{return await runTransaction(db,async transaction=>{assertAccess();if(!family.canManage)throw Error('Only the owner can clear shared reviews.');const current=decodeReviews(await transaction.get(reviewRef));observed=current.revision;if(current.epoch===marker)return current;const revision=current.revision+1;transaction.set(reviewRef,{format:1,revision,epoch:marker,payload:'{}',updatedBy:user.uid,updatedAt:serverTimestamp()});return {values:{},revision,epoch:marker};});}
      catch(error){if(!/permission-denied|aborted/.test(error.code||'')||attempt===3)throw error;assertAccess();const latest=decodeReviews(await getDocFromServer(reviewRef));if(!family.canManage||latest.revision<=observed)throw error;}
    }
  }
  const reviewApi={subscribe:(next,error)=>onSnapshot(reviewRef,{includeMetadataChanges:true},snapshot=>{try{next(decodeReviews(snapshot));}catch(e){error(e);}},error),load:async()=>decodeReviews(await getDocFromServer(reviewRef)),save:saveReviews,reset:resetReviews};
  window.financeCloudResolve();
  Promise.resolve(window.trackerReady).then(async()=>{await installReviewSync(reviewApi);const css=document.createElement('link');css.rel='stylesheet';css.href='./workbench.css?v=79';document.head.append(css);installFinanceWorkbench();installExperience();installAttention();installRecordSearch();}).catch(error=>console.warn('Workbench unavailable',error));
  Promise.resolve(window.trackerReady).then(installRecordRecovery).catch(error=>console.warn('Record recovery unavailable',error));
  Promise.resolve(window.trackerReady).then(installWorkProtection).catch(error=>console.warn('Draft recovery unavailable',error));
  Promise.resolve(window.trackerReady).then(()=>installCloudNotice((next,error)=>onSnapshot(doc(db,'users/'+family.ownerUid+'/tracker/current'),snapshot=>next(snapshot.exists()?snapshot.data():null),error))).catch(error=>console.warn('Live cloud notice unavailable',error));
  Promise.resolve(window.trackerReady).then(()=>initializeAccountPhoto({
    uid:user.uid,
    load:async()=>{const snapshot=await getDocFromServer(doc(db,'users/'+user.uid+'/profile/photo'));return snapshot.exists()?snapshot.data().image:'';},
    save:async image=>{if(auth.currentUser?.uid!==user.uid)throw new Error('The signed-in account changed. Reload.');const batch=writeBatch(db);batch.set(doc(db,'users/'+user.uid+'/profile/photo'),{image});await batch.commit();}
  })).catch(()=>{});
},error=>{showError(error);});


// Surface a useful message if authentication or the initial cloud read stalls.
setTimeout(()=>{
  if(document.body.classList.contains('cloud-loading')){
    document.body.classList.remove('cloud-loading');login.hidden=true;
    message.textContent='Loading is taking longer than expected. Check your connection, then reload.';
    document.getElementById('cloudRecoveryActions').hidden=false;
    gateExport.hidden=true;document.getElementById('cloudSaveRetry').hidden=true;
  }
},15000);
