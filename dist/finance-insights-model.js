import {monthClose,nextMonth,automaticCheckKey} from './finance-model.js?v=79';
const amount=r=>Number(r?.amount)||0;
const sum=rows=>rows.reduce((n,r)=>n+amount(r),0);
const inMonth=(r,m)=>r.date?.slice(0,7)===m;
export function previousMonth(m){const[y,n]=m.split('-').map(Number);return `${n===1?y-1:y}-${String(n===1?12:n-1).padStart(2,'0')}`;}
export function monthEnd(today){const m=today.slice(0,7);return nextMonth(m)+'-01'===new Date(Date.parse(today+'T12:00:00Z')+86400000).toISOString().slice(0,10);}
export function automaticEntries(data,visible,month,payments={}){
 const ids=new Set(Object.values(visible).flat().map(r=>r.id));
 const contributions=['retirementContributions','investmentContributions','stallionContributions'].flatMap(k=>data[k]||[]).filter(r=>r.automatic===true&&inMonth(r,month)&&ids.has(r.accountId||r.investmentId||r.stallionId));
 const incomeIds=new Set((visible.income||[]).map(r=>r.id));const recurring=[...(data.income||[]).filter(r=>incomeIds.has(r.id)),...(data.expenses||[])].filter(r=>r.recurringRuleId&&inMonth(r,month));
 return [...contributions,...recurring].map(row=>{const p=payments[automaticCheckKey(row)];return {row,confirmed:p?.status==='paid'&&p.amount===row.amount&&(p.epsAmount||0)===(row.epsAmount||0)};});
}
export function freshness(kind,row,stamp,today,growthType='market'){
 const market=kind==='nps'||kind==='investments'&&growthType==='market';
 const date=row.valuationDate,valid=typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date+'T00:00:00Z'))&&new Date(date+'T00:00:00Z').toISOString().slice(0,10)===date&&date<=today;
 if(!market||!valid)return {due:false,label:market?'Valuation date not recorded':'Fixed or non-market value',date:null};
 const days=Math.floor((Date.parse(today+'T00:00:00Z')-Date.parse(date+'T00:00:00Z'))/86400000);
 return {due:days>30,label:'Last value update '+date+(days>30?' · Over 30 days old':''),date};
}
export function monthlyChanges(data,visible,month){
 const ids=new Set(Object.values(visible).flat().map(r=>r.id)),investmentIds=new Set((visible.investments||[]).map(r=>r.id));
 const contributions=sum(['retirementContributions','investmentContributions','stallionContributions'].flatMap(k=>data[k]||[]).filter(r=>inMonth(r,month)&&ids.has(r.accountId||r.investmentId||r.stallionId)));
 const expenses=(data.expenses||[]).filter(r=>inMonth(r,month)),prior=(data.expenses||[]).filter(r=>inMonth(r,previousMonth(month)));
 const income=sum((visible.income||[]).filter(r=>inMonth(r,month))),principal=expenses.filter(r=>new Set((visible.debts||[]).map(d=>d.id)).has(r.loanId)).reduce((n,r)=>n+(Number(r.principalPaid)||0),0);
 // PMS profit snapshots are cumulative; subtract a previous dated snapshot.
 let pmsGain=0,covered=0;const pms=(visible.investments||[]).filter(r=>r.type==='Stallion PMS');
 for(const inv of pms){const history=(data.stallionProfitHistory||[]).filter(r=>r.stallionId===inv.id&&Number.isFinite(r.profit)).sort((a,b)=>a.date.localeCompare(b.date));const before=history.filter(r=>r.date.slice(0,7)<month).at(-1),end=history.filter(r=>inMonth(r,month)).at(-1);if(before&&end&&before.date.slice(0,7)===previousMonth(month)){pmsGain+=end.profit-before.profit;covered++;}}
 return {contributions,income,expenses:sum(expenses),principal,spendingChange:prior.length&&expenses.length?sum(expenses)-sum(prior):null,pmsGain:covered?pmsGain:null,pmsCovered:covered,pmsTotal:pms.length,hasOtherInvestments:Object.keys(visible).some(k=>['pf','ppf','nps'].includes(k)&&visible[k]?.length)||(visible.investments||[]).some(r=>investmentIds.has(r.id)&&r.type!=='Stallion PMS')};
}
export function commitmentPlan(data,today,candidates){
 const nextIncome=candidates.filter(r=>r.kind==='income'&&r.date>=today).sort((a,b)=>a.date.localeCompare(b.date))[0];
 const fallback=new Date(Date.parse(today+'T12:00:00Z')+30*86400000).toISOString().slice(0,10),until=nextIncome?.date||fallback;
 const items=candidates.filter(r=>r.kind!=='income'&&(nextIncome?r.date<until:r.date<=until));
 const known=items.filter(r=>Number.isFinite(r.amount)&&r.amount>=0),unknown=items.length-known.length,total=sum(known),balance=monthClose({...data,...Object.fromEntries(['income','expenses','stallionContributions'].map(k=>[k,(data[k]||[]).filter(r=>r.date<=today)]))},today.slice(0,7));
 return {until,nextIncome,items,total,unknown,balance,remaining:balance.opening===null||unknown?null:balance.available-total};
}

