import {cashflowIndex,monthClose,automaticCheckKey} from './finance-model.js?v=79';
export function attentionItems(data,visible,meta,today,sync={}){
 const items=[],current=today.slice(0,7),totals=cashflowIndex(data),balanceMonths=new Set((data.monthlyBalances||[]).map(r=>r.month));const active=m=>{const r=totals.get(m);return balanceMonths.has(m)||r&&(r.income!==0||r.expenses!==0||r.stallion!==0);};
 if(sync.blocked)items.push({key:'sync',label:'Cloud sync needs review',action:'syncDetails'});
 else if(sync.dirty)items.push({key:'sync',label:'Device save needs attention',action:'syncDetails'});
 if(sync.reviewProblem)items.push({key:'reviews',label:'Shared review sync needs attention',action:'syncDetails'});
 // Pending uploads and temporary offline state already have a sync indicator; do not duplicate them here.
 const months=[...totals.keys()].filter(m=>m<=current&&active(m)).sort().reverse();
 const incomplete=months.filter(m=>{const r=monthClose(data,m,totals);return m===current?r.opening===null:!r.complete;});
 if(incomplete.length)items.push({key:'month',label:incomplete.length+' household month'+(incomplete.length===1?' needs':'s need')+' balance review',action:'monthly',month:incomplete[0]});
 const stamps=meta.valuations||{};let missing=0;
 for(const[kind,rows]of Object.entries(visible))for(const row of rows){const stamp=stamps[kind+':'+row.id];if(!stamp||stamp.value!==row.current||!/^\d{4}-\d{2}-\d{2}$/.test(stamp.date)||stamp.date>today||!Number.isFinite(Date.parse(stamp.date+'T00:00:00Z'))||new Date(stamp.date+'T00:00:00Z').toISOString().slice(0,10)!==stamp.date)missing++;}
 if(missing)items.push({key:'valuations',label:missing+' valuation'+(missing===1?' needs':'s need')+' confirmation',action:'valuations'});
 const ids=new Set(Object.values(visible).flat().map(r=>r.id));
 const automatic=[...(data.retirementContributions||[]),...(data.investmentContributions||[]),...(data.stallionContributions||[])].filter(r=>r.automatic===true&&r.date?.slice(0,7)===current&&ids.has(r.accountId||r.investmentId||r.stallionId));
 const unchecked=automatic.filter(r=>{const key=automaticCheckKey(r),paid=meta.paymentStatus?.[key];return paid?paid.status!=='paid'||paid.amount!==r.amount||(paid.epsAmount||0)!==(r.epsAmount||0):true;}).length;
 if(unchecked)items.push({key:'automatic',label:unchecked+' automatic entr'+(unchecked===1?'y needs':'ies need')+' a statement check',action:'monthly',month:current});
 return items;
}
export function installAttention(){
 const host=document.getElementById('dashboard');if(!host)return;
 const box=document.createElement('details');box.id='financeAttention';box.className='finance-workbench-tools';box.hidden=true;const summary=document.createElement('summary');const list=document.createElement('div');box.append(summary,list);host.prepend(box);
 const read=key=>window.financeReviews?.get(key)||{};
 function render(){
  if(!host.classList.contains('active'))return;
  const visible=Object.fromEntries(['investments','pf','ppf','nps'].map(kind=>[kind,profileRows(state[kind]||[])]));
  const items=attentionItems(state,visible,{valuations:read('valuations'),paymentStatus:read('paymentStatus')},localDateKey(),{blocked:cloudSaveBlocked,dirty:persistenceDirty&&!pendingSaves,reviewProblem:window.financeReviews?.problem()});
  box.hidden=items.length===0;summary.textContent='Needs attention · '+items.length;list.replaceChildren();
  for(const item of items){const row=document.createElement('div');row.className='finance-attention-row';const label=document.createElement('span');label.textContent=item.label;const button=document.createElement('button');button.type='button';button.className='btn-small';button.textContent='Review';button.setAttribute('aria-label','Review: '+item.label);button.onclick=()=>window.financeWorkbench?.[item.action]?.(item.month);row.append(label,button);list.append(row);}
 }
 let queued=false;const schedule=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;render();});};
 const update=updateDashboard;updateDashboard=function(...args){const result=update.apply(this,args);schedule();return result;};
 const status=storageMessage;storageMessage=function(...args){const result=status.apply(this,args);schedule();return result;};
 document.addEventListener('finance-review-changed',schedule);document.addEventListener('close',schedule,true);
 const observer=new MutationObserver(schedule);observer.observe(host,{attributes:true,attributeFilter:['class']});
 const reset=window.financeBridge.reset;window.financeBridge.reset=function(){observer.disconnect();document.removeEventListener('finance-review-changed',schedule);document.removeEventListener('close',schedule,true);box.remove();return reset.apply(this,arguments);};
 window.financeAttention={refresh:render};render();
}
