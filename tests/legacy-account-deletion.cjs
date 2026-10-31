'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../dist/firebase-client.js'),'utf8');
const vault=fs.readFileSync(require('node:path').join(__dirname,'../dist/finance-vault.js'),'utf8');
const service=require('../functions/delete-account-service.js');
assert.match(vault,/This account still has unencrypted cloud records/);
assert.match(source,/function offerLegacyAccountDeletion\(user,family,error\)/);
assert.match(source,/family\.role!=='owner'\|\|family\.ownerUid!==user\.uid/);
assert.match(source,/startsWith\(LEGACY_VAULT_ERROR\)/);
assert.match(source,/auth\.currentUser\?\.uid!==user\.uid/);
assert.match(source,/phrase\.value!=='DELETE MY ACCOUNT'/);
assert.match(source,/payload\.result\?\.deleted!==true/);
assert.match(source,/offerLegacyAccountDeletion\(user,family,error\)/);
const fail=(code,message)=>Object.assign(new Error(message),{code});
const now=1000;
const auth={uid:'owner',token:{email_verified:true,email:'owner@example.com',auth_time:now}};
assert.deepEqual(service.validateDeletion({auth,data:{confirmation:'DELETE MY ACCOUNT'}},now,fail),{uid:'owner',email:'owner@example.com'});
assert.throws(()=>service.validateDeletion({auth,data:{confirmation:'DELETE DASHBOARD'}},now,fail),{code:'invalid-argument'});
assert.throws(()=>service.validateDeletion({auth:{...auth,token:{...auth.token,auth_time:now-301}},data:{confirmation:'DELETE MY ACCOUNT'}},now,fail),{code:'failed-precondition'});
console.log('Legacy account deletion guard and server confirmation checks passed.');

// Exercise the blocked-screen interaction without Firebase or any real account.
const vm=require('node:vm');
const fragment=source.slice(source.indexOf('const LEGACY_VAULT_ERROR='),source.indexOf('onAuthStateChanged(auth,'));
assert.ok(fragment.includes('function offerLegacyAccountDeletion'));
class Element{
 constructor(tag){this.tag=tag;this.children=[];this.listeners={};this.disabled=false;this.value='';this.checked=false;}
 append(...children){this.children.push(...children);}
 setAttribute(name,value){this[name]=value;}
 addEventListener(name,callback){this.listeners[name]=callback;}
 find(test){if(test(this))return this;for(const child of this.children){if(child instanceof Element){const found=child.find(test);if(found)return found;}}return null;}
}
function setup(role='owner',error='This account still has unencrypted cloud records.'){
 const card=new Element('div'),counts={requests:0,signouts:0,reloads:0};
 const context={document:{createElement:tag=>new Element(tag),getElementById:id=>card.find(el=>el.id===id)},gate:{querySelector:()=>card},
  window:{addEventListener(){}},navigator:{onLine:true},auth:{currentUser:{uid:'owner'}},
  confirm:()=>true,signOut:async()=>{counts.signouts++;},location:{reload(){counts.reloads++;}},
  fetch:async()=>{counts.requests++;return {ok:true,json:async()=>({result:{deleted:true}})};},
  config:{projectId:'demo-test'},friendly:e=>e.message};
 vm.createContext(context);vm.runInContext(fragment,context);
 const owner={uid:'owner',email:'owner@example.com',getIdToken:async()=> 'test-token'};
 vm.runInContext('offerLegacyAccountDeletion',context)(owner,{role,ownerUid:'owner'},new Error(error));
 return {card,counts,context};
}
(async()=>{
 const nonOwner=setup('viewer');assert.equal(nonOwner.card.find(el=>el.id==='legacyAccountDelete'),null);
 const unrelated=setup('owner','Network unavailable');assert.equal(unrelated.card.find(el=>el.id==='legacyAccountDelete'),null);
 const owner=setup();const root=owner.card.find(el=>el.id==='legacyAccountDelete');assert.ok(root);
 const form=root.find(el=>el.tag==='form'),phrase=root.find(el=>el['aria-label']==='Type DELETE MY ACCOUNT');
 const checkbox=root.find(el=>el.type==='checkbox'),submit=root.find(el=>el.type==='submit');
 assert.equal(submit.disabled,true);phrase.value='DELETE MY ACCOUNT';phrase.listeners.input();assert.equal(submit.disabled,true);
 checkbox.checked=true;checkbox.listeners.change();assert.equal(submit.disabled,false);
 await form.listeners.submit({preventDefault(){}});assert.deepEqual(owner.counts,{requests:1,signouts:1,reloads:1});
 const cancel=setup();const cancelRoot=cancel.card.find(el=>el.id==='legacyAccountDelete');
 const cancelPhrase=cancelRoot.find(el=>el['aria-label']==='Type DELETE MY ACCOUNT');
 const cancelBox=cancelRoot.find(el=>el.type==='checkbox');
 cancelPhrase.value='DELETE MY ACCOUNT';cancelPhrase.listeners.input();cancelBox.checked=true;cancelBox.listeners.change();
 cancel.context.confirm=()=>false;
 await cancelRoot.find(el=>el.tag==='form').listeners.submit({preventDefault(){}});
 assert.equal(cancel.counts.requests,0);
 const failure=setup();const failureRoot=failure.card.find(el=>el.id==='legacyAccountDelete');
 const failurePhrase=failureRoot.find(el=>el['aria-label']==='Type DELETE MY ACCOUNT'),failureCheck=failureRoot.find(el=>el.type==='checkbox');
 failurePhrase.value='DELETE MY ACCOUNT';failurePhrase.listeners.input();failureCheck.checked=true;failureCheck.listeners.change();
 failure.context.fetch=async()=>({ok:false,json:async()=>({error:{message:'Sign in again before deleting your account.'}})});
 await failureRoot.find(el=>el.tag==='form').listeners.submit({preventDefault(){}});
 assert.equal(failure.counts.reloads,0);
 assert.equal(failureRoot.find(el=>el.textContent==='Sign out and sign in again').disabled,false);
 console.log('Legacy deletion locked-screen interaction tests passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});

