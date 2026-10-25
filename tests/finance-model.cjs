const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),path=require('path');
const c={};vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(__dirname,'../dist/finance-model.js'),'utf8').replaceAll('export function','function').replaceAll('export const','const')+';this.api={cashflowIndex,monthClose,realValue,valuationStatus,nextMonth};',c);const model=c.api;
const html=fs.readFileSync(path.join(__dirname,'../dist/index.html'),'utf8');function extract(name){const a=html.indexOf('    function '+name+'(');return html.slice(a,html.indexOf('\n    }',a)+6);}
const old={inMonth:(d,m)=>d?.slice(0,7)===m,retirementOutflow:()=>0};vm.createContext(old);vm.runInContext(['monthTotals','recalculateHouseExpenses'].map(extract).join('\n'),old);
let seed=91;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
for(let trial=0;trial<200;trial++){
 const months=Array.from({length:24},(_,i)=>`${2025+Math.floor(i/12)}-${String(i%12+1).padStart(2,'0')}`),data={income:[],expenses:[],stallionContributions:[],monthlyBalances:[]};
 for(const month of months){for(const kind of ['income','expenses','stallionContributions'])for(let i=0;i<3;i++)data[kind].push({id:kind+month+i,date:month+'-01',amount:Math.round(random()*10000000)/100,isAnnual:i===0});if(random()>.15)data.monthlyBalances.push({month,startBalance:Math.round(random()*500000)});}
 old.state=JSON.parse(JSON.stringify(data));old.recalculateHouseExpenses();
 for(const month of months){const a=model.monthClose(data,month),b=old.monthTotals(month);for(const key of ['income','expenses','stallion'])assert.equal(a[key],b[key]);const balance=old.state.monthlyBalances.find(r=>r.month===month);if(balance)assert.equal(a.house,balance.houseExpense);}
}
assert.equal(model.nextMonth('2026-12'),'2027-01');assert.equal(model.realValue(100,0,5),100);assert(Math.abs(model.realValue(121,10,2)-100)<1e-10);assert.throws(()=>model.realValue(100,31,5));assert.throws(()=>model.realValue(100,6,0));assert.equal(model.valuationStatus({current:100},{value:90,date:'2026-01-01'},'2026-02-01'),'Unverified');assert.match(model.valuationStatus({current:100},{value:100,date:'2026-01-01'},'2026-02-01'),/31 days/);
console.log('PASS 4,800 month comparisons against existing calculations, missing balances, annual expenses, year rollover, inflation and valuation invalidation');
