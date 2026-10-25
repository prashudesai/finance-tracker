const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const code=fs.readFileSync(require('path').join(__dirname,'../dist/record-recovery.js'),'utf8').replaceAll('export function','function');const c={};vm.createContext(c);vm.runInContext(code+';this.rows=recoveryRows;this.select=selectRecovery;',c);
const local={income:[{id:'a',amount:10},{id:'b',amount:20}],settings:{rate:8}},cloud={income:[{id:'a',amount:15},{id:'c',amount:30}],settings:{rate:9}};
const rows=c.rows(local,cloud);assert.equal(rows.length,4);assert.throws(()=>c.select(local,rows,[]),/every/);
const choices=rows.map(r=>r.id==='a'||r.id==='c'?'cloud':'local');const result=c.select(local,rows,choices);assert.equal(result.income.find(r=>r.id==='a').amount,15);assert.equal(result.income.find(r=>r.id==='b').amount,20);assert.equal(result.income.find(r=>r.id==='c').amount,30);assert.equal(result.settings.rate,8);assert.equal(local.income[0].amount,10);
assert.equal(c.select(local,rows,rows.map(()=> 'cloud')).income.length,2);
console.log('PASS record selections require explicit choices, preserve independent records, handle deletions and do not mutate originals');
