const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const s=fs.readFileSync(require('path').join(__dirname,'../src/core/13-dashboard.js'),'utf8');
const fn=s.slice(s.indexOf('    function dashboardSavingsContributionAverage('),s.indexOf('    // DASHBOARD UPDATE'));
const state={investments:[{id:'pms',type:'Stallion PMS',member:'A'},{id:'other',type:'Stallion PMS',member:'B'}],retirementContributions:[{member:'A',date:'2026-04-02',amount:100,epsAmount:10},{member:'A',date:'2026-05-02',amount:200},{member:'B',date:'2026-05-02',amount:999},{member:'A',date:'2026-03-02',amount:999},{member:'A',date:'2026-07-02',amount:999}],stallionContributions:[{stallionId:'pms',date:'2026-04-03',amount:50},{stallionId:'pms',date:'2026-06-03',amount:100},{stallionId:'other',date:'2026-04-03',amount:999}],investmentContributions:[{date:'2026-04-03',amount:5000}]};
const before=JSON.stringify(state),c={state,profileRows:rows=>rows.filter(row=>row.member==='A')};vm.runInNewContext(fn,c);
let result=c.dashboardSavingsContributionAverage(new Date(2026,5,30));assert.equal(result.months,3);assert.equal(result.average,150,'Retirement and selected PMS only, no EPS or general investments');assert.equal(JSON.stringify(state),before);
state.retirementContributions=[];state.stallionContributions=[];result=c.dashboardSavingsContributionAverage(new Date(2026,5,30));assert.equal(result.months,0);assert.equal(result.average,0);
console.log('PASS Dashboard savings average: FY dates, reported months, profile, EPS/general investment exclusions and read-only behavior');
