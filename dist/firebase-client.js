import {installMobileExperience} from './mobile-experience.js';
import {installFilterPopovers} from './filter-popovers.js';
import {installFinanceInsights} from './finance-insights.js';
import {installCashFlow} from './cash-flow.js?v=86';
import {initializeApp} from './vendor/firebase-app.js';
import {initializeAuth,indexedDBLocalPersistence,browserLocalPersistence,browserSessionPersistence,browserPopupRedirectResolver,GoogleAuthProvider,onAuthStateChanged,signInWithPopup,signOut} from './vendor/firebase-auth.js';
import {getFirestore,doc,getDocFromServer,writeBatch,runTransaction,onSnapshot,serverTimestamp} from './vendor/firebase-firestore.js';
import {installReviewSync} from './review-sync.js?v=83';
import {reviewValues,applyReviewPatch,validateReviewRestore} from './review-model.js?v=83';
import {installRecordSearch} from './record-search.js?v=85';
import {installAttention} from './attention.js?v=81';
import {installFinanceWorkbench} from './finance-workbench.js?v=79';
import {installExperience} from './experience.js?v=79';
import {installRecordRecovery} from './record-recovery.js?v=77';
import {installWorkProtection} from './work-protection.js?v=76';
import {installCloudNotice} from './cloud-notice.js?v=75';
import {initializeFamilyAccess} from './family-access.js?v=66';
import {initializeAccountPhoto} from './account-photo.js?v=66';
import {createCloudStore} from './firebase-store.js?v=66';
import {openVault} from './finance-vault.js?v=1';
const config={apiKey:'AIzaSyBYhF_dyyOSyHyGletR58W7bYlL0xw8dQk',authDomain:'finance-tracker-bc7c9.firebaseapp.com',projectId:'finance-tracker-bc7c9',storageBucket:'finance-tracker-bc7c9.firebasestorage.app',messagingSenderId:'720970373789',appId:'1:720970373789:web:bb792be22a462f359cd274'};
// Safari and mobile need Firebase's auth iframe prepared before the sign-in tap.
const app=initializeApp(config),auth=initializeAuth(app,{persistence:[indexedDBLocalPersistence,browserLocalPersistence,browserSessionPersistence],popupRedirectResolver:browserPopupRedirectResolver}),db=getFirestore(app),provider=new GoogleAuthProvider();
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
  try{await signInWithPopup(auth,provider,browserPopupRedirectResolver);}
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

const LEGACY_VAULT_ERROR='This account still has unencrypted cloud records.';
function offerLegacyAccountDeletion(user,family,error){
  if(family.role!=='owner'||family.ownerUid!==user.uid||!String(error?.message||'').startsWith(LEGACY_VAULT_ERROR))return;
  const card=gate.querySelector('.cloud-login-card');
  if(!card||document.getElementById('legacyAccountDelete'))return;
  const section=document.createElement('section');
  section.id='legacyAccountDelete';
  section.className='cloud-vault-form';
  const heading=document.createElement('h2');heading.textContent='Start over with an encrypted tracker';
  const warning=document.createElement('p');
  warning.textContent='Your existing tracker uses the older, unencrypted format. Deleting your account permanently removes the cloud tracker, shared family access and records. Downloaded backups are not deleted, but this version cannot open old backups. Only proceed if you have safely kept any data you need.';
  const form=document.createElement('form');
  const label=document.createElement('label');label.textContent='Type DELETE MY ACCOUNT to permanently delete this tracker account';
  const phrase=document.createElement('input');phrase.type='text';phrase.autocomplete='off';phrase.spellcheck=false;phrase.setAttribute('aria-label','Type DELETE MY ACCOUNT');
  const acknowledgement=document.createElement('label'),check=document.createElement('input');check.type='checkbox';
  acknowledgement.append(check,' I understand this permanently deletes the account and its cloud data.');
  const button=document.createElement('button');button.type='submit';button.textContent='Delete my old account';button.disabled=true;
  const status=document.createElement('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const retryLogin=document.createElement('button');retryLogin.type='button';retryLogin.textContent='Sign out and sign in again';retryLogin.onclick=async()=>{retryLogin.disabled=true;try{await signOut(auth);location.reload();}catch(error){status.textContent=friendly(error);retryLogin.disabled=false;}};
  const update=()=>{button.disabled=phrase.value!=='DELETE MY ACCOUNT'||!check.checked||!navigator.onLine;};
  phrase.addEventListener('input',update);check.addEventListener('change',update);
  window.addEventListener('online',update);window.addEventListener('offline',update);
  label.append(phrase);form.append(label,acknowledgement,button,status,retryLogin);section.append(heading,warning,form);card.append(section);
  form.addEventListener('submit',async event=>{
    event.preventDefault();update();
    if(button.disabled||auth.currentUser?.uid!==user.uid||family.role!=='owner'||family.ownerUid!==user.uid)return;
    if(!confirm('Permanently delete your existing tracker account, all cloud financial records and family invitations? This cannot be undone.'))return;
    button.disabled=true;phrase.disabled=true;check.disabled=true;retryLogin.disabled=true;
    status.textContent='Deleting account and cloud records… Keep this page open.';
    try{
      const token=await user.getIdToken(true);
      const response=await fetch('https://us-central1-'+config.projectId+'.cloudfunctions.net/deleteTrackerAccount',{
        method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
        body:JSON.stringify({data:{confirmation:'DELETE MY ACCOUNT'}})
      });
      const payload=await response.json();
      if(!response.ok||payload.error||payload.result?.deleted!==true){
        throw new Error(payload.error?.message||'Account deletion was not confirmed. Nothing else will be changed by this screen.');
      }
      status.textContent='Account deleted. Returning to sign-in…';
      try{await signOut(auth);}catch(_){}
      location.reload();
    }catch(failure){
      status.textContent=friendly(failure)+(/sign in again|recent/i.test(friendly(failure))?' Sign out, sign in again and retry.':'');
      phrase.disabled=false;check.disabled=false;retryLogin.disabled=false;update();
    }
  });
}

onAuthStateChanged(auth,async user=>{
  if(initialUid!==undefined){
    if(user?.uid!==initialUid){window.financeBridge?.reset();location.reload();}
    return;
  }
  if(!user){document.body.classList.remove('cloud-loading');window.dispatchEvent(new Event('pft:signed-out'));login.hidden=false;message.textContent='';login.disabled=false;return;}
  window.PFTPerformance?.mark('auth-ready');
  initialUid=user.uid;const loadingStatus=document.getElementById('cloudLoadingIndicator');if(loadingStatus)loadingStatus.textContent='Signed in — loading your family’s financial data…';document.body.classList.add('cloud-loading');login.hidden=true;message.textContent='Opening your tracker…';
  let family;try{family=await initializeFamilyAccess(db,user,lock);}catch(error){lock(error);return;}
  window.PFTPerformance?.mark('access-ready');
  window.addEventListener('pft:before-reveal',()=>installCashFlow(),{once:true});
  const assertAccess=()=>{if(!family.accessValid())throw new Error('Family access changed. Reload.');};
  const api={
    currentUid:()=>auth.currentUser?.uid,
    online:()=>navigator.onLine,
    get:async path=>{const snapshot=await getDocFromServer(doc(db,path));return snapshot.exists()?snapshot.data():null;},
    create:async(path,data)=>{assertAccess();if(family.role!=='owner')throw Error('Only the owner can create a vault.');await runTransaction(db,async tx=>{const ref=doc(db,path);if((await tx.get(ref)).exists())throw Error('The vault already exists. Reload.');tx.set(ref,data);});},
    rotate:async(path,previous,next)=>{assertAccess();if(family.role!=='owner')throw Error('Only the owner can reset the vault passphrase.');await runTransaction(db,async tx=>{const ref=doc(db,path),snapshot=await tx.get(ref);if(!snapshot.exists()||snapshot.data().wrapped!==previous.wrapped)throw Error('Vault settings changed on another device. Reload.');tx.set(ref,next);});return next;},
    createPair:async(owner,id,data)=>{assertAccess();if(owner!==family.ownerUid)throw Error('Wrong tracker.');await runTransaction(db,async tx=>{const ref=doc(db,`users/${owner}/vaultInvites/${id}`);if((await tx.get(ref)).exists())throw Error('Pairing code already exists.');tx.set(ref,data);});},
    readPair:async(owner,id)=>{assertAccess();if(owner!==family.ownerUid)throw Error('Wrong tracker.');return api.get(`users/${owner}/vaultInvites/${id}`);},
    canCleanup:family.canManage,
    put:async records=>{assertAccess();if(!family.canEdit)throw new Error('Viewer access cannot save changes.');const batch=writeBatch(db);for(const record of records)batch.set(doc(db,record.path),record.data);await batch.commit();},
    remove:async paths=>{assertAccess();if(!family.canManage)return;const batch=writeBatch(db);for(const path of paths)batch.delete(doc(db,path));await batch.commit();},
    publish:async(path,expected,next)=>runTransaction(db,async transaction=>{
      assertAccess();if(!family.canEdit)throw new Error('Viewer access cannot save changes.');
      if(next.resetHistory&&!family.canManage)throw new Error('Only the owner can clear tracker history.');
      if(auth.currentUser?.uid!==user.uid)throw new Error('The signed-in account changed. Reload.');
      const ref=doc(db,path),snapshot=await transaction.get(ref),old=snapshot.exists()?snapshot.data():null;
      if(next.mutationId&&old?.mutationId===next.mutationId){if(old.mutationProof!==next.mutationProof)throw Object.assign(new Error('A save identifier was reused for different records.'),{code:'tracker/conflict'});return {acknowledged:old};}
      if((old?.revision||0)!==expected)throw Object.assign(new Error('Another device saved newer records.'),{code:'tracker/conflict'});
      if(next.reviewRestore)await applyBackupReviewRestore(transaction,next.reviewRestore);
      const {resetHistory,reviewRestore,...metadata}=next;transaction.set(ref,{...metadata,previous:!resetHistory&&old?{generation:old.generation,count:old.count}:null});return old;
    })
  };
  let vault;try{vault=await openVault(api,family.ownerUid,family.role,user.uid,user.email||'');}catch(error){lock(error);offerLegacyAccountDeletion(user,family,error);return;}
  const pairPanel=document.getElementById('settingsAccountPanel');if(pairPanel){const section=document.createElement('section');section.className='cloud-vault-form';const heading=document.createElement('h3');heading.textContent='Encrypted vault';const button=document.createElement('button');button.type='button';button.textContent='Approve a new device';const code=document.createElement('code');code.hidden=true;button.onclick=async()=>{button.disabled=true;try{code.textContent=await vault.approveDevice();code.hidden=false;button.textContent='Generate another code';}catch(error){code.textContent=friendly(error);code.hidden=false;}finally{button.disabled=false;}};const note=document.createElement('p');note.textContent='Share this code only with the person signing in on the new device. It expires in five minutes.';section.append(heading,button,note,code);if(family.role==='owner'){const renew=document.createElement('button');renew.type='button';renew.textContent='Replace lost recovery key';const recoveryCode=document.createElement('code');recoveryCode.hidden=true;const emailKey=document.createElement('a');emailKey.textContent='Email to myself';emailKey.hidden=true;renew.onclick=async()=>{if(!confirm('Replace the recovery key? The previous recovery key will stop working. Save the new key immediately.'))return;renew.disabled=true;try{const value=await vault.renewRecovery();recoveryCode.textContent=value;recoveryCode.hidden=false;emailKey.href='mailto:'+encodeURIComponent(user.email||'')+'?subject='+encodeURIComponent('Personal Finance Tracker recovery key')+'&body='+encodeURIComponent('Anyone who can read this email can recover your tracker.\n\n'+value);emailKey.hidden=false;}catch(error){recoveryCode.textContent=friendly(error);recoveryCode.hidden=false;}finally{renew.disabled=false;}};section.append(renew,recoveryCode,emailKey);}pairPanel.append(section);}
  const store=createCloudStore(api,family.ownerUid,user.uid,vault);
  // Read-only comparisons use a separate store so their load cannot change the writer revision.
  const inspect=()=>{assertAccess();return createCloudStore(api,family.ownerUid,user.uid,vault).load();};
  window.financeCloud={uid:family.role==='owner'?user.uid:'shared:'+user.uid+'|'+family.ownerUid+'|'+family.role,ownerUid:family.ownerUid,ownerEmail:family.ownerEmail,inspect,email:user.email||'',role:family.role,canEdit:family.canEdit,canManage:family.canManage,accessValid:family.accessValid,displayName:user.displayName||'',checkRevision:async()=>{assertAccess();const pointer=await api.get('users/'+family.ownerUid+'/tracker/current');assertAccess();const revision=pointer?.revision||0;if(!Number.isInteger(revision)||revision<0)throw new Error('Cloud revision is invalid.');return revision;},load:store.load,save:(envelope,options)=>{assertAccess();if(!family.canEdit)throw new Error('Viewer access cannot save changes.');return store.save(envelope,options);},resume:store.resume,revision:()=>store.revision,updatedAt:()=>store.updatedAt,lock,
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
  const profileName=document.getElementById('settingsProfileName'),profileAvatar=document.getElementById('settingsProfileAvatar');if(profileName)profileName.textContent=user.displayName||'Your account';if(profileAvatar){const initials=(user.displayName||user.email||'P').split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase();profileAvatar.textContent=initials;if(user.photoURL){const img=document.createElement('img');img.alt='';img.referrerPolicy='no-referrer';img.src=user.photoURL;img.onerror=()=>profileAvatar.textContent=initials;profileAvatar.replaceChildren(img);}}
  accountLabel.textContent=(user.email||'Google account')+(family.role==='owner'?'':' · '+family.role+' · '+family.ownerEmail+'’s tracker');
  document.getElementById('cloudSignOut').addEventListener('click',()=>window.financeCloud.logout().catch(error=>alert(friendly(error))));
  document.getElementById('cloudSaveRetry').addEventListener('click',()=>window.financeBridge?.retry());
  document.getElementById('cloudRefresh').addEventListener('click',()=>window.financeBridge?.refreshRemote().catch(error=>alert(friendly(error))));
  window.financeCloud.inspectVersion=async()=>{assertAccess();const reader=createCloudStore(api,family.ownerUid,user.uid,vault);const envelope=await reader.load();return {envelope,revision:reader.revision};};
  window.financeCloud.reviewPayload={encrypt:value=>vault.encrypt('reviews:'+family.ownerUid,value),decrypt:value=>vault.decrypt('reviews:'+family.ownerUid,value)};
  const reviewRef=doc(db,'users/'+family.ownerUid+'/reviews/current');
  const decodeReviews=async snapshot=>{const data=snapshot.exists()?snapshot.data():null;if(data&&data.format!==2)throw Error('Old shared reviews are not encrypted. Delete old data before opening the vault.');return {values:reviewValues(data?await vault.decrypt('reviews:'+family.ownerUid,data.payload):{}),revision:data?.revision||0,epoch:data?.epoch||'initial',fromCache:snapshot.metadata?.fromCache===true};};
  async function applyBackupReviewRestore(transaction,input){
    assertAccess();if(!family.canManage)throw Error('Only the owner can restore shared reviews.');
    const restore=validateReviewRestore(input),current=await decodeReviews(await transaction.get(reviewRef)),marker='restore-'+restore.id;
    if(current.epoch===marker)return;
    if(current.revision!==restore.baseRevision||current.epoch!==restore.epoch)throw Object.assign(Error('Shared reviews changed after the backup import was prepared. Review the cloud conflict before replacing records.'),{code:'tracker/conflict'});
    transaction.set(reviewRef,{format:2,revision:current.revision+1,epoch:marker,payload:await vault.encrypt('reviews:'+family.ownerUid,restore.values),updatedBy:user.uid,updatedAt:serverTimestamp()});
  }
  async function saveReviews(patch){
    let observed=-1;
    for(let attempt=0;attempt<4;attempt++){
      try{return await runTransaction(db,async transaction=>{
        assertAccess();if(!family.canEdit)throw Error('Viewer access cannot change reviews.');
        const current=await decodeReviews(await transaction.get(reviewRef));observed=current.revision;
        if(patch.some(p=>p.epoch!==current.epoch))throw Object.assign(Error('Shared reviews were reset. Export pending changes, then reload reviews.'),{code:'tracker/review-conflict'});
        const values=applyReviewPatch(current.values,patch),revision=current.revision+1;
        transaction.set(reviewRef,{format:2,revision,epoch:current.epoch,payload:await vault.encrypt('reviews:'+family.ownerUid,values),updatedBy:user.uid,updatedAt:serverTimestamp()});return {values,revision,epoch:current.epoch};
      });}catch(error){
        if(!/permission-denied|aborted/.test(error.code||'')||attempt===3)throw error;
        assertAccess();const latest=await decodeReviews(await getDocFromServer(reviewRef));if(!family.canEdit||latest.revision<=observed)throw error;
      }
    }
  }
  async function resetReviews(marker){
    let observed=-1;for(let attempt=0;attempt<4;attempt++){
      try{return await runTransaction(db,async transaction=>{assertAccess();if(!family.canManage)throw Error('Only the owner can clear shared reviews.');const current=await decodeReviews(await transaction.get(reviewRef));observed=current.revision;if(current.epoch===marker)return current;const revision=current.revision+1;transaction.set(reviewRef,{format:2,revision,epoch:marker,payload:await vault.encrypt('reviews:'+family.ownerUid,{}),updatedBy:user.uid,updatedAt:serverTimestamp()});return {values:{},revision,epoch:marker};});}
      catch(error){if(!/permission-denied|aborted/.test(error.code||'')||attempt===3)throw error;assertAccess();const latest=await decodeReviews(await getDocFromServer(reviewRef));if(!family.canManage||latest.revision<=observed)throw error;}
    }
  }
  const reviewApi={subscribe:(next,error)=>onSnapshot(reviewRef,{includeMetadataChanges:true},snapshot=>{decodeReviews(snapshot).then(next,error);},error),load:async()=>decodeReviews(await getDocFromServer(reviewRef)),save:saveReviews,reset:resetReviews};
  window.financeCloudResolve();
  Promise.resolve(window.trackerReady).then(async()=>{await installReviewSync(reviewApi);installFinanceWorkbench();installExperience();installAttention();installRecordSearch();installCashFlow();installFinanceInsights();installMobileExperience();installFilterPopovers();}).catch(error=>console.warn('Workbench unavailable',error));
  Promise.resolve(window.trackerReady).then(installRecordRecovery).catch(error=>console.warn('Record recovery unavailable',error));
  Promise.resolve(window.trackerReady).then(installWorkProtection).catch(error=>console.warn('Draft recovery unavailable',error));
  Promise.resolve(window.trackerReady).then(()=>installCloudNotice((next,error)=>onSnapshot(doc(db,'users/'+family.ownerUid+'/tracker/current'),snapshot=>next(snapshot.exists()?snapshot.data():null),error))).catch(error=>console.warn('Live cloud notice unavailable',error));
  Promise.resolve(window.trackerReady).then(()=>initializeAccountPhoto({
    uid:user.uid,
    googlePhotoURL:user.photoURL || '',
    load:async()=>{const snapshot=await getDocFromServer(doc(db,'users/'+user.uid+'/profile/photo'));if(!snapshot.exists())return '';const data=snapshot.data();if(data.format!==2)throw Error('Old photo is not encrypted. Remove it before saving a new one.');return vault.decrypt('photo:'+user.uid,data.image);},
    save:async image=>{if(auth.currentUser?.uid!==user.uid)throw new Error('The signed-in account changed. Reload.');const batch=writeBatch(db);batch.set(doc(db,'users/'+user.uid+'/profile/photo'),{format:2,image:await vault.encrypt('photo:'+user.uid,image)});await batch.commit();}
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

