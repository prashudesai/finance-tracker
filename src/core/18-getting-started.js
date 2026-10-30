    // Presentation-only onboarding. Preference writes never enter the finance snapshot.
    function gettingStartedSnapshot(data,month,loanSkipped=false){
      const keys=['income','expenses','debts','investments','pf','ppf','nps','gratuityAccounts','monthlyBalances','investmentContributions','retirementContributions','stallionContributions','stallionProfitHistory','archivedAccounts'];
      return {hasData:keys.some(key=>Array.isArray(data[key])&&data[key].length>0),family:(data.customValues?.familyMembers||[]).some(name=>String(name).trim()),opening:(data.monthlyBalances||[]).some(row=>row.month===month&&Number.isFinite(row.startBalance)),loans:(data.debts||[]).length>0||loanSkipped,investments:['investments','pf','ppf','nps','gratuityAccounts'].some(key=>(data[key]||[]).length>0)};
    }
    function readGettingStartedPreference(){try{return JSON.parse(trackerStorage.getItem('gettingStarted:v1')||'null');}catch(_){return null;}}
    function writeGettingStartedPreference(value){try{trackerStorage.setItem('gettingStarted:v1',JSON.stringify(value));}catch(_){}}
    function renderGettingStarted(){
      if(!window.PFTGettingStarted||!window.financeCloud)return;
      const dashboard=document.getElementById('dashboard'),checklist=document.getElementById('gettingStartedChecklist'),empty=document.getElementById('dashboardFirstRecord');if(!dashboard||!checklist||!empty)return;
      const editable=window.financeCloud.canEdit!==false;
      let pref=readGettingStartedPreference();const current=gettingStartedSnapshot(state,currentMonthKey(),pref?.loanSkipped===true);
      if(!pref){pref={eligible:!current.hasData,dismissed:current.hasData,loanSkipped:false};if(editable)writeGettingStartedPreference(pref);}
      const steps=[['family','Family members','Add or review names','family'],['opening','Opening balance','Set balance','opening'],['loans','Loans (optional)','Add loan','loan'],['investments','Investments','Add investment','investment']];
      const done=steps.filter(([key])=>current[key]).length;
      if(done===4&&!pref.dismissed){pref.dismissed=true;if(editable)writeGettingStartedPreference(pref);}
      const visible=editable&&pref.eligible&&!pref.dismissed;
      checklist.hidden=!visible;
      if(visible){const signature=JSON.stringify([current,pref,done]);if(checklist.dataset.signature!==signature){checklist.dataset.signature=signature;checklist.innerHTML='<div class="getting-started-heading"><div><h2>Get started</h2><p>Set up what matters to you · '+done+' of 4 complete</p></div><button type="button" class="btn-secondary" data-setup-action="skip">Skip for now</button></div><ol class="getting-started-steps">'+steps.map(([key,title,label,action])=>'<li class="'+(current[key]?'is-complete':'')+'"><span class="setup-step-state" aria-hidden="true">'+(current[key]?'✓':'○')+'</span><strong>'+title+'</strong><button type="button" class="btn-secondary" data-setup-action="'+(current[key]&&['loan','investment'].includes(action)?action+'-view':action)+'">'+(current[key]?'Review':label)+'</button>'+(key==='loans'&&!current.loans?'<button type="button" class="setup-skip-loan" data-setup-action="no-loans">Not applicable</button>':'')+'</li>').join('')+'</ol>';}}
      dashboard.dataset.emptyTracker=String(!current.hasData);empty.hidden=current.hasData;
      empty.querySelectorAll('button').forEach(button=>button.hidden=!editable);
      const mobile=window.matchMedia('(max-width:700px)').matches;
      empty.querySelector('h2').textContent=editable?(mobile?'Start with what matters to you':'Add your first income to see your month at a glance'):'No financial records yet';
      empty.querySelector('p').textContent=editable?'Your income, expenses and balances will appear here as you add records.':'No financial records have been added yet. The owner or an editor can add records.';
      const resume=document.getElementById('resumeGettingStarted');if(resume)resume.hidden=!editable||!pref.eligible||!pref.dismissed||done===4;
    }
    function runGettingStartedAction(action,trigger){
      if(!window.financeCloud||window.financeCloud.canEdit===false)return;
      const nav=id=>document.querySelector('.nav-tab[data-tab="'+id+'"]')?.click();
      if(['skip','no-loans','resume'].includes(action)){const pref=readGettingStartedPreference()||{eligible:true,dismissed:false,loanSkipped:false};if(action==='no-loans')pref.loanSkipped=true;else pref.dismissed=action==='skip';writeGettingStartedPreference(pref);if(action==='resume')nav('dashboard');renderGettingStarted();return;}
      if(action==='loan-view'){nav('debts');return;}
      if(action==='investment-view'){nav('investments');return;}
      if(action==='family'){nav('settings');const tile=[...document.querySelectorAll('.settings-quick-tile')].find(node=>/family/i.test(node.querySelector('strong')?.textContent||''));tile?.click();document.querySelector('[data-family-dialog="familyNameDetails"]')?.click();return;}
      if(action==='opening'){nav('income-expenses');const tools=document.querySelector('#income-expenses .cash-tools');if(tools)tools.open=true;if(document.getElementById('balanceEntryForm')?.hidden)document.getElementById('toggleBalanceForm')?.click();requestAnimationFrame(()=>{document.getElementById('balanceStartAmount')?.focus();document.getElementById('balanceEntryForm')?.scrollIntoView({block:'nearest'});});return;}
      if(action==='income'||action==='expense'){nav('income-expenses');if(window.financeCashFlow)window.financeCashFlow.open(action,trigger);return;}
      if(action==='loan'){nav('debts');openEntryFormModal('loanAddPanel',trigger);return;}
      if(['investment','pf','ppf','nps'].includes(action)){nav('investments');setInvestmentMobileSection?.(action==='investment'?'investments':'retirement');openEntryFormModal(action==='investment'?'otherInvestmentAddPanel':action+'AddPanel',trigger);return;}
      if(action==='contribution'){const modal=document.getElementById('investmentContributionModal'),kind=modal?.dataset.retirementType,id=modal?.dataset.investmentId;if(kind&&id)openManualRetirementContribution(kind,id);else if(id)openManualInvestmentContribution(id);else nav('investments');return;}
    }
    function installGettingStarted(){
      if(window.PFTGettingStarted||!window.financeCloud||typeof state==='undefined')return;
      const dashboard=document.getElementById('dashboard');if(!dashboard)return;
      const checklist=document.createElement('section');checklist.id='gettingStartedChecklist';checklist.className='panel getting-started-checklist';checklist.setAttribute('aria-label','Setup checklist');checklist.hidden=true;
      const empty=document.createElement('section');empty.id='dashboardFirstRecord';empty.className='panel first-record-prompt';empty.hidden=true;empty.innerHTML='<h2>Add your first income to see your month at a glance</h2><p>Your income, expenses and balances will appear here as you add records.</p><button type="button" class="btn-primary" data-setup-action="income">+ Add income</button><div class="mobile-first-record-options" aria-label="Other setup options"><button type="button" class="btn-secondary" data-setup-action="expense">Add expense</button><button type="button" class="btn-secondary" data-setup-action="opening">Opening balance</button><button type="button" class="btn-secondary" data-setup-action="investment">Add investment</button><button type="button" class="btn-secondary" data-setup-action="loan">Add loan</button><button type="button" class="btn-secondary" data-setup-action="family">Family members</button></div>';
      const intro=dashboard.querySelector('.dashboard-page-intro');if(intro){intro.after(checklist);checklist.after(empty);}else dashboard.prepend(checklist,empty);
      const resume=document.createElement('button');resume.id='resumeGettingStarted';resume.type='button';resume.className='btn-secondary';resume.textContent='Resume setup';resume.dataset.setupAction='resume';resume.hidden=true;document.querySelector('#settings .settings-intro')?.after(resume);
      document.addEventListener('click',event=>{const button=event.target.closest('[data-setup-action]');if(button){event.preventDefault();runGettingStartedAction(button.dataset.setupAction,button);}});
      let frame=0;
      function enhanceEmptyTables(){
        cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
          document.querySelectorAll('.friendly-empty-cell [data-setup-action],.investment-empty-state [data-setup-action],#retirementEmptyState [data-setup-action]').forEach(button=>{button.hidden=window.financeCloud?.canEdit===false;});
          for(const body of document.querySelectorAll('tbody')){
            let cell=body.rows.length===1&&body.rows[0].cells.length===1?body.rows[0].cells[0]:null;
            if(!body.rows.length){const row=body.insertRow();cell=row.insertCell();cell.colSpan=Math.max(1,body.closest('table')?.querySelectorAll('thead th').length||1);cell.textContent='No records here yet.';}
            if(!cell||cell.dataset.emptyEnhanced||!/^No\b/i.test(cell.textContent.trim()))continue;
            if(cell.querySelector('button')){cell.dataset.emptyEnhanced='true';continue;}
            cell.dataset.emptyEnhanced='true';cell.classList.add('friendly-empty-cell');
            const mapping={incomeBody:['income','Add income'],expenseBody:['expense','Add expense'],debtsBody:['loan','Add loan'],pfBody:['pf','Add PF account'],ppfBody:['ppf','Add PPF account'],npsBody:['nps','Add NPS account'],balanceHistoryBody:['opening','Set opening balance'],houseExpenseBody:['opening','Set opening balance'],investmentContributionBody:['contribution','Add contribution'],stallionContribBody:['investment','View investments'],debtEmiHistoryBody:['expense','Record a payment']};
            let match=mapping[body.id],filtered=false;
            if(['incomeBody','expenseBody'].includes(body.id)){
              const kind=body.id==='incomeBody'?'income':'expense',rows=kind==='income'?profileRows(state.income):state.expenses;
              filtered=rows.length>0;
              if(!filtered)cell.textContent=kind==='income'?'No income yet. Add your first one.':'No expenses yet. Add your first one.';
              else cell.textContent='No '+(kind==='income'?'income':'expenses')+' match this month or filter.';
              if(filtered){const b=document.createElement('button');b.type='button';b.className='btn-secondary';b.textContent='Clear filters';b.onclick=()=>{document.getElementById(kind+'HistorySearch').value='';const latest=rows.map(row=>row.date.slice(0,7)).sort().at(-1)||currentMonthKey();document.getElementById('income-expenses').dataset.cashMonth=latest;const fy=document.getElementById(kind+'HistoryFinancialYear'),month=document.getElementById(kind+'HistoryMonth');fy.dataset.preferredYear=String(financialYearStartYearForMonthKey(latest));month.dataset.preferredMonth=latest;transactionHistoryPages[kind]=1;kind==='income'?renderIncome():renderExpenses();window.financeCashFlow?.refresh?.();};cell.append(b);continue;}
            }
            if(!match){const b=document.createElement('button');b.type='button';b.className='btn-secondary';b.textContent='Review filters or records';b.onclick=()=>{const region=body.closest('.investment-edit-modal,dialog,.panel,.tab-content')||document;const select=region.querySelector('select');if(select){const popover=document.getElementById(select.id+'PopoverTrigger');if(popover)popover.click();else select.focus();}else document.querySelector('.nav-tab[data-tab="income-expenses"]')?.click();};cell.append(b);continue;}
            if(window.financeCloud?.canEdit===false){const note=document.createElement('small');note.textContent='Ask the owner or an editor to add records.';cell.append(note);continue;}
            const button=document.createElement('button');button.type='button';button.className='btn-secondary';button.textContent=match[1];button.dataset.setupAction=match[0];cell.append(button);
          }
          for(const host of document.querySelectorAll('.investment-empty-state,#retirementEmptyState')){if(host.querySelector('[data-setup-action]')||window.financeCloud?.canEdit===false)continue;const button=document.createElement('button');button.type='button';button.className='btn-secondary';button.textContent='Add your first account';button.dataset.setupAction=host.id==='retirementEmptyState'?'pf':'investment';host.append(button);}
        });
      }
      const observer=new MutationObserver(enhanceEmptyTables);observer.observe(document.body,{childList:true,subtree:true});window.matchMedia('(max-width:700px)').addEventListener('change',renderGettingStarted);window.PFTGettingStarted={refresh:renderGettingStarted,enhance:enhanceEmptyTables};renderGettingStarted();enhanceEmptyTables();
    }
    if(typeof window!=='undefined'){
      window.addEventListener('pft:before-reveal',installGettingStarted);
      Promise.resolve(window.trackerReady).then(()=>{if(window.financeCloud)installGettingStarted();}).catch(()=>{});
    }
