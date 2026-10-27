    // INCOME
    document.getElementById('addIncomeBtn').addEventListener('click', async () => {
      const member = document.getElementById('incomeMember').value;
      const src = document.getElementById('incomeSource').value;
      const amt = Number(document.getElementById('incomeAmount').value);
      const date = document.getElementById('incomeDate').value || localDateKey();
      const notes = document.getElementById('incomeNotes').value;

      if (!member) {
        alert('Add a family member in Settings before recording income.');
        return;
      }
      if (!Number.isFinite(amt) || amt <= 0) {
        alert('Enter a valid amount');
        return;
      }

      if(state.income.some(row=>row.recurringRuleId&&row.member===member&&row.source===incomeSourceForStorage(src,member)&&row.date.slice(0,7)===date.slice(0,7))){alert('An automatic entry for this member and source already exists this month. Edit that income entry to adjust its amount.');return;}
      const cashIncomeId=generateId();
      state.income.push({
        id: cashIncomeId,
        member: member,
        source: incomeSourceForStorage(src,member),
        amount: amt,
        date: date,
        notes: notes
      });

      document.getElementById('incomeAmount').value = '';
      document.getElementById('incomeDate').value = '';
      document.getElementById('incomeNotes').value = '';

      document.getElementById('incomeHistoryFinancialYear').dataset.preferredYear = String(financialYearStartYearForMonthKey(date.slice(0,7)));
      document.getElementById('incomeHistoryMonth').dataset.preferredMonth = date.slice(0, 7);
      transactionHistoryPages.income=1;
      const operation=saveData();
      renderIncome();
      updateDashboard();
      if(window.financeCashFlow)await window.financeCashFlow.trackSave('income',cashIncomeId,date,operation);
    });

    function currentFinancialYearStartYear(now = new Date()) {
      return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    }
    function financialYearStartYearForMonthKey(month) {
      const [year, monthNumber] = String(month).split('-').map(Number);
      return monthNumber >= 4 ? year : year - 1;
    }
    function financialYearLabel(startYear) {
      return `FY ${startYear}-${String(Number(startYear) + 1).slice(-2)}`;
    }
    function monthKeyInFinancialYear(month, startYear) {
      const start = `${startYear}-04`, end = `${Number(startYear) + 1}-03`;
      return month >= start && month <= end;
    }
    function populateHistoryFinancialYear(selectId, monthKeys, preferredStartYear) {
      const select = document.getElementById(selectId);
      const master=['incomeHistoryFinancialYear','expenseHistoryFinancialYear'].includes(selectId)?document.getElementById('income-expenses')?.dataset.cashMonth:null;
      if(master) preferredStartYear=financialYearStartYearForMonthKey(master);
      const currentYear = currentFinancialYearStartYear();
      const previous = Number(select.dataset.preferredYear || preferredStartYear || select.value || currentYear);
      const years = [...new Set([currentYear, ...monthKeys.map(financialYearStartYearForMonthKey).filter(year => year <= currentYear)])].sort((a,b)=>b-a);
      select.innerHTML = years.map(year => `<option value="${year}">${financialYearLabel(year)}</option>`).join('');
      select.value = years.includes(previous) ? String(previous) : String(currentYear);
      delete select.dataset.preferredYear;
      return Number(select.value);
    }
    function populateHistoryMonth(selectId, records, financialYearStart) {
      const select = document.getElementById(selectId);
      const currentYear = currentFinancialYearStartYear();
      const currentMonth = currentMonthKey();
      const master=['incomeHistoryMonth','expenseHistoryMonth'].includes(selectId)?document.getElementById('income-expenses')?.dataset.cashMonth:null;
      if(master){select.replaceChildren(new Option(new Date(master+'-01T12:00:00').toLocaleDateString('en-IN',{month:'long',year:'numeric'}),master));delete select.dataset.preferredMonth;return master;}

      const months = [...new Set(records.map(row => row.date.slice(0, 7)))].filter(month => monthKeyInFinancialYear(month, financialYearStart) && (financialYearStart !== currentYear || month <= currentMonth)).sort((a,b)=>b.localeCompare(a));
      if (financialYearStart === currentYear && !months.includes(currentMonth)) months.unshift(currentMonth);
      const previous = select.dataset.preferredMonth || select.value || currentMonth;
      select.innerHTML = months.map(month => {
        const label = new Date(month + '-01T12:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
        return `<option value="${month}">${label}</option>`;
      }).join('');
      const samePeriodLastYear = `${financialYearStart}-${String(Number(previous.split('-')[1]) || (new Date().getMonth()+1)).padStart(2,'0')}`;
      const selected = months.includes(previous) ? previous : months.includes(samePeriodLastYear) ? samePeriodLastYear : financialYearStart === currentYear ? currentMonth : months[0];
      select.value = selected || '';
      delete select.dataset.preferredMonth;
      return select.value;
    }
    const TRANSACTION_HISTORY_PAGE_SIZE=8;
    const transactionHistoryPages={income:1,expense:1};
    const transactionHistorySorts={income:null,expense:null};
    function sortTransactionHistoryRecords(rows,kind) {
      const choice=transactionHistorySorts[kind];
      if(!choice)return rows;
      const value=row=>{
        if(kind==='income') return [row.member||'',row.source,Number(row.amount)||0,row.date][choice.column];
        const loan=String(row.category)==='EMI Payment'&&row.loanId?state.debts.find(debt=>debt.id===row.loanId)?.type||'':row.notes||'';
        return [row.category,Number(row.amount)||0,row.isAnnual?'Annual':'Monthly',loan,row.date][choice.column];
      };
      return [...rows].map((row,index)=>({row,index,key:value(row)})).sort((a,b)=>{
        const cmp=typeof a.key==='number'&&typeof b.key==='number'?a.key-b.key:String(a.key??'').localeCompare(String(b.key??''),'en',{numeric:true,sensitivity:'base'});
        return (choice.direction==='desc'?-cmp:cmp)||a.index-b.index;
      }).map(item=>item.row);
    }
    function renderTransactionPagination(kind,total) {
      const pageCount=Math.max(1,Math.ceil(total/TRANSACTION_HISTORY_PAGE_SIZE));
      transactionHistoryPages[kind]=Math.min(Math.max(transactionHistoryPages[kind]||1,1),pageCount);
      const page=transactionHistoryPages[kind],start=total?(page-1)*TRANSACTION_HISTORY_PAGE_SIZE+1:0,end=Math.min(page*TRANSACTION_HISTORY_PAGE_SIZE,total);
      const title=kind==='income'?'Income':'Expense';
      document.getElementById(`${kind}HistoryPaginationSummary`).innerHTML=`<strong>Showing ${start}–${end} of ${total}</strong><span>8 entries per page · Page ${page} of ${pageCount}</span>`;
      const pages=pageCount<=5?Array.from({length:pageCount},(_,i)=>i+1):[...new Set([1,page-1,page,page+1,pageCount].filter(n=>n>=1&&n<=pageCount))].sort((a,b)=>a-b);
      let pageMarkup='',last=0;
      pages.forEach(n=>{if(n-last>1)pageMarkup+='<span class="transaction-pagination-ellipsis" aria-hidden="true">…</span>';pageMarkup+=`<button type="button" data-transaction-page="${n}"${n===page?' aria-current="page"':''} aria-label="${title} history page ${n}">${n}</button>`;last=n;});
      document.getElementById(`${kind}HistoryPaginationControls`).innerHTML=`<button type="button" data-transaction-page="prev" aria-label="Previous ${title.toLowerCase()} page"${page===1?' disabled':''}>‹</button>${pageMarkup}<button type="button" data-transaction-page="next" aria-label="Next ${title.toLowerCase()} page"${page===pageCount?' disabled':''}>›</button>`;
    }
    function renderTransactionHistorySummary(kind,records) {
      const total=(records||[]).reduce((sum,row)=>sum+(Number(row.amount)||0),0);
      const label=records.length===1?'1 entry in selected month':`${records.length} entries in selected month`;
      document.getElementById(`${kind}HistorySummary`).innerHTML=`<span>${label}</span><strong>${formatCurrency(total)}</strong>`;
    }
    function changeTransactionHistoryPage(kind,event) {
      const button=event.target.closest('[data-transaction-page]');
      if(!button||button.disabled)return;
      const total=kind==='income'?profileRows(state.income).filter(row=>row.date.slice(0,7)===document.getElementById('incomeHistoryMonth').value).length:state.expenses.filter(row=>row.date.slice(0,7)===document.getElementById('expenseHistoryMonth').value).length;
      const pages=Math.max(1,Math.ceil(total/TRANSACTION_HISTORY_PAGE_SIZE)),current=transactionHistoryPages[kind]||1;
      const requested=button.dataset.transactionPage==='prev'?current-1:button.dataset.transactionPage==='next'?current+1:Number(button.dataset.transactionPage);
      transactionHistoryPages[kind]=Math.min(Math.max(requested,1),pages);
      kind==='income'?renderIncome():renderExpenses();
    }

    function renderIncome() {
      const tbody = document.getElementById('incomeBody');
      const incomeRows=profileRows(state.income);
      const selectedYear = populateHistoryFinancialYear('incomeHistoryFinancialYear', incomeRows.map(row => row.date.slice(0,7)));
      const selectedMonth = populateHistoryMonth('incomeHistoryMonth', incomeRows, selectedYear);
      const records = sortTransactionHistoryRecords(incomeRows.filter(i => i.date.slice(0, 7) === selectedMonth).sort((a, b) => b.date.localeCompare(a.date)),'income');
      renderTransactionHistorySummary('income',records);
      const pageCount=Math.max(1,Math.ceil(records.length/TRANSACTION_HISTORY_PAGE_SIZE));
      transactionHistoryPages.income=Math.min(Math.max(transactionHistoryPages.income||1,1),pageCount);
      const pageStart=(transactionHistoryPages.income-1)*TRANSACTION_HISTORY_PAGE_SIZE;
      const pageRecords=records.slice(pageStart,pageStart+TRANSACTION_HISTORY_PAGE_SIZE);
      if (records.length === 0) {
        const label = selectedMonth ? new Date(selectedMonth + '-01T12:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : financialYearLabel(selectedYear);
        tbody.innerHTML = `<tr><td colspan="5" class="text-muted">No income recorded for ${analyticEscape(label)}.</td></tr>`;
      } else {
      tbody.innerHTML = pageRecords.map(i => `
        <tr data-cash-record="${analyticEscape(i.id)}">
          <td data-label="Member"><strong>${analyticEscape(i.member || '—')}</strong></td>
          <td data-label="Source">
            <strong>${analyticEscape(i.source)}</strong>
            ${i.notes ? `<div class="text-muted" style="font-size: 11px; margin-top: 2px;">${analyticEscape(i.notes)}</div>` : ''}
          </td>
          <td class="text-right" data-label="Amount">${formatCurrency(i.amount)}</td>
          <td class="text-muted" data-label="Date"><span class="transaction-date-desktop">${calendarDate(i.date).toLocaleDateString('en-IN')}</span><span class="transaction-date-mobile">${calendarDate(i.date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</span></td>
          <td class="transaction-actions" data-label="Actions">
            <button class="btn-small" aria-label="Edit income" onclick="editIncome('${i.id}')">Edit</button>
            <button class="btn-small btn-danger" aria-label="Delete income" onclick="deleteIncome('${i.id}')">Delete</button>
          </td>
        </tr>
      `).join('');
      }
      renderTransactionPagination('income',records.length);
      if(window.financeCashFlow)renderTransactionOverview();
    }

    async function editIncome(id) {
      const income = state.income.find(i => i.id === id);
      if (!income) return;
      const originalRecord=JSON.stringify(income);
      const values=await openRecordEditor('Edit income',[{key:'member',label:'Family member',value:income.member||'',options:Array.from(document.getElementById('incomeMember').options,o=>o.value)},{key:'amount',label:'Amount ₹',type:'number',min:0.01,value:income.amount},{key:'date',label:'Receipt date',type:'date',value:income.date},{key:'notes',label:'Notes',type:'textarea',value:income.notes||''}],v=>income.recurringMonth&&v.date.slice(0,7)!==income.recurringMonth?'Keep this recurring entry in its scheduled month. Adjust its amount or day within that month.':null);
      if(!values)return;
      if(!state.income.includes(income)||JSON.stringify(income)!==originalRecord){alert('This record changed while editing. Reopen it and try again.');return;}


      const newMember = values.member;
      if (newMember === null) return;

      const newAmt = values.amount;
      if (newAmt === null) return;

      const amt = Number(newAmt);
      if (!Number.isFinite(amt) || amt <= 0) {
        alert('Enter a valid amount');
        return;
      }

      const newDate = values.date;
      if (newDate === null) return;

      if (!validCalendarDate(newDate)) {
        alert('Enter valid date in YYYY-MM-DD format');
        return;
      }

      const newNotes = values.notes;
      if (newNotes === null) return;


      income.source = incomeSourceForStorage(income.source, income.member || '');
      income.member = newMember;
      income.amount = amt;
      income.date = newDate;
      income.notes = newNotes;
      document.getElementById('incomeHistoryFinancialYear').dataset.preferredYear = String(financialYearStartYearForMonthKey(newDate.slice(0,7)));
      document.getElementById('incomeHistoryMonth').dataset.preferredMonth = newDate.slice(0, 7);
      transactionHistoryPages.income=1;
      await saveData('Edited income');
      renderIncome();
      updateDashboard();
    }

    function deleteIncome(id) {
      if (confirm('Delete this income entry?')) {
        state.income = state.income.filter(i => i.id !== id);
        saveData();
        renderIncome();
        updateDashboard();
      }
    }

