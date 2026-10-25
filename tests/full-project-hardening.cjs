const fs=require('fs'),vm=require('vm'),A=require('assert/strict'),{performance}=require('perf_hooks');
const html=fs.readFileSync(require.resolve('../dist/index.html'),'utf8');
function fn(s,n){const a=s.indexOf('    function '+n+'('),b=s.indexOf('\n    }',a)+6;A(a>=0);return s.slice(a,b);}
A(!html.includes('applyRequestedDefaultValueRemovals'));A(!html.includes('REQUESTED_DEFAULT_VALUE_REMOVALS'));
const old=fs.readFileSync(__dirname+'/fixtures/pms-sync-before.js','utf8');
const make=source=>{const c={state:{}};c.allAccounts=kind=>[...c.state[kind],...c.state.archivedAccounts.filter(a=>a.kind===kind).map(a=>a.record)];vm.createContext(c);vm.runInContext(fn(source,'syncStallionPmsFromInvestments'),c);return c;};
const before=make(old),after=make(html),clone=x=>JSON.parse(JSON.stringify(x));
const data={investments:Array.from({length:3000},(_,i)=>({id:'i'+i,type:i%3?'Stallion PMS':'Bonds',name:'Fund '+i,member:'Alex',invested:100,current:125,date:'2026-01-01'})),stallionPms:Array.from({length:2500},(_,i)=>({id:'i'+i,member:'Old',profit:1,createdDate:'2025-01-01'})),archivedAccounts:[{kind:'investments',record:{id:'archived',type:'Stallion PMS'}}]};data.stallionPms.push({id:'archived',profit:88});
const timings={before:[],after:[]};for(let n=0;n<5;n++)for(const [key,c] of [['before',before],['after',after]]){c.state=clone(data);const t=performance.now();c.syncStallionPmsFromInvestments();timings[key].push(performance.now()-t);}
A.deepEqual(clone(after.state),clone(before.state));A.equal(after.state.stallionPms.find(r=>r.id==='archived').profit,88);A(!after.state.stallionPms.some(r=>r.id==='i0'));
const median=xs=>xs.sort((a,b)=>a-b)[2],report={accounts:3000,beforeMedianMs:median(timings.before),afterMedianMs:median(timings.after)};report.speedup=report.beforeMedianMs/report.afterMedianMs;
console.log('PASS destructive migration absent; indexed PMS sync preserves active/archived values, adds missing mirrors and removes orphans.');console.log(JSON.stringify(report));
