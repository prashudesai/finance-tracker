// Presentation and review tools. Financial calculations and publication stay in index.html.
(() => {
  'use strict';
  const el = (tag, text, cls) => { const node=document.createElement(tag); if(text!==undefined)node.textContent=text; if(cls)node.className=cls; return node; };
  const labels={income:'Income',expenses:'Expenses',investments:'Investments',pf:'PF',ppf:'PPF',nps:'NPS',debts:'Debts',monthlyBalances:'Monthly balances',retirementContributions:'Retirement contributions',investmentContributions:'Investment contributions',stallionContributions:'PMS contributions',stallionProfitHistory:'PMS value history',gratuityAccounts:'Gratuity',archivedAccounts:'Archived accounts',reconciliations:'Statement checks',projectionAdjustments:'Planned changes'};
  const comparable=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
  function compareRecords(before,after){
    const groups=[];
    for(const [key,label] of Object.entries(labels)){
      const oldRows=before[key]||[],newRows=after[key]||[];
      const identity=(row,index)=>key==='archivedAccounts'?row.kind+':'+row.record?.id:String(row.id??row.month??index);
      const old=new Map(oldRows.map((row,i)=>[identity(row,i),row])),next=new Map(newRows.map((row,i)=>[identity(row,i),row]));
      const added=[],changed=[],removed=[];
      for(const [id,row] of next){if(!old.has(id))added.push({id,after:row});else if(comparable(old.get(id))!==comparable(row))changed.push({id,before:old.get(id),after:row});}
      for(const [id,row] of old)if(!next.has(id))removed.push({id,before:row});
      groups.push({key,label,current:oldRows.length,incoming:newRows.length,added,changed,removed});
    }
    const ignore=new Set([...Object.keys(labels),'lastUpdate','schemaVersion','auditLog','backupMetadata']);
    const settings=[...new Set([...Object.keys(before),...Object.keys(after)])].filter(k=>!ignore.has(k)&&comparable(before[k])!==comparable(after[k]));
    return {groups,settings};
  }
  function dialog(id,title){
    let node=document.getElementById(id);if(node)return node;
    node=el('dialog',undefined,'tracker-review-dialog');node.id=id;node.setAttribute('aria-labelledby',id+'Title');
    const head=el('header'),heading=el('h2',title);heading.id=id+'Title';head.append(heading);
    const close=el('button','×','btn-secondary');close.type='button';close.setAttribute('aria-label','Close '+title);close.onclick=()=>node.close('cancel');head.append(close);
    node.append(head,el('div',undefined,'tracker-review-content'),el('footer',undefined,'tracker-review-actions'));document.body.append(node);
    node.addEventListener('close',()=>{node._returnFocus?.focus?.();});return node;
  }
  function show(node){node._returnFocus=document.activeElement;node.showModal();node.querySelector('header button').focus();}
  function action(node,text,fn,primary=false){const button=el('button',text,primary?'btn-primary':'btn-secondary');button.type='button';button.onclick=fn;node.querySelector('footer').append(button);return button;}
  function summaryTable(model,incomingLabel='Backup',onlyDifferences=false){
    const wrap=el('div',undefined,'tracker-review-table'),table=el('table'),head=el('thead'),row=el('tr');
    ['Records','Now',incomingLabel,'Add','Change','Remove'].forEach(text=>row.append(el('th',text)));head.append(row);table.append(head);
    const body=el('tbody');for(const group of model.groups.filter(g=>onlyDifferences?g.added.length||g.changed.length||g.removed.length:g.current||g.incoming)){const tr=el('tr');[group.label,group.current,group.incoming,group.added.length,group.changed.length,group.removed.length].forEach(value=>tr.append(el('td',String(value))));body.append(tr);}table.append(body);wrap.append(table);return wrap;
  }
  function recordName(row){return [row?.date||row?.month,row?.member,row?.source||row?.category||row?.account||row?.type||row?.scheme,row?.amount!==undefined?formatCurrency(row.amount):null].filter(Boolean).join(' · ');}
  function diffDetails(model){
    const fragment=document.createDocumentFragment();
    for(const group of model.groups){const rows=[...group.added.map(x=>({...x,kind:'Add'})),...group.changed.map(x=>({...x,kind:'Change'})),...group.removed.map(x=>({...x,kind:'Remove'}))];if(!rows.length)continue;
      const details=el('details'),title=el('summary',group.label+' · '+rows.length+' difference(s)');details.append(title);
      for(const row of rows.slice(0,50)){const entry=el('details');entry.append(el('summary',row.kind+' · '+(recordName(row.after||row.before)||row.id)));const pre=el('pre',JSON.stringify({before:row.before??null,after:row.after??null},null,2));entry.append(pre);details.append(entry);}
      if(rows.length>50)details.append(el('p','Showing 50 differences. The counts above include every record. Export the files to examine the full set.'));fragment.append(details);
    }
    if(model.settings.length)fragment.append(el('p','Other settings differ: '+model.settings.join(', ')+'. These are replaced too.'));
    return fragment;
  }
  window.previewTrackerImport=async(data,filename,metadata,reviews)=>{
    const node=dialog('importPreviewDialog','Review backup before import'),content=node.querySelector('.tracker-review-content'),footer=node.querySelector('footer');content.replaceChildren();footer.replaceChildren();
    const model=compareRecords(state,data),removed=model.groups.reduce((n,g)=>n+g.removed.length,0);
    content.append(el('p',filename),el('p','Import replaces this tracker’s current records. It does not combine the two files. A recovery snapshot is kept by the existing import process.'));
    content.append(el('p',reviews===null?'This current device-recovery file has no shared-review snapshot. Your current shared reviews will be kept.':'Shared review marks, valuation dates, planner inputs and payment confirmations will also be replaced. Records and reviews publish together after syncing.'));
    const currentOwner=window.financeCloud?.ownerUid;
    if(metadata?.ownerUid&&metadata.ownerUid!==currentOwner)content.append(el('p','This backup identifies a different tracker owner. Check carefully before replacing this family’s records.','tracker-review-warning'));
    content.append(el('p',metadata?.exportedAt&&Number.isFinite(Date.parse(metadata.exportedAt))?'Backup exported: '+new Date(metadata.exportedAt).toLocaleString():'Export date and tracker identity are unavailable for this backup.'));
    if(data.lastUpdate)content.append(el('p','Recorded last change: '+String(data.lastUpdate)));
    if(removed)content.append(el('p',removed+' current record(s) are absent from this backup and will be removed.','tracker-review-warning'));
    content.append(summaryTable(model),diffDetails(model));
    const label=el('label',undefined,'tracker-review-confirm'),check=el('input');check.type='checkbox';check.id='importPreviewConfirm';label.append(check,document.createTextNode('I reviewed the differences and want to replace current records.'));content.append(label);
    const exportStatus=el('p');exportStatus.setAttribute('role','status');content.append(exportStatus);
    action(node,'Download current backup',()=>{document.getElementById('exportBtn').click();exportStatus.textContent='Download requested. Check that your browser saved the file before continuing.';});
    action(node,'Cancel',()=>node.close('cancel'));
    const confirm=action(node,'Replace with this backup',()=>node.close('confirm'),true);confirm.id='importPreviewApply';confirm.disabled=true;check.onchange=()=>confirm.disabled=!check.checked;
    show(node);return new Promise(resolve=>node.addEventListener('close',()=>resolve(node.returnValue==='confirm'),{once:true}));
  };
  window.openTrackerConflictReview=async()=>{
    const node=dialog('syncReviewDialog','Review data conflict'),content=node.querySelector('.tracker-review-content');content.replaceChildren(el('p','Loading the latest cloud copy for comparison…'));node.querySelector('footer').replaceChildren();action(node,'Close',()=>node.close());show(node);
    if(!navigator.onLine){content.replaceChildren(el('p','Connect to the internet to compare with the cloud. Your device’s changes remain on this device.'));return;}
    try{
      const local=JSON.parse(JSON.stringify(state)),cloud=await window.financeCloud.inspect();
      if(!node.open)return;
      if(!cloud?.data)throw Error('No cloud snapshot is available.');
      const incoming=validateBackup(cloud.data),model=compareRecords(local,incoming);
      const differences=model.groups.reduce((n,g)=>n+g.added.length+g.changed.length+g.removed.length,0);
      content.replaceChildren(el('p',differences+' record difference(s) · '+model.settings.length+' setting group(s)', 'tracker-conflict-count'));
      content.append(el('p','Device is your saved copy. Cloud is the latest shared copy. Review and download a backup before replacing either copy.'));
      if(differences)content.append(summaryTable(model,'Cloud',true));
      const details=el('details');details.append(el('summary','Inspect changed records'),diffDetails(model));content.append(details);
      const message=el('p');message.setAttribute('role','status');content.append(message);
      action(node,'Download this device’s backup',()=>{document.getElementById('exportBtn').click();message.textContent='Download requested. Check that the file was saved. Then close this comparison to use the existing cloud-refresh action.';});
    }catch(error){if(node.open)content.replaceChildren(el('p','Comparison unavailable: '+error.message+'. No records were replaced.'));}
  };
  function moneyRows(items){const list=el('dl',undefined,'tracker-money-list');for(const [label,value] of items){list.append(el('dt',label),el('dd',value==null?'Pending':formatCurrency(value)));}return list;}
  window.showDashboardExplanation=key=>{
    const d=window.PFT_DASHBOARD_INSIGHTS;if(!d)return;
    const node=dialog('calculationReviewDialog','How this amount is calculated'),content=node.querySelector('.tracker-review-content');content.replaceChildren();node.querySelector('footer').replaceChildren();
    const title={netWorth:'Net worth',surplusBalance:'Available balance',lastMonthHouseExpense:'House expense',lastMonthFullExpense:'Full expense'}[key];content.append(el('h3',title));
    if(key==='netWorth'){
      content.append(el('p','Selected family profile: '+d.profile+'. Assets − outstanding principal = net worth.'),moneyRows([['Investments',d.totalInvestment],['NPS',d.npsTotal],['PPF',d.ppfTotal],['PF (EPS excluded)',d.pfTotal],['Total assets',d.totalAssets],['Outstanding debts',d.totalDebts],['Net worth',d.netWorth]]));
      content.append(el('p','Archived accounts and gratuity estimates are excluded from this dashboard total.'));
      const detail=el('details');detail.append(el('summary','Included accounts and current values'));for(const row of d.accounts)detail.append(el('p',row.name+' · '+formatCurrency(row.value)));content.append(detail);
    }else if(key==='surplusBalance'){
      content.append(el('p',d.currentMonthStr+' · Household totals remain shared across family profile filters.'),moneyRows([['Opening balance',d.opening],['Income',d.householdMonthlyIncome],['Recorded expenses',d.monthlyExpenses],['PMS contributions',d.stallionPmsExpenses],['Available balance',d.surplusBalance]]),el('p','Opening balance + income − expenses − PMS contributions.'));
      if(!d.hasOpening)content.append(el('p','No opening balance is recorded for this month. The existing calculation uses zero.','tracker-review-warning'));
    }else{
      const snapshot=window.PFT_DASHBOARD_SNAPSHOT||d;const t=snapshot.previousTotals;content.append(el('p',snapshot.previousMonthKey+' · Household totals.'));
      content.append(moneyRows([['Opening balance',snapshot.previousOpening],['Income',t.income],['Recorded expenses',t.expenses],['PMS contributions',t.stallion],['Next month opening balance',snapshot.hasOpening?snapshot.opening:null],['House expense',snapshot.houseAmount],...(key==='lastMonthFullExpense'?[['Full expense',snapshot.fullExpense]]:[])]));
      content.append(el('p','House expense = opening balance + income − recorded expenses − PMS contributions − next month opening balance. Full expense adds recorded expenses back, including annual expenses in full.'));
      if(snapshot.houseAmount==null)content.append(el('p','Both consecutive months need an opening balance before house expense can be calculated.','tracker-review-warning'));
      else if(snapshot.houseAmount<0)content.append(el('p','The residual is negative. Review the balances and any missing income.','tracker-review-warning'));
    }
    content.append(el('p','These are the same amounts used by the dashboard. Opening this explanation does not change records.'));action(node,'Done',()=>node.close());show(node);
  };
  window.renderReadableChangeLog=async()=>{
    const target=document.getElementById('changeLogList');if(!target)return;
    try{const page=auditPage,rows=await readChangeLog(9,page*8);if(page!==auditPage)return;target.replaceChildren(el('p','History saved on this device. Actor details identify the signed-in session; imported entries may come from another device.'));
      for(const row of rows.slice(0,8)){const details=el('details');details.append(el('summary',new Date(row.at).toLocaleString()+' · '+row.action+' · '+row.changes.length+' change(s)'));details.append(el('p','Recorded by: '+(row.actor?.email||'Not recorded')+(row.actor?.role?' · '+row.actor.role:'')));
        for(const change of row.changes.slice(0,50)){const entry=el('details');entry.append(el('summary',(labels[change.collection]||change.collection)+' · '+change.action+' · '+(recordName(change.after||change.before)||change.id||'')));const before=change.before,after=change.after;
          if(before&&after&&typeof before==='object'&&typeof after==='object'&&!Array.isArray(before)&&!Array.isArray(after)){for(const field of new Set([...Object.keys(before),...Object.keys(after)]))if(comparable(before[field])!==comparable(after[field]))entry.append(el('p',field+': '+String(before[field]??'—')+' → '+String(after[field]??'—')));}
          else entry.append(el('pre',JSON.stringify({before:before??null,after:after??null},null,2)));details.append(entry);
        }
        if(row.changes.length>50)details.append(el('p','Showing the first 50 changes; export includes the full history.'));
        if(row.importedHistory)details.append(el('p',row.importedHistory.length+' imported history entries. Full entries are included in the JSON export.'));target.append(details);
      }
      if(!rows.length)target.append(el('p','No change history on this device yet.'));
      const nav=el('div',undefined,'tracker-review-actions');for(const [text,delta,disabled] of [['Previous',-1,page===0],['Next',1,rows.length<=8]]){const b=el('button',text,'btn-small');b.disabled=disabled;b.onclick=()=>{auditPage+=delta;window.renderReadableChangeLog();};nav.append(b);}target.append(nav);
    }catch(error){target.textContent=error.message;}
  };
  function install(){
    renderChangeLog=window.renderReadableChangeLog;
    const status=document.getElementById('cloudSyncStatus');
    if(status){
      const review=el('button','Review differences','btn-small');review.id='cloudReviewDifferences';review.type='button';review.hidden=true;review.onclick=window.openTrackerConflictReview;
      status.parentElement.append(review);
      const originalFooter=document.getElementById('lastUpdate')?.closest('footer');if(originalFooter)originalFooter.hidden=true;
      const refresh=()=>{review.hidden=!cloudSaveBlocked;};
      new MutationObserver(refresh).observe(status,{childList:true,characterData:true,subtree:true});window.addEventListener('online',refresh);window.addEventListener('offline',refresh);refresh();
    }
    const info=document.getElementById('settingsInfoPanel');
    if(info){
      const details=el('details');details.id='appInfoCalculations';details.append(el('summary','Calculation breakdowns using your records'),el('p','View the amounts behind your latest dashboard totals. Personal assets and debts follow the selected family profile; household balances and expenses stay shared.'));
      const actions=el('div',undefined,'tracker-review-actions');
      for(const [id,label] of [['netWorth','Net worth'],['surplusBalance','Available balance'],['lastMonthHouseExpense','House expense'],['lastMonthFullExpense','Full expense']]){
        const b=el('button',label,'btn-secondary');b.type='button';b.dataset.calculation=id;b.onclick=()=>window.showDashboardExplanation(id);actions.append(b);
      }
      details.append(actions);info.querySelector('#appInfoPdfStatus').after(details);
    }
    const add=el('button','+ Add record','btn-primary tracker-quick-add');add.type='button';add.id='trackerQuickAdd';add.setAttribute('aria-label','Add record');add.title='Add record';add.innerHTML='<span class="quick-add-symbol" aria-hidden="true">+</span><span class="quick-add-label"> Add record</span>';add.hidden=window.financeCloud.canEdit===false;document.getElementById('dashboard').prepend(add);
    let quickAddScrollTimer;
    // Keep Add in one predictable spot above the dock. Fade it when that spot
    // contains content instead of moving it halfway up the dashboard.
    function placeQuickAdd(){
      add.style.bottom='';
      if(!window.matchMedia('(max-width:700px)').matches){add.classList.remove('quick-add-obscured');return;}
      const dashboard=document.getElementById('dashboard');
      if(!dashboard.classList.contains('active'))return;
      const target=add.getBoundingClientRect();
      if(!target.width)return;
      const overlaps=r=>r.right>target.left-5&&r.left<target.right+5&&r.bottom>target.top-5&&r.top<target.bottom+5;
      let blocked=false,walker=document.createTreeWalker(dashboard,NodeFilter.SHOW_TEXT);
      while(!blocked&&walker.nextNode()){
        const node=walker.currentNode;
        if(!node.textContent.trim()||add.contains(node)||!node.parentElement.getClientRects().length)continue;
        const range=document.createRange();range.selectNodeContents(node);
        blocked=[...range.getClientRects()].some(overlaps);
      }
      if(!blocked)blocked=[...dashboard.querySelectorAll('button,input,select,canvas')].some(e=>e!==add&&!add.contains(e)&&e.getClientRects().length&&overlaps(e.getBoundingClientRect()));
      add.classList.toggle('quick-add-obscured',blocked);
    }
    const settleQuickAdd=()=>{clearTimeout(quickAddScrollTimer);quickAddScrollTimer=setTimeout(()=>{placeQuickAdd();document.body.classList.remove('quick-add-scrolling');},300);};
    window.addEventListener('scroll',()=>{
      if(!window.matchMedia('(max-width:700px)').matches)return;
      document.body.classList.add('quick-add-scrolling');settleQuickAdd();
    },{passive:true});
    window.addEventListener('resize',settleQuickAdd,{passive:true});
    document.addEventListener('click',event=>{if(event.target.closest('[data-tab],[data-style-page]'))settleQuickAdd();});
    settleQuickAdd();
    add.onclick=()=>{
      const node=dialog('quickAddDialog','Add a record');node.querySelector('.tracker-review-content').replaceChildren();node.querySelector('footer').replaceChildren();
      for(const [label,tab,target,panel] of [['Income','income-expenses','#incomeAmount'],['Expense or loan payment','income-expenses','#expenseAmount'],['Investment','investments','#openGeneralInvestmentBtn'],['PMS contribution','investments',null,'stallionContributionAddPanel'],['Loan or debt','debts',null,'loanAddPanel']]){
        const b=el('button',label,'btn-secondary');b.type='button';b.onclick=()=>{node.close();document.querySelector('.nav-tab[data-tab="'+tab+'"]').click();requestAnimationFrame(()=>{if(panel){openEntryFormModal(panel,add);return;}const field=target?document.querySelector(target):null;if(field&&field.getClientRects().length){field.scrollIntoView({block:'center',behavior:'smooth'});field.focus({preventScroll:true});if(target==='#openGeneralInvestmentBtn')field.click();}});};node.querySelector('.tracker-review-content').append(b);
      }show(node);
    };
    document.querySelectorAll('input[type="number"]').forEach(input=>{if(!input.hasAttribute('inputmode'))input.setAttribute('inputmode','decimal');});

  }
  window.PFT_REVIEW_TOOLS={compareRecords};
  Promise.resolve(window.trackerReady).then(()=>{if(window.financeCloud&&!storageLoadFailed)install();}).catch(()=>{});
})();


