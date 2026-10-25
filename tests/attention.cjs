const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');const c={};vm.createContext(c);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../dist/finance-model.js'),'utf8').replaceAll('export function','function').replaceAll('export const','const')+fs.readFileSync(path.join(__dirname,'../dist/attention.js'),'utf8').replace(/^import .*;\n/m,'').replaceAll('export function','function')+';this.items=attentionItems;this.check=automaticCheckKey;',c);
const empty={income:[],expenses:[],stallionContributions:[],monthlyBalances:[]},today='2026-10-25';assert.equal(c.items(empty,{}, {},today).length,0);
const data={...empty,income:[{id:'i',date:'2026-10-01',amount:10}],monthlyBalances:[{month:'2026-10',startBalance:20}]};assert.equal(c.items(data,{}, {},today).length,0);data.monthlyBalances=[];assert.equal(c.items(data,{}, {},today)[0].month,'2026-10');
const record={id:'a',current:100};const view={pf:[record]},meta={valuations:{'pf:a':{value:100,date:'2026-10-01'}}};assert.equal(c.items(empty,view,meta,today).length,0);record.current=101;assert.equal(c.items(empty,view,meta,today)[0].key,'valuations');record.current=100;meta.valuations['pf:a'].date='2026-02-31';assert.equal(c.items(empty,view,meta,today).length,1);
const row={id:'r',accountId:'a',investmentType:'pf',date:'2026-10-01',amount:10,automatic:true};const d={...empty,retirementContributions:[row]};assert(c.items(d,view,{},today).some(x=>x.key==='automatic'));assert(!c.items(d,{pf:[]},{},today).some(x=>x.key==='automatic'));assert(c.items(d,view,{confirmedEntries:{[c.check(row)]:true}},today).some(x=>x.key==='automatic'));
assert.equal(c.items(empty,{}, {},today,{pending:true}).length,0);assert.equal(c.items(empty,{}, {},today,{blocked:true})[0].key,'sync');
console.log('PASS empty state, current versus past month, valuation changes/invalid dates, profile filtering, statement checks and sync deduplication');

const paid={status:'paid',amount:10,epsAmount:2};row.epsAmount=2;const paidMeta={paymentStatus:{[c.check(row)]:paid}};assert(!c.items(d,view,paidMeta,today).some(x=>x.key==='automatic'));row.epsAmount=3;assert(c.items(d,view,paidMeta,today).some(x=>x.key==='automatic'));

assert.equal(c.items(empty,{}, {},today,{reviewProblem:true})[0].key,'reviews');
