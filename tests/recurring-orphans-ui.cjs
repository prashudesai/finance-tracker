const A=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const R=require('../dist/recurring.js'),L=require('../dist/loan-ledger.js');
function setup(state,edit=async()=>null){
 const nodes=new Map(),element=()=>({innerHTML:'',textContent:'',disabled:false,onclick:null,options:[],value:'',addEventListener(){},showModal(){},close(){},querySelectorAll(){return[];}});
 const document={hidden:true,getElementById:id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);},querySelector:()=>null,addEventListener(){}};
 const window={PFT_RECURRING:R,PFT_LOAN_LEDGER:L,financeCloud:{canEdit:true,accessValid:()=>true}},ctx={window,document,console,structuredClone,confirm:()=>true,setInterval(){}};vm.createContext(ctx);
 vm.runInContext(fs.readFileSync(__dirname+'/../dist/recurring-ui.js','utf8'),ctx);
 const api={get:()=>state,today:()=> '2026-10-23',escape:String,currency:n=>'₹'+n,ready:()=>true,commit:async next=>{for(const key of Object.keys(state))delete state[key];Object.assign(state,next);return true;},edit, id:()=> 'new',preferredMember:()=>'',source:s=>s,subcategories:{},wire(){}};
 window.initializeRecurringUI(api);return{document,window};
}
const tick=async()=>{await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve));};
(async()=>{
 const salary={id:'salary',kind:'income',name:'Salary',member:'Me',source:'Salary',amount:50000,startMonth:'2026-03',endMonth:'',day:1,paused:false,amountChanges:[]};
 const row={id:'rec_salary',date:'2026-08-01',member:'Me',source:'Salary',amount:50000,recurringRuleId:'salary',recurringMonth:'2026-08'};
 const state={income:[row],expenses:[],debts:[],recurringRules:[{id:'orphan',kind:'emi',name:'Monthly EMI',loanId:'deleted-loan',startMonth:'2026-03',endMonth:'',day:5,paused:false,amountChanges:[]},salary],recurringOccurrences:[{ruleId:'salary',month:'2026-08',status:'posted',recordId:row.id}]};
 const {document}=setup(state),open=document.getElementById('openRecurringBtn');open.onclick();
 const list=document.getElementById('recurringList');
 A.match(list.innerHTML,/Linked loan unavailable/);A.match(list.innerHTML,/Remove stopped schedule/);A.match(list.innerHTML,/Delete schedule/);A.doesNotMatch(list.innerHTML,/Edit future.*orphan/);
 list.onclick({target:{closest(selector){return selector==='[data-rec-remove]'?{dataset:{recRemove:'orphan'}}:null;}}});await tick();
 A.equal(state.recurringRules.some(r=>r.id==='orphan'),false);A.match(document.getElementById('recurringStatus').textContent,/deleted/);
 list.onclick({target:{closest(selector){return selector==='[data-rec-remove]'?{dataset:{recRemove:'salary'}}:null;}}});await tick();
 const archived=state.recurringRules.find(r=>r.id==='salary');A.equal(archived.archived,true);A.equal(archived.paused,true);A.equal(state.income[0].id,row.id);A.equal(state.recurringOccurrences.length,1);A.match(document.getElementById('recurringStatus').textContent,/archived/);
 console.log('PASS stale schedule can be removed; deleting a used recurring schedule preserves its posted entry and archives the rule');
 let docRef,step=0,loanFields;
 const loanState={income:[],expenses:[],debts:[{id:'home-loan',type:'Home Loan',emi:82000,remaining:500000,date:'2025-01-01',emiDueDay:5}],recurringRules:[],recurringOccurrences:[]};
 const edit=async(_title,fields)=>{if(step++===0)return{kind:'emi'};loanFields=fields;docRef.getElementById('recordEdit_loanId').value=fields.find(field=>field.key==='loanId').value;return null;};
 const ui=setup(loanState,edit);docRef=ui.document;ui.document.getElementById('addRecurringBtn').onclick();await tick();
 const labels=loanFields.find(field=>field.key==='loanId').optionLabels;
 A.equal(labels['home-loan'],'Home Loan · ₹82000');A.doesNotMatch(JSON.stringify(labels),/undefined/);
 console.log('PASS EMI loan selector shows a readable fallback name when a loan has no name field');
 const recurringEmi={id:'daily-rule',kind:'emi',name:'Monthly EMI',loanId:'sbi',startMonth:'2026-08',endMonth:'',day:5,paused:false,amountChanges:[]};
 const dailyState={income:[],expenses:[],debts:[{id:'sbi',type:'Home Loan',principal:1000000,remaining:1000000,rate:7.5,emi:82000,date:'2026-01-01',dailyInterestBasis:true}],recurringRules:[recurringEmi],recurringOccurrences:[]};
 const dailyUi=setup(dailyState);dailyUi.document.getElementById('openRecurringBtn').onclick();
 const reviewHtml=dailyUi.document.getElementById('recurringReview').innerHTML;A.equal((reviewHtml.match(/₹82000/g)||[]).length,3);A.doesNotMatch(reviewHtml,/₹1(?:<|\s)/);
 console.log('PASS each missed daily-balance EMI review row shows the scheduled amount instead of the synthetic quote amount');
})().catch(error=>{console.error(error);process.exitCode=1;});
