// Touch-only enhancements; desktop controls and stored financial records are untouched.
export function installMobileExperience(){
 if(window.financeMobileExperience)return;
 const mobile=matchMedia('(max-width:700px)'),main=document.getElementById('trackerMain');
 const indicator=document.createElement('div');indicator.id='mobilePullRefresh';indicator.hidden=true;indicator.setAttribute('role','status');indicator.setAttribute('aria-live','polite');document.body.append(indicator);
 const pullThreshold=240,pullReveal=110;
 let gesture=null,busy=false,timer=0,scanTimer=0,disposed=false;
 const ignore='button,a,input,select,textarea,summary,[contenteditable],dialog,[role=dialog],[role=listbox],[role=menu],.modal,.table-wrapper,svg,canvas';
 function blocked(target){
  if(!mobile.matches||!main||main.inert||!window.financeCloud||document.body.classList.contains('cloud-pending')||scrollY>1||[...document.querySelectorAll('dialog[open],.investment-edit-modal:not([hidden]),[aria-modal=true]')].some(e=>e.getClientRects().length>0))return true;
  if(!(target instanceof Element)||!main.contains(target)||target.closest(ignore))return true;
  for(let n=target;n&&n!==main;n=n.parentElement){const css=getComputedStyle(n);if(/auto|scroll/.test(css.overflowY)&&n.scrollHeight>n.clientHeight+1)return true;}
  return false;
 }
 const hide=()=>{indicator.hidden=true;indicator.removeAttribute('data-ready');};
 function status(text){clearTimeout(timer);indicator.textContent=text;indicator.hidden=false;timer=setTimeout(hide,3500);}
 async function refresh(){
  if(busy)return;busy=true;
  try{
   if(window.financeDrafts?.pending()){status('Finish or save your entry before refreshing.');return;}
   if(!navigator.onLine){status('Connect to the internet to refresh.');return;}
   indicator.textContent='Refreshing…';indicator.hidden=false;
   await window.financeBridge?.refreshRemote();
   hide();
  }catch(error){status(error?.message||'Refresh failed. Please try again.');}
  finally{busy=false;}
 }
 function start(event){gesture=null;if(busy||event.touches.length!==1||blocked(event.target))return;const t=event.touches[0];gesture={x:t.clientX,y:t.clientY,pull:0};}
 function move(event){
  if(!gesture)return;if(event.touches.length!==1||!mobile.matches||scrollY>1){gesture=null;hide();return;}
  const t=event.touches[0],dx=t.clientX-gesture.x,dy=t.clientY-gesture.y;
  if(dy<0||Math.abs(dx)>Math.max(16,dy*.65)){gesture=null;hide();return;}
  if(dy<12)return;
  if(event.cancelable)event.preventDefault(); // Avoid a second native browser refresh.
  gesture.pull=dy;if(dy<pullReveal){hide();return;}indicator.hidden=false;indicator.textContent=dy>=pullThreshold?'Release to refresh':'Pull to refresh';indicator.dataset.ready=String(dy>=pullThreshold);
 }
 function end(){const ready=gesture?.pull>=pullThreshold;gesture=null;if(ready)void refresh();else if(!busy)hide();}
 const cancel=()=>{gesture=null;if(!busy)hide();};
 document.addEventListener('touchstart',start,{passive:true});document.addEventListener('touchmove',move,{passive:false});document.addEventListener('touchend',end,{passive:true});document.addEventListener('touchcancel',cancel,{passive:true});
 // Only explanatory paragraphs become help disclosures. Actionable warnings stay visible.
 const helps=new Map();
 function scan(){
  if(disposed)return;
  if(!mobile.matches){for(const [p,d]of helps){if(d.isConnected)d.replaceWith(p);}helps.clear();return;}
  for(const [p,d]of helps)if(!d.isConnected)helps.delete(p);
  for(const p of document.querySelectorAll('.finance-insight-note,.loan-change-help,.panel>p,.info-box>p')){
   if(p.closest('.mobile-info-help,[role=alert],#cloudGate,#firstNameSetup')||p.textContent.trim().length<180||p.querySelector('button,a,input,select')||/warning|error|delete|cannot|must |do not|don’t/i.test(p.className+' '+p.textContent))continue;
   const d=document.createElement('details');d.className='mobile-info-help';const summary=document.createElement('summary');
   summary.innerHTML='<span class="mobile-info-icon" aria-hidden="true">i</span><span>How this works</span>';
   if(p.closest('#cashBalanceBreakdown'))summary.lastElementChild.textContent='About this calculation';
   p.before(d);d.append(summary,p);helps.set(p,d);
  }
 }
 const schedule=()=>{clearTimeout(scanTimer);scanTimer=setTimeout(scan,60);};
 const observer=new MutationObserver(schedule);observer.observe(main,{childList:true,subtree:true});
 const adapt=()=>{cancel();scan();};mobile.addEventListener('change',adapt);scan();
 const reset=window.financeBridge.reset;window.financeBridge.reset=function(){disposed=true;observer.disconnect();clearTimeout(timer);clearTimeout(scanTimer);mobile.removeEventListener('change',adapt);document.removeEventListener('touchstart',start);document.removeEventListener('touchmove',move);document.removeEventListener('touchend',end);document.removeEventListener('touchcancel',cancel);indicator.remove();for(const [p,d]of helps)if(d.isConnected)d.replaceWith(p);delete window.financeMobileExperience;return reset.apply(this,arguments);};
 installCompactAccountDetails();
 window.financeMobileExperience={};
}

function installCompactAccountDetails(){
 const mobile=matchMedia('(max-width:700px)'),dialogs=[document.getElementById('investmentCategoryDialog'),document.getElementById('retirementCategoryDialog')].filter(Boolean);
 const originals=new Map();let frame=0,disposed=false;
 const norm=text=>String(text).toLowerCase().replace(/[^a-z0-9]/g,'');
 const metricKey=text=>{const key=norm(text);return ({totalinvested:'invested',currentvalue:'current',currentbalance:'current',currentpfbalance:'current',pfbalance:'current',gainloss:'gain',gain:'gain',interestrate:'rate',monthlycontribution:'monthly',monthlycontributions:'monthly',estimatedgratuity:'gratuity'})[key]||key;};
 const metricValue=text=>String(text).replace(/[\s,+]/g,'').replaceAll('−','-');
 function restore(){for(const [button,html]of originals)if(button.isConnected)button.innerHTML=html;originals.clear();for(const dialog of dialogs){dialog.querySelectorAll('.mobile-summary-duplicate,.mobile-identity-duplicate').forEach(e=>e.classList.remove('mobile-summary-duplicate','mobile-identity-duplicate'));dialog.querySelectorAll('[data-mobile-account-action]').forEach(e=>{delete e.dataset.mobileAccountAction;delete e.dataset.mobileActionKind;});dialog.querySelectorAll('.mobile-one-detail').forEach(row=>row.classList.remove('mobile-one-detail'));dialog.classList.remove('mobile-compact-account');}}
 function scan(){
  frame=0;if(disposed)return;if(!mobile.matches){restore();return;}
  for(const dialog of dialogs){
   if(dialog.hidden)continue;dialog.classList.add('mobile-compact-account');
   const investment=dialog.id==='investmentCategoryDialog',summary=dialog.querySelector(investment?'#investmentCategoryDialogSummary':'#retirementCategoryDialogSummary'),host=dialog.querySelector(investment?'#investmentCategoryDialogTable':'#retirementCategoryDialogTable');
   if(!summary||!host)continue;
   const type=dialog.dataset.retirementType,accountCount=dialog.dataset.stallionId?1:type?profileRows(state[type==='gratuity'?'gratuityAccounts':type]||[]).length:profileRows(state.investments||[]).filter(r=>r.type===dialog.dataset.investmentType).length;
   const metrics=new Map();for(const item of summary.children){const label=item.querySelector('span,small'),value=item.querySelector('strong');if(label&&value)metrics.set(metricKey(label.textContent),metricValue(value.textContent));}
   const identity=dialog.querySelector('header')?.textContent||'';
   for(const row of host.querySelectorAll('tbody tr:not(.investment-desktop-actions-row)')){
    for(const cell of row.querySelectorAll(':scope>td')){
     const label=cell.dataset.mobileLabel||cell.dataset.label||'',key=metricKey(label),value=metricValue(cell.textContent);
     // Equal values with different meanings are never deduplicated. Aggregates
     // remain separate from individual holdings when multiple accounts exist.
     const duplicate=accountCount===1&&!cell.querySelector('button,input,select')&&metrics.has(key)&&metrics.get(key)===value;
     cell.classList.toggle('mobile-summary-duplicate',duplicate);
     const identityDuplicate=accountCount===1&&/^(member|familymember|name|account)$/.test(norm(label))&&cell.textContent.trim()&&identity.includes(cell.textContent.trim());cell.classList.toggle('mobile-identity-duplicate',Boolean(identityDuplicate));
    }
    const actions=row.querySelector('td.investment-row-actions,td.account-action-buttons,td[data-mobile-label="Actions"],td[data-label="Actions"]');
    if(!actions)continue;
    const details=[...row.children].filter(cell=>cell!==actions&&!cell.matches('.mobile-summary-duplicate,.mobile-identity-duplicate'));row.classList.toggle('mobile-one-detail',details.length===1);
    for(const button of actions.querySelectorAll('button')){
     if(originals.has(button))continue;
     const label=button.getAttribute('aria-label')||button.title||button.textContent.trim(),lower=label.toLowerCase();
     const kind=/histor/.test(lower)?'history':/delet/.test(lower)?'delete':/edit/.test(lower)?'edit':/gain|profit/.test(lower)?'gain':/contribution/.test(lower)?'add':/updat|valu/.test(lower)?'update':'other';
     const names={history:'View history',edit:'Edit account',delete:'Delete account',add:'Add contribution',gain:'Update gain/loss',update:'Update value'};
     originals.set(button,button.innerHTML);button.dataset.mobileAccountAction='';button.dataset.mobileActionKind=kind;
     const svg=button.querySelector('svg')?.cloneNode(true),name=document.createElement('span');name.className='mobile-account-action-label';name.textContent=names[kind]||label;
     button.replaceChildren(...(svg?[svg,name]:[name]));
    }
   }
  }
  for(const [button]of originals)if(!button.isConnected)originals.delete(button);
 }
 function schedule(){if(!disposed&&!frame)frame=requestAnimationFrame(scan);}
 const observer=new MutationObserver(schedule);for(const dialog of dialogs)observer.observe(dialog,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});mobile.addEventListener('change',schedule);schedule();
 const reset=window.financeBridge.reset;window.financeBridge.reset=function(){disposed=true;observer.disconnect();cancelAnimationFrame(frame);mobile.removeEventListener('change',schedule);restore();return reset.apply(this,arguments);};
}
