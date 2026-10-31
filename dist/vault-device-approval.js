// One-time ECDH key exchange for an explicitly approved, already-authorized device.
// Firestore receives only ephemeral public keys and an authenticated AES-GCM ciphertext.
const encoder=new TextEncoder();
const toBase64=bytes=>{let value='';for(const byte of bytes)value+=String.fromCharCode(byte);return btoa(value);};
const fromBase64=value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
const hex=bytes=>[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
const scope=(owner,id,uid)=>encoder.encode('pft-device-approval-v1:'+owner+':'+id+':'+uid);
const publicExport=key=>crypto.subtle.exportKey('spki',key).then(bytes=>toBase64(new Uint8Array(bytes)));
async function importPublic(text){
  if(typeof text!=='string'||text.length>256||!/^[A-Za-z0-9+/=]+$/.test(text))throw Error('Invalid device request public key.');
  return crypto.subtle.importKey('spki',fromBase64(text),{name:'ECDH',namedCurve:'P-256'},true,[]);
}
async function secret(privateKey,publicText,usage){
  return crypto.subtle.deriveKey({name:'ECDH',public:await importPublic(publicText)},privateKey,{name:'AES-GCM',length:256},false,[usage]);
}
export async function publicFingerprint(text){
  const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',fromBase64(text)));
  return hex(digest.slice(0,4)).toUpperCase();
}
export async function newDeviceRequest(ownerUid,actorUid,email,label){
  const keys=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},false,['deriveKey']);
  const publicKey=await publicExport(keys.publicKey);
  const id=hex(crypto.getRandomValues(new Uint8Array(12)));
  return {id,privateKey:keys.privateKey,fingerprint:await publicFingerprint(publicKey),record:{
    format:1,requesterUid:actorUid,requesterEmail:String(email).trim().toLowerCase(),
    deviceLabel:String(label||'New device').slice(0,80),publicKey,status:'pending'
  }};
}
export async function encryptApproval(raw,ownerUid,id,request){
  if(!(raw instanceof Uint8Array)||raw.length!==32||!/^([0-9a-f]{24})$/.test(id)||request.status!=='pending')throw Error('Invalid device approval.');
  const keys=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},false,['deriveKey']);
  const wrapping=await secret(keys.privateKey,request.publicKey,'encrypt');
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const payload=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:scope(ownerUid,id,request.requesterUid)},wrapping,raw));
  return {responseKey:await publicExport(keys.publicKey),payload:toBase64(new Uint8Array([...iv,...payload]))};
}
export async function decryptApproval(privateKey,ownerUid,id,request){
  if(request.status!=='approved'||typeof request.payload!=='string'||request.payload.length>256)throw Error('Approval is not available.');
  const wrapping=await secret(privateKey,request.responseKey,'decrypt');
  const bytes=fromBase64(request.payload);
  if(bytes.length<29)throw Error('The approval response is invalid.');
  const raw=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.slice(0,12),additionalData:scope(ownerUid,id,request.requesterUid)},wrapping,bytes.slice(12)));
  if(raw.length!==32)throw Error('Invalid shared vault key.');
  return raw;
}
