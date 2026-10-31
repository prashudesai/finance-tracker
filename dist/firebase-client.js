import {installMobileExperience} from './mobile-experience.js';
import {installFilterPopovers} from './filter-popovers.js';
import {installFinanceInsights} from './finance-insights.js';
import {installCashFlow} from './cash-flow.js?v=86';
import {initializeApp} from './vendor/firebase-app.js';
import {initializeAuth,indexedDBLocalPersistence,browserLocalPersistence,browserSessionPersistence,browserPopupRedirectResolver,GoogleAuthProvider,onAuthStateChanged,signInWithPopup,signOut} from './vendor/firebase-auth.js';
import {getFirestore,doc,collection,query,where,getDocFromServer,setDoc,deleteDoc,writeBatch,runTransaction,onSnapshot,serverTimestamp} from './vendor/firebase-firestore.js';
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
import {publicFingerprint} from './vault-device-approval.js?v=1';
import {sendRecoveryEmail} from './recovery-email.js?v=1';
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
  const emailRecoveryKey=async recoveryKey=>{
    if(family.role!=='owner'||family.ownerUid!==user.uid||auth.currentUser?.uid!==user.uid)throw Error('Only the signed-in vault owner can email a recovery key.');
    const gmailProvider=new GoogleAuthProvider();
    gmailProvider.addScope('https://www.googleapis.com/auth/gmail.send');
    gmailProvider.setCustomParameters({prompt:'select_account consent'});
    let result;
    try{result=await signInWithPopup(auth,gmailProvider,browserPopupRedirectResolver);}
    catch(error){if(error?.code==='auth/popup-closed-by-user'||error?.code==='auth/cancelled-popup-request')throw Error('Gmail permission was cancelled. Your recovery key has not been emailed.');throw error;}
    if(result.user.uid!==user.uid||result.user.email?.toLowerCase()!==user.email?.toLowerCase()){
      throw Error('The Google account selected for Gmail does not match your tracker account. Nothing was sent.');
    }
    const credential=GoogleAuthProvider.credentialFromResult(result);
    if(!credential?.accessToken)throw Error('Gmail did not grant permission to send email.');
    await sendRecoveryEmail(credential.accessToken,user.email,recoveryKey);
  };
  const api={
    currentUid:()=>auth.currentUser?.uid,
    emailRecoveryKey,
    online:()=>navigator.onLine,
    get:async path=>{const snapshot=await getDocFromServer(doc(db,path));return snapshot.exists()?snapshot.data():null;},
    create:async(path,data)=>{assertAccess();if(family.role!=='owner')throw Error('Only the owner can create a vault.');await runTransaction(db,async tx=>{const ref=doc(db,path);if((await tx.get(ref)).exists())throw Error('The vault already exists. Reload.');tx.set(ref,data);});},
    rotate:async(path,previous,next)=>{assertAccess();if(family.role!=='owner')throw Error('Only the owner can reset the vault passphrase.');await runTransaction(db,async tx=>{const ref=doc(db,path),snapshot=await tx.get(ref);if(!snapshot.exists()||snapshot.data().wrapped!==previous.wrapped)throw Error('Vault settings changed on another device. Reload.');tx.set(ref,next);});return next;},
    createPair:async(owner,id,data)=>{assertAccess();if(owner!==family.ownerUid)throw Error('Wrong tracker.');await runTransaction(db,async tx=>{const ref=doc(db,`users/${owner}/vaultInvites/${id}`);if((await tx.get(ref)).exists())throw Error('Pairing code already exists.');tx.set(ref,data);});},
    readPair:async(owner,id)=>{assertAccess();if(owner!==family.ownerUid)throw Error('Wrong tracker.');return api.get(`users/${owner}/vaultInvites/${id}`);},
    createDeviceRequest:async(id,request)=>{
      assertAccess();if(auth.currentUser?.uid!==user.uid)throw Error('Sign in to request a device approval.');
      await setDoc(doc(db,`users/${family.ownerUid}/vaultRequests/${id}`),{
        ...request,createdAt:serverTimestamp(),expiresAt:new Date(Date.now()+300000)
      });
    },
    getDeviceRequest:async id=>{
      assertAccess();const snapshot=await getDocFromServer(doc(db,`users/${family.ownerUid}/vaultRequests/${id}`));
      return snapshot.exists()?snapshot.data():null;
    },
    removeDeviceRequest:async id=>{
      assertAccess();await deleteDoc(doc(db,`users/${family.ownerUid}/vaultRequests/${id}`));
    },
    watchDeviceRequests:callback=>{
      assertAccess();if(family.role!=='owner'||family.ownerUid!==user.uid)throw Error('Only the owner can approve devices.');
      return onSnapshot(query(collection(db,`users/${family.ownerUid}/vaultRequests`),where('status','==','pending')),callback,error=>console.warn('Device approval requests unavailable',error));
    },
    decideDeviceRequest:async(id,expected,approval)=>{
      assertAccess();if(family.role!=='owner'||family.ownerUid!==user.uid||auth.currentUser?.uid!==user.uid)throw Error('Only the signed-in tracker owner can approve devices.');
      await runTransaction(db,async transaction=>{
        const ref=doc(db,`users/${family.ownerUid}/vaultRequests/${id}`),snap=await transaction.get(ref),current=snap.exists()?snap.data():null;
        if(!current||current.status!=='pending'||current.publicKey!==expected.publicKey||current.requesterUid!==expected.requesterUid||current.expiresAt?.toMillis()<=Date.now())throw Error('This device approval request expired or changed.');
        transaction.update(ref,{status:approval?'approved':'denied',decidedAt:serverTimestamp(),...(approval||{})});
      });
    },
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
  let vault;try{vault=await openVault(api,family.ownerUid,family.role,user.uid,user.email||'');}catch(error){lock(error);return;}
  const pairPanel=document.getElementById('settingsAccountPanel');
  if(pairPanel){
    const section=document.createElement('section');section.className='cloud-vault-form vault-settings';
    const heading=document.createElement('h3');heading.textContent='Encrypted vault';
    const info=document.createElement('p');info.textContent='Approve signed-in devices using an unlocked desktop. You can still use a private pairing code if needed.';
    section.append(heading,info);
    if(family.role==='owner'&&family.ownerUid===user.uid){
      const requestsHeading=document.createElement('h4');requestsHeading.textContent='Device approval requests';
      const requestsList=document.createElement('div');requestsList.className='vault-approval-list';requestsList.textContent='No pending requests.';
      section.append(requestsHeading,requestsList);
      const notification=document.createElement('aside');notification.className='vault-approval-notification';notification.setAttribute('role','region');notification.setAttribute('aria-label','New device approval requests');notification.hidden=true;
      const notificationHeading=document.createElement('h3');notificationHeading.textContent='New device approval requested';
      const notificationList=document.createElement('div');notificationList.className='vault-approval-list';
      notification.append(notificationHeading,notificationList);document.body.append(notification);
      let renderSerial=0;
      const render=async snapshot=>{
        const serial=++renderSerial;
        const requests=snapshot.docs.map(docSnap=>({id:docSnap.id,...docSnap.data()})).filter(request=>request.expiresAt?.toMillis()>Date.now());
        const cards=[];
        for(const request of requests){
          const fingerprint=await publicFingerprint(request.publicKey).catch(()=> 'Unavailable');
          if(serial!==renderSerial)return;
          const card=document.createElement('div');card.className='vault-approval-card';
          const identity=document.createElement('strong');identity.textContent=request.requesterEmail||'Authorized family member';
          const label=document.createElement('p');label.textContent='Device: '+(request.deviceLabel||'New browser');
          const code=document.createElement('code');code.textContent='Security check: '+fingerprint;
          const actions=document.createElement('div');actions.className='vault-approval-actions';
          const approve=document.createElement('button');approve.type='button';approve.textContent='Approve';
          const deny=document.createElement('button');deny.type='button';deny.className='btn-secondary';deny.textContent='Deny';
          const status=document.createElement('p');status.setAttribute('role','status');
          const decide=async allow=>{
            if(allow&&!confirm('Approve the new device for '+request.requesterEmail+'? Check that its security check matches '+fingerprint+'.'))return;
            approve.disabled=true;deny.disabled=true;
            try{
              const response=allow?await vault.approveRequest(request.id,request):null;
              await api.decideDeviceRequest(request.id,request,response);
              status.textContent=allow?'Approved. The new device can now unlock.':'Request denied.';
            }catch(error){status.textContent=friendly(error);approve.disabled=false;deny.disabled=false;}
          };
          approve.onclick=()=>decide(true);deny.onclick=()=>decide(false);
          actions.append(approve,deny);card.append(identity,label,code,actions,status);cards.push(card);
        }
        if(serial!==renderSerial)return;
        requestsList.textContent=cards.length?cards.length+' pending request(s). Approve or deny from the on-screen notification.':'No pending requests.';
        if(cards.length){notificationList.replaceChildren(...cards);notification.hidden=false;}
        else{notificationList.replaceChildren();notification.hidden=true;}
      };
      api.watchDeviceRequests(snapshot=>render(snapshot).catch(error=>console.warn('Approval list unavailable',error)));
    }
    const backup=document.createElement('details');backup.className='vault-code-fallback';
    const summary=document.createElement('summary');summary.textContent='Use a pairing code instead';
    const codeButton=document.createElement('button');codeButton.type='button';codeButton.textContent='Generate a pairing code';
    const code=document.createElement('code');code.hidden=true;
    codeButton.onclick=async()=>{codeButton.disabled=true;try{code.textContent=await vault.approveDevice();code.hidden=false;}catch(error){code.textContent=friendly(error);code.hidden=false;}finally{codeButton.disabled=false;}};
    const note=document.createElement('p');note.textContent='Share this private code only with the person signing in. It expires in five minutes.';
    backup.append(summary,note,codeButton,code);section.append(backup);
    if(family.role==='owner'){
      const renew=document.createElement('button');renew.type='button';renew.textContent='Replace lost recovery key';
      const recoveryCode=document.createElement('code');recoveryCode.hidden=true;
      const emailKey=document.createElement('button');emailKey.type='button';emailKey.textContent='Email to myself (Gmail)';emailKey.hidden=true;
      const emailStatus=document.createElement('p');emailStatus.setAttribute('role','status');
      renew.onclick=async()=>{
        if(!confirm('Replace the recovery key? The previous recovery key will stop working. Save the new key immediately.'))return;
        renew.disabled=true;
        try{const value=await vault.renewRecovery();recoveryCode.textContent=value;recoveryCode.hidden=false;
          emailKey.hidden=false;
          emailKey.onclick=async()=>{emailKey.disabled=true;emailStatus.textContent='Requesting Gmail permission…';try{await emailRecoveryKey(value);emailStatus.textContent='Gmail accepted your recovery-key email. Check your inbox and spam folder.';}catch(error){emailStatus.textContent=friendly(error);}finally{emailKey.disabled=false;}};
        }catch(error){recoveryCode.textContent=friendly(error);recoveryCode.hidden=false;}finally{renew.disabled=false;}
      };
      section.append(renew,recoveryCode,emailKey,emailStatus);
    }
    pairPanel.append(section);
  }
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

