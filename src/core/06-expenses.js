    // EXPENSES
    const EXPENSE_SUBCATEGORY_OPTIONS = {
      Insurance: ['Term insurance', 'Health insurance', 'Car insurance', 'Bike insurance', 'Any other'],
      Maintenance: ['Car', 'Bike', 'House', 'Any other']
    };
    const ANNUAL_EXPENSE_DEFAULT_CATEGORIES = new Set(['Insurance', 'Maintenance', 'Vacation']);
    function rebuildDebtRepaymentHistory(debtId) {
      const debt=state.debts.find(row=>row.id===debtId);
      if(!debt)return 'The linked debt could not be found.';
      if(Array.isArray(debt.loanChanges)||debt.firstEmiDate!==undefined||debt.firstEmiExtraInterest!==undefined||debt.firstEmiInterestMethod!==undefined||debt.dailyInterestBasis===true){const result=PFT_LOAN_LEDGER.rebuild(debt,loanPayments(debtId),undefined,localDateKey());if(result.error)return result.error;applyLoanLedger(debt,result);return null;}
      if(debt.repaymentBaseEmi!==undefined&&(!Number.isFinite(debt.repaymentBaseEmi)||debt.repaymentBaseEmi<0))return 'Invalid original EMI.';
      const rows=(state.expenses||[]).filter(row=>row.category==='EMI Payment'&&row.loanId===debtId)
        .sort((a,b)=>String(a.date).localeCompare(String(b.date))||((a.repaymentType==='part-payment'?0:1)-(b.repaymentType==='part-payment'?0:1))||String(a.id).localeCompare(String(b.id)));
      let balance=Number(debt.principal)-(Number(debt.principalPaidBeforeTracking)||0),interestTotal=Number(debt.interestPaidBeforeTracking)||0,lastEmiDate=debt.date,cycleOpeningBalance=balance;
      let currentEmi=Number(debt.repaymentBaseEmi??debt.emi)||0;
      let cycleParts=[];
      const updates=[];
      const dayNumber=date=>Date.parse(String(date)+'T00:00:00Z')/86400000;
      const monthlyRate=(Number(debt.rate)||0)/1200;
      for(const row of rows){
        const amount=Number(row.amount);
        if(!Number.isFinite(amount)||amount<=0)return 'Every linked EMI or part payment must have a positive amount.';
        if(row.date<debt.date)return 'A repayment date cannot be earlier than the loan start date.';
        if(row.repaymentType==='part-payment'){
          if(amount>balance+0.01)return `Part payment (${formatCurrency(amount)}) exceeds the remaining principal (${formatCurrency(balance)}).`;
          const estimate=remainingEmiEstimate({remaining:balance,emi:currentEmi,rate:debt.rate});
          const term=estimate.count>1&&estimate.finalPayment<currentEmi*0.01?estimate.count-1:estimate.count;
          if(row.partPaymentAction==='reduce'&&(!term||!Number.isFinite(term)))return 'Enter an EMI that covers interest before reducing the EMI.';
          const applied=Math.min(amount,balance);
          if(row.partPaymentAction==='reduce')currentEmi=balance<=applied?0:roundedLoanEmi(balance-applied,Number(debt.rate),term);
          cycleParts.push({date:row.date,amount:applied});
          balance=Math.max(0,balance-applied);
          updates.push({row,principalPaid:applied,interestPaid:0});
          continue;
        }
        const intervalDays=Math.max(0,dayNumber(row.date)-dayNumber(lastEmiDate));
        let interest;
        if(row.interestOverride===true){
          interest=Number(row.interestPaid)||0;
        }else if(cycleParts.length&&intervalDays>0){
          let weightedBalanceDays=cycleOpeningBalance*intervalDays;
          for(const part of cycleParts){
            const daysAfterPayment=Math.max(0,dayNumber(row.date)-dayNumber(part.date));
            weightedBalanceDays-=part.amount*daysAfterPayment;
          }
          interest=Math.round(Math.max(0,weightedBalanceDays/intervalDays)*monthlyRate);
        }else{
          interest=Math.round(balance*monthlyRate);
        }
        const principal=amount-interest;
        if(principal<=0)return `Monthly EMI (${formatCurrency(amount)}) does not cover interest of ${formatCurrency(interest)}.`;
        if(principal>balance+0.01)return `Monthly EMI principal (${formatCurrency(principal)}) exceeds the remaining principal (${formatCurrency(balance)}).`;
        const applied=Math.min(principal,balance);
        updates.push({row,principalPaid:applied,interestPaid:interest});
        balance=Math.max(0,balance-applied);
        interestTotal+=interest;
        lastEmiDate=row.date;
        cycleOpeningBalance=balance;
        cycleParts=[];
      }
      for(const update of updates){update.row.principalPaid=Math.round(update.principalPaid*100)/100;update.row.interestPaid=Math.round(update.interestPaid*100)/100;}
      if(debt.repaymentBaseEmi!==undefined||rows.some(row=>row.partPaymentAction)){
        if(debt.repaymentBaseEmi===undefined)debt.repaymentBaseEmi=Number(debt.emi)||0;
        debt.emi=currentEmi;
      }
      debt.remaining=Math.round(balance*100)/100;
      debt.interestPaid=Math.round(interestTotal*100)/100;
      return null;
    }
    function restoreLoanRecord(target,snapshot){for(const key of Object.keys(target))delete target[key];Object.assign(target,snapshot);}
    function roundedLoanEmi(balance,annualRate,months){
      const r=annualRate/1200;
      return Math.round(r===0?balance/months:balance*r/(-Math.expm1(-months*Math.log1p(r))));
    }
    async function chooseEmiPaymentDate(debt,date){
      const firstDue=firstLoanEmiDueDate(debt);
      if(firstDue&&date<firstDue){alert('The first Monthly EMI is due on '+firstDue+'. Record an earlier principal reduction as a Part Payment.');return null;}
      const due=scheduledEmiDueDate(date,debt.emiDueDay??Number(debt.firstEmiDate?.slice(-2)));
      if(!due||date<=due)return date;
      const answer=await openRecordEditor('EMI payment date',[{key:'dateChoice',label:'Payment is after the due date. Choose the calculation date.',value:'entered',options:['entered','due'],optionLabels:{entered:'Keep entered date: '+date,due:'Use due date: '+due}}]);
      return answer?(answer.dateChoice==='due'?due:date):null;
    }
    function partPaymentPreview(debt,amount,date,action,editingId){
      const original=state;
      try{
        state=JSON.parse(JSON.stringify(original));
        if(editingId)state.expenses=state.expenses.filter(row=>row.id!==editingId);
        state.expenses.push({id:editingId||'preview-payment',category:'EMI Payment',loanId:debt.id,amount,date,repaymentType:'part-payment',partPaymentAction:action});
        const error=rebuildDebtRepaymentHistory(debt.id);
        if(error)return {error};
        const result=state.debts.find(row=>row.id===debt.id),schedule=remainingEmiEstimate(result);
        return {remaining:result.remaining,emi:result.emi,payments:schedule.label};
      }finally{state=original;}
    }
    async function choosePartPaymentAction(debt,amount,date,editingId){
      if(document.getElementById('recordEditorDialog').open)return null;
      const original=state,originalJSON=JSON.stringify(state);
      const initial=editingId?state.expenses.find(row=>row.id===editingId)?.partPaymentAction:'keep';
      const pending=openRecordEditor('Part payment', [{key:'action',label:'After reducing principal',value:initial||'keep',options:['keep','reduce'],optionLabels:{keep:'Keep EMI same · reduce tenure',reduce:'Reduce EMI · keep remaining tenure'}}],values=>partPaymentPreview(debt,amount,date,values.action,editingId).error||null);
      const select=document.getElementById('recordEdit_action'),note=document.createElement('div');
      note.setAttribute('role','status');note.setAttribute('aria-live','polite');
      note.style.cssText='margin-top:12px;padding:12px;border:1px solid var(--border);border-radius:10px;font-size:13px;line-height:1.6;background:var(--bg);';
      select.parentElement.appendChild(note);
      const refresh=()=>{
        const result=partPaymentPreview(debt,amount,date,select.value,editingId);
        note.replaceChildren();
        const lines=result.error?[result.error]:[
          select.value==='reduce'?'Reduce EMI: the remaining tenure is used to calculate a lower EMI.':'Keep EMI same: the principal reduction shortens the remaining tenure.',
          'Part payment: '+formatCurrency(amount)+' · Principal only',
          'Outstanding balance: '+formatCurrency(result.remaining),
          'Monthly EMI: '+formatCurrency(result.emi)+' · Estimated payments: '+result.payments,
          'The next EMI interest includes prorating for the part-payment date. Whole-rupee rounding can adjust the final payment.'
        ];
        for(const text of lines){const line=document.createElement('div');line.textContent=text;note.appendChild(line);}
        note.style.color=result.error?'var(--danger)':'var(--text)';
      };
      select.addEventListener('change',refresh);refresh();
      try{
        const choice=await pending;
        if(!choice)return null;
        if(state!==original||JSON.stringify(original)!==originalJSON){alert('Data changed during preview. Please try again.');return null;}
        return choice.action;
      }finally{select.removeEventListener('change',refresh);}
    }
    function autofillExpenseEmi(){
      if(document.getElementById('expenseCategory').value!=='EMI Payment')return;
      const debt=state.debts.find(row=>row.id===document.getElementById('expenseLoan').value);
      let amount=debt?.emi;
      if(debt&&(debt.firstEmiDate!==undefined||debt.firstEmiExtraInterest!==undefined||debt.firstEmiInterestMethod!==undefined)){const date=document.getElementById('expenseDate').value||localDateKey(),quote=PFT_LOAN_LEDGER.quotePayment(debt,loanPayments(debt.id),date<debt.firstEmiDate?debt.firstEmiDate:date);if(!quote.error&&!quote.paidOff)amount=quote.amount;}
      document.getElementById('expenseAmount').value=document.getElementById('expenseRepaymentType').value==='emi'&&debt?String(amount):'';
    }
    function updateExpenseCategoryFields() {
      const category = document.getElementById('expenseCategory').value;
      const loanSelectGroup = document.getElementById('loanSelectGroup');
      const repaymentTypeGroup = document.getElementById('repaymentTypeGroup');
      const subcategoryGroup = document.getElementById('expenseSubcategoryGroup');
      const subcategorySelect = document.getElementById('expenseSubcategory');
      const subcategories = EXPENSE_SUBCATEGORY_OPTIONS[category] || [];
      subcategoryGroup.hidden = subcategories.length === 0;
      subcategorySelect.innerHTML = subcategories.length
        ? '<option value="">-- Select type --</option>' + subcategories.map(value => `<option value="${analyticEscape(value)}">${analyticEscape(value)}</option>`).join('')
        : '';
      document.getElementById('isAnnual').value = ANNUAL_EXPENSE_DEFAULT_CATEGORIES.has(category) ? 'yes' : 'no';
      if (category === 'EMI Payment') {
        loanSelectGroup.style.display = 'block';
        repaymentTypeGroup.style.display = 'block';
        populateLoanDropdown();
        updateRepaymentTypeNote();
      } else {
        loanSelectGroup.style.display = 'none';
        repaymentTypeGroup.style.display = 'none';
        document.getElementById('expenseLoan').value = '';
      }
    }
    function updateRepaymentTypeNote(){
      const part=document.getElementById('expenseRepaymentType')?.value==='part-payment';
      const note=document.getElementById('repaymentTypeNote');
      if(note)note.textContent=part?'The full amount reduces loan principal. No interest is included.':'Monthly EMI includes interest and principal.';
    }
    document.getElementById('expenseRepaymentType').addEventListener('change',()=>{updateRepaymentTypeNote();autofillExpenseEmi();});
    document.getElementById('expenseLoan').addEventListener('change',autofillExpenseEmi);
    document.getElementById('expenseDate').addEventListener('change',()=>{const debt=state.debts.find(d=>d.id===document.getElementById('expenseLoan').value);if(debt?.firstEmiDate)autofillExpenseEmi();});
    document.getElementById('expenseCategory').addEventListener('change', function() {
      updateExpenseCategoryFields();
    });
    updateExpenseCategoryFields();

    document.getElementById('addExpenseBtn').addEventListener('click', async () => {
      const submit=document.getElementById('addExpenseBtn');if(submit.disabled)return;submit.disabled=true;
      try {
      const cat = document.getElementById('expenseCategory').value;
      const amt = Number(document.getElementById('expenseAmount').value);
      const annual = document.getElementById('isAnnual').value === 'yes';
      const subcategory = document.getElementById('expenseSubcategory').value;
      let date = document.getElementById('expenseDate').value || localDateKey();
      const notes = document.getElementById('expenseNotes').value;
      const loanId = cat === 'EMI Payment' ? document.getElementById('expenseLoan').value : null;
      const repaymentType = cat === 'EMI Payment' ? document.getElementById('expenseRepaymentType').value : null;

      if (!Number.isFinite(amt) || amt <= 0) {
        alert('Enter a valid amount');
        return;
      }
      if(cat!=='EMI Payment'&&state.expenses.some(row=>row.recurringRuleId&&row.category===cat&&(row.subcategory||'')===(subcategory||'')&&row.date.slice(0,7)===date.slice(0,7)&&Math.abs(row.amount-amt)<.011)&&!confirm('An automatic expense with this category and amount already exists this month. Edit it to adjust the month. Add another separate expense anyway?'))return;
      if ((EXPENSE_SUBCATEGORY_OPTIONS[cat] || []).length && !subcategory) {
        alert('Select an expense type');
        return;
      }

      let principalPaid = 0, interestPaid = 0, partPaymentAction=null;
      if (cat === 'EMI Payment') {
        if (!loanId) {
          alert('Please select a loan for this EMI payment');
          return;
        }

        if(repaymentType!=='part-payment'&&state.expenses.some(row=>row.recurringRuleId&&row.loanId===loanId&&row.repaymentType!=='part-payment'&&row.date.slice(0,7)===date.slice(0,7))){alert('An automatic EMI already exists for this loan this month. Edit that payment instead.');return;}
        const debt = state.debts.find(d => d.id === loanId);
        if(!debt){alert('Please select an active loan for this payment.');return;}
        if(!validCalendarDate(date)){alert('Enter a valid payment date.');return;}
        if(repaymentType!=='part-payment'){date=await chooseEmiPaymentDate(debt,date);if(!date)return;}
        else{partPaymentAction=await choosePartPaymentAction(debt,amt,date);if(!partPaymentAction)return;}
        if(!state.debts.includes(debt)){alert('The loan changed. Please try again.');return;}
        if(repaymentType==='part-payment'){principalPaid=amt;interestPaid=0;}
        else{const monthlyRate=debt.rate/100/12;interestPaid=Math.round(debt.remaining*monthlyRate);principalPaid=amt-interestPaid;}
      }

      const newExpense={
        id: generateId(),
        category: cat,
        ...(document.getElementById('expenseMember').value?{member:document.getElementById('expenseMember').value}:{}),
        subcategory: subcategory || '',
        amount: amt,
        isAnnual: annual,
        date: date,
        notes: notes,
        loanId: loanId || null,
        principalPaid: principalPaid,
        interestPaid: interestPaid,
        ...(cat==='EMI Payment'?{repaymentType,...(partPaymentAction?{partPaymentAction}:{})}: {})
      };
      state.expenses.push(newExpense);
      if(cat==='EMI Payment'){
        const scheduleError=rebuildDebtRepaymentHistory(loanId);
        if(scheduleError){state.expenses=state.expenses.filter(row=>row!==newExpense);alert(scheduleError);return;}
      }

      document.getElementById('expenseAmount').value = '';
      document.getElementById('expenseDate').value = localDateKey();
      document.getElementById('expenseNotes').value = '';
      document.getElementById('expenseLoan').value = '';
      document.getElementById('expenseRepaymentType').value = 'emi';
      updateRepaymentTypeNote();
      document.getElementById('expenseSubcategory').value = '';

      document.getElementById('expenseHistoryFinancialYear').dataset.preferredYear = String(financialYearStartYearForMonthKey(date.slice(0,7)));
      document.getElementById('expenseHistoryMonth').dataset.preferredMonth = date.slice(0, 7);
      transactionHistoryPages.expense=1;
      const operation=saveData();
      renderExpenses();
      renderDebts();
      updateDashboard();
      populateLoanDropdown();
      if(window.financeCashFlow)await window.financeCashFlow.trackSave('expense',newExpense.id,date,operation);
      }finally{submit.disabled=false;}
    });

    function renderExpenses() {
      const tbody = document.getElementById('expenseBody');
      const selectedYear = populateHistoryFinancialYear('expenseHistoryFinancialYear', state.expenses.map(row => row.date.slice(0,7)));
      const selectedMonth = populateHistoryMonth('expenseHistoryMonth', state.expenses, selectedYear);
      const monthRecords=state.expenses.filter(e=>e.date.slice(0,7)===selectedMonth);
      const records = sortTransactionHistoryRecords(filterTransactionHistory(monthRecords,'expense').sort((a,b)=>b.date.localeCompare(a.date)),'expense');
      renderTransactionHistorySummary('expense',monthRecords);
      const pageCount=Math.max(1,Math.ceil(records.length/TRANSACTION_HISTORY_PAGE_SIZE));
      transactionHistoryPages.expense=Math.min(Math.max(transactionHistoryPages.expense||1,1),pageCount);
      const pageStart=(transactionHistoryPages.expense-1)*TRANSACTION_HISTORY_PAGE_SIZE;
      const pageRecords=records.slice(pageStart,pageStart+TRANSACTION_HISTORY_PAGE_SIZE);
      if (records.length === 0) {
        const label = selectedMonth ? new Date(selectedMonth + '-01T12:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : financialYearLabel(selectedYear);
        tbody.innerHTML = `<tr><td colspan="6" class="text-muted">${document.getElementById('expenseHistorySearch').value.trim()?'No matching expense transactions.':`No expenses recorded for ${analyticEscape(label)}.`}</td></tr>`;
      } else {
      tbody.innerHTML = pageRecords.map(e => {
        let loanInfo = '';
        let breakdown = '';
        
        if (e.category === 'EMI Payment' && e.loanId) {
          const debt = allAccounts('debts').find(d => d.id === e.loanId);
          if (debt) {
            loanInfo = debt.type;
            const principalPortion = e.principalPaid || e.amount;
            const interestPortion = e.interestPaid || 0;
            breakdown = `<div class="emi-breakdown" style="font-size: 11px; color: var(--success); margin-top: 2px; line-height: 1.45;"><div>P: ${formatCurrency(principalPortion)}</div><div>I: ${formatCurrency(interestPortion)}</div></div>`;
          }
        } else {
          loanInfo = e.notes || '-';
        }

        const typeLabel=e.category==='EMI Payment'?(e.repaymentType==='part-payment'?'Part payment':'EMI'):e.isAnnual?'Annual':'Monthly';
        const typeClass=e.category==='EMI Payment'?'emi':e.isAnnual?'annual':'monthly';
        const badge=`<span class="transaction-type-badge transaction-type-${typeClass}"${e.category==='EMI Payment'?` title="Principal: ${analyticEscape(formatCurrency(e.principalPaid ?? e.amount))} · Interest: ${analyticEscape(formatCurrency(e.interestPaid ?? 0))}" tabindex="0"`:''}>${typeLabel}</span>`;
        return `
          <tr data-cash-record="${analyticEscape(e.id)}">
            <td data-label="Category"><strong>${analyticEscape(e.category)}</strong>${e.member?`<div class="text-muted transaction-expense-member">${analyticEscape(e.member)}</div>`:''}${e.category==='EMI Payment'&&e.loanId?`<div class="text-muted transaction-desktop-secondary" style="font-size:11px;margin-top:2px">${e.repaymentType==='part-payment'?'Part Payment':'Monthly EMI'}</div>`:''}${e.subcategory ? `<div class="text-muted transaction-desktop-secondary" style="font-size:11px;margin-top:2px">${analyticEscape(e.subcategory)}</div>` : ''}<div class="transaction-mobile-details">${badge}${e.category==='EMI Payment'&&e.loanId?`<span class="transaction-mobile-detail">${e.repaymentType==='part-payment'?'Part Payment':'Monthly EMI'}</span>`:''}${e.subcategory?`<span class="transaction-mobile-detail">${analyticEscape(e.subcategory)}</span>`:''}${loanInfo&&loanInfo!=='-'?`<span class="transaction-mobile-detail">${analyticEscape(loanInfo)}</span>`:''}</div></td>
            <td class="text-right" data-label="Amount">${formatCurrency(e.amount)}${breakdown}</td>
            <td data-label="Type">${badge}</td>
            <td class="text-muted" data-label="Loan / Notes">${analyticEscape(loanInfo)}</td>
            <td class="text-muted" data-label="Date"><span class="transaction-date-desktop">${calendarDate(e.date).toLocaleDateString('en-IN')}</span><span class="transaction-date-mobile">${calendarDate(e.date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</span></td>
            <td class="transaction-actions" data-label="Actions">
              <button class="btn-small" aria-label="Edit expense" onclick="editExpense('${e.id}')">Edit</button>
              <button class="btn-small btn-danger" aria-label="Delete expense" onclick="deleteExpense('${e.id}')">Delete</button>
            </td>
          </tr>
        `;
      }).join('');
      }
      renderTransactionPagination('expense',records.length);
      if(window.financeCashFlow)renderTransactionOverview();
    }

    async function editExpense(id) {
      if(archivedExpenseGuard(id))return;
      const expense = state.expenses.find(e => e.id === id);
      if (!expense) return;
      const originalRecord=JSON.stringify(expense);
      const fields=[{key:'member',label:'Family member (optional)',value:expense.member||'',options:Array.from(document.getElementById('expenseMember').options,o=>o.value).filter(Boolean),optional:true,placeholder:'Household / unspecified'},{key:'amount',label:'Amount ₹',type:'number',min:0.01,value:expense.amount},...(expense.category==='EMI Payment'&&expense.loanId?[{key:'repaymentType',label:'Payment type',value:expense.repaymentType||'emi',options:['emi','part-payment'],optionLabels:{emi:'Monthly EMI','part-payment':'Part Payment'}}]:[]),{key:'date',label:'Expense date',type:'date',value:expense.date},{key:'notes',label:'Notes',type:'textarea',value:expense.notes||''}];
      const values=await openRecordEditor('Edit expense',fields,v=>expense.recurringMonth&&v.date.slice(0,7)!==expense.recurringMonth?'Keep this recurring entry in its scheduled month. Adjust its amount or day within that month.':null);
      if(!values)return;
      if(!state.expenses.includes(expense)||JSON.stringify(expense)!==originalRecord){alert('This record changed while editing. Reopen it and try again.');return;}
      const newAmt = values.amount;
      if (newAmt === null) return;
      const amt = Number(newAmt);
      if (!Number.isFinite(amt) || amt <= 0) {
        alert('Enter a valid amount');
        return;
      }
      let newDate = values.date;
      if (newDate === null) return;
      if (!validCalendarDate(newDate)) {
        alert('Enter valid date in YYYY-MM-DD format');
        return;
      }
      const newNotes = values.notes;
      if (newNotes === null) return;
      const debt=expense.loanId?state.debts.find(row=>row.id===expense.loanId):null;
      const editedRepaymentType=values.repaymentType==='part-payment'?'part-payment':'emi';
      let partPaymentAction=null;
      if(expense.category==='EMI Payment'&&debt){
        if(editedRepaymentType==='part-payment'){partPaymentAction=await choosePartPaymentAction(debt,amt,newDate,id);if(!partPaymentAction)return;}
        else{newDate=await chooseEmiPaymentDate(debt,newDate);if(!newDate)return;}
        if(!state.expenses.includes(expense)||JSON.stringify(expense)!==originalRecord){alert('Record changed. Please reopen it.');return;}
      }
      const debtSnapshot=debt?JSON.stringify(debt):null;
      const rowSnapshots=debt?state.expenses.filter(row=>row.category==='EMI Payment'&&row.loanId===debt.id).map(row=>[row,JSON.stringify(row)]):[];
      if(values.member)expense.member=values.member;else delete expense.member;
      expense.amount = amt;
      expense.date = newDate;
      expense.notes = newNotes;
      if(expense.category==='EMI Payment'&&expense.loanId){
        expense.repaymentType=editedRepaymentType;
        if(partPaymentAction)expense.partPaymentAction=partPaymentAction;else delete expense.partPaymentAction;
        if(expense.repaymentType==='part-payment')expense.interestOverride=false;
        const error=rebuildDebtRepaymentHistory(expense.loanId);
        if(error){Object.assign(debt,JSON.parse(debtSnapshot));for(const [row,snapshot] of rowSnapshots)restoreLoanRecord(row,JSON.parse(snapshot));alert(error);return;}
      }
      document.getElementById('expenseHistoryFinancialYear').dataset.preferredYear = String(financialYearStartYearForMonthKey(newDate.slice(0,7)));
      document.getElementById('expenseHistoryMonth').dataset.preferredMonth = newDate.slice(0, 7);
      transactionHistoryPages.expense=1;
      await saveData('Edited expense');
      renderExpenses();
      renderDebts();
      updateDashboard();
    }

    function deleteExpense(id) {
      if(archivedExpenseGuard(id))return;
      if (confirm('Delete this expense?')) {
        const expense = state.expenses.find(e => e.id === id);
        state.expenses = state.expenses.filter(e => e.id !== id);
        if(expense?.category==='EMI Payment'&&expense.loanId){
          const error=rebuildDebtRepaymentHistory(expense.loanId);
          if(error){state.expenses.push(expense);alert(error);return;}
        }
        saveData();
        renderExpenses();
        renderDebts();
        updateDashboard();
      }
    }

