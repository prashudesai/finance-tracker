import {automaticEntries,automaticEntryTitle,pendingAutomaticEntries} from './finance-insights-model.js';
import {cashflowIndex,monthClose,realValue,valuationStatus,automaticCheckKey} from './finance-model.js?v=79';
export function installFinanceWorkbench(){
 // Use one shared model for monthly helpers and recalculated house expense.
 monthTotals=month=>({...cashflowIndex(state).get(month)||{income:0,expenses:0,stallion:0},retirement:retirementOutflow(month)});
 buildMonthlyTotalsIndex=()=>{const index=cashflowIndex(state);for(const [m,row]of index)row.retirement=retirementOutflow(m);return index;};
 recalculateHouseExpenses=()=>{const index=cashflowIndex(state);state.monthlyBalances.sort((a,b)=>b.month.localeCompare(a.month));for(const b of state.monthlyBalances){const r=monthClose(state,b.month,index);b.houseExpense=r.house;b.houseExpenseNextMonth=r.complete?nextMonthKey(b.month):null;}return index;};
 function nextMonthKey(m){const[y,n]=m.split('-').map(Number);return `${n===12?y+1:y}-${String(n===12?1:n+1).padStart(2,'0')}`;}
 const read=key=>window.financeReviews?.get(key)||{};
 const write=(key,data)=>{if(!window.financeReviews)throw Error('Shared reviews are not ready.');return window.financeReviews.setGroup(key,data);};
 const add=(parent,tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;parent.append(e);return e;};
 const button=(parent,text,fn)=>{const b=add(parent,'button',text);b.type='button';b.className='btn-small';b.onclick=()=>Promise.resolve().then(fn).catch(error=>{const msg=add(parent,'p',error.message);msg.setAttribute('role','alert');});return b;};
 const dialog=document.createElement('dialog');dialog.id='financeWorkbenchDialog';dialog.className='finance-workbench-dialog';document.body.append(dialog);
 function open(title){if(dialog.open||dataOperationBusy)return false;dialog.replaceChildren();const header=add(dialog,'header');header.className='finance-workbench-header';const heading=add(header,'h2',title);heading.id='workbenchHeading';dialog.setAttribute('aria-labelledby',heading.id);const close=button(header,'×',()=>dialog.close());close.className='finance-workbench-close';close.setAttribute('aria-label','Close');dialog.showModal();return true;}
 function table(parent,rows){const dl=add(parent,'dl');dl.className='finance-workbench-values';for(const [key,value]of rows){add(dl,'dt',key);add(dl,'dd',value);}return dl;}
 function field(parent,label,type,value){const wrap=add(parent,'label',label),e=add(wrap,'input');e.type=type;e.value=value;e.setAttribute('aria-label',label);return e;}
 // On mobile Safari, native month/date fields can show only the calendar icon.
 // Mirror the selected date visibly without replacing its actual input or value.
 function readableCalendar(input){
  const label=input.closest('label');if(!label||!['date','month'].includes(input.type))return input;
  const control=add(label,'span');control.className='valuation-date-control';
  control.append(input);
  const output=add(control,'span');output.className='valuation-date-display';
  output.setAttribute('aria-hidden','true');
  const render=()=>{
   const value=input.value,valid=input.type==='month'?/^\d{4}-\d{2}$/.test(value):/^\d{4}-\d{2}-\d{2}$/.test(value);
   const date=valid?new Date(value+(input.type==='month'?'-01':'')+'T12:00:00'):null;
   output.textContent=date&&!Number.isNaN(date.getTime())?date.toLocaleDateString('en-IN',input.type==='month'?{month:'long',year:'numeric'}:{day:'numeric',month:'short',year:'numeric'}):'Choose '+(input.type==='month'?'month':'date');
  };
  input.addEventListener('input',render);input.addEventListener('change',render);render();
  return input;
 }
 let contributionEdit=null;
 const isReviewEditing=kind=>contributionEdit?.kind===kind;
 function returnToReview(){
  const context=contributionEdit;if(!context)return;contributionEdit=null;context.saveButton.textContent=context.label;context.modal.inert=false;
  const collection=context.kind==='retirement'?'retirementContributions':context.kind==='stallion'?'stallionContributions':'investmentContributions',row=state[collection]?.find(r=>r.id===context.id);
  document.getElementById('retirementContributionHistoryModal').hidden=true;syncInvestmentOverlayBodyLock();monthly(row?.date?.slice(0,7)||context.month,context.options);
  const entry=[...dialog.querySelectorAll('[data-contribution-id]')].find(e=>e.dataset.contributionId===context.id);
  if(entry){for(let node=entry;node&&node!==dialog;node=node.parentElement){if(node.tagName==='DETAILS')node.open=true;}[...entry.querySelectorAll('button')].at(-1)?.focus();}
 }
 async function editForReview(row,month,options={}){
  if((state.income||[]).includes(row)||(state.expenses||[]).includes(row)){dialog.close();try{if((state.income||[]).includes(row))await editIncome(row.id);else await editExpense(row.id);}finally{monthly(month,options);}return;}
  const retirement=(state.retirementContributions||[]).includes(row),stallion=(state.stallionContributions||[]).includes(row),kind=retirement?'retirement':stallion?'stallion':'investment';dialog.close();
  if(retirement)editRetirementContribution(row.id);else if(stallion)editStallionContrib(row.id);else{openInvestmentContributionModal(row.investmentId);editInvestmentContribution(row.id);}
  const modal=document.getElementById(retirement?'accountUpdateModal':stallion?'investmentEditModal':'investmentContributionModal'),saveButton=document.getElementById(retirement?'saveAccountUpdate':stallion?'saveInvestmentEdit':'saveInvestmentContribution');
  contributionEdit={id:row.id,kind,month,options,modal,saveButton,label:saveButton.textContent,saving:false};saveButton.textContent='Save & return to review';
 }
 async function saveAndReturn(saving,finish){
  const context=contributionEdit;if(!context)return;context.saving=true;context.modal.inert=true;
  try{if(!await saving){alert('The correction was not saved. Your editor is still open; retry or export your records.');return false;}finish();returnToReview();return true;}
  finally{context.saving=false;context.modal.inert=false;}
 }
 const cancelReviewEdit=e=>{const context=contributionEdit;if(!context)return;if(e.type==='keydown'&&e.key!=='Escape')return;if(e.type==='click'&&!e.target.closest('[data-close-account-update],[data-close-edit],[data-close-investment-contribution]'))return;if(context.saving){e.preventDefault();e.stopImmediatePropagation();return;}setTimeout(()=>{if(contributionEdit===context&&context.modal.hidden)returnToReview();},0);};
 document.addEventListener('click',cancelReviewEdit,true);document.addEventListener('keydown',cancelReviewEdit,true);
 function monthly(month=currentMonthKey(),options={}){if(!open(options.automaticOnly?'Review automatic entries':'Review month'))return;const input=readableCalendar(field(dialog,'Month','month',month)),body=add(dialog,'section');
  const render=()=>{const openContributionIds=new Set([...body.querySelectorAll('.automatic-entry-card[open]')].map(node=>node.dataset.contributionId));const wasAutomaticListOpen=Boolean(body.querySelector('details:has(.automatic-entry-card)')?.open);body.replaceChildren();const r=monthClose(state,input.value);const money=n=>n===null?'Missing':formatCurrency(n);
   const firstTrackedMonth=(state.monthlyBalances||[]).map(b=>b.month).filter(Boolean).sort()[0];
   const beforeTracking=Boolean(firstTrackedMonth&&r.month<firstTrackedMonth);
   if(!options.automaticOnly){
    body.classList.add('month-review-body');
    const summary=add(body,'div');summary.className='month-review-summary';
    const heading=add(summary,'h3',new Date(r.month+'-01T12:00:00').toLocaleDateString('en-IN',{month:'long',year:'numeric'}));
    const saved=read('closedMonths')[r.month],signature=JSON.stringify(r);
    const reviewed=saved?.signature===signature;
    const status=add(summary,'p',beforeTracking?'Before tracking started':reviewed?'Reviewed ✓':saved?'Review again — figures changed':r.complete?'Ready to mark reviewed':'Bank balance needed');
    status.className='month-review-status'+(r.complete?' is-ready':' is-warning');
    const figures=add(body,'div');figures.className='month-review-figures';
    for(const [label,value] of [['Income',money(r.income)],['Expenses (including EMIs)',money(r.expenses)],['Closing bank balance',money(r.closing)]]){
      const item=add(figures,'div');item.className='month-review-figure';
      add(item,'span',label);add(item,'strong',value);
    }
    const actions=add(body,'div');actions.className='month-review-actions';
    const navigateBalance=(month)=>{dialog.close();document.querySelector('.nav-tab[data-tab="income-expenses"]').click();const tools=document.querySelector('#income-expenses .cash-tools');if(tools)tools.open=true;const form=document.getElementById('balanceEntryForm');if(form.hidden)document.getElementById('toggleBalanceForm').click();document.getElementById('balanceMonth').value=month;document.getElementById('balanceStartAmount').value=state.monthlyBalances.find(b=>b.month===month)?.startBalance??'';form.scrollIntoView({block:'nearest'});document.getElementById('balanceStartAmount').focus();};
    if(beforeTracking){
      const skipped=add(body,'p','Tracking began in '+new Date(firstTrackedMonth+'-01T12:00:00').toLocaleDateString('en-IN',{month:'long',year:'numeric'})+'. Earlier months do not need review.');skipped.className='month-review-help';
    }else if(!r.complete){
      const missing=add(body,'p','Set the bank balance for '+(r.opening===null?'this month':'the next month')+' to complete this review. Each balance is entered only once and is also the previous month’s closing balance.');missing.className='month-review-help';missing.setAttribute('role','status');
    }else{
      const help=add(body,'p',reviewed?'This month has been marked reviewed.':'Check the amounts above, then mark the month reviewed.');help.className='month-review-help';help.setAttribute('role','status');
    }
    if(!beforeTracking&&!r.complete){
      const balanceMonth=r.opening===null?r.month:nextMonthKey(r.month);
      const fix=button(actions,'Set bank balance — '+new Date(balanceMonth+'-01T12:00:00').toLocaleDateString('en-IN',{month:'short',year:'numeric'}),()=>navigateBalance(balanceMonth));fix.classList.add('month-review-primary');fix.disabled=window.financeCloud.canEdit===false;
    }
    if(r.complete&&!beforeTracking){
      const mark=button(actions,reviewed?'Reviewed ✓':'Mark as reviewed',async()=>{if(mark.disabled)return;mark.disabled=true;mark.textContent='Saving review…';try{await window.financeBridge.settle();if(window.financeBridge.dirty())throw Error('Finish saving financial changes before marking the month reviewed.');const latest=monthClose(state,input.value);if(!latest.complete)throw Error('Add the missing balances before marking this month reviewed.');const data=read('closedMonths');data[latest.month]={signature:JSON.stringify(latest),at:new Date().toISOString()};await write('closedMonths',data);render();}catch(error){mark.disabled=false;mark.textContent='Mark as reviewed';throw error;}});
      mark.classList.add('month-review-primary');mark.disabled=reviewed||window.financeCloud.canEdit===false;
    }
    const details=add(body,'details');details.className='month-review-details';
    add(details,'summary','View calculation details');
    table(details,[['Opening balance (selected month)',money(r.opening)],['Recorded income',money(r.income)],['Recorded expenses (including EMIs)',money(r.expenses)],['PMS contributions',money(r.stallion)],['Available before unrecorded house spending',money(r.available)],['Closing balance = next month opening',money(r.closing)],['Residual house expense',money(r.house)]]);
    if(!beforeTracking){const balanceMonth=nextMonthKey(r.month);
      const edit=button(details,'Update bank balance — '+new Date(balanceMonth+'-01T12:00:00').toLocaleDateString('en-IN',{month:'short',year:'numeric'}),()=>navigateBalance(balanceMonth));edit.disabled=window.financeCloud.canEdit===false;
    }
    if(saved&&!reviewed)add(details,'p','Financial records changed since your last review. Please review again.');
   }
   const visible=Object.fromEntries(['investments','pf','ppf','nps','income'].map(k=>[k,profileRows(state[k]||[])]));
   const paymentMarks=read('paymentStatus');
   const scheduled=beforeTracking?[]:pendingAutomaticEntries(state,visible,r.month,paymentMarks,localDateKey()).map(e=>e.row);
   if(!scheduled.length&&options.automaticOnly)add(body,'p','No automatic entries need verification.');
   if(scheduled.length){const detail=add(body,'details');add(detail,'summary',scheduled.length+' automatically posted entries');detail.open=options.automaticOnly===true||wasAutomaticListOpen;add(detail,'p','Already included in balances. Confirming payment does not post the contribution again.');for(const row of scheduled){const box=add(detail,'details'),key=automaticCheckKey(row),payment=paymentMarks[key],paid=payment?.status==='paid'&&payment.amount===row.amount&&(payment.epsAmount||0)===(row.epsAmount||0);box.dataset.contributionId=row.id;box.className='automatic-entry-card';box.open=openContributionIds.has(row.id);
const rowSummary=add(box,'summary');rowSummary.className='automatic-entry-summary';
const copy=add(rowSummary,'span');copy.className='automatic-entry-copy';
add(copy,'strong',automaticEntryTitle(row,visible));
add(copy,'small',new Date(row.date+'T12:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}));
const right=add(rowSummary,'span');right.className='automatic-entry-value';
add(right,'strong',formatCurrency(row.amount));
const paidStatus=add(right,'small',paid?'Verified':'Unverified');paidStatus.className=paid?'is-verified':'is-unverified';
const actions=add(box,'div');actions.className='automatic-entry-actions';
const date=readableCalendar(field(actions,'Payment date','date',paid?payment.date:row.date));
const edit=button(actions,'Edit amount',()=>editForReview(row,input.value,options));edit.disabled=window.financeCloud.canEdit===false;const mark=button(actions,paid?'Undo payment confirmation':'Mark paid from statement',async()=>{await window.financeBridge.settle();if(window.financeBridge.dirty())throw Error('Finish saving financial changes before confirming payment.');if(!paid&&(!validCalendarDate(date.value)||date.value>localDateKey()))throw Error('Choose a valid payment date through today.');const payments=read('paymentStatus');payments[key]={status:paid?'unverified':'paid',date:paid?null:date.value,amount:row.amount,epsAmount:row.epsAmount||0,at:new Date().toISOString(),by:window.financeCloud.email};await write('paymentStatus',payments);render();});mark.disabled=window.financeCloud.canEdit===false;}}
  };input.onchange=render;render();
 }

 function valuations(onlyKind=null,onlyId=null,onlyIds=null){
  if(!open('Valuation freshness'))return;
  const intro=add(dialog,'p','Valuation confirmations sync with shared reviews. Changing a balance requires confirmation again.');
  intro.className='valuation-intro';
  const list=add(dialog,'div');list.className='valuation-account-list';
  const stamps=read('valuations');
  for(const kind of ['investments','pf','ppf','nps'])for(const row of profileRows(state[kind]||[])){
   if(onlyKind&&(kind!==onlyKind||(onlyId&&row.id!==onlyId)||(onlyIds&&!onlyIds.includes(row.id))))continue;
   const card=add(list,'section');card.className='valuation-account';
   const top=add(card,'div');top.className='valuation-account-top';
   const heading=add(top,'div');add(heading,'h3',row.name||row.account||row.scheme||row.type||kind.toUpperCase());
   const key=kind+':'+row.id;
   const status=add(heading,'p',valuationStatus(row,stamps[key],localDateKey()));status.className='valuation-account-status';
   const balance=add(top,'div');balance.className='valuation-account-balance';
   add(balance,'span','Current value');add(balance,'strong',formatCurrency(row.current));
   const date=field(card,'Valuation date','date',stamps[key]?.date||localDateKey());
   const dateLabel=date.closest('label');dateLabel?.classList.add('valuation-account-date');
   // iOS Safari can suppress the visible value of a native date input in dark dialogs.
   // Keep the real date input/picker and show an independent, always-readable value.
   const dateControl=add(dateLabel,'span');dateControl.className='valuation-date-control';
   dateControl.append(date);
   const dateDisplay=add(dateControl,'span');dateDisplay.className='valuation-date-display';
   dateDisplay.setAttribute('aria-hidden','true');
   const displayDate=()=>{
    const raw=date.value;
    const parsed=raw&&/^\d{4}-\d{2}-\d{2}$/.test(raw)?new Date(raw+'T12:00:00'):null;
    dateDisplay.textContent=parsed&&!Number.isNaN(parsed.getTime())
     ?parsed.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})
     :'Choose valuation date';
   };
   date.addEventListener('input',displayDate);
   date.addEventListener('change',displayDate);
   displayDate();
   const actions=add(card,'div');actions.className='valuation-account-actions';
   const confirm=button(actions,'Confirm value as of date',async()=>{
    if(!validCalendarDate(date.value)||date.value>localDateKey())throw Error('Choose a valid date through today.');
    const latest=read('valuations');latest[key]={date:date.value,value:row.current};
    await write('valuations',latest);status.textContent=valuationStatus(row,latest[key],localDateKey());
   });
   confirm.classList.add('valuation-confirm');confirm.disabled=window.financeCloud.canEdit===false;
   const update=button(actions,['pf','ppf'].includes(kind)?'Add contribution':'Update balance',()=>{
    dialog.close();
    if(['pf','ppf'].includes(kind))openManualRetirementContribution(kind,row.id);
    else if(kind==='investments')editInvestment(row.id);
    else openInvestmentEditModal(kind,row.id);
   });
   update.disabled=window.financeCloud.canEdit===false;
   const returns=add(card,'details');returns.className='valuation-return-basis';add(returns,'summary','Return basis');
   const gain=Number(row.current)-Number(row.invested??row.current);
   table(returns,[['Gain / loss',formatCurrency(gain)]]);
   if(kind==='nps'||kind==='investments'){
    const xirr=kind==='nps'?npsXirr(row):row.type==='Stallion PMS'?stallionXirr(row):investmentXirr(row);
    add(returns,'p',xirr===null?'XIRR unavailable: check dated contributions and the opening investment balance.':'XIRR from dated cash flows: '+(xirr*100).toFixed(2)+'%');
    add(returns,'p','CAGR compares opening and closing amounts; XIRR accounts for dated contributions. Neither is a forecast.');
   }
  }
 }

 function planning(){if(!open('Portfolio goal planner'))return;const saved=read('planning');
  const years=field(dialog,'Years to goal','number',saved.years||5);years.min='1';years.max='40';
  const inflation=field(dialog,'Annual inflation assumption (%)','number',saved.inflation??6);inflation.min='0';inflation.max='30';inflation.step='0.1';
  const target=field(dialog,'Portfolio goal in today’s rupees','number',saved.target||'');target.min='0';
  const body=add(dialog,'section');body.setAttribute('aria-live','polite');
  button(dialog,'Calculate scenarios',async()=>{const y=Number(years.value),i=Number(inflation.value),t=Number(target.value);if(!years.value||!inflation.value||!Number.isInteger(y)||y<1||y>40||!Number.isFinite(t)||t<0)throw Error('Enter valid years, inflation and a nonnegative target.');realValue(0,i,y);
   const assets=growthProjectionAssets(),results=['stress','base','optimistic'].map(s=>{const nominal=runGrowthProjection(assets,y,s).ending;return {scenario:s,nominal,real:realValue(nominal,i,y)};});body.replaceChildren();
   add(body,'p','Selected profile: '+(isCombinedFamilyProfile()?'Combined family':activeFamilyProfile)+'. Portfolio only; debt and gratuity excluded. Uses your existing projection assumptions.');
   for(const r of results)table(body,[[r.scenario+' · projected portfolio',formatCurrency(r.nominal)],['In today’s rupees',formatCurrency(r.real)],...(t>0?[['Gap to goal in today’s rupees',formatCurrency(Math.max(0,t-r.real))]]:[])]);
   if(window.financeCloud.canEdit!==false)await write('planning',{years:y,inflation:i,target:t});
  });
 }
 function commitments(){if(!open('Upcoming recorded commitments'))return;const today=localDateKey(),end=new Date(today+'T12:00:00');end.setDate(end.getDate()+60);const until=end.toISOString().slice(0,10);const rules=new Map((state.recurringRules||[]).map(r=>[r.id,r]));const due=PFT_RECURRING.pending(state,until);if(!due.length)add(dialog,'p','No pending recurring items in the next 60 days.');for(const row of due){const rule=rules.get(row.ruleId);table(dialog,[[rule?.name||row.ruleId,row.date],['Type',rule?.kind||''],['Amount',Number.isFinite(row.amount)?formatCurrency(row.amount):'From loan schedule'],['Status',row.existing?'Recorded match; review in recurring entries':row.date<today?'Overdue / not recorded':'Scheduled / not recorded']]);}}
 async function reviewImportConflict(){
  if(!open('Review imported shared reviews'))return;const status=add(dialog,'p','Loading the latest cloud reviews…');
  try{const versions=await window.financeReviews.inspectRestore();status.textContent='Choose the review data to use with your imported financial records. Financial sync still checks for newer cloud records.';
   const details=add(dialog,'details');add(details,'summary','Compare backup and cloud reviews');const pre=add(details,'pre',JSON.stringify(versions,null,2));pre.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere';
   for(const [label,keep]of [['Use reviews from this backup',true],['Keep latest cloud reviews',false]])button(dialog,label,async()=>{if(!confirm(label+'? Export a backup first if you need to keep both versions.'))return;await window.financeReviews.resolveRestore(keep);dialog.close();syncDetails();});
  }catch(error){add(dialog,'p',error.message);}
 }
 function syncDetails(){if(!open('Sync details'))return;const pending=Boolean(syncRecord?.pending||pendingSaves||persistenceDirty);table(dialog,[['Device save',persistenceDirty?'Needs attention':pendingSaves?'Saving':'Saved'],['Cloud',cloudSaveBlocked?'Review conflict or access':pending?'Pending':navigator.onLine?'Synced':'Offline'],['Last cloud sync',syncRecord?.lastCloudUpdated?new Date(syncRecord.lastCloudUpdated).toLocaleString():'Not recorded']]);add(dialog,'p',window.financeReviews?.status()||'Shared reviews are not ready.');button(dialog,'Retry review sync',()=>window.financeReviews?.retry());if(window.financeReviews?.hasRestore())button(dialog,'Resolve backup review sync',()=>{dialog.close();reviewImportConflict();});button(dialog,'Export review changes',()=>{const blob=new Blob([JSON.stringify(window.financeReviews?.exportPending(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='review-changes.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});button(dialog,'Reload shared reviews',async()=>{const pending=window.financeReviews.pending();if(pending&&!confirm('Discard this device’s unsynced review changes and load shared reviews? Financial records will not change.'))return;await window.financeReviews.reload(pending);dialog.close();syncDetails();});button(dialog,'Retry sync',async()=>{await window.financeBridge.retry();dialog.close();syncDetails();});button(dialog,'Export device backup',()=>window.financeBridge.exportUnsaved());if(cloudSaveBlocked)button(dialog,'Review conflict',()=>{dialog.close();window.resolveTrackerConflict?.();});}
 function audit(){if(!open('Check financial totals'))return;const issues=[],index=buildMonthlyTotalsIndex();for(const month of cashflowIndex(state).keys()){
   const r=monthClose(state,month),t=monthTotals(month),indexed=monthTotalsFromIndex(index,month);for(const k of ['income','expenses','stallion'])if(Math.abs(r[k]-t[k])>.005||Math.abs(r[k]-indexed[k])>.005)issues.push(month+' '+k);
   const balance=state.monthlyBalances.find(b=>b.month===month);if(balance&&r.house!==null&&Math.abs(r.house-balance.houseExpense)>.005)issues.push(month+' house expense');
  }
  const d=window.PFT_DASHBOARD_INSIGHTS;if(d&&d.currentMonthStr===currentMonthKey()){const r=monthClose(state,currentMonthKey());if(Math.abs(r.available-d.surplusBalance)>.005)issues.push('Dashboard available balance');if(Math.abs(d.totalAssets-d.totalDebts-d.netWorth)>.005)issues.push('Dashboard net worth');}
  add(dialog,'p',issues.length?'Review: '+issues.join(', '):'Monthly cash-flow helpers, house-expense balances and available dashboard totals reconcile.');button(dialog,'Run full record health checks',()=>{dialog.close();runDataHealth();});
 }
 function tools(host,title,actions){if(!host)return;const details=add(host,'details');details.className='finance-workbench-tools';const summary=add(details,'summary');add(summary,'span',title);if(title==='Month review'){const hint=add(summary,'span','Review available');hint.className='month-review-hint';}for(const [label,fn]of actions)button(details,label,fn);}
 // The shortcut follows the selected cash-flow month and its saved review signature.
 const cashPage=document.getElementById('income-expenses');
 const selectedCashMonth=()=>cashPage?.dataset.cashMonth||currentMonthKey();
 let reviewShortcut=null;
 function refreshMonthReviewShortcut(){
  if(!reviewShortcut)return;
  const month=selectedCashMonth();
  const reviewed=read('closedMonths')[month]?.signature===JSON.stringify(monthClose(state,month));
  reviewShortcut.parentElement.hidden=reviewed;
  reviewShortcut.textContent=month===currentMonthKey()?'Review this month':'Review selected month';
  reviewShortcut.setAttribute('aria-label','Review cash flow for '+new Date(month+'-01T12:00:00').toLocaleDateString('en-IN',{month:'long',year:'numeric'}));
 }
 document.addEventListener('finance-review-changed',refreshMonthReviewShortcut);
 function refreshCommitmentsPreview(){
  refreshMonthReviewShortcut();
  const host=document.getElementById('cashFlowCommitmentsPreview');if(!host)return;
  host.replaceChildren();
  const today=localDateKey(),end=new Date(today+'T12:00:00');
  end.setDate(end.getDate()+60);
  const until=[end.getFullYear(),String(end.getMonth()+1).padStart(2,'0'),String(end.getDate()).padStart(2,'0')].join('-');
  const rules=new Map((state.recurringRules||[]).map(rule=>[rule.id,rule]));
  let due;
  try{due=PFT_RECURRING.pending(state,until).filter(row=>row.date>=today&&!row.existing).sort((a,b)=>a.date.localeCompare(b.date));}
  catch(error){add(host,'p','Upcoming commitments are temporarily unavailable.');return;}
  if(!due.length){add(host,'p','No unrecorded recurring commitments scheduled in the next 60 days.');return;}
  const list=add(host,'ul');list.className='cash-flow-commitment-list';
  for(const row of due.slice(0,3)){
   const item=add(list,'li'),label=add(item,'span'),rule=rules.get(row.ruleId);
   add(label,'strong',rule?.name||'Recurring commitment');add(label,'small',row.date);
   add(item,'b',Number.isFinite(row.amount)?formatCurrency(row.amount):'Schedule-based');
  }
  if(due.length>3)add(host,'p',`+${due.length-3} more commitments in the next 60 days`);
 }
 // Keep a single review CTA when the selected month needs attention.
 // Upcoming commitments remain available in the section below.
 const cashIntro=document.querySelector('#income-expenses .transaction-intro');
 if(cashIntro){
  const shortcuts=document.createElement('div');shortcuts.className='cash-flow-quick-actions';cashIntro.after(shortcuts);
  reviewShortcut=button(shortcuts,'Review this month',()=>monthly(selectedCashMonth()));
  refreshMonthReviewShortcut();
 }
 const previewHost=document.querySelector('#income-expenses .cash-flow-trend-panel');
 if(previewHost){
  const preview=document.createElement('section');preview.id='cashFlowCommitmentsPanel';preview.className='cash-flow-commitments-panel panel';
  const heading=add(preview,'div');heading.className='cash-flow-commitments-heading';
  add(heading,'h2','Upcoming commitments');button(heading,'View all',commitments);
  const content=add(preview,'div');content.id='cashFlowCommitmentsPreview';content.setAttribute('aria-live','polite');
  previewHost.after(preview);refreshCommitmentsPreview();
 }
 tools(document.getElementById('income-expenses'),'Month review',[['Review month',monthly],['Upcoming commitments',commitments]]);
 tools(document.getElementById('investments'),'Record freshness',[['Review valuation dates',valuations]]);
 tools(document.getElementById('growth-projection'),'Goal planning',[['Portfolio goal planner',planning]]);
 tools(document.getElementById('settingsRecordsPanel'),'Calculation checks',[['Check financial totals',audit],['Sync details',syncDetails]]);
 window.financeWorkbench={refreshCommitmentsPreview,automatic:month=>monthly(month,{automaticOnly:true}),monthly,valuations,planning,audit,commitments,syncDetails,isReviewEditing,saveAndReturn};
 const reset=window.financeBridge.reset;window.financeBridge.reset=function(){document.removeEventListener('click',cancelReviewEdit,true);document.removeEventListener('keydown',cancelReviewEdit,true);document.removeEventListener('finance-review-changed',refreshMonthReviewShortcut);reviewShortcut?.parentElement?.remove();document.getElementById('cashFlowCommitmentsPanel')?.remove();contributionEdit=null;if(dialog.open)dialog.close();dialog.remove();return reset.apply(this,arguments);};
}
