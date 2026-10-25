const fs=require('./app-source.cjs').fs,vm=require('vm'),A=require('assert/strict');const source=fs.readFileSync(__dirname+'/../dist/index.html','utf8');
function fn(name){const a=source.indexOf('    function '+name+'(');A(a>=0);return source.slice(a,source.indexOf('\n    }',a)+6);}
const calls=[],idle=[],ctx={console,document:{hidden:false,addEventListener(){}},window:{requestIdleCallback:cb=>idle.push(cb)},setTimeout:cb=>idle.push(cb)};
for(const name of ['updateDashboard','renderIncome','renderExpenses','renderBalanceHistory','renderInvestments','renderNps','renderPpf','renderPf','renderStallionContributions','renderDebts','renderCustomValuesPanel','renderRecordTools','renderBackupCare','renderRecovery'])ctx[name]=()=>calls.push(name);
vm.createContext(ctx);vm.runInContext('const startupPendingPages=new Set();let startupRenderReady=false;'+fn('renderStartupPage')+fn('warmStartupPages'),ctx);
vm.runInContext("startupPendingPages.add('dashboard');renderStartupPage('dashboard')",ctx);A.equal(calls.length,0);
vm.runInContext("startupRenderReady=true;for(const page of ['income-expenses','investments','debts','settings'])startupPendingPages.add(page);renderStartupPage('dashboard');renderStartupPage('dashboard')",ctx);A.deepEqual(calls,['updateDashboard']);
vm.runInContext("renderStartupPage('debts')",ctx);A.equal(calls.at(-1),'renderDebts');
vm.runInContext('warmStartupPages()',ctx);A.equal(idle.length,0);A.equal(vm.runInContext('startupPendingPages.size',ctx),3);
vm.runInContext("renderStartupPage('income-expenses');renderStartupPage('investments');renderStartupPage('settings')",ctx);A.equal(vm.runInContext('startupPendingPages.size',ctx),0);A.equal(calls.filter(x=>x==='renderIncome').length,1);A.equal(calls.filter(x=>x==='renderInvestments').length,1);
console.log('PASS active-page-first, dirty-page navigation, no duplicate renders and no eager hidden-page work');
