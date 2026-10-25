/* Pure monthly recurrence planning. No timers, storage or network access. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PFT_RECURRING=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
'use strict';
const monthOK=x=>typeof x==='string'&&/^(19|20|21)\d\d-(0[1-9]|1[0-2])$/.test(x);
const idOK=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(x);
const text=x=>typeof x==='string'&&x.trim().length>0&&x.length<=100;
const money=x=>typeof x==='number'&&Number.isFinite(x)&&round(x)>0&&x<=1e12;
const round=x=>Math.round(x*100)/100;
function nextMonth(month){const [y,m]=month.split('-').map(Number);return m===12?`${y+1}-01`:`${y}-${String(m+1).padStart(2,'0')}`;}
function dueDate(rule,month){const [y,m]=month.split('-').map(Number),last=new Date(Date.UTC(y,m,0)).getUTCDate();return month+'-'+String(rule.day===0?last:Math.min(rule.day,last)).padStart(2,'0');}
function amountAt(rule,month){let amount=rule.amount;for(const change of rule.amountChanges||[])if(change.month<=month)amount=change.amount;return amount;}
function validate(data){
 if(data.recurringRules===undefined)data.recurringRules=[];if(data.recurringOccurrences===undefined)data.recurringOccurrences=[];
 if(!Array.isArray(data.recurringRules)||data.recurringRules.length>250||!Array.isArray(data.recurringOccurrences)||data.recurringOccurrences.length>30000)throw Error('Invalid recurring history size.');
 const ids=new Set();
 for(const r of data.recurringRules){
  if(!r||!idOK(r.id)||r.id.length>80||ids.has(r.id)||!['income','expense','emi'].includes(r.kind)||!text(r.name)||!monthOK(r.startMonth)||!Number.isInteger(r.day)||r.day<0||r.day>31||typeof r.paused!=='boolean')throw Error('Invalid recurring item.');ids.add(r.id);
  if(r.pausedFrom!==undefined&&!monthOK(r.pausedFrom))throw Error('Invalid pause month.');
  if(r.endMonth!==''&&(!monthOK(r.endMonth)||r.endMonth<r.startMonth))throw Error('Recurring end month must follow the start month.');
  if(r.kind==='emi'){if(!idOK(r.loanId))throw Error('Recurring EMI requires a loan.');}
  else if(!money(r.amount))throw Error('Recurring amount must be positive.');
  if(r.kind==='income'&&(!text(r.member)||!text(r.source)))throw Error('Recurring income requires a family member and source.');
  if(r.kind==='expense'&&(!text(r.category)||r.category==='EMI Payment'||typeof r.subcategory!=='string'||r.subcategory.length>100||typeof r.isAnnual!=='boolean'))throw Error('Invalid recurring expense.');
  if(!Array.isArray(r.amountChanges)||r.amountChanges.length>1000)throw Error('Invalid recurring amount history.');
  let last='';for(const c of r.amountChanges){if(!monthOK(c.month)||c.month<=last||c.month<r.startMonth||!money(c.amount)||r.kind==='emi')throw Error('Invalid recurring amount change.');last=c.month;}
 }
 const keys=new Set();
 for(const o of data.recurringOccurrences){const key=o?.ruleId+'|'+o?.month;if(!o||!ids.has(o.ruleId)||!monthOK(o.month)||keys.has(key)||!['posted','matched','skipped'].includes(o.status)||(o.recordId!==undefined&&!idOK(o.recordId)))throw Error('Invalid recurring occurrence.');keys.add(key);}
 const recordKeys=new Set();
 for(const row of [...(data.income||[]),...(data.expenses||[])])if(row.recurringRuleId!==undefined||row.recurringMonth!==undefined){
  const key=row.recurringRuleId+'|'+row.recurringMonth;
  if(!ids.has(row.recurringRuleId)||!monthOK(row.recurringMonth)||row.date?.slice(0,7)!==row.recurringMonth||recordKeys.has(key))throw Error('Invalid or duplicate recurring record.');recordKeys.add(key);
  if(!data.recurringOccurrences.some(o=>o.ruleId===row.recurringRuleId&&o.month===row.recurringMonth&&o.status==='posted'&&o.recordId===row.id))throw Error('Recurring record is missing its occurrence history.');
 }
 const activeLoans=new Set();for(const r of data.recurringRules)if(r.kind==='emi'&&!r.paused){if(activeLoans.has(r.loanId))throw Error('Only one active recurring EMI is allowed per loan.');activeLoans.add(r.loanId);}
 return data;
}
function matches(data,rule,month){
 const rows=rule.kind==='income'?data.income:data.expenses;
 return rows.find(row=>row.date?.slice(0,7)===month&&!row.recurringRuleId&&
  (rule.kind==='emi'?row.category==='EMI Payment'&&row.loanId===rule.loanId&&row.repaymentType!=='part-payment':
   rule.kind==='income'?row.member===rule.member&&row.source===rule.source:
   row.category===rule.category&&(row.subcategory||'')===rule.subcategory&&Math.abs(row.amount-amountAt(rule,month))<.011)&&
  !(data.recurringOccurrences||[]).some(o=>o.recordId===row.id&&o.ruleId!==rule.id));
}
function pending(data,today){
 const current=today.slice(0,7),seen=new Set((data.recurringOccurrences||[]).map(o=>o.ruleId+'|'+o.month)),rows=[];
 for(const rule of data.recurringRules||[]){if(rule.paused)continue;
  if(rule.kind==='emi'&&!(data.debts||[]).some(d=>d.id===rule.loanId&&d.remaining>0))continue;
  let month=rule.startMonth,count=0;
  while(month<=current&&(!rule.endMonth||month<=rule.endMonth)&&count++<3600){
   const date=dueDate(rule,month),debt=rule.kind==='emi'?data.debts.find(d=>d.id===rule.loanId):null;
   if(!seen.has(rule.id+'|'+month)&&date<=today&&(!debt||(debt.firstEmiDate?date>=debt.firstEmiDate:(Date.parse(date+'T00:00:00Z')-Date.parse(debt.date+'T00:00:00Z'))/86400000>=30)))rows.push({ruleId:rule.id,month,date,amount:amountAt(rule,month),missed:month<current,existing:matches(data,rule,month)?.id||null});
   month=nextMonth(month);
  }
 }
 return rows.sort((a,b)=>a.date.localeCompare(b.date)||a.ruleId.localeCompare(b.ruleId));
}
function apply(input,requests,ledger,today){
 const data=JSON.parse(JSON.stringify(input));validate(data);let changed=0;const errors=[];
 const due=pending(data,today),seen=new Set();
 for(const request of [...requests].sort((a,b)=>a.month.localeCompare(b.month)||a.ruleId.localeCompare(b.ruleId))){
  const key=request.ruleId+'|'+request.month;if(seen.has(key))continue;seen.add(key);
  const candidate=due.find(x=>x.ruleId===request.ruleId&&x.month===request.month);if(!candidate)continue;
  const rule=data.recurringRules.find(r=>r.id===request.ruleId);
  if(request.skip){data.recurringOccurrences.push({ruleId:rule.id,month:request.month,status:'skipped'});changed++;continue;}
  const earlier=due.some(x=>x.ruleId===rule.id&&x.month<request.month&&!(data.recurringOccurrences||[]).some(o=>o.ruleId===rule.id&&o.month===x.month));
  if(rule.kind==='emi'&&earlier){errors.push(rule.name+': review earlier missed payments first.');continue;}
  const existing=matches(data,rule,request.month);
  if(existing){data.recurringOccurrences.push({ruleId:rule.id,month:request.month,status:'matched',recordId:existing.id});changed++;continue;}
  const amount=request.amount===undefined?amountAt(rule,request.month):request.amount;
  if(rule.kind!=='emi'&&!money(amount)){errors.push(rule.name+': enter a positive amount.');continue;}
  const id='rec_'+rule.id+'_'+request.month.replace('-','');
  if([...data.income,...data.expenses].some(r=>r.id===id)){errors.push(rule.name+': recurring record ID already exists.');continue;}
  const meta={id,date:candidate.date,recurringRuleId:rule.id,recurringMonth:request.month,notes:rule.name+' · Monthly recurring'};
  if(rule.kind==='income')data.income.push({...meta,member:rule.member,source:rule.source,amount:round(amount)});
  else if(rule.kind==='expense')data.expenses.push({...meta,category:rule.category,subcategory:rule.subcategory,isAnnual:rule.isAnnual,amount:round(amount),loanId:null,principalPaid:0,interestPaid:0});
  else{
   const debt=data.debts.find(d=>d.id===rule.loanId),payments=data.expenses.filter(e=>e.category==='EMI Payment'&&e.loanId===rule.loanId);
   const quote=ledger.quotePayment(debt,payments,candidate.date);
   if(quote.error){errors.push(rule.name+': '+quote.error);continue;}
   if(quote.paidOff){data.recurringOccurrences.push({ruleId:rule.id,month:request.month,status:'skipped'});changed++;continue;}
   const row={...meta,category:'EMI Payment',subcategory:'',isAnnual:false,loanId:rule.loanId,repaymentType:'emi',amount:quote.amount,principalPaid:0,interestPaid:0};
   const rebuilt=ledger.rebuild(debt,[...payments,row]);
   if(rebuilt.error){errors.push(rule.name+': '+rebuilt.error);continue;}
   Object.assign(debt,{remaining:rebuilt.remaining,interestPaid:rebuilt.interestPaid,rate:rebuilt.rate,emi:rebuilt.emi});
   data.expenses.push(row);for(const split of rebuilt.payments)Object.assign(data.expenses.find(e=>e.id===split.id),{principalPaid:split.principalPaid,interestPaid:split.interestPaid});
  }
  data.recurringOccurrences.push({ruleId:rule.id,month:request.month,status:'posted',recordId:id});changed++;
 }
 validate(data);return{data,changed,errors};
}
return{validate,pending,apply,dueDate,amountAt,nextMonth,monthOK};
});
