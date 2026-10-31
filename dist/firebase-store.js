// Immutable, per-user snapshots. A revision-checked pointer publishes a complete
// snapshot atomically; a large import never becomes partially visible.
const CHUNK_BYTES = 180000;
const MAX_PLAIN_BYTES = 30 * 1024 * 1024;
const MAX_BYTES = 42 * 1024 * 1024; // Base64-wrapped AES-GCM ciphertext.
function encode(bytes) {
  let result = '';
  for (let i=0; i<bytes.length; i+=8192) result += String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(result);
}
function decode(text) { return Uint8Array.from(atob(text), c=>c.charCodeAt(0)); }
async function digest(bytes) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
}
export function createCloudStore(api, uid, actorUid=uid, vault) {
  if (!uid || !/^[A-Za-z0-9_-]+$/.test(uid)) throw new Error('Invalid account identifier.');
  const root = `users/${uid}`;
  const metaPath = `${root}/tracker/current`;
  let revision = 0, updatedAt = null;
  let loaded = false;
  let busy = false;
  function assertUser() { if (api.currentUid() !== actorUid) throw new Error('Your signed-in account changed. Reload before editing.'); }
  async function removeSnapshot(snapshot) {
    if(api.canCleanup===false)return;
    if (!snapshot?.generation || !Number.isInteger(snapshot.count)) return;
    // A second device may publish while this save is cleaning up. Never delete
    // chunks still named by the live pointer, including its recovery generation.
    const live=await api.get(metaPath);
    if(snapshot.generation===live?.generation || snapshot.generation===live?.previous?.generation)return;
    const paths=Array.from({length:snapshot.count},(_,i)=>`${root}/snapshots/${snapshot.generation}/chunks/${i}`);
    for(let i=0;i<paths.length;i+=400) await api.remove(paths.slice(i,i+400));
  }
  async function load() {
    assertUser();
    for(let attempt=0;attempt<3;attempt++) {
      const meta=await api.get(metaPath);assertUser();
      if (!meta) { revision=0;updatedAt=null;loaded=true;return null; }
      if(meta.format!==2 || !Number.isInteger(meta.revision) || meta.revision<1 || !/^[\w-]+$/.test(meta.generation) || !Number.isInteger(meta.count) || meta.count<1 || meta.count>240) throw new Error('This snapshot is not encrypted or its metadata is invalid. Delete old cloud data before opening the vault.');
      // Bound parallel reads to four; retain chunk order and existing digest checks.
      const chunks=[];
      for(let i=0;i<meta.count;i+=4){
        assertUser();
        const batch=await Promise.all(Array.from({length:Math.min(4,meta.count-i)},(_,j)=>api.get(`${root}/snapshots/${meta.generation}/chunks/${i+j}`)));
        assertUser();chunks.push(...batch);
      }
      if(chunks.some(c=>!c || typeof c.payload!=='string')) {
        const current=await api.get(metaPath);
        if(current?.generation!==meta.generation)continue;
        throw new Error('The cloud snapshot is incomplete. Keep your working desktop open and export its JSON backup before repairing cloud data.');
      }
      const parts=chunks.map(c=>decode(c.payload));
      const length=parts.reduce((sum,p)=>sum+p.length,0);
      if(length>MAX_BYTES)throw new Error('Cloud snapshot exceeds the supported size.');
      const bytes=new Uint8Array(length);let offset=0;
      for(const part of parts){bytes.set(part,offset);offset+=part.length;}
      if(await digest(bytes)!==meta.digest)throw new Error('Cloud snapshot verification failed. Records were not loaded.');
      const current=await api.get(metaPath);
      if(current?.generation!==meta.generation)continue;
      const envelope=await vault.decrypt('tracker:'+uid,new TextDecoder('utf-8',{fatal:true}).decode(bytes));
      if(!envelope || typeof envelope.data!=='object' || !envelope.data)throw new Error('Invalid tracker snapshot.');
      assertUser();revision=meta.revision;updatedAt=meta.updatedAt||null;loaded=true;
      return envelope;
    }
    throw new Error('Another device is saving repeatedly. Please reload in a moment.');
  }
  async function save(envelope, options={}) {
    assertUser();
    if(!loaded)throw new Error('Load this account before saving.');
    if(busy)throw new Error('A cloud save is already in progress.');
    if(!api.online())throw new Error('You are offline. Export your changes or reconnect and retry.');
    busy=true;
    const generation=crypto.randomUUID();let count=0,published=false,publishAttempted=false;
    try {
      if(new TextEncoder().encode(JSON.stringify(envelope)).length>MAX_PLAIN_BYTES)throw new Error('Backup is larger than the supported 30 MB limit.');
      const bytes=new TextEncoder().encode(await vault.encrypt('tracker:'+uid,envelope));
      if(bytes.length>MAX_BYTES)throw new Error('Encrypted backup exceeds the supported size.');
      const records=[];
      for(let i=0;i<bytes.length;i+=CHUNK_BYTES)records.push({path:`${root}/snapshots/${generation}/chunks/${records.length}`,data:{payload:encode(bytes.subarray(i,i+CHUNK_BYTES))}});
      count=records.length;
      for(let i=0;i<records.length;i+=400) { assertUser(); await api.put(records.slice(i,i+400)); }
      const hash=await digest(bytes);
      const mutationProof=await vault.proof('tracker:'+uid,envelope);
      const expected=revision;
      assertUser();publishAttempted=true;
      const savedAt=new Date().toISOString();
      const old=await api.publish(metaPath,expected,{format:2,mutationId:envelope.mutationId||generation,mutationProof,revision:expected+1,generation,count,digest:hash,resetHistory:options.clearHistory===true,updatedAt:savedAt,...(envelope.reviewRestore?{reviewRestore:envelope.reviewRestore}:{})});
      published=true;
      if(old?.acknowledged){revision=old.acknowledged.revision;updatedAt=old.acknowledged.updatedAt||null;try{await removeSnapshot({generation,count});}catch(_){}return revision;}
      revision=expected+1;updatedAt=savedAt;
      if(!old){try{const pointer=await api.get(metaPath);if(pointer?.generation!==generation)await removeSnapshot({generation,count});}catch(_) {}}
      // Keep the immediately preceding snapshot as a recovery generation.
      try { await removeSnapshot(old?.previous); if(options.clearHistory)await removeSnapshot(old); } catch(_) { /* Cleanup may retry later; published data is safe. */ }
      return revision;
    } finally {
      busy=false;
      if(!published) { try {const pointer=publishAttempted?await api.get(metaPath):null;if(pointer?.generation!==generation)await removeSnapshot({generation,count});}catch(_){} }
    }
  }
  return {uid,load,save,resume(value){assertUser();if(!Number.isInteger(value)||value<0)throw new Error('Invalid cached revision');revision=value;loaded=true;},get revision(){return revision;},get updatedAt(){return updatedAt;}};
}

