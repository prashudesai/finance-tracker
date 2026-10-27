// Reuse the existing financial controls; this module owns presentation only.
export function installCashFlow(){
 const page=document.getElementById('income-expenses');if(!page||window.financeCashFlow)return;
 const make=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls;if(text)n.textContent=text;return n;};
 const grid=page.querySelector('.transaction-grid'),overview=page.querySelector('.transaction-overview');
 if(!grid||!overview)return;
 const mobile=matchMedia('(max-width:700px)');let compact=mobile.matches;
 const period=page.querySelector('#transactionOverviewMonth'),monthFilter=make('select','transaction-period pft-native-filter');monthFilter.id='cashMonthFilter';monthFilter.setAttribute('aria-label','Cash flow month');period.after(monthFilter);period.hidden=true;
 function refreshMonthFilter(){const keys=[currentMonthKey(),...(state.income||[]).map(r=>r.date.slice(0,7)),...(state.expenses||[]).map(r=>r.date.slice(0,7)),...(state.monthlyBalances||[]).map(r=>r.month)],years=[...new Set(keys.map(m=>m.slice(0,4)))],months=years.flatMap(year=>Array.from({length:12},(_,i)=>year+'-'+String(i+1).padStart(2,'0'))).filter(m=>/^\d{4}-\d{2}$/.test(m)&&m<=currentMonthKey()).sort().reverse();const chosen=page.dataset.cashMonth||currentMonthKey(),signature=JSON.stringify(months);if(monthFilter.dataset.signature!==signature){monthFilter.replaceChildren(...months.map(month=>{const option=document.createElement('option');option.value=month;option.textContent=new Date(month+'-01T12:00:00').toLocaleDateString('en-IN',{month:'long',year:'numeric'});return option;}));monthFilter.dataset.signature=signature;}monthFilter.value=months.includes(chosen)?chosen:currentMonthKey();}
 monthFilter.onchange=()=>{page.dataset.cashMonth=monthFilter.value;transactionHistoryPages.income=transactionHistoryPages.expense=1;renderIncome();renderExpenses();renderTransactionOverview();window.financeInsights?.refresh();};

 const originalTitle=page.querySelector('.transaction-intro h1').textContent,originalNet=overview.querySelector('.transaction-metric-net .transaction-metric-label').textContent;
 page.classList.add('cash-flow-layout');page.dataset.cashKind='expense';
 page.querySelector('.transaction-intro h1').textContent='Cash flow';
 overview.querySelector('.transaction-metric-net .transaction-metric-label').textContent='Balance after expenses';
 const bar=make('div','cash-balance');bar.innerHTML='<div class="cash-balance-track" role="img"><span class="cash-balance-remaining"></span><span class="cash-balance-spent"></span></div><p class="cash-balance-caption" role="status"></p>';
 overview.append(bar);
 const controls=make('div','cash-controls flow-tabs');controls.setAttribute('role','tablist');controls.setAttribute('aria-label','Cash flow record type');
 const dialog=make('dialog','cash-entry-dialog');dialog.id='cashEntryDialog';dialog.setAttribute('aria-labelledby','cashEntryTitle');
 const heading=make('header','cash-entry-heading'),back=make('button','btn-secondary','← Back'),title=make('h2','','Add expense');title.id='cashEntryTitle';back.type='button';heading.append(back,title);
 const status=make('p','cash-entry-status');status.setAttribute('role','status');dialog.append(heading,status);document.body.append(dialog);
 const entries={},histories={},tabs={},pending={},moved=[];let selectedKind='expense',active=null,trigger=null,scroll=0,savedRow=null;
 for(const kind of ['income','expense']){
  const label=kind==='income'?'Income':'Expenses',button=make('button','',label);button.type='button';button.id='cashTab-'+kind;button.setAttribute('role','tab');button.setAttribute('aria-controls','cashHistory-'+kind);controls.append(button);tabs[kind]=button;
  const panel=make('section','cash-entry-panel panel');panel.dataset.cashEntryKind=kind;panel.hidden=true;dialog.append(panel);entries[kind]=panel;
  for(const original of page.querySelectorAll('.transaction-panel-'+kind)){
   const history=original.querySelector('.history-section');
   if(history){histories[kind]=original;original.id='cashHistory-'+kind;original.setAttribute('role','tabpanel');original.setAttribute('aria-labelledby',button.id);original.dataset.cashHistoryKind=kind;
    const add=make('button','btn-primary cash-add','+ Add '+kind);add.type='button';add.dataset.cashAdd=kind;history.querySelector('.panel-header').prepend(add);add.onclick=()=>open(kind,add);}
   for(const node of [...original.children].filter(n=>n.matches('.form-grid,.transaction-submit'))){const marker=document.createComment('cash-entry-home');node.before(marker);moved.push({node,marker,kind});panel.append(node);}
   if(!history)original.classList.add('cash-entry-home');
  }
  const submit=document.getElementById(kind==='income'?'addIncomeBtn':'addExpenseBtn');submit.textContent='Save '+kind;
  const cancel=make('button','btn-secondary cash-cancel','Cancel');cancel.type='button';cancel.onclick=close;panel.querySelector('.transaction-submit').append(cancel);
  for(const field of panel.querySelectorAll('input[id],select[id],textarea[id]')){const label=field.closest('.form-group')?.querySelector('label');if(label&&!label.htmlFor)label.htmlFor=field.id;}
  panel.querySelector('#'+kind+'Amount')?.closest('.form-group')?.classList.add('cash-amount-field');
  button.onclick=()=>select(kind);
  button.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?'income':e.key==='End'?'expense':kind==='income'?'expense':'income';select(next);tabs[next].focus();}};
 }
 grid.before(controls);
 const recurring=page.querySelector('.recurring-launch');if(recurring)grid.after(recurring);
 const surplus=page.querySelector('.transaction-surplus'),surplusHome=document.createComment('cash-surplus-home');let tools;if(surplus){surplus.before(surplusHome);tools=make('details','cash-tools');const summary=make('summary','','Monthly surplus & opening balance');surplus.before(tools);tools.append(summary,surplus);}
 function select(kind){if(!histories[kind])return;if(compact&&page.dataset.cashMonth&&document.getElementById(kind+'HistoryMonth').value!==page.dataset.cashMonth)(kind==='income'?renderIncome:renderExpenses)();selectedKind=kind;if(compact)page.dataset.cashKind=kind;for(const name of ['income','expense']){histories[name].hidden=compact&&name!==kind;tabs[name].setAttribute('aria-selected',String(name===kind));tabs[name].tabIndex=name===kind?0:-1;}renderTransactionOverview();}
 function decorateHistory(kind){if(!compact)return;for(const row of document.getElementById(kind==='income'?'incomeBody':'expenseBody').querySelectorAll('tr[data-cash-record]')){
  const cell=row.querySelector(kind==='income'?'td[data-label=Source]':'td[data-label=Category]');
  if(cell&&!cell.querySelector('.cash-category-icon')){const icon=make('span','cash-category-icon');icon.setAttribute('aria-hidden','true');icon.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 8h14l-1 12H6L5 8ZM9 8V6a3 3 0 0 1 6 0v2M9 12v4m6-4v4"/></svg>';cell.prepend(icon);}
  row.classList.add('cash-editable-record');row.tabIndex=0;row.setAttribute('aria-label','Edit '+kind+' · '+cell?.textContent.trim());
 }}
 const historyObserver=new MutationObserver(()=>{decorateHistory('income');decorateHistory('expense');});
 for(const kind of ['income','expense'])historyObserver.observe(document.getElementById(kind==='income'?'incomeBody':'expenseBody'),{childList:true});
 decorateHistory('income');decorateHistory('expense');
 const editRow=event=>{
  if(!compact)return;
  const row=event.target.closest('tr[data-cash-record]');if(!row)return;
  const interactive=event.target.closest('button,a,input,select,textarea,[tabindex="0"]:not(tr)');if(interactive&&row.contains(interactive))return;
  if(event.type==='keydown'&&!['Enter',' '].includes(event.key))return;
  if(event.type==='keydown')event.preventDefault();
  if(window.getSelection()?.toString())return;
  row.querySelector('button[aria-label^="Edit"]')?.click();
 };
 page.addEventListener('click',editRow);page.addEventListener('keydown',editRow);
 const historyFilterChange=event=>{
  if(!event.target.matches('#incomeHistoryMonth,#expenseHistoryMonth,#incomeHistoryFinancialYear,#expenseHistoryFinancialYear'))return;
  delete page.dataset.cashMonth;
  queueMicrotask(()=>{const kind=event.target.id.startsWith('income')?'income':'expense';page.dataset.cashMonth=document.getElementById(kind+'HistoryMonth').value;renderIncome();renderExpenses();refreshMonthFilter();renderTransactionOverview();window.financeInsights?.refresh();});
 };
 page.addEventListener('change',historyFilterChange,true);
 function close(){if(active&&pending[active]?.busy)return;dialog.close();}
 back.onclick=close;dialog.addEventListener('cancel',e=>{if(active&&pending[active]?.busy)e.preventDefault();});
 dialog.addEventListener('close',()=>{if(dialog.open)return;document.body.classList.remove('cash-entry-open');active=null;window.scrollTo({top:scroll,behavior:'instant'});trigger?.focus({preventScroll:true});savedRow?.scrollIntoView({block:'nearest',behavior:'instant'});savedRow=null;});
 function open(kind,from){select(kind);if(!compact){window.dispatchEvent(new CustomEvent('pft:desktop-cash-kind',{detail:kind}));document.getElementById(kind+'Amount').focus();return;}if(dialog.open)return;trigger=from||document.activeElement;scroll=window.scrollY;active=kind;for(const name of ['income','expense'])entries[name].hidden=name!==kind;title.textContent='Add '+kind;status.textContent=pending[kind]?'The previous entry still needs a device save. Retry before adding another.':'';document.body.classList.add('cash-entry-open');dialog.showModal();document.getElementById(kind+'Amount').focus();}
 function updateBar(income,expenses){
  const net=income-expenses,positive=income>0,remaining=positive?Math.max(0,Math.min(100,net/income*100)):0,spent=positive?100-remaining:expenses>0?100:0;
  bar.querySelector('.cash-balance-remaining').style.width=remaining+'%';bar.querySelector('.cash-balance-spent').style.width=spent+'%';bar.dataset.deficit=String(net<0);
  const text=positive?(net<0?'Expenses exceed income by '+formatCurrency(-net):Math.round(remaining)+'% remaining · '+Math.round(spent)+'% spent'):(expenses>0?'No income recorded · Expenses '+formatCurrency(expenses):'No income or expenses recorded for this month');
  bar.querySelector('.cash-balance-track').setAttribute('aria-label',text);bar.querySelector('.cash-balance-caption').textContent=text;
 }
 // A failed device write retries the same record, rather than posting it twice.
 function trackSave(kind,id,date,operation,values){
  const panel=compact?entries[kind]:document.getElementById(kind+'Amount').closest('.transaction-panel'),submit=document.getElementById(kind==='income'?'addIncomeBtn':'addExpenseBtn');
  const form=panel.querySelector('.form-grid');
  const baseline=Object.fromEntries([...panel.querySelectorAll('input[id],select[id],textarea[id]')].map(n=>[n.id,n.value]));
  const entry=pending[kind]={id,date,values:values||pending[kind]?.values,busy:true};form.inert=false;submit.disabled=true;submit.textContent='Saving…';status.textContent='Saving to this device…';
  return Promise.resolve(operation).then(ok=>{
   entry.busy=false;submit.disabled=false;form.inert=false;
   if(!ok){for(const [key,value]of Object.entries(entry.values||{})){const field=document.getElementById(key);if(field&&field.value===baseline[key])field.value=value;}submit.textContent='Retry save';status.textContent='Device save failed. Retry saves this same entry; export a backup if it keeps failing.';return false;}
   delete pending[kind];submit.textContent='Save '+kind;status.textContent='';
   const changed=Object.entries(baseline).some(([key,value])=>document.getElementById(key)?.value!==value);
   if(!changed)for(const key of [kind+'Amount',kind+'Date',kind+'Notes'])document.getElementById(key).value='';
   if(compact){page.dataset.cashMonth=date.slice(0,7);renderIncome();renderExpenses();}select(kind);const row=document.getElementById(kind==='income'?'incomeBody':'expenseBody')?.querySelector('[data-cash-record="'+CSS.escape(id)+'"]');if(row&&!changed){savedRow=row;row.classList.add('cash-just-saved');setTimeout(()=>row.classList.remove('cash-just-saved'),2500);}
   if(dialog.open&&active===kind&&!changed)dialog.close();else if(changed)status.textContent='Previous entry saved. Your next unfinished entry is still here.';return true;
  });
 }
 const capture=e=>{const kind=e.target.closest('#addIncomeBtn')?'income':e.target.closest('#addExpenseBtn')?'expense':null;if(!kind)return;const item=pending[kind];if(item){e.preventDefault();e.stopImmediatePropagation();if(!item.busy)trackSave(kind,item.id,item.date,saveData('Retry cash flow save'),item.values);return;}entries[kind].__cashValues=Object.fromEntries([...(compact?entries[kind]:document.getElementById(kind+'Amount').closest('.transaction-panel')).querySelectorAll('input[id],select[id],textarea[id]')].map(n=>[n.id,n.value]));};
 document.addEventListener('click',capture,true);
 const onNavigation=e=>{if(e.target.closest('.nav-tab,[data-style-page]')&&dialog.open)close();};document.addEventListener('click',onNavigation,true);
 function adapt(){
  compact=mobile.matches;
  if(!compact&&dialog.open){dialog.close();document.body.classList.remove('cash-entry-open');}
  page.classList.toggle('cash-flow-layout',compact);
  controls.hidden=bar.hidden=!compact;monthFilter.hidden=false;page.dataset.cashMonth=page.dataset.cashMonth||currentMonthKey();refreshMonthFilter();
  page.querySelector('.transaction-intro h1').textContent=compact?'Cash flow':originalTitle;
  overview.querySelector('.transaction-metric-net .transaction-metric-label').textContent=compact?'Balance after expenses':originalNet;
  for(const {node,marker,kind}of moved){if(compact)entries[kind].append(node);else marker.after(node);}
  for(const node of page.querySelectorAll('.cash-add,.cash-cancel'))node.hidden=!compact;
  if(tools){tools.hidden=!compact;if(compact)tools.append(surplus);else surplusHome.after(surplus);}
  if(!compact){delete page.dataset.cashKind;for(const h of Object.values(histories))h.hidden=false;for(const menu of page.querySelectorAll('.cash-record-menu')){const actions=menu.parentNode;for(const b of menu.querySelectorAll('button'))actions.append(b);menu.remove();}for(const icon of page.querySelectorAll('.cash-category-icon'))icon.remove();for(const row of page.querySelectorAll('.cash-editable-record')){row.classList.remove('cash-editable-record');row.removeAttribute('tabindex');row.removeAttribute('aria-label');}}
  else {select(selectedKind);decorateHistory('income');decorateHistory('expense');}
  for(const kind of ['income','expense'])if(!pending[kind])document.getElementById(kind==='income'?'addIncomeBtn':'addExpenseBtn').textContent=(compact?'Save ':'Add ')+kind;
  renderTransactionOverview();
 }
 mobile.addEventListener('change',adapt);
 const reset=window.financeBridge.reset;window.financeBridge.reset=function(){mobile.removeEventListener('change',adapt);historyObserver.disconnect();page.removeEventListener('click',editRow);page.removeEventListener('keydown',editRow);page.removeEventListener('change',historyFilterChange,true);document.removeEventListener('click',capture,true);document.removeEventListener('click',onNavigation,true);if(dialog.open)dialog.close();for(const {node,marker}of moved)if(marker.isConnected)marker.replaceWith(node);dialog.remove();controls.remove();bar.remove();monthFilter.remove();delete page.dataset.cashMonth;delete window.financeCashFlow;return reset.apply(this,arguments);};
 window.financeCashFlow={open,select,updateBar,refreshMonthFilter,trackSave:(kind,id,date,operation)=>trackSave(kind,id,date,operation,entries[kind].__cashValues)};
 adapt();
}

