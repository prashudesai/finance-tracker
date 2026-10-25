// Shared household cash-flow model. PF/NPS payroll deductions are not deducted again.
export const validMonth=value=>/^\d{4}-(0[1-9]|1[0-2])$/.test(value);
export function nextMonth(month){if(!validMonth(month))throw Error('Choose a valid month.');const[y,m]=month.split('-').map(Number);return `${m===12?y+1:y}-${String(m===12?1:m+1).padStart(2,'0')}`;}
export function cashflowIndex(data){
 const totals=new Map();const ensure=m=>{if(!totals.has(m))totals.set(m,{income:0,expenses:0,stallion:0});return totals.get(m);};
 for(const [key,rows]of [['income',data.income],['expenses',data.expenses],['stallion',data.stallionContributions]])for(const r of rows||[]){const m=r.date?.slice(0,7);if(validMonth(m))ensure(m)[key]+=Number(r.amount)||0;}
 for(const r of data.monthlyBalances||[])if(validMonth(r.month))ensure(r.month);return totals;
}
export function monthClose(data,month,index=cashflowIndex(data)){
 if(!validMonth(month))throw Error('Choose a valid month.');
 const totals=index.get(month)||{income:0,expenses:0,stallion:0},balances=new Map((data.monthlyBalances||[]).map(r=>[r.month,r.startBalance]));
 const opening=balances.get(month),closing=balances.get(nextMonth(month));
 const available=(opening??0)+totals.income-totals.expenses-totals.stallion;
 return {month,...totals,opening:opening??null,closing:closing??null,available,house:opening!==undefined&&closing!==undefined?available-closing:null,complete:opening!==undefined&&closing!==undefined};
}
export function realValue(nominal,inflation,years){if(!Number.isFinite(nominal)||!Number.isFinite(inflation)||inflation<0||inflation>30||!Number.isInteger(years)||years<1||years>40)throw Error('Check the amount, inflation (0–30%) and horizon (1–40 years).');return nominal/Math.pow(1+inflation/100,years);}
export function valuationStatus(record,stamp,today){
 if(!stamp||stamp.value!==record.current||!/^\d{4}-\d{2}-\d{2}$/.test(stamp.date)||!Number.isFinite(Date.parse(stamp.date)))return 'Unverified';
 const days=Math.floor((Date.parse(today+'T00:00:00Z')-Date.parse(stamp.date+'T00:00:00Z'))/86400000);
 if(days<0)return 'Invalid future date';return `${stamp.date} · ${days} days ago`;
}
