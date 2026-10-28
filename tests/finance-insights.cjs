const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');const c={};vm.createContext(c);
const source=['finance-model.js','finance-insights-model.js'].map(f=>fs.readFileSync('dist/'+f,'utf8').replace(/^import .*;\n/gm,'').replaceAll('export function','function').replaceAll('export const','const')).join('\n');vm.runInContext(source+';this.api={monthEnd,freshness,automaticEntries,pendingAutomaticEntries,automaticEntryTitle,monthlyChanges,commitmentPlan,monthClose};',c);const m=c.api;
assert(m.monthEnd('2026-10-31'));assert(!m.monthEnd('2026-10-30'));assert(m.monthEnd('2028-02-29'));assert(m.monthEnd('2026-12-31'));
const data={income:[{id:'inc',amount:1000,date:'2026-10-01'}],expenses:[{id:'e',amount:200,date:'2026-10-02',loanId:'debt',principalPaid:120},{amount:100,date:'2026-09-10'}],monthlyBalances:[{month:'2026-10',startBalance:100},{month:'2026-11',startBalance:500}],stallionContributions:[{id:'c',stallionId:'pms',amount:50,date:'2026-10-01',automatic:true}],retirementContributions:[{id:'pf1',accountId:'pf',amount:20,date:'2026-10-01',automatic:true}],investments:[],stallionProfitHistory:[{stallionId:'pms',date:'2026-09-30',profit:10},{stallionId:'pms',date:'2026-10-20',profit:30}]};
const visible={investments:[{id:'pms',type:'Stallion PMS'}],pf:[{id:'pf',current:100}],income:data.income,debts:[{id:'debt'}]};const before=JSON.stringify(data);
assert.equal(m.monthClose(data,'2026-10').available,850);assert.equal(m.monthClose(data,'2026-10').house,350); // Payroll not subtracted twice.
assert.equal(m.automaticEntries(data,visible,'2026-10').length,2);assert.equal(m.automaticEntries(data,{},'2026-10').length,0);
let changes=m.monthlyChanges(data,visible,'2026-10');assert.equal(changes.contributions,70);assert.equal(changes.principal,120);assert.equal(changes.spendingChange,100);assert.equal(changes.pmsGain,20);
assert.equal(m.monthlyChanges({...data,stallionProfitHistory:[]},visible,'2026-10').pmsGain,null);assert.equal(m.monthlyChanges({...data,expenses:[]},visible,'2026-10').spendingChange,null);
for(const kind of ['pf','ppf'])assert.equal(m.freshness(kind,{valuationDate:'2025-01-01'},null,'2026-10-31').due,false);
for(const growth of ['fixed','no-return'])assert.equal(m.freshness('investments',{valuationDate:'2025-01-01'},null,'2026-10-31',growth).due,false);
assert.equal(m.freshness('nps',{valuationDate:'2026-10-01'},null,'2026-10-31').due,false);
assert.equal(m.freshness('nps',{valuationDate:'2026-09-30'},null,'2026-10-31').due,true);
for(const date of [undefined,'2026-02-31','2026-11-01'])assert.equal(m.freshness('nps',{valuationDate:date},null,'2026-10-31').due,false);
assert.equal(m.freshness('investments',{valuationDate:'2026-09-01',current:100},{date:'2026-10-31',value:100},'2026-10-31').due,true);
const candidates=[{kind:'expense',date:'2026-10-27',amount:100},{kind:'income',date:'2026-11-01',amount:9999},{kind:'expense',date:'2026-11-01',amount:300}];let plan=m.commitmentPlan(data,'2026-10-26',candidates);assert.equal(plan.total,100);assert.equal(plan.remaining,750); // Expected salary not added; same-day payments are outside before-income period.
assert.equal(m.commitmentPlan({...data,monthlyBalances:[]},'2026-10-26',candidates).remaining,null);assert.equal(m.commitmentPlan(data,'2026-10-26',[...candidates,{kind:'emi',date:'2026-10-28',amount:null}]).remaining,null);assert.equal(JSON.stringify(data),before);
console.log('PASS financial insights: reconciliation, month-end gating, payroll deduplication, profile scope, gain snapshots, freshness and uncertain commitments');

assert.equal(m.monthlyChanges({...data,stallionProfitHistory:[{stallionId:'pms',date:'2025-01-01',profit:0},{stallionId:'pms',date:'2026-10-20',profit:100}]},visible,'2026-10').pmsGain,null);
const recurring={...data,expenses:[...data.expenses,{id:'recurring',recurringRuleId:'r',date:'2026-10-05',amount:5}]};assert.equal(m.automaticEntries(recurring,visible,'2026-10').length,3);
assert.equal(m.commitmentPlan({...data,income:[...data.income,{amount:99999,date:'2026-10-30'}]},'2026-10-26',candidates).remaining,750);
assert.equal(m.commitmentPlan(data,'2026-10-26',[{kind:'expense',date:'2026-10-20',amount:50}]).total,50);

assert.equal(m.automaticEntryTitle({investmentType:'pf',accountId:'pf'}, {pf:[{id:'pf',account:'Company Provident Fund'}]}),'PF — Company Provident Fund');
assert.equal(m.automaticEntryTitle({investmentType:'ppf',accountId:'ppf1'}, {ppf:[{id:'ppf1',account:'Bank PPF'}]}),'PPF — Bank PPF');
assert.equal(m.automaticEntryTitle({investmentType:'nps',accountId:'nps1'}, {nps:[{id:'nps1',account:'Retirement Tier I'}]}),'NPS — Retirement Tier I');
assert.equal(m.automaticEntryTitle({investmentId:'mf1'}, {investments:[{id:'mf1',type:'Mutual Funds',name:'Index Fund'}]}),'Mutual Funds — Index Fund');
assert.equal(m.automaticEntryTitle({stallionId:'pms1'}, {investments:[{id:'pms1',type:'Stallion PMS',name:'Core Portfolio'}]}),'Stallion PMS — Core Portfolio');
assert.equal(m.automaticEntryTitle({investmentType:'pf',accountId:'missing'}, {}),'PF');
assert.equal(m.automaticEntryTitle({investmentType:'pf',accountId:'pf1',accountName:'Legacy PF'}, {pf:[{id:'pf1'}]}),'PF — Legacy PF');

const pendingVisible={investments:[{id:'pms',type:'Stallion PMS'}],pf:[{id:'pf',account:'Employer PF'}],income:data.income};
const pendingAll=m.pendingAutomaticEntries(data,pendingVisible,'2026-10',{},'2026-10-31');
assert.equal(pendingAll.length,2,'Month-end displays only pending contributions');
assert.equal(m.pendingAutomaticEntries(data,pendingVisible,'2026-10',{},'2026-10-30').length,0,'Before month-end should be hidden');
assert.equal(m.pendingAutomaticEntries(data,pendingVisible,'2026-10',{},'2026-11-01').length,2,'Unverified previous-month entries remain');
const paidRow=pendingAll[0].row;
const paymentKey=JSON.stringify([paidRow.investmentType||'',paidRow.accountId||paidRow.investmentId||paidRow.stallionId||'',paidRow.id,paidRow.date,paidRow.amount]);
const confirmations={[paymentKey]:{status:'paid',date:'2026-10-31',amount:paidRow.amount,epsAmount:paidRow.epsAmount||0}};
assert.equal(m.pendingAutomaticEntries(data,pendingVisible,'2026-10',confirmations,'2026-11-01').length,1,'Verified entry must disappear');
assert.equal(m.pendingAutomaticEntries(data,pendingVisible,'2026-10',{...confirmations,[JSON.stringify([pendingAll[1].row.investmentType||'',pendingAll[1].row.accountId||pendingAll[1].row.investmentId||pendingAll[1].row.stallionId||'',pendingAll[1].row.id,pendingAll[1].row.date,pendingAll[1].row.amount])]:{status:'paid',amount:pendingAll[1].row.amount,epsAmount:pendingAll[1].row.epsAmount||0}},'2026-11-01').length,0,'All verified means no section');
const corrected={...data,retirementContributions:data.retirementContributions.map(row=>({...row,amount:row.amount+1}))};
assert.equal(m.pendingAutomaticEntries(corrected,pendingVisible,'2026-10',confirmations,'2026-11-01').length,2,'Edited amount invalidates old verification');
const novemberStart={monthlyBalances:[{month:'2026-11',startBalance:5000}],income:[],expenses:[],stallionContributions:[]};
assert.equal(m.monthClose(novemberStart,'2026-10').closing,5000);
assert.equal(m.monthClose(novemberStart,'2026-11').opening,5000);
assert.equal(novemberStart.monthlyBalances.length,1,'Monthly boundary is one record, not two');
console.log('PASS month-end visibility, verified filtering and single Nov-opening/Oct-closing balance record');
