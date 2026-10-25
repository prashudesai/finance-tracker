    // MONTHLY BALANCE TRACKING
    document.getElementById('toggleBalanceForm').addEventListener('click', () => {
      const form = document.getElementById('balanceEntryForm');
      const button = document.getElementById('toggleBalanceForm');
      const opening = form.hidden;
      form.hidden = !opening;
      button.textContent = opening ? 'Cancel' : '+ Add Monthly Surplus';
      button.setAttribute('aria-expanded', String(opening));
      if (opening) {
        if (!document.getElementById('balanceMonth').value) document.getElementById('balanceMonth').value = currentMonthKey();
        document.getElementById('balanceMonth').focus();
      }
    });
    document.getElementById('addBalanceBtn').addEventListener('click', () => {
      const month = document.getElementById('balanceMonth').value;
      const startBalance = Number(document.getElementById('balanceStartAmount').value);

      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || document.getElementById('balanceStartAmount').value.trim() === '' || !Number.isFinite(startBalance) || startBalance < 0) {
        alert('Please enter month and valid start balance');
        return;
      }

      // Check if record already exists for this month
      const existingIndex = state.monthlyBalances.findIndex(b => b.month === month);
      if (existingIndex !== -1) {
        if (confirm('Record already exists for this month. Replace it?')) {
          state.monthlyBalances[existingIndex].startBalance = startBalance;
        } else {
          return;
        }
      } else {
        state.monthlyBalances.push({
          id: generateId(),
          month: month,
          startBalance: startBalance
        });
      }

      // Sort by month descending (latest first)
      state.monthlyBalances.sort((a, b) => new Date(b.month + '-01') - new Date(a.month + '-01'));

      document.getElementById('balanceMonth').value = currentMonthKey();
      document.getElementById('balanceStartAmount').value = '';
      document.getElementById('balanceEntryForm').hidden = true;
      document.getElementById('toggleBalanceForm').textContent = '+ Add Monthly Surplus';
      document.getElementById('toggleBalanceForm').setAttribute('aria-expanded', 'false');

      saveData();
      renderBalanceHistory();
      updateDashboard();
    });

    function renderBalanceHistory() {
      recalculateHouseExpenses();
      const totalsIndex=buildMonthlyTotalsIndex();
      const selectedYear = populateHistoryFinancialYear('balanceHistoryFinancialYear', state.monthlyBalances.map(row => row.month));
      const startMonth = `${selectedYear}-04`, endMonth = `${selectedYear + 1}-03`;
      const rows = state.monthlyBalances.filter(b => b.month >= startMonth && b.month <= endMonth && b.month < currentMonthKey()).map(b => {
        const t = monthTotalsFromIndex(totalsIndex,b.month);
        const h = b.houseExpense;
        return `<tr><td>${b.month}</td><td>${formatCurrency(b.startBalance)}</td><td>${formatCurrency(t.income)}</td><td>${formatCurrency(t.expenses)}</td><td>${formatCurrency(t.stallion)}</td><td>${formatCurrency(t.retirement)}</td><td>${formatCurrency(b.startBalance + t.income - t.expenses - t.stallion)}</td><td>${h === null ? 'Pending next month balance' : formatCurrency(h)}</td><td><button class="btn-small" onclick="deleteBalance('${b.id}')">Delete</button></td></tr>`;
      }).join('');
      document.getElementById('balanceHistoryBody').innerHTML = rows || '<tr><td colspan="9" class="text-muted">No completed monthly surplus records for this financial year.</td></tr>';
      document.getElementById('houseExpenseBody').innerHTML = state.monthlyBalances.map(b => `<tr><td>${b.month}</td><td>${b.houseExpense === null ? 'Pending' : formatCurrency(b.houseExpense)}</td><td>${b.houseExpense === null ? 'Enter next calendar month opening balance' : b.houseExpense < 0 ? 'Negative difference: review balances / missing inflows' : 'Calculated and recorded'}</td></tr>`).join('') || '<tr><td colspan="3">Add monthly opening balances to calculate house expenses.</td></tr>';
    }

    function deleteBalance(id) {
      if (confirm('Delete this balance record?')) {
        state.monthlyBalances = state.monthlyBalances.filter(b => b.id !== id);
        saveData();
        renderBalanceHistory();
        updateDashboard();
      }
    }

    function renderTransactionOverview() {
      const month=currentMonthKey();
      const income=profileRows(state.income).filter(row=>inMonth(row.date,month)).reduce((sum,row)=>sum+(Number(row.amount)||0),0);
      const expenses=state.expenses.filter(row=>inMonth(row.date,month)).reduce((sum,row)=>sum+(Number(row.amount)||0),0);
      const net=income-expenses;
      const period=document.getElementById('transactionOverviewMonth');
      const incomeTotal=document.getElementById('transactionIncomeTotal');
      const expenseTotal=document.getElementById('transactionExpenseTotal');
      const netTotal=document.getElementById('transactionNetTotal');
      const netCard=document.getElementById('transactionNetCard');
      if(period) period.textContent=new Date(`${month}-01T12:00:00`).toLocaleDateString('en-IN',{month:'long',year:'numeric'});
      if(incomeTotal) incomeTotal.textContent=formatCurrency(income);
      if(expenseTotal) expenseTotal.textContent=formatCurrency(expenses);
      if(netTotal) netTotal.textContent=`${net<0?'−':''}${formatCurrency(Math.abs(net))}`;
      if(netCard) netCard.classList.toggle('is-negative',net<0);
    }

