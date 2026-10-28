import {monthClose} from './finance-model.js?v=79';
import {previousMonth,monthEnd,automaticEntries,freshness,monthlyChanges,commitmentPlan} from './finance-insights-model.js';
export function installFinanceInsights(){
 if(window.financeInsights)return;
 const cash=document.getElementById('income-expenses'),dashboard=document.getElementById('dashboard'),investments=document.getElementById('investments');if(!cash||!dashboard||!investments)return;
 const created=[],cleanups=[],make=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
 const append=(parent,tag,text,cls)=>{const n=make(tag,cls,text);parent.append(n);return n;};
 const action=(parent,text,fn)=>{const b=append(parent,'button',text,'btn-small');b.type='button';b.onclick=fn;return b;};
 const read=k=>window.financeReviews?.get(k)||{},money=n=>n===null?'Not recorded':formatCurrency(n);
 const visible=()=>Object.fromEntries(['investments','pf','ppf','nps','income','debts'].map(k=>[k,profileRows(state[k]||[])]));
 const rows=(host,values)=>{const dl=append(host,'dl',undefined,'finance-insight-values');for(const [k,v]of values){append(dl,'dt',k);append(dl,'dd',v);}return dl;};
 const note=(p,t)=>append(p,'p',t,'finance-insight-note');
 const detail=(id,title)=>{const d=make('details','finance-insight-card');d.id=id;append(d,'summary',title);const body=append(d,'div',undefined,'finance-insight-body');created.push(d);return {d,body};};
 const breakdown=detail('cashBalanceBreakdown','How this balance is calculated');cash.querySelector('.transaction-overview').append(breakdown.d);
 const commitments=detail('cashCommitments','Before next planned income');cash.querySelector('.transaction-overview').after(commitments.d);
 const recurringSource=document.getElementById('openRecurringBtn'),recurringLaunch=recurringSource?.closest('.recurring-launch');if(recurringSource){const card=make('div','finance-commitment-card');commitments.d.before(card);card.append(commitments.d);const recurring=make('button','finance-recurring-shortcut','↻ Recurring');recurring.id='cashRecurringShortcut';recurring.type='button';recurring.setAttribute('aria-label','Manage recurring items');recurring.onclick=()=>recurringSource.click();card.append(recurring);created.push(card);if(recurringLaunch){recurringLaunch.hidden=true;cleanups.push(()=>recurringLaunch.hidden=false);}}
 const review=make('aside','finance-insight-card finance-automatic-prompt');review.id='cashAutomaticReview';review.hidden=true;created.push(review);cash.querySelector('.transaction-overview').before(review);
 const changes=detail('monthlyChanges','What changed this month');
 const sync=make('span','finance-bottom-sync');sync.id='financeBottomSync';sync.setAttribute('role','status');sync.setAttribute('aria-live','polite');document.body.append(sync);created.push(sync);
 // Search owns bottom detection, including explicit scroll intent on short pages.
 const search=document.getElementById('openRecordSearch');if(search){const tools=make('div','finance-bottom-tools');tools.id='financeBottomTools';tools.setAttribute('role','group');tools.setAttribute('aria-label','Record search and sync');document.body.append(tools);tools.append(sync,search);created.push(tools);}const bottomObserver=new MutationObserver(()=>paintSync());if(search)bottomObserver.observe(search,{attributes:true,attributeFilter:['class']});cleanups.push(()=>bottomObserver.disconnect());
 const pageMonth=()=>{const kind=cash.dataset.cashKind;return cash.dataset.cashMonth||(kind&&document.getElementById(kind+'HistoryMonth')?.value)||currentMonthKey();};
 function renderBreakdown(){const month=pageMonth(),r=monthClose(state,month),signature=JSON.stringify(r);if(breakdown.body.dataset.signature===signature)return;breakdown.body.dataset.signature=signature;breakdown.body.replaceChildren();note(breakdown.body,'Household cash flow · '+month);rows(breakdown.body,[['Opening balance',money(r.opening)],['Recorded income',money(r.income)],['Recorded expenses (including EMIs)','− '+money(r.expenses)],['PMS transfers','− '+money(r.stallion)],['Available before unrecorded spending',r.opening===null?'Opening balance needed':money(r.available)],['Bank closing balance',money(r.closing)],['Unrecorded spending / balance difference',money(r.house)]]);note(breakdown.body,'The headline shows income minus recorded expenses for the selected profile. This breakdown includes household opening balance and PMS transfers. PF/NPS payroll deductions are not deducted again. Bank closing balance uses next month’s opening balance; other investment transfers are not included in this cash-flow model.');action(breakdown.body,'Review balances',()=>window.financeWorkbench.monthly(month));}
 function scheduledCandidates(today){
  const end=new Date(Date.parse(today+'T12:00:00Z')+60*86400000).toISOString().slice(0,10),rules=new Map((state.recurringRules||[]).map(r=>[r.id,r]));
  const result=PFT_RECURRING.pending(state,end).filter(r=>!r.existing).map(r=>{const rule=rules.get(r.ruleId);let amount=r.amount;if(rule.kind==='emi'){const debt=state.debts.find(d=>d.id===rule.loanId);const quote=debt?PFT_LOAN_LEDGER.quotePayment(debt,state.expenses.filter(e=>e.loanId===debt.id),r.date):null;amount=quote?.error?null:quote?.amount;}
   return {...r,name:rule.name,kind:rule.kind,amount:Number.isFinite(amount)?amount:null};});
  // Forecast only explicit schedules; this never posts a contribution.
  for(const inv of state.investments||[]){if(inv.autoMonthlyContribution!==true||investmentMonthlyAmount(inv)<=0)continue;let date=inv.monthlyContributionNextDate||inv.monthlyContributionDate;if(!validCalendarDate(date||''))continue;const anchor=Number((inv.monthlyContributionDate||date).slice(-2));for(let n=0;date<=end&&n<3;n++,date=addMonthsClamped(date,1,anchor)){if(date<today)continue;const recorded=inv.type==='Stallion PMS'?state.stallionContributions:state.investmentContributions;if(recorded.some(r=>(r.stallionId||r.investmentId)===inv.id&&r.date===date))continue;result.push({date,kind:'investment',name:inv.name||'Investment contribution',amount:investmentMonthlyAmount(inv)});}}
  for(const account of state.ppf||[]){if(retirementMonthlyAmount(account,'ppf')<=0)continue;for(let n=1;n<=2;n++){const date=addMonthsClamped(today.slice(0,7)+'-01',n,1);if(date>end||date<account.date)continue;if((state.retirementContributions||[]).some(r=>r.accountId===account.id&&r.date===date))continue;result.push({date,kind:'investment',name:account.account||'PPF contribution',amount:retirementMonthlyAmount(account,'ppf')});}}
  return result;
 }
 function renderCommitments(){const today=localDateKey(),plan=commitmentPlan(state,today,scheduledCandidates(today)),signature=JSON.stringify([today,pageMonth(),plan]);if(commitments.body.dataset.signature===signature)return;commitments.body.dataset.signature=signature;commitments.body.replaceChildren();commitments.d.hidden=false;commitments.d.querySelector('summary').textContent=plan.nextIncome?'Before next planned income':'Upcoming recorded commitments';note(commitments.body,plan.nextIncome?'Next planned income: '+plan.until+' · expected':'Next 30 days · no upcoming income schedule recorded');rows(commitments.body,[['Estimated available from recorded cash flow',plan.balance.opening===null?'Opening balance needed':money(plan.balance.available)],['Known planned payments',money(plan.total)],['After known planned payments',plan.remaining===null?'More information needed':money(plan.remaining)]]);if(plan.unknown)note(commitments.body,plan.unknown+' payment amount(s) need review.');if(!plan.items.length)note(commitments.body,'No unposted payments scheduled in this period.');for(const r of plan.items.slice(0,6))rows(commitments.body,[[r.name+' · '+r.date+(r.date<today?' · Overdue / unrecorded':''),r.amount===null?'Amount needs review':money(r.amount)]]);if(plan.items.length>6)note(commitments.body,(plan.items.length-6)+' more scheduled payments.');note(commitments.body,'Estimate from household records and configured schedules, not a live bank balance. Expected income is not added. Unscheduled bills, unscheduled investment transfers and unrecorded spending are excluded. PF/NPS payroll deductions are not counted again.');action(commitments.body,'See scheduled payments',()=>window.financeWorkbench.commitments());}
 function renderAutomatic(){const today=localDateKey(),month=pageMonth(),entries=automaticEntries(state,visible(),month,read('paymentStatus')),count=entries.filter(e=>!e.confirmed).length,signature=JSON.stringify([today,month,count]);if(review.dataset.signature===signature)return;review.dataset.signature=signature;review.hidden=!(month===today.slice(0,7)&&monthEnd(today)&&count);review.replaceChildren();if(review.hidden)return;append(review,'strong','Review '+new Date(month+'-01T12:00:00').toLocaleDateString('en-IN',{month:'long'})+' automatic entries');note(review,count+' existing entries to check · confirmation never posts them again');action(review,'Review automatic entries',()=>window.financeWorkbench.automatic(month));}
 function renderChanges(){
  const month=currentMonthKey(),r=monthlyChanges(state,visible(),month),signature=JSON.stringify([month,r]);
  placeChanges();if(changes.body.dataset.signature===signature)return;
  changes.body.dataset.signature=signature;changes.body.replaceChildren();
  const monthLabel=new Date(month+'-01T12:00:00').toLocaleDateString('en-IN',{month:'long'});
  const previousLabel=new Date(previousMonth(month)+'-01T12:00:00').toLocaleDateString('en-IN',{month:'long',year:'numeric'});
  changes.d.querySelector('summary').textContent='What changed in '+monthLabel;
  const heading=append(changes.body,'p','Key recorded changes · '+monthLabel+' compared with '+previousLabel,'finance-highlights-intro');
  const grid=append(changes.body,'div',undefined,'finance-highlights-grid');
  const card=(title,value,kind,caption)=>{
   const item=append(grid,'div',undefined,'finance-highlight finance-highlight-'+kind);
   append(item,'span',title,'finance-highlight-label');
   append(item,'strong',value,'finance-highlight-value');
   append(item,'span',caption,'finance-highlight-caption');
   return item;
  };
  card('Recorded contributions',money(r.contributions),'contributions','Recorded transfers · selected profile');
  card('Debt principal repaid',money(r.principal),'debt','Principal only · selected profile');
  const spending=r.spendingChange;
  const spendingValue=spending===null?'Comparison unavailable':money(Math.abs(spending))+(spending<0?' less':spending>0?' more':' · unchanged');
  card('Recorded spending',spendingValue,spending===null?'neutral':spending<0?'positive':spending>0?'negative':'neutral','Compared with '+previousLabel+' · household-wide');
  const pmsValue=r.pmsGain===null?'Dated snapshots needed':(r.pmsGain>=0?'+ ':'− ')+money(Math.abs(r.pmsGain));
  card('PMS gain change',pmsValue,'pms',r.pmsGain===null?'Opening and closing valuations required':'Based on '+r.pmsCovered+' of '+r.pmsTotal+' holdings');
  const explain=append(changes.body,'details',undefined,'finance-highlights-explain');
  append(explain,'summary','How these figures are calculated');
  note(explain,'Contributions and debt follow the selected profile; expenses are household-wide. Spending compares recorded month totals, including an incomplete current month.');
  note(explain,r.pmsGain===null?'Monthly investment gains need opening and closing dated values. Current balances alone cannot show a monthly gain.':'PMS gain change covers '+r.pmsCovered+' of '+r.pmsTotal+' PMS holdings with dated profit snapshots. Other asset gains are not inferred.');
  action(changes.body,'View cash-flow details',()=>{document.querySelector('.nav-tab[data-tab="income-expenses"]').click();breakdown.d.open=true;breakdown.d.scrollIntoView({block:'nearest'});});
  placeChanges();
 }
 function placeChanges(){const flow=dashboard.querySelector('.flow-home:not([hidden]) .flow-summary');const target=flow||dashboard.querySelector('.dashboard');if(target&&changes.d.previousElementSibling!==target)target.after(changes.d);}
 function valuationFooter(host,accounts){
  host.querySelector(':scope > .finance-valuation-footer')?.remove();
  const header=host.querySelector(':scope > .panel-header');let review=header?.querySelector('.finance-valuation-review');
  // A fixed-interest or no-return holding has no market quote to refresh.
  // Record its cash additions through the existing account-detail contribution action.
  const hasMarketValuation=accounts.some(({kind,row})=>kind==='nps'||(kind==='investments'&&investmentGrowthType(row.type)==='market'));
  if(!accounts.length||host.id==='stallionPmsPanel'||!hasMarketValuation){review?.remove();header?.querySelector('.finance-stale-dot')?.remove();return;}
  if(header&&!review){review=make('button','finance-valuation-review');review.type='button';review.textContent='Update value';}
  const actions=make('div','finance-valuation-footer');actions.style.cssText='display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-top:8px;padding-top:8px;border-top:1px solid var(--border)';
  if(review){review.setAttribute('aria-label','Update value');review.title='Update value';review.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" style="width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8"><path d="M12 5v14M5 12h14"/></svg>';review.style.cssText='display:inline-grid;place-items:center;width:44px;min-width:44px;height:44px;min-height:44px;padding:10px';actions.append(review);host.append(actions);}
  if(!review)return;
  review.onclick=event=>{event.stopPropagation();window.financeWorkbench.valuations(accounts[0].kind,accounts.length===1?accounts[0].row.id:null,accounts.map(item=>item.row.id));};
  const statuses=accounts.map(({kind,row})=>{
   const history=kind==='investments'&&row.type==='Stallion PMS'?(state.stallionProfitHistory||[]).filter(r=>r.stallionId===row.id).map(r=>r.date).sort().at(-1):null;
   const dated={...row,valuationDate:row.valuationDate||history};
   return freshness(kind,dated,null,localDateKey(),kind==='investments'?investmentGrowthType(row.type):'market');
  });
  const stale=statuses.filter(s=>s.due);let dot=host.querySelector('.finance-stale-dot');
  if(stale.length){if(!dot){dot=make('span','finance-stale-dot');dot.setAttribute('role','img');review.before(dot);}dot.setAttribute('aria-label',stale.length+' market valuation'+(stale.length===1?'':'s')+' over 30 days old');dot.title=stale.map(s=>s.label).join(' · ');}
  else dot?.remove();
 }
 function renderValuations(){const v=visible();for(const card of investments.querySelectorAll('.investment-category-card'))valuationFooter(card,v.investments.filter(r=>r.type===card.dataset.investmentType).map(row=>({kind:'investments',row})));for(const card of investments.querySelectorAll('.retirement-account-card[data-retirement-type]')){const kind=card.dataset.retirementType;if(['pf','ppf','nps'].includes(kind))valuationFooter(card,v[kind].map(row=>({kind,row})));else if(kind==='gratuity'){card.querySelector(':scope > .finance-valuation-footer')?.remove();const header=card.querySelector(':scope > .panel-header');header?.querySelector('.finance-valuation-review')?.remove();}}const pms=document.getElementById('stallionPmsPanel');if(pms)valuationFooter(pms,v.investments.filter(r=>r.type==='Stallion PMS').map(row=>({kind:'investments',row})));}
 function paintSync(){const pending=syncRecord?.pending||window.financeReviews?.pending();let text;if(persistenceDirty)text='Device save needs attention';else if(cloudSaveBlocked||window.financeReviews?.problem())text='Sync needs review';else if(pendingSaves)text='Saving on this device…';else if(window.financeStartupChecking)text='Checking cloud changes…';else if(pending)text=navigator.onLine?(syncBusy?'Saved on device · Syncing…':'Saved on device · Waiting to sync'):'Saved on device · Offline';else if(!navigator.onLine)text='Saved on this device · Offline';else if(window.financeReviews?.status()?.startsWith('Checking'))text='Checking shared reviews…';else text=syncRecord?.lastCloudUpdated?'Synced '+new Date(syncRecord.lastCloudUpdated).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}):'Saved on this device';if(sync.textContent!==text)sync.textContent=text;sync.classList.toggle('at-page-bottom',Boolean(search?.classList.contains('at-page-bottom')));}
 let queued=false,disposed=false;function refresh(){if(disposed||queued)return;queued=true;requestAnimationFrame(()=>{queued=false;if(disposed)return;if(cash.classList.contains('active')){renderBreakdown();renderCommitments();renderAutomatic();}if(dashboard.classList.contains('active'))renderChanges();if(investments.classList.contains('active'))renderValuations();paintSync();});}
 const wraps=[];for(const name of ['updateDashboard','renderTransactionOverview','renderInvestments','renderPf','renderPpf','renderNps','storageMessage']){const original=window[name];if(typeof original!=='function')continue;const wrapped=function(...args){const result=original.apply(this,args);if(name==='storageMessage')paintSync();else refresh();return result;};window[name]=wrapped;wraps.push({name,original,wrapped});}
 const pageObserver=new MutationObserver(refresh);for(const host of [cash,dashboard,investments])pageObserver.observe(host,{attributes:true,attributeFilter:['class']});cleanups.push(()=>pageObserver.disconnect());
 let dayTimer;function armDay(){clearTimeout(dayTimer);const next=new Date();next.setHours(24,0,1,0);dayTimer=setTimeout(()=>{refresh();armDay();},next-Date.now());}armDay();cleanups.push(()=>clearTimeout(dayTimer));
 const onVisibility=()=>{if(!document.hidden){refresh();armDay();}};document.addEventListener('visibilitychange',onVisibility);cleanups.push(()=>document.removeEventListener('visibilitychange',onVisibility));
 const listener=()=>refresh();document.addEventListener('finance-review-changed',listener);window.addEventListener('online',listener);window.addEventListener('offline',listener);cleanups.push(()=>{document.removeEventListener('finance-review-changed',listener);window.removeEventListener('online',listener);window.removeEventListener('offline',listener);});
 const appearance=new MutationObserver(refresh);appearance.observe(document.documentElement,{attributes:true,attributeFilter:['data-layout-style','data-theme']});cleanups.push(()=>appearance.disconnect());
 const reset=window.financeBridge.reset;window.financeBridge.reset=function(){disposed=true;for(const fn of cleanups)fn();for(const {name,original,wrapped}of wraps)if(window[name]===wrapped)window[name]=original;for(const n of created)n.remove();for(const n of investments.querySelectorAll('.finance-valuation-footer'))n.remove();delete window.financeInsights;return reset.apply(this,arguments);};
 window.financeInsights={refresh,scheduledCandidates};refresh();
}

