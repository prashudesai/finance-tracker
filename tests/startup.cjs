const fs=require('./app-source.cjs').fs,vm=require('vm'),assert=require('assert/strict'),path=require('path');
const root=path.resolve(__dirname,'../dist'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const source=fs.readFileSync(path.join(root,'firebase-client.js'),'utf8').replace(/^import .*;\n/gm,'');
function harness(){
 const classes=new Set(['cloud-pending','cloud-loading']),els=new Map();let authCallback,timeout;
 const get=id=>{if(!els.has(id))els.set(id,{hidden:false,disabled:false,addEventListener(){},textContent:''});return els.get(id);};
 const context={doc:()=>({}),installReviewSync:async()=>{},reviewValues:x=>x,applyReviewPatch:x=>x,installRecordSearch:()=>{},installCashFlow:()=>{},installAttention:()=>{},installFinanceWorkbench:()=>{},installExperience:()=>{},installRecordRecovery:()=>{},installWorkProtection:()=>{},installCloudNotice:()=>{},initializeAccountPhoto:()=>{},initializeFamilyAccess:async()=>({ownerUid:'test',role:'owner',canEdit:true,canManage:true,accessValid:()=>true}),document:{createElement:()=>({}),head:{append(){}},body:{classList:{add:(...x)=>x.forEach(v=>classes.add(v)),remove:(...x)=>x.forEach(v=>classes.delete(v)),contains:x=>classes.has(x)}},getElementById:get,querySelector:()=>({inert:true})},window:{financeCloudResolve(){},addEventListener(){},dispatchEvent(){}},Event:class{},initializeApp:()=>({}),initializeAuth:()=>({currentUser:{uid:'test'}}),getFirestore:()=>({}),indexedDBLocalPersistence:{},browserLocalPersistence:{},browserSessionPersistence:{},browserPopupRedirectResolver:{},GoogleAuthProvider:class{setCustomParameters(){}},onAuthStateChanged:(_,cb)=>authCallback=cb,createCloudStore:()=>({load(){},save(){},resume(){},revision:0}),setTimeout:fn=>timeout=fn,navigator:{onLine:true},location:{reload(){}},console};
 vm.runInNewContext(source,context);return{classes,get,context,auth:user=>authCallback(user),timeout:()=>timeout()};
}
(async()=>{
 assert.match(html,/<body class="cloud-pending cloud-loading">/);
 assert.match(html,/body\.cloud-loading #cloudGate \.cloud-login-layout\{display:none;\}/);
 const signedIn=harness();await signedIn.auth({uid:'test',email:'test@example.test'});assert(signedIn.classes.has('cloud-loading'));signedIn.context.window.financeCloud.showApp();assert(!signedIn.classes.has('cloud-loading'));assert(!signedIn.classes.has('cloud-pending'));assert(signedIn.get('cloudGate').hidden);
 const signedOut=harness();await signedOut.auth(null);assert(!signedOut.classes.has('cloud-loading'));assert.equal(signedOut.get('cloudLogin').hidden,false);assert.equal(signedOut.get('cloudLogin').disabled,false);
 const stalled=harness();stalled.timeout();assert(!stalled.classes.has('cloud-loading'));assert.match(stalled.get('cloudMessage').textContent,/longer than expected/);
 const error=harness();error.context.window.financeCloudLock(new Error('Test failure'));assert(!error.classes.has('cloud-loading'));assert(error.classes.has('cloud-pending'));assert.equal(error.get('cloudGate').hidden,false);
 console.log('PASS: initial loading, session restore, dashboard reveal, sign-in, timeout, and error recovery');
})();
