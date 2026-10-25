    // PPF Management
    document.getElementById('addPpfBtn').addEventListener('click', () => {
      const member = document.getElementById('ppfMember').value;
      const account = document.getElementById('ppfAccount').value;
      let invested = Number(document.getElementById('ppfInvested').value);
      let current = Number(document.getElementById('ppfCurrent').value);
      const date = document.getElementById('ppfDate').value || localDateKey();
      const rate = document.getElementById('ppfRate').value === '' ? 7.1 : Number(document.getElementById('ppfRate').value);
      const monthly = Number(document.getElementById('ppfMonthly').value);
      const autoMonthlyContribution=document.getElementById('ppfAutomaticMonthly').checked;

      if (!member || !account || !Number.isFinite(invested) || invested <= 0 || !Number.isFinite(current) || current < 0 || !Number.isFinite(monthly) || monthly < 0 || !Number.isFinite(rate) || rate < 0 || (autoMonthlyContribution&&monthly<=0)) {
        alert('Fill all required fields with valid amounts');
        return;
      }

      // Entered invested/current balances are authoritative; monthly amount is a separate schedule.

      state.ppf.push({
        id: generateId(),
        member: member,
        account: account,
        invested: invested,
        current: current,
        date: date,
        rate: rate,
        monthly: monthly,
        autoMonthlyContribution,
        contributionsThrough: currentMonthKey()
      });

      document.getElementById('ppfAccount').value = '';
      document.getElementById('ppfInvested').value = '';
      document.getElementById('ppfCurrent').value = '';
      document.getElementById('ppfDate').value = '';
      document.getElementById('ppfRate').value = '';
      document.getElementById('ppfMonthly').value = '';
      document.getElementById('ppfAutomaticMonthly').checked=false;syncRetirementMonthlyForm('ppf');

      saveData();
      renderInvestments();
      renderPpf();
      closeInvestmentEntry('ppfAddPanel');
      updateDashboard();
    });

    function renderPpf() {
      const viewAccounts=profileRows(state.ppf||[]);
      updateRetirementTilesVisibility();
      const tbody = document.getElementById('ppfBody');
      if (!tbody) return;
      updateAnnualInterestColumn('ppf');
      updateRetirementAccountSummary('ppf');
      renderInvestmentOverview();
      const tileCurrent = document.getElementById('ppfTileCurrent');
      if (tileCurrent) tileCurrent.textContent = formatCurrency(viewAccounts.reduce((sum,ppf)=>sum+(Number(ppf.current)||0),0));
      renderAccountPager('ppf','ppfBody',renderPpf);
      if (viewAccounts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-muted">No PPF added yet.</td></tr>';
        refreshRetirementCategoryDialog();return;
      }

      const showMonthly=viewAccounts.some(row=>retirementMonthlyAmount(row,'ppf')>0);
      tbody.innerHTML = pageAccountRows('ppf',viewAccounts).map(ppf => {
        const gain = ppf.current - ppf.invested;
        return `
          <tr>
            <td><strong>${analyticEscape(ppf.member)}</strong></td>
            <td>${analyticEscape(ppf.account)}</td>
            ${showMonthly?`<td class="text-right monthly-contribution-column">${formatCurrency(retirementMonthlyAmount(ppf,'ppf'))}</td>`:''}
            <td class="text-right">${formatCurrency(ppf.invested)}</td>
            <td class="text-right">${formatCurrency(ppf.current)}</td>
            <td class="text-right ${gain >= 0 ? 'positive' : 'negative'}">${gain >= 0 ? '+' : ''}${formatCurrency(gain)}</td>
            <td class="text-right">${ppf.rate}%</td>
            <td class="annual-interest-column">${annualInterestControl('ppf',ppf)}</td>
            <td class="account-action-buttons">
              <button class="btn-small" onclick="editPpf('${ppf.id}')">Edit</button>
              <button class="btn-small btn-danger" onclick="deletePpf('${ppf.id}')">Delete</button>
              <button class="btn-small" onclick="openManualPpfContribution('${ppf.id}')">Add Contribution</button>
              <button class="btn-small" onclick="viewRetirementContributionHistory('ppf','${ppf.id}')">View History</button>
            </td>
          </tr>
        `;
      }).join('');
      updateAnnualInterestColumn('ppf');
      refreshRetirementCategoryDialog();
    }

    function editPpf(id) { openInvestmentEditModal('ppf',id); }
    function deletePpf(id) {
      if (confirm('Delete this PPF account and its recorded contribution history?')) {
        state.ppf = state.ppf.filter(p => p.id !== id);
        state.retirementContributions=state.retirementContributions.filter(row=>row.investmentType!=='ppf'||row.accountId!==id);
        saveData();
        renderInvestments();
        renderPpf();
        updateDashboard();
      }
    }

