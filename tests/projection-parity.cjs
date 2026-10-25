const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),path=require('path'),{performance}=require('perf_hooks');
const before=fs.readFileSync(process.env.BASELINE_HTML||path.join(__dirname,'fixtures/projection-before.js'),'utf8');
const after=fs.readFileSync(path.join(__dirname,'../dist/index.html'),'utf8');
function fn(s,name){const start=s.indexOf(`    function ${name}(`);assert(start>=0);const lineEnd=s.indexOf('\n',start);return s.slice(start,lineEnd).trimEnd().endsWith('}')?s.slice(start,lineEnd):s.slice(start,s.indexOf('\n    }',start)+6);}
function engine(src){const c={state:{},currentMonthKey:()=> '2026-10',totalGratuityEstimate:date=>100000+Number(date.slice(0,4))*100+Number(date.slice(5,7))*5};vm.createContext(c);vm.runInContext(['projectionMonthIndex','projectionMonthKey','projectionMonthEndDate','runGrowthProjection'].map(n=>fn(src,n)).join('\n'),c);return c;}
const old=engine(before),fresh=engine(after);let seed=123456;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
function close(a,b){if(typeof a==='number'){assert(Math.abs(a-b)<=Math.max(.00001,Math.abs(a)*1e-11),`${a} versus ${b}`);}else if(a&&typeof a==='object'){assert.deepEqual(Object.keys(a),Object.keys(b));for(const k of Object.keys(a))close(a[k],b[k]);}else assert.equal(a,b);}
let comparisons=0;
for(let i=0;i<120;i++){
 const assets=Array.from({length:1+i%30},(_,j)=>({name:'Asset '+j,kind:['market','pf','ppf','fixed','no-return'][j%5],current:100000+Math.round(random()*1000000),monthly:Math.round(random()*10000),stepUpPercent:Math.round(random()*20),returns:{stress:j%5===4?0:-5+random()*10,base:j%5===4?0:random()*12,optimistic:j%5===4?0:12+random()*15}}));
 if(i%9===0)assets.push({name:'Gratuity',kind:'gratuity',current:302655,monthly:0,returns:{stress:0,base:0,optimistic:0}});
 const state={projectionSettings:{includeMonthlyContributions:i%4!==0,excludedMonthlyContributions:i%3===0?['Asset 0']:[]},projectionAdjustments:[{category:'Asset 0',date:'2027-04-05',type:'add',amount:10000},{category:'Asset 0',date:'2028-03-07',type:'withdraw',amount:5000}]};
 for(const scenario of ['stress','base','optimistic']){old.state=fresh.state=state;close(old.runGrowthProjection(assets,1+i%10,scenario),fresh.runGrowthProjection(assets,1+i%10,scenario));comparisons++;}
}
const assets=Array.from({length:1000},(_,i)=>({name:'Asset '+i,kind:i%4===0?'pf':'market',current:120000,monthly:1000,stepUpPercent:5,returns:{stress:0,base:12,optimistic:15}}));
const times={before:[],after:[]};
for(let warm=0;warm<3;warm++)for(const c of [old,fresh]){c.state={projectionSettings:{},projectionAdjustments:[]};for(const scenario of ['stress','base','optimistic'])c.runGrowthProjection(assets,10,scenario);}
for(let pass=0;pass<5;pass++)for(const[name,c]of [['before',old],['after',fresh]]){c.state={projectionSettings:{},projectionAdjustments:[]};const start=performance.now();for(const scenario of ['stress','base','optimistic'])c.runGrowthProjection(assets,10,scenario);times[name].push(performance.now()-start);}
const median=a=>[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)];
console.log(JSON.stringify({passed:comparisons,failed:0,description:'Full FY row/output parity against pre-optimization engine',benchmark:{assets:1000,years:10,scenarios:3,beforeMs:times.before,afterMs:times.after,medianBeforeMs:median(times.before),medianAfterMs:median(times.after),speedup:median(times.before)/median(times.after)}},null,2));
