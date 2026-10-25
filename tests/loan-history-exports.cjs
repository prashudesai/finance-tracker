const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ledger=require('../dist/loan-ledger.js');
const html=fs.readFileSync(require.resolve('../dist/index.html'),'utf8');
const collectStart=html.indexOf('    function collectLoanHistoryRows(debtId){');
const collectEnd=html.indexOf('    function loanHistoryOrdered(',collectStart);
const orderedEnd=html.indexOf('    function loanHistoryCell(',collectEnd);
assert(collectStart>=0&&collectEnd>collectStart&&orderedEnd>collectEnd,'single-loan history helpers exist');
const context={
  loanHistoryExportRows:[],
  state:{
    debts:[
      {id:'home',type:'Home Loan',principal:100000,remaining:100000,rate:12,emi:10000,date:'2026-01-01'},
      {id:'car',type:'Car Loan',principal:50000,remaining:50000,rate:10,emi:5000,date:'2026-01-01'}
    ],archivedAccounts:[],
    expenses:[
      {id:'p1',category:'EMI Payment',loanId:'home',date:'2026-02-01',amount:10000,interestPaid:1000,principalPaid:9000},
      {id:'p2',category:'EMI Payment',loanId:'home',date:'2026-03-01',amount:10000,interestPaid:900,principalPaid:9100},
      {id:'car1',category:'EMI Payment',loanId:'car',date:'2026-02-15',amount:5000,interestPaid:400,principalPaid:4600}
    ]
  },PFT_LOAN_LEDGER:ledger,localDateKey:()=> '2026-10-24'
};
vm.createContext(context);
vm.runInContext('function allAccounts(kind){return [...state[kind],...state.archivedAccounts.filter(row=>row.kind===kind).map(row=>row.record)];}',context);
const helpers=html.slice(collectStart,orderedEnd);
vm.runInContext(helpers+'\nthis.collectLoanHistoryRows=collectLoanHistoryRows;this.loanHistoryOrdered=loanHistoryOrdered;',context);
context.loanHistoryExportRows=context.collectLoanHistoryRows('home');
assert.equal(context.loanHistoryExportRows.length,2,'export is limited to the selected loan');
assert.deepEqual(Array.from(context.loanHistoryExportRows,row=>row.date),['2026-02-01','2026-03-01']);
assert.deepEqual(Array.from(context.loanHistoryOrdered(false),row=>row.date),['2026-03-01','2026-02-01'],'view order is newest first');
assert.deepEqual(Array.from(context.loanHistoryOrdered(true),row=>row.date),['2026-02-01','2026-03-01'],'export and print order is oldest first');
assert.equal(context.loanHistoryExportRows[0].interest,1000);
assert.equal(context.loanHistoryExportRows[0].principal,9000);
context.loanHistoryExportRows=context.collectLoanHistoryRows('car');
assert.equal(context.loanHistoryExportRows.length,1);
assert.equal(context.loanHistoryExportRows[0].amount,5000,'switching the selected loan changes export contents');
const daily={id:'daily',type:'Daily Loan',principal:100000,remaining:100000,rate:12,emi:10000,date:'2026-09-01',dailyInterestBasis:true};
context.state.debts.push(daily);
context.loanHistoryExportRows=context.collectLoanHistoryRows('daily');
assert(context.loanHistoryExportRows.some(row=>row.entry==='Interest capitalization'&&row.date==='2026-09-30'));
assert(!context.loanHistoryExportRows.some(row=>row.date==='2026-10-31'),'future month-end capitalization is excluded');
const modal=html.match(/<div id="debtEmiHistoryModal"[\s\S]*?<\/div>\s*<\/div>/)?.[0]||'';
for(const id of ['debtEmiHistoryPdf','debtEmiHistoryCsv','debtEmiHistoryPrint'])assert(modal.includes(`id="${id}"`),`${id} is inside the per-loan history modal`);
assert(!html.includes('All loan payment history'));
assert.match(html,/statement\.rows\.slice\(\)\.reverse\(\)/,'daily-balance view is newest first');
console.log('PASS per-loan PDF/CSV/print controls export only the selected loan; view is newest-first and export order is oldest-first');
