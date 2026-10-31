// Browser-only encryption. Firestore never receives a passphrase, recovery key, or data key.
const enc=new TextEncoder(),dec=new TextDecoder('utf-8',{fatal:true}),ITERATIONS=600000;
const b64=bytes=>{let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);};
const unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const makeRecovery=()=>{const raw=crypto.getRandomValues(new Uint8Array(32));const hex=[...raw].map(b=>b.toString(16).padStart(2,'0')).join('').toUpperCase();return {raw,display:'PFT-'+hex.match(/.{8}/g).join('-')};};
function parseRecovery(value){const hex=value.trim().replace(/^PFT-/i,'').replaceAll('-','');if(!/^[0-9a-f]{64}$/i.test(hex))throw Error('Enter the complete recovery key.');return Uint8Array.from(hex.match(/../g),pair=>parseInt(pair,16));}
async function passKey(pass,salt){const input=await crypto.subtle.importKey('raw',enc.encode(pass),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt:unb64(salt),iterations:ITERATIONS,hash:'SHA-256'},input,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);}
async function recoveryKey(raw){return crypto.subtle.importKey('raw',raw,{name:'AES-GCM'},false,['encrypt','decrypt']);}
async function seal(key,scope,bytes){const iv=crypto.getRandomValues(new Uint8Array(12));const cipher=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc.encode(scope)},key,bytes));const out=new Uint8Array(iv.length+cipher.length);out.set(iv);out.set(cipher,iv.length);return b64(out);}
async function unseal(key,scope,text){const bytes=unb64(text);if(bytes.length<29)throw Error('Encrypted cloud record is invalid.');return new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.slice(0,12),additionalData:enc.encode(scope)},key,bytes.slice(12)));}
export function createCipher(key,raw){return {encrypt:async(scope,value)=>seal(key,scope,enc.encode(JSON.stringify(value))),decrypt:async(scope,value)=>JSON.parse(dec.decode(await unseal(key,scope,value))),
  proof:async(scope,value)=>{const mac=await crypto.subtle.importKey('raw',raw,{name:'HMAC',hash:'SHA-256'},false,['sign']);return b64(new Uint8Array(await crypto.subtle.sign('HMAC',mac,enc.encode(scope+'\0'+JSON.stringify(value)))));}};}
function dialog({title,note,confirm=false,recovery=false,pairing=false,remember=false,allowPair=false,allowRecovery=false}){return new Promise(resolve=>{
  const gate=document.getElementById('cloudGate'),message=document.getElementById('cloudMessage');
  const form=document.createElement('form');form.className='cloud-vault-form';
  const heading=document.createElement('h2');heading.textContent=title;
  const description=document.createElement('p');description.textContent=note;
  const input=document.createElement('input');input.type=recovery||pairing?'text':'password';input.autocomplete=confirm?'new-password':'current-password';input.required=true;input.placeholder=pairing?'Device pairing code':recovery?'PFT recovery key':'Vault passphrase';input.setAttribute('aria-label',input.placeholder);
  const repeat=document.createElement('input');if(confirm){repeat.type='password';repeat.autocomplete='new-password';repeat.required=true;repeat.placeholder='Confirm passphrase';repeat.setAttribute('aria-label',repeat.placeholder);}
  const keep=document.createElement('input');keep.type='checkbox';const keepLabel=document.createElement('label');keepLabel.append(keep,' Remember this device');
  const submit=document.createElement('button');submit.type='submit';submit.textContent=confirm?'Continue':'Unlock';
  form.append(heading,description,input);if(confirm)form.append(repeat);if(remember)form.append(keepLabel);form.append(submit);
  if(allowPair){const pair=document.createElement('button');pair.type='button';pair.textContent='Approve with an existing device';pair.onclick=()=>{form.remove();resolve({pair:true});};form.append(pair);}
  if(allowRecovery){const forgot=document.createElement('button');forgot.type='button';forgot.textContent='Use recovery key';forgot.onclick=()=>{form.remove();resolve({recover:true});};form.append(forgot);}
  gate.append(form);message.textContent='Your vault must be unlocked to load records.';
  form.onsubmit=e=>{e.preventDefault();if(confirm&&(input.value.length<12||input.value!==repeat.value)){message.textContent='Use at least 12 characters and enter the same passphrase twice.';return;}const value={text:input.value,remember:keep.checked};form.remove();resolve(value);};
  input.focus();
});}
async function showRecovery(display,email){
  const gate=document.getElementById('cloudGate'),message=document.getElementById('cloudMessage');
  const form=document.createElement('form');form.className='cloud-vault-form';
  const heading=document.createElement('h2');heading.textContent='Save your recovery key';
  const note=document.createElement('p');note.textContent='Save this in your password manager or offline. It is shown only now. Without it, your passphrase, or an unlocked device, your data cannot be recovered.';
  const code=document.createElement('code');code.textContent=display;
  const label=document.createElement('label');const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.required=true;label.append(checkbox,' I saved this recovery key');
  const done=document.createElement('button');done.type='submit';done.textContent='I saved it';
  form.append(heading,note,code);if(email){const mail=document.createElement('a');mail.href='mailto:'+encodeURIComponent(email)+'?subject='+encodeURIComponent('Personal Finance Tracker recovery key')+'&body='+encodeURIComponent('Save this recovery key securely. Anyone who can read this email can recover your encrypted tracker.\n\n'+display);mail.textContent='Email to myself';form.append(mail);}form.append(label,done);gate.append(form);message.textContent='Save your recovery key before continuing.';
  await new Promise(resolve=>{form.onsubmit=e=>{e.preventDefault();form.remove();resolve();};});
}
function deviceStore(ownerUid,actorUid){
  const id=ownerUid+':'+actorUid;
  const open=()=>new Promise((resolve,reject)=>{const req=indexedDB.open('PFT-remembered-vault-v1',1);req.onupgradeneeded=()=>req.result.createObjectStore('keys');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
  const access=async(method,value)=>{const db=await open();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('keys',method==='get'?'readonly':'readwrite'),req=tx.objectStore('keys')[method](...(method==='get'?[id]:[value,id]));req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}finally{db.close();}};
  return {async recall(){try{const record=await access('get');if(!record)return null;const raw=await unseal(record.key,'device:'+id,record.wrapped);return raw;}catch(_){return null;}},async save(raw){const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);await access('put',{key,wrapped:await seal(key,'device:'+id,raw)});}};
}
export async function openVault(api,ownerUid,role,actorUid,email=''){
  const path=`users/${ownerUid}/vault/config`;
  const device=deviceStore(ownerUid,actorUid);
  let config=await api.get(path);
  const legacy=await api.get(`users/${ownerUid}/tracker/current`);
  if(legacy&&legacy.format!==2)throw Error('This account still has unencrypted cloud records. Delete the old tracker data before starting an encrypted vault.');
  if(!config&&role!=='owner')throw Error('The owner must create the encrypted vault first.');
  if(!config){
    const pass=await dialog({title:'Create your private vault',note:'Choose a passphrase you can use on every device. Share it privately with family members who need access.',confirm:true,remember:true});
    const raw=crypto.getRandomValues(new Uint8Array(32)),key=await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt','decrypt']);
    const salt=b64(crypto.getRandomValues(new Uint8Array(16))),recovery=makeRecovery();
    config={format:1,kdf:'PBKDF2-SHA256',iterations:ITERATIONS,salt,wrapped:await seal(await passKey(pass.text,salt),'vault-pass-v1',raw),recoveryWrapped:await seal(await recoveryKey(recovery.raw),'vault-recovery-v1',raw),verifier:await seal(key,'vault-check-v1',enc.encode('PFT vault v1'))};
    await api.create(path,config);await showRecovery(recovery.display,email);if(pass.remember)try{await device.save(raw);}catch(_){}return withPairing(key,raw,api,ownerUid);
  }
  if(config.format!==1||config.kdf!=='PBKDF2-SHA256'||config.iterations!==ITERATIONS||typeof config.salt!=='string')throw Error('Unsupported encrypted vault settings.');
  const remembered=await device.recall();if(remembered)try{const key=await crypto.subtle.importKey('raw',remembered,'AES-GCM',false,['encrypt','decrypt']);if(dec.decode(await unseal(key,'vault-check-v1',config.verifier))==='PFT vault v1')return withPairing(key,remembered,api,ownerUid);}catch(_){}
  for(;;){
    const pass=await dialog({title:'Unlock your private vault',note:'Enter the passphrase you created for this tracker. It stays on this device.',remember:true,allowPair:true,allowRecovery:role==='owner'});
    if(pass.pair){
      const entry=await dialog({title:'Approve this device',note:'On your unlocked device, open Settings and choose Approve a new device. Enter its code here.',pairing:true,remember:true});
      try{const raw=await receivePair(api,ownerUid,entry.text,config);if(entry.remember)try{await device.save(raw);}catch(_){}return withPairing(await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt','decrypt']),raw,api,ownerUid);}catch(_){document.getElementById('cloudMessage').textContent='Pairing code invalid or expired. Try again.';continue;}
    }
    if(pass.recover&&role==='owner'){
      const value=await dialog({title:'Use your recovery key',note:'Only the account owner can reset the shared passphrase.',recovery:true});
      try{
        const raw=await unseal(await recoveryKey(parseRecovery(value.text)),'vault-recovery-v1',config.recoveryWrapped);
        const next=await dialog({title:'Set a new passphrase',note:'Other family devices will need the new passphrase.',confirm:true,remember:true});
        const salt=b64(crypto.getRandomValues(new Uint8Array(16)));
        config=await api.rotate(path,config,{...config,salt,wrapped:await seal(await passKey(next.text,salt),'vault-pass-v1',raw)});
        if(next.remember)try{await device.save(raw);}catch(_){}
        return withPairing(await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt','decrypt']),raw,api,ownerUid);
      }catch(_){document.getElementById('cloudMessage').textContent='Recovery failed. Check the recovery key and try again.';}continue;
    }
    try{const raw=await unseal(await passKey(pass.text,config.salt),'vault-pass-v1',config.wrapped);if(pass.remember)try{await device.save(raw);}catch(_){}return withPairing(await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt','decrypt']),raw,api,ownerUid);}
    catch(_){document.getElementById('cloudMessage').textContent='Incorrect passphrase. Try again or use your recovery key.';}
  }
}
function withPairing(key,raw,api,ownerUid){return {...createCipher(key,raw),async renewRecovery(){
  const path=`users/${ownerUid}/vault/config`,previous=await api.get(path),recovery=makeRecovery();
  await api.rotate(path,previous,{...previous,recoveryWrapped:await seal(await recoveryKey(recovery.raw),'vault-recovery-v1',raw)});
  return recovery.display;
},async approveDevice(){
  const id=[...crypto.getRandomValues(new Uint8Array(8))].map(x=>x.toString(16).padStart(2,'0')).join('');
  const secret=crypto.getRandomValues(new Uint8Array(16)),hex=[...secret].map(x=>x.toString(16).padStart(2,'0')).join('');
  const payload=await seal(await recoveryKey(secret),'pair:'+ownerUid+':'+id,raw);
  await api.createPair(ownerUid,id,{format:1,payload,expiresAt:Date.now()+5*60*1000});
  return 'PFTPAIR-'+id.toUpperCase()+'-'+hex.toUpperCase();
}};}
async function receivePair(api,ownerUid,code,config){
  const match=/^PFTPAIR-([0-9a-f]{16})-([0-9a-f]{32})$/i.exec(code.trim());if(!match)throw Error('Invalid pairing code.');
  const id=match[1].toLowerCase(),secret=Uint8Array.from(match[2].match(/../g),pair=>parseInt(pair,16));
  const record=await api.readPair(ownerUid,id);if(!record||record.format!==1||record.expiresAt<Date.now()||record.expiresAt>Date.now()+5*60*1000)throw Error('Pairing code expired.');
  const raw=await unseal(await recoveryKey(secret),'pair:'+ownerUid+':'+id,record.payload);
  const key=await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt','decrypt']);
  if(dec.decode(await unseal(key,'vault-check-v1',config.verifier))!=='PFT vault v1')throw Error('Wrong vault.');
  return raw;
}
