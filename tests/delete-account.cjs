const assert=require('assert/strict');
const {validateDeletion,eraseTrackerAccount}=require('../functions/delete-account-service');
const now=2000000000,fail=(code,message)=>Object.assign(new Error(message),{code});
const request={auth:{uid:'signed-in-user',token:{email:'USER@example.test',email_verified:true,auth_time:now}},data:{confirmation:'DELETE MY ACCOUNT',uid:'someone-else'}};
assert.deepEqual(validateDeletion(request,now,fail),{uid:'signed-in-user',email:'user@example.test'});
for(const mutation of [r=>r.auth=null,r=>r.auth.token.email_verified=false,r=>r.auth.token.auth_time=now-301,r=>r.data.confirmation='DELETE']){const copy=structuredClone(request);mutation(copy);assert.throws(()=>validateDeletion(copy,now,fail));}
(async()=>{
 const events=[];const account={uid:'signed-in-user',email:'user@example.test'};
 assert.deepEqual(await eraseTrackerAccount(account,{blockAccount:async uid=>events.push(['block',uid]),removeInvitations:async(uid,email)=>events.push(['invites',uid,email]),removeOwnedTracker:async uid=>events.push(['records',uid]),removeLogin:async uid=>events.push(['auth',uid])}),{deleted:true});
 assert.deepEqual(events.map(e=>e[0]),['block','invites','records','auth']);assert(events.every(e=>e[1]==='signed-in-user'));
 let removedLogin=false;await assert.rejects(eraseTrackerAccount(account,{blockAccount:async()=>{},removeInvitations:async()=>{throw Error('Failure')},removeOwnedTracker:async()=>{},removeLogin:async()=>{removedLogin=true}}));assert.equal(removedLogin,false);
 console.log('PASS: signed-in identity, typed confirmation, recent login, deletion order and retry protection');
})();
