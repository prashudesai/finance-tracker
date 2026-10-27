    // STALLION PMS HANDLERS
    // Removed: Portfolio Setup form - Users can now add Stallion PMS from Investments tab

    function populateStallionDropdowns() {
      const portfolios=profileRows(state.investments.filter(row=>row.type==='Stallion PMS'));
      for(const id of ['stallionContribMember','stallionProfitMember']) {
        const select=document.getElementById(id),previous=select.value;
        select.replaceChildren();const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='-- Select Portfolio --';select.appendChild(placeholder);
        for(const portfolio of portfolios){const option=document.createElement('option');option.value=portfolio.id;option.textContent=`${portfolio.member} — ${portfolio.name}`;select.appendChild(option);}
        const single=portfolios.length===1;
        select.value=single?portfolios[0].id:portfolios.some(row=>row.id===previous)?previous:'';
        select.disabled=single;select.classList.toggle('pms-single-portfolio',single);select.setAttribute('aria-readonly',String(single));
      }
    }

    // renderStallion removed - Stallion PMS now added via regular Investments tab

    function renderStallionContributions() {
      const tbody = document.getElementById('stallionContribBody');
      const visibleIds=new Set(profileRows(state.investments.filter(row=>row.type==='Stallion PMS')).map(row=>row.id));
      const visibleRecords=state.stallionContributions.filter(c=>visibleIds.has(c.stallionId));
      const selectedYear = populateHistoryFinancialYear('stallionContributionFinancialYear', visibleRecords.map(row => row.date.slice(0,7)));
      const records = visibleRecords.filter(c=>monthKeyInFinancialYear(c.date.slice(0,7), selectedYear)).sort((a,b)=>b.date.localeCompare(a.date));
      if (records.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-muted">No Stallion PMS contributions recorded for ${financialYearLabel(selectedYear)}.</td></tr>`;
        return;
      }

      tbody.innerHTML = records.map(c => {
        const stallion = state.stallionPms.find(s => s.id === c.stallionId);
        return `
          <tr>
            <td><strong>${analyticEscape(stallion?.member || 'Unknown')}</strong></td>
            <td>${analyticEscape(stallion?.name || 'Unknown')}</td>
            <td class="text-right"><strong>${formatCurrency(c.amount)}</strong></td>
            <td>${calendarDate(c.date).toLocaleDateString('en-IN')}</td>
            <td>
              <button class="btn-small" onclick="editStallionContrib('${c.id}')">Edit</button>
              <button class="btn-small btn-danger" onclick="deleteStallionContrib('${c.id}')">Delete</button>
            </td>
          </tr>
        `;
      }).join('');
      if(!document.getElementById('stallionHistoryModal').hidden)renderStallionHistoryModal();
    }

    document.getElementById('addStallionContribBtn').addEventListener('click', () => {
      const stallionId = document.getElementById('stallionContribMember').value;
      const amount = Number(document.getElementById('stallionContribAmount').value);
      const date = document.getElementById('stallionContribDate').value || localDateKey();

      if (!stallionId || stallionId === '-- Select Member --' || !Number.isFinite(amount) || amount <= 0) {
        alert('Please select a portfolio and enter a valid amount');
        return;
      }

      const portfolio=state.investments.find(row=>row.id===stallionId&&row.type==='Stallion PMS');
      if(!validCalendarDate(date)||!portfolio||date<portfolio.date){alert('Choose a valid contribution date on or after the portfolio opening date.');return;}
      if (!validStallionContributionChange(stallionId, amount)) return;
      state.stallionContributions.push({
        id: generateId(),
        stallionId: stallionId,
        amount: amount,
        date: date
      });

      // Update Stallion PMS invested amount with contribution
      const stallion = state.stallionPms.find(s => s.id === stallionId);
      if (stallion) {
        stallion.invested += amount;
        
        // Also update the corresponding investment entry
        const investment = state.investments.find(i => i.id === stallionId && i.type === 'Stallion PMS');
        if (investment) {
          investment.invested += amount;
          // Recalculate current value: new invested amount + profit
          investment.current = investment.invested + (stallion.profit || 0);
        }
      }

      document.getElementById('stallionContribAmount').value = '';
      document.getElementById('stallionContribDate').value = '';
      document.getElementById('stallionContribMember').value = '-- Select Member --';
      document.getElementById('stallionContributionFinancialYear').dataset.preferredYear = String(financialYearStartYearForMonthKey(date.slice(0,7)));

      saveData();
      renderInvestments();
      renderStallionContributions();
      closeInvestmentEntry('stallionContributionAddPanel');
      updateDashboard();
    });

    document.getElementById('updateStallionProfitBtn').addEventListener('click', () => {
      const stallionId = document.getElementById('stallionProfitMember').value;
      const newProfit = Number(document.getElementById('stallionProfitAmount').value);
      const profitDate = document.getElementById('stallionProfitDate').value || localDateKey();

      if (!stallionId || stallionId === '-- Select Portfolio --') {
        alert('Please select a portfolio');
        return;
      }

      const target = state.stallionPms.find(s => s.id === stallionId);
      if (!validCalendarDate(profitDate) || !Number.isFinite(newProfit) || !target || target.invested + newProfit < 0) {
        alert('Enter a valid gain or loss; current value cannot be negative');
        return;
      }

      const stallion = state.stallionPms.find(s => s.id === stallionId);
      if (stallion) {

        const existingSnapshot = state.stallionProfitHistory.find(row => row.stallionId === stallionId && row.date === profitDate);
        if (existingSnapshot) existingSnapshot.profit = newProfit;
        else state.stallionProfitHistory.push({id:generateId(),stallionId,profit:newProfit,date:profitDate});
        const latest=state.stallionProfitHistory.filter(r=>r.stallionId===stallionId).sort((a,b)=>b.date.localeCompare(a.date))[0];
        stallion.profit=latest.profit;
        
        // Update corresponding investment entry
        const investment = state.investments.find(i => i.id === stallionId && i.type === 'Stallion PMS');
        if (investment) {
          // Current value = Total Invested (including contributions) + Profit
          // Invested amount in stallionPms already includes all contributions
          investment.current = stallion.invested + stallion.profit;
          investment.valuationDate=latest.date;
        }
        
        document.getElementById('stallionProfitAmount').value = '';
        document.getElementById('stallionProfitMember').value = '-- Select Portfolio --';
        document.getElementById('stallionProfitDate').value = localDateKey();
        
        saveData();
        renderInvestments();
        closeInvestmentEntry('stallionProfitAddPanel');
        updateDashboard();
        alert('Profit updated successfully!');
      }
    });

    function editStallion(id) { openInvestmentEditModal('investment',id); }

    function editStallionContrib(id) { openInvestmentEditModal('stallionContribution',id); }
    function deleteStallion(id) {
      if (confirm('Delete this Stallion PMS portfolio?\nThis will also delete all contributions for this portfolio.')) {
        state.investments = state.investments.filter(x=>x.id!==id);
        state.stallionPms = state.stallionPms.filter(s => s.id !== id);
        state.stallionContributions = state.stallionContributions.filter(c => c.stallionId !== id);
        state.stallionProfitHistory = state.stallionProfitHistory.filter(row => row.stallionId !== id);
        saveData();
        renderInvestments();
        renderStallionContributions();
        populateStallionDropdowns();
        updateDashboard();
      }
    }

    function validStallionContributionChange(id, difference) {
      const investment = state.investments.find(i => i.id === id && i.type === 'Stallion PMS');
      if (!investment || !Number.isFinite(investment.invested + difference) || !Number.isFinite(investment.current + difference) || investment.invested + difference < 0 || investment.current + difference < 0) {
        alert('This correction would make the portfolio invested or current value invalid. Correct the portfolio balances first, then retry. No records were changed.');
        return false;
      }
      return true;
    }

    function deleteStallionContrib(id) {
      if (confirm('Delete this contribution?')) {
        const contrib = state.stallionContributions.find(c => c.id === id);
        if (contrib) {
          if (!validStallionContributionChange(contrib.stallionId, -contrib.amount)) return;
          // Reduce the invested amount in stallionPms and investment entry
          const stallion = state.stallionPms.find(s => s.id === contrib.stallionId);
          if (stallion) {
            stallion.invested -= contrib.amount;
            
            const investment = state.investments.find(i => i.id === contrib.stallionId && i.type === 'Stallion PMS');
            if (investment) {
              investment.invested -= contrib.amount;
              // Recalculate current value
              investment.current = investment.invested + (stallion.profit || 0);
            }
          }
        }

        state.stallionContributions = state.stallionContributions.filter(c => c.id !== id);
        saveData();
        renderInvestments();
        renderStallionContributions();
        updateDashboard();
      }
    }


