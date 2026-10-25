import {collection,query,where,getDocsFromServer,doc,getDocFromServer,setDoc,deleteDoc,runTransaction,onSnapshot} from './vendor/firebase-firestore.js';

export function normalizeFamilyEmail(value){
  const email=String(value||'').trim().toLowerCase();
  if(email.length>254||! /^[^\s/@]+@[^\s/@]+\.[^\s/@]+$/.test(email))throw new Error('Enter a valid Google email address.');
  return email;
}
export function inviteDocumentId(ownerUid,email){
  if(!/^[A-Za-z0-9_-]+$/.test(ownerUid))throw new Error('Invalid tracker owner.');
  return ownerUid+'~'+normalizeFamilyEmail(email);
}
export function familyPermissions(role){return {canEdit:role==='owner'||role==='editor',canManage:role==='owner'};}

export async function initializeFamilyAccess(db,user,lock){
  if(!user.emailVerified)throw new Error('Use a verified Google account to open the tracker.');
  const email=normalizeFamilyEmail(user.email),key='pftActiveTracker:'+user.uid;
  const status=document.getElementById('familyAccessStatus'),selector=document.getElementById('familyTrackerSelect');
  let incoming=[],members=[],listError='',selected=user.uid;
  try{selected=localStorage.getItem(key)||user.uid;}catch(_){}
  async function reloadLists(){
    if(!navigator.onLine)throw new Error('Connect to the internet to check family invitations.');
    const [received,owned]=await Promise.all([
      getDocsFromServer(query(collection(db,'familyInvites'),where('email','==',email))),
      getDocsFromServer(query(collection(db,'familyInvites'),where('ownerUid','==',user.uid)))
    ]);
    incoming=received.docs.map(d=>({id:d.id,...d.data()}));members=owned.docs.map(d=>({id:d.id,...d.data()}));
  }
  try{await reloadLists();}catch(e){listError=e.message;}
  const own={ownerUid:user.uid,ownerEmail:email,role:'owner',status:'accepted'};
  let active=own;
  if(selected!==user.uid){
    // A shared workspace never opens from cached permissions.
    let snapshot;try{snapshot=await getDocFromServer(doc(db,'familyInvites',inviteDocumentId(selected,email)));}catch(e){if(e.code==='permission-denied'){try{localStorage.removeItem(key);}catch(_){}}throw new Error('Could not verify shared access. Connect to the internet and reload. If access was revoked, reload again to open your own tracker.');}
    const invitation=snapshot.exists()?snapshot.data():null;
    if(!invitation||invitation.ownerUid!==selected||invitation.email!==email||invitation.status!=='accepted'||!['viewer','editor'].includes(invitation.role)){
      try{localStorage.removeItem(key);}catch(_){}
      throw new Error('Family access is unavailable. Reload to open your own tracker, or ask the owner for a new invitation.');
    }
    active=invitation;
  }else if(incoming.length&&(()=>{try{return !localStorage.getItem(key);}catch(_){return true;}})()){
    // New invited users choose the shared tracker before their personal setup.
    active=await new Promise(resolve=>{
      const gate=document.getElementById('cloudGate'),card=gate.querySelector('.cloud-login-card');
      document.body.classList.remove('cloud-loading');document.getElementById('cloudLogin').hidden=true;
      document.getElementById('cloudMessage').textContent='Choose the tracker you want to open.';
      const choices=document.createElement('div');card.append(choices);
      const add=(label,invite)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=async()=>{b.disabled=true;try{if(invite.role!=='owner')await accept(invite);try{localStorage.setItem(key,invite.ownerUid);}catch(_){}choices.remove();document.body.classList.add('cloud-loading');resolve({...invite,status:'accepted'});}catch(e){b.disabled=false;document.getElementById('cloudMessage').textContent=e.message;}};choices.append(b);};
      for(const invite of incoming.filter(i=>['pending','accepted'].includes(i.status)&&['viewer','editor'].includes(i.role)))add((invite.status==='pending'?'Accept & open ':'Open ')+invite.ownerEmail+' · '+invite.role,invite);
      add('Open my own tracker',own);
    });
  }
  async function accept(invite){
    await runTransaction(db,async tx=>{
      const ref=doc(db,'familyInvites',inviteDocumentId(invite.ownerUid,email)),snap=await tx.get(ref),current=snap.exists()?snap.data():null;
      if(!current||current.email!==email||!['pending','accepted'].includes(current.status))throw new Error('This invitation is no longer available.');
      if(current.status==='pending')tx.update(ref,{status:'accepted'});
    });
  }
  async function switchTo(ownerUid){
    if(ownerUid===active.ownerUid)return;
    await window.financeBridge?.settle();
    if(window.financeBridge?.dirty()||await window.financeBridge?.pendingSync())throw new Error('Sync your pending changes before switching trackers.');
    if(ownerUid!==user.uid){const invite=incoming.find(i=>i.ownerUid===ownerUid);if(!invite)throw new Error('Refresh the invitation list and try again.');await accept(invite);}
    try{localStorage.setItem(key,ownerUid);}catch(_){throw new Error('Browser storage is unavailable.');}
    location.reload();
  }
  function element(tag,text){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;}
  function render(){
    selector.replaceChildren();const options=[own,...incoming.filter(i=>['pending','accepted'].includes(i.status))];
    if(!options.some(i=>i.ownerUid===active.ownerUid))options.push(active);
    for(const item of options){const option=element('option',item.role==='owner'?'My family tracker':item.ownerEmail+' · '+item.role+(item.status==='pending'?' · Invitation':''));option.value=item.ownerUid;selector.append(option);}selector.value=active.ownerUid;
    document.getElementById('familyOwnerControls').hidden=active.role!=='owner';
    document.getElementById('familyAccessRole').textContent=active.role==='owner'?'Owner · You manage this tracker':active.role==='editor'?'Editor · '+active.ownerEmail+'’s tracker':'Viewer · Read-only access to '+active.ownerEmail+'’s tracker';
    const list=document.getElementById('familyMemberAccessList');list.replaceChildren();
    if(active.role==='owner'){
      if(!members.length)list.append(element('p','No additional members have access.'));
      for(const member of members){
        const row=element('div');row.className='family-access-row';row.append(element('span',member.email+' · '+member.status));
        const role=element('select');role.setAttribute('aria-label','Role for '+member.email);for(const value of ['viewer','editor']){const option=element('option',value==='viewer'?'Viewer':'Editor');option.value=value;role.append(option);}role.value=member.role;
        role.onchange=async()=>{role.disabled=true;try{await grant(member.email,role.value);status.textContent='Role updated.';}catch(e){status.textContent=e.message;}finally{role.disabled=false;}};row.append(role);
        const revoke=element('button','Revoke access');revoke.type='button';revoke.className='btn-secondary';revoke.onclick=async()=>{if(!confirm('Revoke '+member.email+'’s access to this tracker?'))return;revoke.disabled=true;try{await deleteDoc(doc(db,'familyInvites',member.id));await reloadLists();render();status.textContent='Access revoked.';}catch(e){status.textContent=e.message;revoke.disabled=false;}};row.append(revoke);list.append(row);
      }
    }
    if(listError)status.textContent='Family Access could not refresh: '+listError;
  }
  async function grant(value,role){
    if(active.role!=='owner')throw new Error('Only the owner can manage access.');
    if(!navigator.onLine)throw new Error('Connect to the internet to change access.');
    const to=normalizeFamilyEmail(value);if(to===email)throw new Error('You already own this tracker.');
    if(!['viewer','editor'].includes(role))throw new Error('Choose Viewer or Editor.');
    const ref=doc(db,'familyInvites',inviteDocumentId(user.uid,to));
    await runTransaction(db,async tx=>{const old=await tx.get(ref);tx.set(ref,{ownerUid:user.uid,ownerEmail:email,email:to,role,status:old.exists()?old.data().status:'pending'});});
    await reloadLists();render();
  }
  selector.onchange=()=>switchTo(selector.value).catch(e=>{selector.value=active.ownerUid;status.textContent=e.message;});
  document.getElementById('familyAccessRefresh').onclick=async()=>{try{listError='';await reloadLists();render();status.textContent='Family Access refreshed.';}catch(e){status.textContent=e.message;}};
  document.getElementById('familyInviteForm').onsubmit=async event=>{event.preventDefault();const button=document.getElementById('familyInviteSubmit');button.disabled=true;try{await grant(document.getElementById('familyInviteEmail').value,document.getElementById('familyInviteRole').value);document.getElementById('familyInviteEmail').value='';status.textContent='Invitation created. Ask this member to open the same website and sign in with that Google email. No email message is sent.';}catch(e){status.textContent=e.message;}finally{button.disabled=false;}};
  render();
  let accessValid=true;
  if(active.role!=='owner'){
    onSnapshot(doc(db,'familyInvites',inviteDocumentId(active.ownerUid,email)),snapshot=>{
      const latest=snapshot.exists()?snapshot.data():null;
      if(!latest||latest.status!=='accepted'||latest.role!==active.role){accessValid=false;lock(new Error('Your family access changed. Reload to check your current role. Pending device edits remain saved.'));}
    },()=>{accessValid=false;lock(new Error('Unable to verify family access. Reconnect and reload.'));});
  }
  return {ownerUid:active.ownerUid,role:active.role,actorUid:user.uid,ownerEmail:active.ownerEmail,...familyPermissions(active.role),accessValid:()=>accessValid};
}
