// Recovery-key email is an explicit, owner-authorized Gmail send. Never store the
// key or an OAuth access token in Firestore, browser storage, or console logs.
const utf8=new TextEncoder();
const base64url=bytes=>{
  let raw='';for(let i=0;i<bytes.length;i+=8192)raw+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(raw).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
};
export function makeRecoveryMessage(email,recoveryKey){
  const recipient=String(email||'').trim().toLowerCase();
  if(!/^[^\s@\r\n]+@[^\s@\r\n]+\.[^\s@\r\n]+$/.test(recipient)||recipient.length>254)throw Error('A valid Google account email is required.');
  const key=String(recoveryKey||'').trim().toUpperCase();
  if(!/^PFT(?:-[A-F0-9]{8}){8}$/.test(key))throw Error('The recovery key is invalid.');
  const message=[
    'From: '+recipient,'To: '+recipient,
    'Subject: Personal Finance Tracker - private recovery key',
    'MIME-Version: 1.0','Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64','',''
  ].join('\r\n');
  const body='Personal Finance Tracker recovery key\n\n'+key+
    '\n\nThis key can unlock your encrypted financial records. Anyone with access to this email can potentially recover your tracker. Save an offline copy in a secure place, and protect your inbox with two-factor authentication.\n\nIf you did not request this email, review your Google account security.';
  // A separately encoded MIME body avoids header injection and supports Unicode.
  let base64='';const bytes=utf8.encode(body);
  for(let i=0;i<bytes.length;i+=8192)base64+=String.fromCharCode(...bytes.subarray(i,i+8192));
  const encoded=btoa(base64).match(/.{1,76}/g).join('\r\n');
  return base64url(utf8.encode(message+encoded+'\r\n'));
}
export async function sendRecoveryEmail(accessToken,email,recoveryKey,sendRequest=fetch){
  if(typeof accessToken!=='string'||accessToken.length<8)throw Error('Gmail authorization is required.');
  const raw=makeRecoveryMessage(email,recoveryKey);
  let response;
  try{response=await sendRequest('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{
    method:'POST',credentials:'omit',cache:'no-store',
    headers:{Authorization:'Bearer '+accessToken,'Content-Type':'application/json'},
    body:JSON.stringify({raw})
  });}catch(_){throw Error('Unable to reach Gmail. Check your connection and try again.');}
  if(!response.ok){
    if(response.status===401||response.status===403)throw Error('Gmail access was denied or is not configured. Enable Gmail API and approve the requested send-only permission.');
    throw Error('Gmail could not send the recovery email. No delivery was confirmed.');
  }
  const result=await response.json();
  if(typeof result?.id!=='string'||!result.id)throw Error('Gmail did not confirm sending the recovery email.');
  return true;
}
