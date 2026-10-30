const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync(require('path').join(__dirname,'../src/core/13-dashboard.js'),'utf8');
const code=source.slice(source.indexOf('function dashboardFullHouseExpense'),source.indexOf('\n    function ',source.indexOf('function dashboardFullHouseExpense')+1));
const context={};vm.createContext(context);vm.runInContext(code,context);const full=context.dashboardFullHouseExpense;
const data={monthlyBalances:[{month:'2025-12',startBalance:5000},{month:'2026-01',startBalance:7000}],income:[{date:'2025-12-01',amount:10000}],expenses:[{date:'2025-12-02',amount:400}],stallionContributions:[{date:'2025-12-03',amount:1000}]};
const before=JSON.stringify(data);assert.equal(full(data,'2025-12'),7000);assert.equal(full({...data,expenses:[]},'2025-12'),7000);assert.equal(full(data,'2026-01'),null);assert.equal(full(data,'invalid'),null);
assert.equal(full({...data,monthlyBalances:[{month:'2025-12',startBalance:0},{month:'2026-01',startBalance:0}],income:[],stallionContributions:[]},'2025-12'),0);
assert.equal(full({...data,monthlyBalances:[{month:'2025-12',startBalance:0},{month:'2026-01',startBalance:12000}]},'2025-12'),-3000);
assert.equal(JSON.stringify(data),before);console.log('PASS Full house expense: household formula, no double counting, year boundary, missing balances, real zero, negative values and no mutation');
