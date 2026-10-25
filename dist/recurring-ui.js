/* UI delegates all finance writes to the tracker's existing validated save path. */
window.initializeRecurringUI=function(api){
 const R=window.PFT_RECURRING,L=window.PFT_LOAN_LEDGER,esc=api.escape;
 const button=document.getElementById('openRecurringBtn'),dialog=document.getElementById('recurringDialog'),list=document.getElementById('recurringList'),review=document.getElementById('recurringReview'),status=document.getElementById('recurringStatus');
 let busy=false,opened=false,reviewSnapshot='',reviewRows=[];
 const canEdit=()=>window.financeCloud?.canEdit!==false&&window.financeCloud?.accessValid?.()!==false;
 const options=id=>[...document.getElementById(id).options].filter(o=>o.value&&!o.dataset.inlineAdd).map(o=>o.value);
 const rules=()=>api.get().recurringRules||[];
 const today=()=>api.today();
 const current=()=>today().slice(0,7);
 const due=()=>R.pending(api.get(),today());
 const message=text=>{status.textContent=text;};
 function render(){
  const pending=due();button.textContent='↻ Recurring items'+(pending.some(r=>r.missed)?' · Review missed':'');
  document.getElementById('addRecurringBtn').disabled=!canEdit()||busy;
  if(!opened)return;
  const visibleRules=rules().filter(r=>!r.archived);
  list.innerHTML=visibleRules.length?visibleRules.map(r=>{
   const loan=r.kind==='emi'?api.get().debts.find(d=>d.id===r.loanId):null;
   const stopped=r.kind==='emi'&&(!loan||loan.remaining<=0);
   const subtitle=r.kind==='emi'?(loan?'Linked EMI · '+api.currency(loan.emi):'Linked loan unavailable'):(r.kind==='income'?'Income · '+r.member:'Expense · '+r.category+(r.subcategory?' / '+r.subcategory:''))+' · '+api.currency(R.amountAt(r,current()));
   const actions=stopped?`<button type="button" data-rec-remove="${esc(r.id)}" ${!canEdit()||busy?'disabled':''}>Remove stopped schedule</button>`:`<button type="button" data-rec-edit="${esc(r.id)}" ${!canEdit()||busy?'disabled':''}>Edit future</button><button type="button" data-rec-pause="${esc(r.id)}" ${!canEdit()||busy?'disabled':''}>${r.paused?'Resume':'Pause'}</button><button type="button" data-rec-skip="${esc(r.id)}" ${!canEdit()||busy||!pending.some(x=>x.ruleId===r.id&&x.month===current())?'disabled':''}>Skip this month</button><button type="button" data-rec-remove="${esc(r.id)}" ${!canEdit()||busy?'disabled':''}>Delete schedule</button>`;
   const stateText=r.paused?'Paused':stopped?(!loan?'Stopped · loan unavailable':'Stopped · loan paid off'):'Automatic';
   return `<article class="recurring-item"><div><strong>${esc(r.name)}</strong><p>${esc(subtitle)}</p><small>${stateText} · ${r.day===0?'Last day':'Day '+r.day} · ${esc(r.startMonth)}${r.endMonth?' to '+esc(r.endMonth):''}</small></div><div class="recurring-actions">${actions}</div></article>`;
  }).join(''):'<p>No recurring items yet. Add salary, rent, maintenance or a linked loan EMI.</p>';
  if(!opened)return;
  reviewRows=pending;reviewSnapshot=JSON.stringify(api.get());
  review.innerHTML=pending.length?pending.map((row,index)=>{
   const rule=rules().find(r=>r.id===row.ruleId),loan=rule.kind==='emi'?api.get().debts.find(d=>d.id===rule.loanId):null;
   const quote=loan?L.quotePayment(loan,api.get().expenses.filter(e=>e.loanId===loan.id&&e.category==='EMI Payment'),row.date):null;
   const amount=rule.kind==='emi'?(quote?.amount||loan?.emi||0):row.amount;
   return `<div class="recurring-review-row"><label><input type="checkbox" data-rec-select="${index}" ${row.existing?'checked':''} ${!canEdit()||busy?'disabled':''}><span>${esc(rule.name)}<small>${esc(row.date)} · ${row.existing?'Existing entry found; mark as recorded':row.missed?'Missed month · review before adding':'Due this month'}</small></span></label>${rule.kind==='emi'||row.existing?`<strong>${esc(api.currency(amount))}</strong>`:`<label class="recurring-amount-label">Amount ₹<input type="number" aria-label="${esc(rule.name+' '+row.month+' amount')}" data-rec-amount="${index}" value="${amount}" min="0.01" step="0.01" ${!canEdit()||busy?'disabled':''}></label>`}</div>`;
  }).join(''):'<p>No due entries waiting for review.</p>';
  document.getElementById('postRecurringBtn').disabled=!canEdit()||busy||!pending.length;
  document.getElementById('skipRecurringBtn').disabled=!canEdit()||busy||!pending.length;
 }
 async function commit(next,action){if(!canEdit())throw Error('Viewer access is read only.');const saved=await api.commit(next,action);if(!saved)throw Error('Changes could not be saved. Please retry.');return true;}
 async function run(work){if(busy||!canEdit())return;busy=true;try{await work();}catch(error){message(error.message);}finally{busy=false;render();}}
 async function post(requests){
  const result=R.apply(api.get(),requests,L,today());
  if(result.changed&&!await commit(result.data,'Processed monthly recurring entries'))throw Error('Entries could not be saved. Please retry.');
  message((result.changed?result.changed+' monthly item(s) processed. ':'')+result.errors.join(' ')+(result.changed?' Edit an income or expense entry to adjust that month only.':''));
 }
 async function automatic(){
  if(busy||!canEdit()||!api.ready()||document.hidden||document.querySelector('dialog[open]')||document.querySelector('.investment-edit-modal:not([hidden])'))return;
  const candidates=due().filter(x=>!x.missed);if(!candidates.length){render();return;}
  await run(()=>post(candidates));
 }
 async function add(){
  const original=JSON.stringify(api.get());
  const kind=await api.edit('Add monthly recurring',[{key:'kind',label:'Entry type',value:'income',options:['income','expense','emi'],optionLabels:{income:'Income',expense:'Expense',emi:'Linked loan EMI'}}]);
  if(!kind)return;const type=kind.kind,fields=[{key:'name',label:'Name',value:type==='income'?'Monthly salary':type==='expense'?'House rent':'Monthly EMI',maxLength:60}];
  if(type==='income'){
   const members=options('incomeMember');if(!members.length){message('Add a family member in Settings → Family Access first.');return;}
   fields.push({key:'member',label:'Family member',value:api.preferredMember?.()||members[0],options:members},{key:'source',label:'Income source',value:'Salary',options:options('incomeSource')});
  }else if(type==='expense'){
   fields.push({key:'category',label:'Expense category',value:'House Rent',options:options('expenseCategory').filter(x=>x!=='EMI Payment')},{key:'subcategory',label:'Expense type (when applicable)',value:'',options:[...new Set(Object.values(api.subcategories).flat())],optional:true},{key:'annual',label:'Annual expense',value:'no',options:['no','yes'],optionLabels:{no:'No',yes:'Yes · count full amount in the recorded month'}});
  }else{
   const debts=api.get().debts.filter(d=>d.remaining>0&&!rules().some(r=>r.kind==='emi'&&!r.paused&&r.loanId===d.id));
   if(!debts.length){message('Add an active loan first, or edit its existing recurring EMI.');return;}
   fields.push({key:'loanId',label:'Loan · uses its current EMI and repayment terms',value:debts[0].id,options:debts.map(d=>d.id),optionLabels:Object.fromEntries(debts.map(d=>[d.id,`${String(d.name||d.notes||d.type||'Loan').trim()} · ${api.currency(d.emi)}`]))});
  }
  if(type!=='emi')fields.push({key:'amount',label:'Monthly amount ₹',type:'number',min:.01,value:''});
  fields.push({key:'day',label:'Due day (0 means last day)',type:'number',min:0,max:31,value:1},{key:'startMonth',label:'Start month',type:'month',value:current()},{key:'endMonth',label:'End month (optional)',type:'month',value:'',required:false});
  const pending=api.edit('Monthly recurring details',fields,v=>{
   if(!v.name.trim())return 'Enter a name.';
   if(type!=='emi'&&(!(Number(v.amount)>0)||Number(v.amount)>1e12))return 'Enter a valid positive amount.';
   if(!Number.isInteger(Number(v.day)))return 'Due day must be a whole number.';
   if(!R.monthOK(v.startMonth)||v.endMonth&&(!R.monthOK(v.endMonth)||v.endMonth<v.startMonth))return 'Enter a valid month range.';
   if(type==='expense'&&(api.subcategories[v.category]||[]).length&&!(api.subcategories[v.category]||[]).includes(v.subcategory))return 'Select an expense type belonging to this category.';
   return null;
  });
  if(type==='income')api.wire(document.getElementById('recordEdit_source'),'incomeSources');
  if(type==='expense'){
   const category=document.getElementById('recordEdit_category'),subcategory=document.getElementById('recordEdit_subcategory');
   const updateSubcategory=()=>{const selected=subcategory.value,values=api.subcategories[category.value]||[];subcategory.replaceChildren(new Option('-- Select type --',''),...values.map(value=>new Option(value,value)));subcategory.value=values.includes(selected)?selected:'';subcategory.required=values.length>0;subcategory.parentElement.hidden=!values.length;};
   api.wire(category,'expenseCategories');category.addEventListener('change',updateSubcategory);updateSubcategory();
  }
  if(type==='emi'){const select=document.getElementById('recordEdit_loanId');const update=()=>{const debt=api.get().debts.find(d=>d.id===select.value);if(!debt)return;document.getElementById('recordEdit_day').value=debt.emiDueDay||Number(debt.firstEmiDate?.slice(-2))||1;if(debt.firstEmiDate)document.getElementById('recordEdit_startMonth').value=[current(),debt.firstEmiDate.slice(0,7)].sort().at(-1);};select.addEventListener('change',update);update();}
  const values=await pending;if(!values)return;
  // Inline custom additions can save while this dialog is open; preserve them.
  if(JSON.stringify(api.get().recurringRules)!==JSON.stringify(JSON.parse(original).recurringRules)){message('Recurring items changed. Reopen the form.');return;}
  await run(async()=>{
   const data=structuredClone(api.get()),r={id:api.id(),kind:type,name:values.name.trim(),day:Number(values.day),startMonth:values.startMonth,endMonth:values.endMonth||'',paused:false,amountChanges:[]};
   if(type==='income')Object.assign(r,{member:values.member,source:api.source(values.source,values.member),amount:Number(values.amount)});
   else if(type==='expense')Object.assign(r,{category:values.category,subcategory:(api.subcategories[values.category]||[]).includes(values.subcategory)?values.subcategory:'',isAnnual:values.annual==='yes',amount:Number(values.amount)});
   else{r.loanId=values.loanId;const debt=data.debts.find(d=>d.id===r.loanId);if(!debt)throw Error('This loan is no longer available.');if((debt.emiDueDay||debt.firstEmiDate)&&r.day!==(debt.emiDueDay||Number(debt.firstEmiDate.slice(-2))))throw Error('Use the loan’s existing EMI due day: '+(debt.emiDueDay||Number(debt.firstEmiDate.slice(-2)))+'.');}
   if(data.recurringRules.some(old=>old.kind===r.kind&&!old.paused&&(r.kind==='emi'?old.loanId===r.loanId:r.kind==='income'?old.member===r.member&&old.source===r.source:old.name.toLowerCase()===r.name.toLowerCase())))throw Error('A matching recurring item already exists. Edit it instead.');
   data.recurringRules.push(r);R.validate(data);if(!await commit(data,'Added recurring '+type))throw Error('Could not save the recurring item.');
   const candidates=due().filter(x=>x.ruleId===r.id&&!x.missed);if(candidates.length)await post(candidates);else message('Recurring item saved. Due entries are added when the app is open. Review any missed months below.');
  });
 }
 async function edit(id){
  const rule=rules().find(r=>r.id===id);if(!rule)return;const original=JSON.stringify(rule),from=[R.nextMonth(current()),rule.startMonth].sort().at(-1);
  const fields=[{key:'endMonth',label:'End month (optional; existing entries stay unchanged)',type:'month',value:rule.endMonth||'',required:false}];
  if(rule.kind!=='emi')fields.unshift({key:'amount',label:'Monthly amount ₹ · from '+from,type:'number',min:.01,value:R.amountAt(rule,from)});
  const v=await api.edit('Edit future schedule',fields,v=>v.endMonth&&(!R.monthOK(v.endMonth)||v.endMonth<current()||v.endMonth<rule.startMonth)?'Choose this month or a later end month.':null);if(!v)return;
  await run(async()=>{const data=structuredClone(api.get()),r=data.recurringRules.find(r=>r.id===id);if(!r||JSON.stringify(r)!==original)throw Error('This recurring item changed. Reopen it.');r.endMonth=v.endMonth||'';if(rule.kind!=='emi'){r.amountChanges=r.amountChanges.filter(c=>c.month!==from);r.amountChanges.push({month:from,amount:Number(v.amount)});r.amountChanges.sort((a,b)=>a.month.localeCompare(b.month));}R.validate(data);await commit(data,'Edited future recurring schedule');message('Future schedule updated. Existing monthly entries keep their amounts.');});
 }
 async function pause(id){await run(async()=>{const data=structuredClone(api.get()),r=data.recurringRules.find(r=>r.id===id);if(!r)return;
  if(r.paused){r.paused=false;for(const row of R.pending(data,today()).filter(x=>x.ruleId===r.id&&x.month>=(r.pausedFrom||current())))data.recurringOccurrences.push({ruleId:r.id,month:row.month,status:'skipped'});delete r.pausedFrom;}
  else{r.paused=true;r.pausedFrom=current();}R.validate(data);await commit(data,'Changed recurring pause');message(r.paused?'Paused. No entries will be added while paused.':'Resumed. Months during the pause are skipped.');});}
 async function removeSchedule(id){const existing=rules().find(r=>r.id===id);if(!existing)return;const loan=existing.kind==='emi'?api.get().debts.find(d=>d.id===existing.loanId):null,stopped=existing.kind==='emi'&&(!loan||loan.remaining<=0);if(!confirm(stopped?'Remove this stopped EMI schedule? Any linked past tracker records will be preserved.':'Delete this recurring schedule? Future automatic entries will stop; existing tracker entries will be preserved.'))return;await run(async()=>{const data=structuredClone(api.get()),result=R.removeSchedule(data,id,current());R.validate(data);if(!await commit(data,'Removed recurring schedule'))throw Error('Could not remove the recurring schedule.');message(result.archived.length?'Schedule archived; linked past records were preserved.':'Schedule deleted. Existing tracker entries were preserved.');});}
 button.onclick=()=>{opened=true;message('');render();dialog.showModal();};
 document.getElementById('closeRecurringBtn').onclick=()=>{dialog.close();opened=false;};dialog.addEventListener('close',()=>{opened=false;});
 document.getElementById('addRecurringBtn').onclick=add;
 list.onclick=e=>{const editButton=e.target.closest('[data-rec-edit]'),pauseButton=e.target.closest('[data-rec-pause]'),skip=e.target.closest('[data-rec-skip]'),remove=e.target.closest('[data-rec-remove]');if(editButton)edit(editButton.dataset.recEdit);if(pauseButton)pause(pauseButton.dataset.recPause);if(skip)run(()=>post([{ruleId:skip.dataset.recSkip,month:current(),skip:true}]));if(remove)removeSchedule(remove.dataset.recRemove);};
 async function reviewSelected(skip){
  if(reviewSnapshot!==JSON.stringify(api.get())){message('Records changed. Review the refreshed list before continuing.');render();return;}
  const requests=[...review.querySelectorAll('[data-rec-select]:checked')].map(input=>{const i=Number(input.dataset.recSelect),row=reviewRows[i],amount=review.querySelector('[data-rec-amount="'+i+'"]');return{ruleId:row.ruleId,month:row.month,...(amount?{amount:Number(amount.value)}:{}),skip};});
  if(!requests.length){message('Select at least one monthly item.');return;}await run(()=>post(requests));
 }
 document.getElementById('postRecurringBtn').onclick=()=>reviewSelected(false);document.getElementById('skipRecurringBtn').onclick=()=>reviewSelected(true);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)automatic();});setInterval(automatic,60000);
 render();automatic();return{render,automatic};
};
