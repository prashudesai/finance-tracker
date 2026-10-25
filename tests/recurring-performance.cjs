const A=require('assert/strict'),{performance}=require('perf_hooks'),R=require('../dist/recurring.js'),old=require('./fixtures/recurring-v2026.10.23.6.cjs');
const base={kind:'income',name:'Salary',member:'Test',source:'Salary',amount:100,day:5,startMonth:'2020-01',endMonth:'',paused:false,amountChanges:[]};
for(let seed=0;seed<500;seed++){
 const data={income:[],expenses:[],debts:[],recurringRules:Array.from({length:5},(_,i)=>({...base,id:'r'+i,day:(seed+i)%32,paused:(seed+i)%7===0,amountChanges:[]})),recurringOccurrences:[]};
 for(let i=0;i<50;i++){const month=`202${i%7}-${String(i%12+1).padStart(2,'0')}`;data.income.push({id:'i'+i,member:'Test',source:'Salary',amount:100,date:month+'-05'});if((i+seed)%3===0)data.recurringOccurrences.push({ruleId:'r'+i%5,month,status:'matched',recordId:'i'+i});}
 A.deepEqual(R.pending(data,'2026-10-23'),old.pending(data,'2026-10-23'));
}
const d={income:[],expenses:[],debts:[],recurringRules:[],recurringOccurrences:[]};for(let i=0;i<100;i++)d.recurringRules.push({...base,id:'r'+i});
for(let i=0;i<30000;i++){const r='r'+i%100,k=Math.floor(i/100),month=`${2000+Math.floor(k/12)}-${String(k%12+1).padStart(2,'0')}`,id='i'+i;d.income.push({id,member:'Test',source:'Salary',date:month+'-05',amount:100,recurringRuleId:r,recurringMonth:month});d.recurringOccurrences.push({ruleId:r,month,status:'posted',recordId:id});}
function timed(fn){const start=performance.now();fn();return Math.round((performance.now()-start)*100)/100;}
console.log(JSON.stringify({differentialScenarios:500,records:30000,oldValidationMs:timed(()=>old.validate(d)),newValidationMs:timed(()=>R.validate(d))}));
