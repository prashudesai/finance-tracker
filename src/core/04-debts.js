    // DEBTS
    function syncNewLoanFirstEmiExtraInterest(force=false){const input=document.getElementById('debtFirstEmiExtraInterest');if(input.dataset.manual==='true'&&!force)return;const date=document.getElementById('debtDate').value,explicitFirstEmiDate=document.getElementById('debtFirstEmiDate').value,dueDay=Number(document.getElementById('debtEmiDueDay').value)||undefined,firstEmiDate=explicitFirstEmiDate||firstLoanEmiDueDate({date,emiDueDay:dueDay});if(!firstEmiDate||!date){input.value='';return;}input.value=PFT_LOAN_LEDGER.estimateExtraFirstEmiInterest({principal:Number(document.getElementById('debtAmount').value),rate:Number(document.getElementById('debtRate').value),date,firstEmiDate}).toFixed(2);}
    function syncNewLoanDailyInterestFields(){const hide=document.getElementById('debtDailyInterestBasis').checked;document.getElementById('debtFirstEmiExtraInterestGroup').hidden=hide;if(!hide)syncNewLoanFirstEmiExtraInterest();}
    document.getElementById('debtDailyInterestBasis').addEventListener('change',syncNewLoanDailyInterestFields);syncNewLoanDailyInterestFields();
    document.getElementById('debtFirstEmiExtraInterest').addEventListener('input',event=>{event.currentTarget.dataset.manual='true';});
    document.getElementById('debtFirstEmiExtraRecalculate').addEventListener('click',()=>{const input=document.getElementById('debtFirstEmiExtraInterest');delete input.dataset.manual;syncNewLoanFirstEmiExtraInterest(true);});
    for(const id of ['debtAmount','debtRate','debtDate','debtFirstEmiDate','debtEmiDueDay'])for(const eventName of ['input','change'])document.getElementById(id).addEventListener(eventName,()=>syncNewLoanFirstEmiExtraInterest());
    document.getElementById('addDebtBtn').addEventListener('click', () => {
      const type = document.getElementById('debtType').value;
      const amt = Number(document.getElementById('debtAmount').value);
      const rate = Number(document.getElementById('debtRate').value) || 0;
      const emi = Number(document.getElementById('debtEMI').value);
      const date = document.getElementById('debtDate').value || localDateKey();
      const emiDueDayInput=document.getElementById('debtEmiDueDay').value.trim();
      const emiDueDay=emiDueDayInput===''?null:Number(emiDueDayInput);
      const firstEmiDate=document.getElementById('debtFirstEmiDate').value;
      const firstEmiExtraText=document.getElementById('debtFirstEmiExtraInterest').value.trim(),firstEmiExtraInterest=firstEmiExtraText===''?0:Number(firstEmiExtraText);
      const dailyInterestBasis=document.getElementById('debtDailyInterestBasis').checked;
      const firstEmiFields={dailyInterestBasis,...(!dailyInterestBasis?{firstEmiInterestMethod:'short-actual365'}:{}),...(firstEmiDate?{firstEmiDate}:{}),...(!dailyInterestBasis&&firstEmiExtraText!==''?{firstEmiExtraInterest}:{})};
      try{PFT_LOAN_LEDGER.validate({date,...(emiDueDay===null?{}:{emiDueDay}),...firstEmiFields});}catch(error){alert(error.message);return;}
      const notes = document.getElementById('debtNotes').value;
      const member=document.getElementById('debtMember')?.value||'Family';

      if (!Number.isFinite(amt) || amt <= 0 || !Number.isFinite(rate) || rate < 0 || !Number.isFinite(emi) || emi < 0) {
        alert('Enter valid principal, rate and EMI amounts');
        return;
      }
      if(emiDueDay!==null&&(!Number.isInteger(emiDueDay)||emiDueDay<1||emiDueDay>31)){alert('Monthly EMI due day must be a whole day from 1 to 31.');return;}

      state.debts.push({
        id: generateId(),
        type: type,
        principal: amt,
        rate: rate,
        emi: Math.round(emi) || 0,
        date: date,
        remaining: amt,
        notes: notes,
        member: member,
        ...(emiDueDay===null?{}:{emiDueDay}),...firstEmiFields
      });
      if(firstEmiFields.dailyInterestBasis){const initError=rebuildDebtRepaymentHistory(state.debts[state.debts.length-1].id);if(initError){state.debts.pop();alert(initError);return;}}

      document.getElementById('debtAmount').value = '';
      document.getElementById('debtRate').value = '';
      document.getElementById('debtEMI').value = '';delete document.getElementById('debtEMI').dataset.manualEmi;document.getElementById('debtTenure').value='';
      document.getElementById('debtDate').value = '';
      document.getElementById('debtEmiDueDay').value = '';
      document.getElementById('debtDailyInterestBasis').checked=false;document.getElementById('debtFirstEmiDate').value='';document.getElementById('debtFirstEmiExtraInterest').value='';delete document.getElementById('debtFirstEmiExtraInterest').dataset.manual;syncNewLoanDailyInterestFields();
      document.getElementById('debtNotes').value = '';
      if(document.getElementById('debtMember'))document.getElementById('debtMember').value='';

      saveData();
      renderDebts();
      populateLoanDropdown();
      updateDashboard();
      closeInvestmentEntry('loanAddPanel');
    });

    function remainingEmiEstimate(debt) {
      const balance = Number(debt.remaining), emi = Number(debt.emi), rate = Number(debt.rate) / 1200;
      if (!Number.isFinite(balance) || balance < 0 || !Number.isFinite(rate) || rate < 0) return {label:'Invalid loan data',count:null};
      if (balance === 0) return {label:'0',count:0,finalPayment:0};
      if (!Number.isFinite(emi) || emi <= 0) return {label:'Enter EMI',count:null};
      if (rate > 0 && emi <= balance * rate) return {label:'EMI does not cover interest',count:null};
      const periods = rate === 0 ? balance / emi : -Math.log1p(-balance * rate / emi) / Math.log1p(rate);
      const count = Math.max(1, Math.ceil(periods - 1e-9));
      const beforeLast = rate === 0 ? balance - emi * (count-1)
        : balance * Math.pow(1+rate,count-1) - emi * Math.expm1((count-1)*Math.log1p(rate)) / rate;
      const finalPayment = Math.min(emi, Math.max(0,beforeLast*(1+rate)));
      return {label:String(count),count,finalPayment};
    }
    function calculateEnteredEmi() {
      if(document.getElementById('debtEMI').dataset.manualEmi==='true')return;
      const principal = Number(document.getElementById('debtAmount').value);
      const annualRate = Number(document.getElementById('debtRate').value);
      const months = Number(document.getElementById('debtTenure').value);
      if (!Number.isFinite(principal) || principal<=0 || !Number.isFinite(annualRate) || annualRate<0 || !Number.isInteger(months) || months<=0) return;
      const rate=annualRate/1200;
      const emi=rate===0?principal/months:principal*rate/(-Math.expm1(-months*Math.log1p(rate)));
      document.getElementById('debtEMI').value=String(Math.round(emi));
    }
    document.getElementById('debtEMI').addEventListener('input',()=>{document.getElementById('debtEMI').dataset.manualEmi=document.getElementById('debtEMI').value.trim()===''?'false':'true';});
    ['debtAmount','debtRate','debtTenure'].forEach(id=>document.getElementById(id).addEventListener('input',calculateEnteredEmi));

    function renderDebtPageOverview() {
      const debts=profileRows(Array.isArray(state.debts)?state.debts:[]);
      const active=debts.filter(debt=>(Number(debt.remaining)||0)>0);
      const outstanding=active.reduce((sum,debt)=>sum+(Number(debt.remaining)||0),0);
      const monthlyEmi=active.reduce((sum,debt)=>sum+(Number(debt.emi)||0),0);
      const set=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value;};
      set('debtPageOutstanding',formatCurrency(outstanding));
      set('debtPageMonthlyEmi',formatCurrency(monthlyEmi));
      set('debtPageAccountCount',`${active.length} active · ${debts.length} total`);
      set('debtPageStatus',`${active.length} active · ${debts.length} total`);
      set('debtListCount',`${debts.length} ${debts.length===1?'account':'accounts'}`);
    }
    function renderDebts() {
      const loanModal=document.getElementById('loanDetailsModal');if(loanModal&&!loanModal.hidden){if(state.debts.some(row=>row.id===loanModal.dataset.loanId))viewLoanDetails(loanModal.dataset.loanId);else closeLoanDetails();}
      renderDebtPageOverview();
      const tbody = document.getElementById('debtsBody');
      const debts=profileRows(state.debts);
      renderAccountPager('debts','debtsBody',renderDebts);
      if (debts.length === 0) {
        tbody.innerHTML = '<tr class="debt-empty-row"><td colspan="8" class="debt-empty-cell"><div class="retirement-empty-state debt-empty-state"><span class="account-empty-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/></svg></span><div class="account-empty-copy"><strong>No debts recorded yet</strong><span>Add a loan to track balances and repayments.</span></div></div></td></tr>';
        return;
      }

      tbody.innerHTML = pageAccountRows('debts',debts).map(d => {
        const paid = loanTotalPrincipal(d) - d.remaining;
        const percentPaid = (loanTotalPrincipal(d)>0?Math.max(0,Math.min(100,paid/loanTotalPrincipal(d)*100)):0).toFixed(1);
        const interestPaid = d.interestPaid || 0;
        const schedule = remainingEmiEstimate(d);
        return `
          <tr data-loan-id="${analyticEscape(d.id)}" tabindex="0" style="cursor:pointer">
            <td data-label="Loan">
              <strong>${analyticEscape(d.type)}</strong>
              ${d.notes ? `<div class="text-muted" style="font-size: 11px; margin-top: 2px;">${analyticEscape(d.notes)}</div>` : ''}
            </td>
            <td class="text-right" data-label="Total borrowed">${formatCurrency(loanTotalPrincipal(d))}${loanTotalPrincipal(d)>d.principal?`<div class="text-muted" style="font-size:11px">Includes ${formatCurrency(loanTotalPrincipal(d)-d.principal)} top-ups</div>`:''}</td>
            <td class="text-right" data-label="Interest rate">${d.rate}%</td>
            <td class="text-right" data-label="Monthly EMI">${formatCurrency(d.emi)}${(d.emiDueDay||d.firstEmiDate)?`<div class="text-muted" style="font-size:11px;margin-top:3px">Monthly EMI Due Date: ${loanDueDateLabel(d)}</div>`:''}</td>
            <td class="text-right" data-label="Outstanding balance">
              <strong>${formatCurrency(d.remaining)}</strong>
              <div class="progress-bar" style="margin-top: 4px;">
                <div class="progress-fill" style="width: ${percentPaid}%; background: var(--success);"></div>
              </div>
              <div style="font-size: 11px; color: var(--success); margin-top: 2px;">${percentPaid}% paid | Interest: ${formatCurrency(interestPaid)}</div>
            </td>
            <td class="text-right" data-label="Remaining EMIs (estimate)"><strong>${schedule.label}</strong></td>
            <td data-label="Status"><span class="badge ${d.remaining <= 0 ? 'badge-success' : 'badge-danger'}">${d.remaining <= 0 ? 'Paid off' : 'Active'}</span></td>
            <td data-label="Actions">
              <button class="btn-small" onclick="viewDebtEmiHistory('${d.id}')">View EMI History</button>
              <button class="btn-small" onclick="editDebt('${d.id}')">Edit</button>
              <button class="btn-small btn-danger" onclick="deleteDebt('${d.id}')">Delete</button>
            </td>
          </tr>
        `;
      }).join('');
    }

    function loanTotalPrincipal(debt){return PFT_LOAN_LEDGER.totalPrincipal(debt);}
    function loanPayments(id){return state.expenses.filter(row=>row.category==='EMI Payment'&&row.loanId===id);}
    function applyLoanLedger(debt,result){
      const expensesById=new Map(state.expenses.map(row=>[row.id,row]));
      for(const split of result.payments){const row=expensesById.get(split.id);if(row)Object.assign(row,{principalPaid:split.principalPaid,interestPaid:split.interestPaid});}
      Object.assign(debt,{remaining:result.remaining,interestPaid:result.interestPaid,rate:result.rate,emi:result.emi});
      if(debt.dailyInterestBasis)debt.dailyBalanceAsOf=localDateKey();
    }
    async function editLoanChange(id,type,changeId=null,removing=false){
      if(window.financeCloud?.canEdit===false)return;
      const debt=state.debts.find(row=>row.id===id);if(!debt)return;
      const original=JSON.stringify(state),entry=debt.loanChanges?.find(row=>row.id===changeId);
      if(changeId&&!entry)return;
      const eventId=changeId||crypto.randomUUID();
      const fields=removing?[{key:'confirm',label:'Remove this entry and recalculate later repayments?',options:['Cancel','Remove entry'],value:'Cancel'}]:[
        {key:'date',label:type!=='topup'?'Effective from repayment date':'Top-up date',type:'date',value:entry?.date||localDateKey()},
        ...(type==='topup'?[{key:'amount',label:'Additional principal ₹',type:'number',min:0.01,value:entry?.amount||''}]:[]),
        ...(type==='emi'?[]:[{key:'rate',label:type==='rate'?'New annual rate %':'New annual rate % (optional)',type:'number',required:type==='rate',value:entry?.rate??(type==='rate'?debt.rate:'')}]),
        ...(type==='emi'?[]:[{key:'choice',label:'After this change',options:['tenure','emi','manual'],optionLabels:{tenure:'Keep tenure · calculate EMI',emi:'Keep EMI · revise tenure',manual:'Enter bank-confirmed EMI'},value:entry?.repaymentChoice||(entry?.emi!==undefined?'manual':'emi')}]),
        {key:'emi',label:type==='emi'?'Revised regular monthly EMI ₹':'Bank-confirmed monthly EMI ₹',type:'number',required:type==='emi',min:1,value:entry?.emi??(type==='emi'?debt.emi:'')},
        {key:'notes',label:'Notes',type:'textarea',maxLength:500,value:entry?.notes||''}
      ];
      function preview(values){
        const draft=JSON.parse(JSON.stringify(debt));
        if(!draft.loanChanges){draft.openingRate=debt.rate;draft.openingEmi=debt.repaymentBaseEmi??debt.emi;draft.loanChanges=[];}
        draft.loanChanges=draft.loanChanges.filter(row=>row.id!==eventId);
        if(!removing){
          if(values.date>localDateKey())return{error:'Choose today or an earlier date. Scheduled loan changes are not supported.'};
          const event={id:eventId,type,date:values.date,notes:values.notes};
          if(type==='topup')event.amount=Number(values.amount);
          if(type!=='emi'&&values.rate!=='')event.rate=Number(values.rate);
          event.repaymentChoice=type==='emi'?'manual':values.choice;
          if(event.repaymentChoice==='manual')event.emi=Number(values.emi);
          draft.loanChanges.push(event);
        }
        const result=PFT_LOAN_LEDGER.rebuild(draft,loanPayments(id),undefined,localDateKey());return{...result,draft};
      }
      const pending=openRecordEditor(removing?'Remove loan change':type==='rate'?'Update interest rate':type==='emi'?'Revise regular EMI':'Top up loan',fields,values=>{
        if(removing&&values.confirm!=='Remove entry')return 'Choose Remove entry or press Cancel.';
        return preview(values).error||null;
      });
      const container=document.getElementById('recordEditorFields'),note=document.createElement('div');note.setAttribute('role','status');note.setAttribute('aria-live','polite');note.className='loan-change-preview';container.append(note);
      const refresh=()=>{
        const values=Object.fromEntries(new FormData(document.getElementById('recordEditorForm'))),manual=document.getElementById('recordEdit_emi');
        if(manual){const enabled=type==='emi'||values.choice==='manual';manual.parentElement.hidden=!enabled;manual.disabled=!enabled;manual.required=enabled;}
        const result=preview(values);note.replaceChildren();
        if(result.error){note.textContent=result.error;return;}
        const change=result.history.find(e=>e.id===eventId),estimate=PFT_LOAN_LEDGER.estimate(result.remaining,result.emi,result.rate);
        const title=document.createElement('h4');title.textContent='Change preview';note.append(title);
        if(change){
          const grid=document.createElement('div');grid.className='loan-change-comparison';
          const cell=(text,kind)=>{const node=document.createElement('span');node.className=kind;node.textContent=text;grid.append(node);};
          cell('At effective date','comparison-label');cell('Before','comparison-heading');cell('After','comparison-heading');
          for(const [label,before,after] of [
            ['Balance',formatCurrency(change.beforeBalance),formatCurrency(change.balance)],
            ['Annual rate',change.beforeRate+'%',change.rate+'%'],
            ['Monthly EMI',formatCurrency(change.beforeEmi),formatCurrency(change.emi)],
            ['Payments left',String(change.oldTerm??'Unavailable'),String(change.newTerm??'Unavailable')]
          ]){cell(label,'comparison-label');cell(before,'comparison-before');cell(after,'comparison-after');}
          note.append(grid);
        }
        const current=document.createElement('dl');current.className='loan-change-current';
        for(const [label,value] of [['Current outstanding',formatCurrency(result.remaining)],['Monthly EMI',formatCurrency(result.emi)],['Estimated payments',String(estimate.count??'Unavailable')]]){
          const item=document.createElement('div'),term=document.createElement('dt'),description=document.createElement('dd');term.textContent=label;description.textContent=value;item.append(term,description);current.append(item);
        }
        note.append(current);
        const help=document.createElement('p');help.className='loan-change-help';help.textContent='Tenure is an estimate. Confirm the bank’s revised schedule when available. Earlier repayments are preserved; top-ups do not create income entries.';note.append(help);
      };
      const rateInput=document.getElementById('recordEdit_rate');if(rateInput)rateInput.step='0.05';
      container.addEventListener('input',refresh);container.addEventListener('change',refresh);refresh();
      const values=await pending;container.removeEventListener('input',refresh);container.removeEventListener('change',refresh);if(!values)return;
      if(JSON.stringify(state)!==original){alert('Records changed during preview. Reopen the loan and try again.');return;}
      const result=preview(values);if(result.error){alert(result.error);return;}
      const change=result.history.find(e=>e.id===eventId);
      const confirmation=removing?'Remove this entry and recalculate the loan?':
        (values.choice==='tenure'?'Keep estimated remaining tenure':values.choice==='emi'?'Keep current EMI':'Use bank-confirmed EMI')+'\nEffective date: '+values.date+
        '\nEMI: '+formatCurrency(change.beforeEmi)+' → '+formatCurrency(change.emi)+
        '\nEstimated payments: '+(change.oldTerm??'Unavailable')+' → '+(change.newTerm??'Unavailable')+
        '\nApply this change?';
      if(!confirm(confirmation))return;
      if(JSON.stringify(state)!==original){alert('Records changed. Reopen the loan and try again.');return;}
      Object.assign(debt,result.draft);applyLoanLedger(debt,result);
      if(!await saveData(removing?'Removed loan change':type==='rate'?'Updated loan interest rate':'Recorded loan top-up'))alert('Could not finish saving. Check the sync status before closing.');
      refreshAllPageViews();viewLoanDetails(id);
    }
    function closeLoanDetails(){document.getElementById('loanDetailsModal').hidden=true;syncInvestmentOverlayBodyLock();}
    function viewLoanDetails(id){
      const debt=state.debts.find(row=>row.id===id);if(!debt)return;
      const modal=document.getElementById('loanDetailsModal');modal.dataset.loanId=id;
      document.getElementById('loanDetailsTitle').textContent=debt.type;
      const schedule=remainingEmiEstimate(debt),body=document.getElementById('loanDetailsContent');body.replaceChildren();
      modal.querySelector('.investment-edit-dialog>div:first-child').classList.add('loan-details-heading');
      const metric=(container,label,value)=>{
        const item=document.createElement('div'),term=document.createElement('dt'),description=document.createElement('dd');
        term.textContent=label;description.textContent=value;item.append(term,description);container.append(item);
      };
      const balance=document.createElement('dl');balance.className='loan-details-balance';
      metric(balance,'Outstanding balance',formatCurrency(debt.remaining));body.append(balance);
      const metrics=document.createElement('dl');metrics.className='loan-details-metrics';
      for(const [label,value] of [['Original principal',formatCurrency(debt.principal)],['Top-ups',formatCurrency(loanTotalPrincipal(debt)-debt.principal)],['Total borrowed',formatCurrency(loanTotalPrincipal(debt))],['Monthly EMI',formatCurrency(Math.round(debt.emi))],['Annual rate',debt.rate+'%'],['Remaining payments',schedule.label]])metric(metrics,label,value);
      body.append(metrics);
      const details=document.createElement('section');details.className='loan-details-section';
      const detailsHeading=document.createElement('h3');detailsHeading.textContent='Loan details';details.append(detailsHeading);
      const terms=document.createElement('dl');terms.className='loan-details-terms';
      for(const [label,value] of [['Family member',debt.member||'Family'],['Interest method',debt.dailyInterestBasis?'Daily balance · month-end capitalization':'Monthly EMI calculation'],['First EMI date',debt.firstEmiDate||'Automatic schedule'],['Extra days’ interest with first EMI',formatCurrency(debt.firstEmiExtraInterest||0)],['Monthly EMI Due Date',loanDueDateLabel(debt)]].filter(([label])=>!debt.dailyInterestBasis||!['Extra days’ interest with first EMI'].includes(label)))metric(terms,label,value);
      details.append(terms);
      const notes=document.createElement('dl');notes.className='loan-details-notes';metric(notes,'Notes',debt.notes||'—');details.append(notes);body.append(details);
      const actions=document.createElement('div');actions.className='loan-details-actions';actions.setAttribute('role','group');actions.setAttribute('aria-label','Loan actions');
      for(const [label,action] of [['Payment history',()=>viewDebtEmiHistory(id)],['Revise EMI',()=>editLoanChange(id,'emi')],['Update interest rate',()=>editLoanChange(id,'rate')],['Top up loan',()=>editLoanChange(id,'topup')],['Edit',()=>editDebt(id)],['Delete',()=>{deleteDebt(id);if(!state.debts.some(row=>row.id===id))closeLoanDetails();}]]){const button=document.createElement('button');button.className=label==='Delete'?'btn-small btn-danger':'btn-small';button.textContent=label;button.onclick=action;actions.appendChild(button);}body.append(actions);
      const editable=window.financeCloud?.canEdit!==false;
      for(const button of body.querySelectorAll('button'))if(button.textContent!=='Payment history')button.disabled=!editable;
      const history=document.createElement('section');history.className='loan-details-section loan-details-history';body.append(history);
      const heading=document.createElement('h3');heading.textContent='Rate, EMI & top-up history';history.append(heading);
      const opening=document.createElement('p');opening.textContent='Opening terms: '+(debt.openingRate??debt.rate)+'% · EMI '+formatCurrency(debt.openingEmi??debt.repaymentBaseEmi??debt.emi);history.append(opening);
      const ledgerHistory=Array.isArray(debt.loanChanges)?PFT_LOAN_LEDGER.rebuild(debt,loanPayments(id),undefined,localDateKey()).history||[]:[];
      for(const entry of [...(debt.loanChanges||[])].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id))){
        const computed=ledgerHistory.find(e=>e.id===entry.id),row=document.createElement('div'),line=document.createElement('p');row.className='loan-details-history-entry';line.textContent=entry.date+' · '+(entry.type==='topup'?'Top-up '+formatCurrency(entry.amount):entry.type==='emi'?'Regular EMI revision':'Rate update')+(entry.rate!==undefined?' · '+entry.rate+'%':'')+(entry.repaymentChoice?' · '+({tenure:'Keep tenure',emi:'Keep EMI',manual:'Bank-confirmed EMI'}[entry.repaymentChoice])+' · EMI '+formatCurrency(computed?.emi??entry.emi):entry.emi!==undefined?' · EMI '+formatCurrency(entry.emi):'')+(entry.notes?' · '+entry.notes:'');row.append(line);
        for(const [label,remove] of [['Edit entry',false],['Remove entry',true]]){const button=document.createElement('button');button.className='btn-small';button.textContent=label;button.disabled=!editable;button.onclick=()=>editLoanChange(id,entry.type,entry.id,remove);row.append(button);}history.append(row);
      }
      modal.hidden=false;syncInvestmentOverlayBodyLock();modal.querySelector('button').focus();
    }
    document.getElementById('debtsBody').addEventListener('click',event=>{if(event.target.closest('button,a,input,select'))return;const row=event.target.closest('[data-loan-id]');if(row)viewLoanDetails(row.dataset.loanId);});
    document.getElementById('debtsBody').addEventListener('keydown',event=>{if(event.target.matches('[data-loan-id]')&&['Enter',' '].includes(event.key)){event.preventDefault();viewLoanDetails(event.target.dataset.loanId);}});
    document.getElementById('loanDetailsModal').addEventListener('click',event=>{if(event.target.id==='loanDetailsModal')closeLoanDetails();});
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!document.getElementById('loanDetailsModal').hidden&&document.getElementById('debtEmiHistoryModal').hidden&&!document.getElementById('recordEditorDialog').open)closeLoanDetails();});
    function viewDebtEmiHistory(debtId) {
      const debt=state.debts.find(row=>row.id===debtId);
      if(!debt)return;
      const records=(state.expenses||[]).filter(row=>row.category==='EMI Payment'&&row.loanId===debtId).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
      const total=records.reduce((sum,row)=>sum+(Number(row.amount)||0),0);
      const principal=records.reduce((sum,row)=>sum+(Number(row.principalPaid??row.amount)||0),0);
      const interest=records.reduce((sum,row)=>sum+(Number(row.interestPaid)||0),0);
      document.getElementById('debtEmiHistoryTitle').textContent=`Loan Payment History — ${debt.type||'Debt'}`;
      const head=document.getElementById('debtEmiHistoryHead'),body=document.getElementById('debtEmiHistoryBody');
      if(debt.dailyInterestBasis===true){
        head.innerHTML='<tr><th>Date</th><th>Type</th><th>Description</th><th class="text-right">Debit</th><th class="text-right">Credit</th><th class="text-right">Balance</th></tr>';
        const statement=PFT_LOAN_LEDGER.dailyStatement(debt,records,localDateKey());
        document.getElementById('debtEmiHistorySummary').textContent=statement.error
          ? 'Could not rebuild the daily-balance statement: '+statement.error
          : `Daily balance · as of ${calendarDate(statement.asOfDate).toLocaleDateString('en-IN')} · Interest capitalized ${formatCurrency(statement.interestPaid)} · Accrued this month, not capitalized ${formatCurrency(statement.accruedInterest)} · Closing balance ${formatCurrency(statement.remaining)}`;
        body.innerHTML=statement.error?'<tr><td colspan="6" class="text-muted">Statement unavailable. Review the loan and payment dates.</td></tr>':statement.rows.slice().reverse().map(row=>`<tr><td data-label="Date">${row.date?calendarDate(row.date).toLocaleDateString('en-IN'):'—'}</td><td data-label="Type">${analyticEscape(row.type)}</td><td data-label="Description">${analyticEscape(row.description)}</td><td class="text-right" data-label="Debit">${row.debit?formatCurrency(row.debit):'—'}</td><td class="text-right" data-label="Credit">${row.credit?formatCurrency(row.credit):'—'}</td><td class="text-right" data-label="Balance"><strong>${formatCurrency(row.balance)}</strong></td></tr>`).join('');
      }else{
        head.innerHTML='<tr><th>Payment date</th><th>Payment type</th><th class="text-right">EMI / payment paid</th><th class="text-right">Interest</th><th class="text-right">Principal repaid</th><th class="text-right">Outstanding after payment</th><th>Notes</th></tr>';
        const balanceResult=PFT_LOAN_LEDGER.paymentBalances(debt,records,localDateKey()),balances=balanceResult.balances||new Map();
      document.getElementById('debtEmiHistorySummary').innerHTML=records.length
        ? '<div class="loan-history-summary-grid">'+[
          ['Payments',String(records.length)],
          ['Total paid',formatCurrency(total)],
          ['Interest',formatCurrency(interest)],
          ['Principal repaid',formatCurrency(principal)],
          ['Outstanding',formatCurrency(debt.remaining)]
        ].map(([label,value])=>'<div class="loan-history-summary-item"><span>'+label+'</span><strong>'+value+'</strong></div>').join('')+'</div>'
        : `No EMI payments have been recorded for this debt yet. Current outstanding ${formatCurrency(debt.remaining)}.`;
        body.innerHTML=records.length?records.map(row=>`<tr><td data-label="Payment date">${row.date?calendarDate(row.date).toLocaleDateString('en-IN'):'—'}</td><td data-label="Payment type">${row.repaymentType==='part-payment'?'Part Payment'+(row.partPaymentAction==='reduce'?' · Reduce EMI':row.partPaymentAction==='keep'?' · Keep EMI':''):'Monthly EMI'}</td><td class="text-right" data-label="EMI / payment paid">${formatCurrency(row.amount)}</td><td class="text-right" data-label="Interest">${formatCurrency(row.interestPaid||0)}</td><td class="text-right" data-label="Principal repaid">${formatCurrency(row.principalPaid??row.amount)}</td><td class="text-right" data-label="Outstanding after payment">${balances.has(row.id)?formatCurrency(balances.get(row.id)):'—'}</td><td data-label="Notes">${analyticEscape(row.notes||'—')}</td></tr>`).join(''):'<tr><td colspan="7" class="text-muted">No loan payments recorded.</td></tr>';
      }
      const modal=document.getElementById('debtEmiHistoryModal');
      modal.dataset.loanId=debtId;loanHistoryExportRows=collectLoanHistoryRows(debtId);
      modal.hidden=false;document.body.style.overflow='hidden';
      paginateHistoryTable('debtEmiHistoryBody',true);
    }
    function closeDebtEmiHistory() {
      document.getElementById('debtEmiHistoryModal').hidden=true;
      syncInvestmentOverlayBodyLock();
    }

    let loanHistoryExportRows=[];
    function collectLoanHistoryRows(debtId){
      const debt=allAccounts('debts').find(row=>row.id===debtId);if(!debt)return[];
      const payments=(state.expenses||[]).filter(row=>row.category==='EMI Payment'&&row.loanId===debt.id).sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))),rows=[];
      if(debt.dailyInterestBasis===true){
        const statement=PFT_LOAN_LEDGER.dailyStatement(debt,payments,localDateKey());if(statement.error)return[];
        statement.rows.forEach((entry,sequence)=>rows.push({date:entry.date||'',entry:entry.type||'Entry',amount:entry.debit||0,interest:0,principal:entry.credit||0,balance:entry.balance??'',notes:entry.description||'',sequence}));
      }else{
        const result=PFT_LOAN_LEDGER.paymentBalances(debt,payments,localDateKey()),balances=result.balances||new Map();
        payments.forEach((payment,sequence)=>rows.push({date:payment.date||'',entry:payment.repaymentType==='part-payment'?'Part payment':'Monthly EMI',amount:Number(payment.amount)||0,interest:Number(payment.interestPaid)||0,principal:Number(payment.principalPaid??payment.amount)||0,balance:balances.get(payment.id)??'',notes:payment.notes||'',sequence}));
      }
      return rows;
    }
    function loanHistoryOrdered(ascending){
      return [...loanHistoryExportRows].sort((a,b)=>String(a.date).localeCompare(String(b.date))*(ascending?1:-1)||(Number(a.sequence)-Number(b.sequence))*(ascending?1:-1));
    }
    function loanHistoryCell(value){let text=String(value??'');return /^[=+@\-]/.test(text)?"'"+text:text;}
    function loanHistoryFilename(extension){const debt=allAccounts('debts').find(row=>row.id===document.getElementById('debtEmiHistoryModal').dataset.loanId);const slug=String(debt?.type||'loan').trim().replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').toLowerCase()||'loan';return `${slug}-payment-history-${localDateKey()}.${extension}`;}
    function downloadLoanHistory(content,type,extension){const url=URL.createObjectURL(new Blob([content],{type})),link=document.createElement('a');link.href=url;link.download=loanHistoryFilename(extension);document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
    function saveLoanHistoryCsv(){
      const headers=['Date','Entry','Amount / Debit','Interest','Principal / Credit','Balance','Notes / Description'];
      const lines=[headers,...loanHistoryOrdered(true).map(row=>[row.date,row.entry,row.amount||'',row.interest||'',row.principal||'',row.balance,row.notes])].map(row=>row.map(value=>'"'+loanHistoryCell(value).replace(/"/g,'""')+'"').join(','));
      downloadLoanHistory('\ufeff'+lines.join('\r\n'),'text/csv;charset=utf-8','csv');
    }
    function saveLoanHistoryPdf(){
      if(!window.jspdf?.jsPDF){
        if(saveLoanHistoryPdf.loading)return saveLoanHistoryPdf.loading;
        const modal=document.getElementById('debtEmiHistoryModal'),selected=modal.dataset.loanId,button=document.getElementById('debtEmiHistoryPdf'),label=button?.textContent;
        if(button){button.disabled=true;button.textContent='Loading PDF…';}
        saveLoanHistoryPdf.loading=window.PFTLoadScript('pdf').then(()=>{saveLoanHistoryPdf.loading=null;if(!modal.hidden&&modal.dataset.loanId===selected)saveLoanHistoryPdf();}).catch(error=>{saveLoanHistoryPdf.loading=null;if(!modal.hidden&&modal.dataset.loanId===selected)alert(error.message);}).finally(()=>{if(button){button.disabled=false;button.textContent=label;}});return saveLoanHistoryPdf.loading;
      }
      const debt=allAccounts('debts').find(row=>row.id===document.getElementById('debtEmiHistoryModal').dataset.loanId),title=`${debt?.type||'Loan'} Payment History`,pdf=new window.jspdf.jsPDF({orientation:'landscape',unit:'mm',format:'a4'}),rows=loanHistoryOrdered(true),columns=[['Date',22],['Entry',36],['Amount / Debit',28],['Interest',24],['Principal / Credit',31],['Balance',29],['Notes / Description',119]];let page=1,y=18;
      const header=()=>{pdf.setFont('helvetica','bold');pdf.setFontSize(13);pdf.text(title,5,10);pdf.setFont('helvetica','normal');pdf.setFontSize(8);pdf.text('Oldest to newest · Generated '+new Date().toLocaleDateString('en-IN'),5,15);let x=5;pdf.setFillColor(232,242,241);pdf.setDrawColor(180);for(const [label,width] of columns){pdf.rect(x,y,width,7,'FD');pdf.text(label,x+1.2,y+4.8);x+=width;}y+=7;};
      const newPage=()=>{pdf.addPage();page++;y=18;header();pdf.setFontSize(7);};header();pdf.setFont('helvetica','normal');pdf.setFontSize(7);
      for(const row of rows){const vals=[row.date,row.entry,row.amount?Number(row.amount).toFixed(2):'',row.interest?Number(row.interest).toFixed(2):'',row.principal?Number(row.principal).toFixed(2):'',row.balance===''?'':Number(row.balance).toFixed(2),row.notes||''];const cells=vals.map((value,i)=>pdf.splitTextToSize(String(value),columns[i][1]-2.5)),height=Math.max(6,...cells.map(cell=>cell.length*3.2+1));if(y+height>195)newPage();let x=5;for(let i=0;i<columns.length;i++){pdf.rect(x,y,columns[i][1],height);pdf.text(cells[i],x+1.2,y+3.5,{maxWidth:columns[i][1]-2.5});x+=columns[i][1];}y+=height;}
      pdf.setFontSize(7);for(let n=1;n<=page;n++){pdf.setPage(n);pdf.text(`${n} / ${page}`,292,203,{align:'right'});}pdf.save(loanHistoryFilename('pdf'));
    }
    function printLoanHistory(){
      const rows=loanHistoryOrdered(true),debt=allAccounts('debts').find(row=>row.id===document.getElementById('debtEmiHistoryModal').dataset.loanId),popup=window.open('','_blank');if(!popup){alert('Allow pop-ups to print the loan history.');return;}
      const title=`${debt?.type||'Loan'} Payment History`,columns=['Date','Entry','Amount / Debit','Interest','Principal / Credit','Balance','Notes / Description'],money=value=>value!==''&&value!==null&&value!==undefined?formatCurrency(value):'—';
      popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${analyticEscape(title)}</title><style>@page{size:A4 landscape;margin:10mm}body{font:10px Arial,sans-serif;color:#111}h1{font-size:18px;margin:0 0 4px}p{color:#555;margin:0 0 12px}table{width:100%;border-collapse:collapse}th,td{padding:5px;border:1px solid #bbb;text-align:left;vertical-align:top}th{background:#e8f2f1}td:nth-child(n+3):nth-child(-n+6){text-align:right;white-space:nowrap}tr{break-inside:avoid}</style></head><body><h1>${analyticEscape(title)}</h1><p>Oldest to newest · Generated ${analyticEscape(new Date().toLocaleDateString('en-IN'))}</p><table><thead><tr>${columns.map(col=>`<th>${analyticEscape(col)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr><td>${row.date?analyticEscape(calendarDate(row.date).toLocaleDateString('en-IN')):'—'}</td><td>${analyticEscape(row.entry)}</td><td>${money(row.amount)}</td><td>${money(row.interest)}</td><td>${money(row.principal)}</td><td>${row.balance!==''?money(row.balance):'—'}</td><td>${analyticEscape(row.notes||'—')}</td></tr>`).join('')}</tbody></table><script>window.onload=()=>window.print()<\/script></body></html>`);popup.document.close();
    }
    document.getElementById('debtEmiHistoryPdf').addEventListener('click',saveLoanHistoryPdf);
    document.getElementById('debtEmiHistoryCsv').addEventListener('click',saveLoanHistoryCsv);
    document.getElementById('debtEmiHistoryPrint').addEventListener('click',printLoanHistory);

    function renderDebtSummary() {
      const container=document.getElementById('debtSummaryTiles');
      const debts=profileRows(state.debts);
      const total=debts.reduce((sum,debt)=>sum+(Number(debt.remaining)||0),0);
      const totalEl=document.getElementById('debtSummaryTotal');
      if(totalEl) totalEl.textContent=formatCurrency(total);
      if(!container) return;
      if(!debts.length) { container.innerHTML='<p class="text-muted">No debts recorded</p>'; return; }
      const byType=new Map();
      debts.forEach(debt=>{
        const type=String(debt.type||'Other');
        if(!byType.has(type)) byType.set(type,[]);
        byType.get(type).push(debt);
      });
      const colors=['#4c83a1','#138b89','#8069aa','#c47b43','#5575b9','#a45f7d'];
      container.innerHTML=Array.from(byType.entries()).map(([type,accounts],index)=>{
        const amount=accounts.reduce((sum,debt)=>sum+(Number(debt.remaining)||0),0);
        const share=total>0?amount/total*100:0;
        const key=`debt-summary-${index}`;
        const details=accounts.map((debt,accountIndex)=>{
          const schedule=remainingEmiEstimate(debt);
          const label=debt.notes?analyticEscape(debt.notes):`${analyticEscape(type)} account ${accountIndex+1}`;
          return `<tr><td><strong>${label}</strong></td><td class="text-right">${formatCurrency(debt.remaining)}</td><td class="text-right">${formatCurrency(debt.emi)}</td><td class="text-right">${schedule.label}</td></tr>`;
        }).join('');
        return `<section class="debt-summary-card" style="--debt-color:${colors[index%colors.length]}">
          <button type="button" class="debt-summary-card-toggle" data-debt-summary-toggle aria-expanded="false" aria-controls="${key}">
            <span class="debt-summary-card-top"><span class="debt-summary-type"><i class="debt-summary-dot"></i>${analyticEscape(type)}</span><span class="debt-summary-share">${share.toFixed(1)}%</span></span>
            <span class="debt-summary-card-amount"><strong>${formatCurrency(amount)}</strong><span>remaining balance</span></span>
            <span class="debt-summary-track" aria-hidden="true"><i style="width:${Math.max(0,Math.min(100,share))}%"></i></span>
            <span class="debt-summary-card-hint"><span>${accounts.length} account${accounts.length===1?'':'s'} · View details</span><span class="debt-summary-chevron" aria-hidden="true">⌄</span></span>
          </button>
          <div id="${key}" class="debt-summary-details" hidden><div class="table-wrapper"><table><thead><tr><th>Account</th><th class="text-right">Remaining</th><th class="text-right">EMI</th><th class="text-right">EMIs left</th></tr></thead><tbody>${details}</tbody></table></div></div>
        </section>`;
      }).join('');
    }

    async function editDebt(id) {
      const debt = state.debts.find(d => d.id === id);
      if (!debt) return;
      const originalRecord=JSON.stringify(debt);
      const members=['',...profileMemberNames()];
      const values=await openRecordEditor('Edit debt',[{key:'member',label:'Family member (optional)',value:debt.member&&debt.member!=='Family'?debt.member:'',options:members,optional:true,placeholder:'-- Optional --'},{key:'principal',label:'Original principal ₹',type:'number',min:0.01,value:debt.principal},{key:'rate',label:'Annual interest rate %',type:'number',value:debt.rate},{key:'emi',label:'Monthly EMI ₹',type:'number',value:debt.emi||0},{key:'emiDueDay',label:'Monthly EMI Due Date (optional)',type:'number',min:1,max:31,required:false,value:debt.emiDueDay??''},{key:'dailyInterestBasis',label:'Daily interest basis (SBI style)',value:debt.dailyInterestBasis?'yes':'no',options:['no','yes'],optionLabels:{no:'No · current method',yes:'Yes · daily balance, month-end capitalization'}},{key:'firstEmiDate',label:'Bank-confirmed first EMI date (optional)',type:'date',required:false,value:debt.firstEmiDate||''},{key:'firstEmiExtraInterest',label:'Extra days’ interest with first EMI ₹ (automatic · editable)',type:'number',min:0,required:false,value:debt.firstEmiExtraInterest??'',hideWhen:{key:'dailyInterestBasis',value:'yes'},autoCalc:'first-emi-extra'},{key:'date',label:'Start date',type:'date',value:debt.date},{key:'notes',label:'Notes',type:'textarea',value:debt.notes||''}],v=>Number(v.rate)!==debt.rate||Math.round(Number(v.emi))!==Math.round(debt.emi)?'Use Revise EMI or Update interest rate in loan details to change terms from a selected date.':Number(v.principal)+(loanTotalPrincipal(debt)-debt.principal)<loanTotalPrincipal(debt)-debt.remaining?'Principal cannot be less than the amount already repaid.':null);
      if(!values)return;
      if(!state.debts.includes(debt)||JSON.stringify(debt)!==originalRecord){alert('This record changed while editing. Reopen it and try again.');return;}


      const newAmt = values.principal;
      if (newAmt === null) return;

      const amt = Number(newAmt);
      if (!Number.isFinite(amt) || amt <= 0) {
        alert('Enter a valid amount');
        return;
      }

      const newRate = values.rate;
      if (newRate === null) return;
      
      const rate = Number(newRate);
      if (!Number.isFinite(rate) || rate < 0) {
        alert('Enter a valid rate');
        return;
      }

      const newEmi = values.emi;
      if (newEmi === null) return;
      const emi = Number(newEmi);
      if (!Number.isFinite(emi) || emi < 0) { alert('Enter a valid EMI amount'); return; }
      const emiDueDayText=values.emiDueDay??'',emiDueDay=emiDueDayText.trim()===''?null:Number(emiDueDayText);
      if(emiDueDay!==null&&(!Number.isInteger(emiDueDay)||emiDueDay<1||emiDueDay>31)){alert('Monthly EMI due day must be a whole day from 1 to 31.');return;}

      const newDate = values.date;
      if (newDate === null) return;

      if (!validCalendarDate(newDate)) {
        alert('Enter valid date in YYYY-MM-DD format');
        return;
      }

      const newNotes = values.notes;
      if (newNotes === null) return;
      const firstEmiDate=values.firstEmiDate||'',firstEmiExtraText=(values.firstEmiExtraInterest||'').trim(),firstEmiExtraInterest=firstEmiExtraText===''?0:Number(firstEmiExtraText);
      const firstEmiFields={...(values.dailyInterestBasis==='yes'?{}:{firstEmiInterestMethod:debt.firstEmiInterestMethod||'short-actual365'}),...(firstEmiDate?{firstEmiDate}:{}),...(values.dailyInterestBasis!=='yes'&&firstEmiExtraText!==''?{firstEmiExtraInterest}:{})};
      if(state.expenses.some(row=>row.loanId===id&&row.category==='EMI Payment'&&row.repaymentType!=='part-payment')&&firstEmiExtraInterest!==(debt.firstEmiExtraInterest||0)){alert('Extra first-EMI interest cannot be changed after monthly payments are recorded. Use the statement correction for the recorded interest split.');return;}
      try{PFT_LOAN_LEDGER.validate({date:newDate,...(emiDueDay===null?{}:{emiDueDay}),...firstEmiFields});}catch(error){alert(error.message);return;}

      if(values.dailyInterestBasis!=='yes'&&firstEmiFields.firstEmiInterestMethod!==(debt.firstEmiInterestMethod||'monthly')){
        const candidate={...debt,...firstEmiFields,principal:amt,date:newDate,emi:Math.round(emi),rate};
        if(!firstEmiDate)delete candidate.firstEmiDate;
        if(emiDueDay===null)delete candidate.emiDueDay;else candidate.emiDueDay=emiDueDay;
        const replay=PFT_LOAN_LEDGER.rebuild(candidate,loanPayments(id),undefined,localDateKey());if(replay.error){alert(replay.error);return;}
        const first=loanPayments(id).filter(row=>row.repaymentType!=='part-payment').sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id))[0],split=first&&replay.payments.find(row=>row.id===first.id);
        const explanation=split?'First EMI interest: '+formatCurrency(first.interestPaid||0)+' → '+formatCurrency(split.interestPaid)+'\nFirst EMI principal: '+formatCurrency(first.principalPaid||0)+' → '+formatCurrency(split.principalPaid)+'\n':'';
        if(!confirm(explanation+'Outstanding principal: '+formatCurrency(debt.remaining)+' → '+formatCurrency(replay.remaining)+'\nTotal recorded interest: '+formatCurrency(debt.interestPaid||0)+' → '+formatCurrency(replay.interestPaid)+'\n\nPayment amounts and bank statement overrides stay unchanged. Later splits are recalculated. Actual-days estimate uses 365 days per year. Apply this calculation?'))return;
        if(!state.debts.includes(debt)||JSON.stringify(debt)!==originalRecord){alert('This loan changed while editing. Reopen it.');return;}
      }
      const topups=loanTotalPrincipal(debt)-debt.principal, repaid = loanTotalPrincipal(debt) - debt.remaining;
      if (amt+topups < repaid) { alert('Original principal cannot be less than the amount already repaid. No changes saved.'); return; }
      const debtSnapshot=JSON.stringify(debt),repaymentSnapshots=state.expenses.filter(row=>row.category==='EMI Payment'&&row.loanId===debt.id).map(row=>[row,JSON.stringify(row)]);
      debt.remaining = amt+topups - repaid;
      debt.principal = amt;
      debt.member = values.member||'Family';
      debt.rate = rate;
      debt.emi = Math.round(emi);
      if(debt.repaymentBaseEmi!==undefined)debt.repaymentBaseEmi=Math.round(emi);
      if(emiDueDay===null)delete debt.emiDueDay;else debt.emiDueDay=emiDueDay;
      delete debt.firstEmiDate;delete debt.firstEmiExtraInterest;delete debt.firstEmiInterestMethod;debt.dailyInterestBasis=values.dailyInterestBasis==='yes';Object.assign(debt,firstEmiFields);
      debt.date = newDate;
      debt.notes = newNotes;
      const scheduleError=rebuildDebtRepaymentHistory(debt.id);
      if(scheduleError){restoreLoanRecord(debt,JSON.parse(debtSnapshot));for(const [row,snapshot] of repaymentSnapshots)restoreLoanRecord(row,JSON.parse(snapshot));alert(scheduleError);return;}
      await saveData('Edited debt');
      renderDebts();
      populateLoanDropdown();
      updateDashboard();
    }

    function deleteDebt(id) {
      if (confirm('Delete this debt and all associated EMI payments? Its recurring EMI schedule will also stop.')) {
        PFT_RECURRING.stopLoanSchedules(state,id,currentMonthKey());
        // Remove all EMI expenses for this debt
        state.expenses = state.expenses.filter(e => e.loanId !== id);
        // Remove the debt
        state.debts = state.debts.filter(d => d.id !== id);
        saveData();
        renderDebts();
        renderExpenses();
      populateLoanDropdown();
        updateDashboard();
      }
    }

