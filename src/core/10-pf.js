    // PF Management
    document.getElementById('addPfBtn').addEventListener('click', () => {
      const member = document.getElementById('pfMember').value;
      const account = document.getElementById('pfAccount').value;
      const employee = Number(document.getElementById('pfEmployee').value);
      const employer = Number(document.getElementById('pfEmployer').value);
      const epsMonthly=Number(document.getElementById('pfEpsMonthly').value),epsCurrent=Number(document.getElementById('pfEpsCurrent').value);
      if(!Number.isFinite(epsMonthly)||epsMonthly<0||epsMonthly>employer||!Number.isFinite(epsCurrent)||epsCurrent<0){alert('Enter a valid EPS balance and an EPS monthly portion between 0 and the employer total.');return;}
      let current = Number(document.getElementById('pfCurrent').value);
      const date = document.getElementById('pfDate').value || localDateKey();
      const rate = Number(document.getElementById('pfRate').value) || 0;
      const autoMonthlyContribution=document.getElementById('pfAutomaticMonthly').checked;

      if (!member || !account || !Number.isFinite(employee) || employee < 0 || !Number.isFinite(employer) || employer < 0 || !Number.isFinite(current) || current < 0 || !Number.isFinite(rate) || rate < 0 || (autoMonthlyContribution&&employee+employer<=0)) {
        alert('Fill all required fields with valid amounts');
        return;
      }

      // Calculate total monthly contribution (employee + employer)
      const monthlyTotal = employee + employer;
      
      // Keep the current balance exactly as entered.

      state.pf.push({
        id: generateId(),
        member: member,
        account: account,
        employee: employee,
        employer: employer,
        epsMonthly,epsCurrent,epsBalanceUpdates:[],
        autoMonthlyContribution,
        rate: rate,
        invested: current,
        current: current,
        contributionsThrough: currentMonthKey(),
        date: date
      });

      document.getElementById('pfAccount').value = '';
      document.getElementById('pfEmployee').value = '';
      document.getElementById('pfEmployer').value = '';
      document.getElementById('pfEpsMonthly').value='0';document.getElementById('pfEpsCurrent').value='0';
      document.getElementById('pfCurrent').value = '';
      document.getElementById('pfRate').value = '';
      document.getElementById('pfDate').value = '';
      document.getElementById('pfAutomaticMonthly').checked=false;syncRetirementMonthlyForm('pf');

      saveData();
      renderPf();
      closeInvestmentEntry('pfAddPanel');
      updateDashboard();
    });

    function renderPf() {
      const viewAccounts=profileRows(state.pf||[]);
      updateRetirementTilesVisibility();
      const tbody = document.getElementById('pfBody');
      updateAnnualInterestColumn('pf');
      updateRetirementAccountSummary('pf');
      renderInvestmentOverview();
      renderAccountPager('pf','pfBody',renderPf);
      if (viewAccounts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" class="text-muted">No PF added yet.</td></tr>';
        refreshRetirementCategoryDialog();return;
      }

      const showMonthly=viewAccounts.some(row=>retirementMonthlyAmount(row,'pf')>0);
      tbody.innerHTML = pageAccountRows('pf',viewAccounts).map(pf => {
        const gain = pf.current - (pf.invested ?? pf.current);
        return `
          <tr>
            <td><strong>${analyticEscape(pf.member)}</strong></td>
            <td>${analyticEscape(pf.account)}</td>
            ${showMonthly?`<td class="text-right monthly-contribution-column">${formatCurrency(pf.employee)}</td><td class="text-right monthly-contribution-column">${formatCurrency(pf.employer)}<small style="display:block;color:var(--text-light)">EPS ${formatCurrency(pf.epsMonthly||0)}<br>PF ${formatCurrency(pf.employer-(pf.epsMonthly||0))}</small></td>`:''}

            <td class="text-right">${formatCurrency(pf.invested ?? pf.current)}</td>
            <td class="text-right" data-label="Current PF Balance">${formatCurrency(pf.current)}</td>
            <td class="text-right" data-label="EPS Balance">${formatCurrency(pf.epsCurrent||0)}</td>
            <td class="text-right ${gain >= 0 ? 'positive' : 'negative'}">${gain >= 0 ? '+' : ''}${formatCurrency(gain)}</td>
            <td class="text-right">${Number(pf.rate || 0)}%</td>
            <td class="annual-interest-column">${annualInterestControl('pf',pf)}</td>
            <td class="account-action-buttons"><div class="pf-actions-grid">
              <button class="btn-small" onclick="editPf('${pf.id}')">Edit</button>
              <button class="btn-small btn-danger" onclick="deletePf('${pf.id}')">Delete</button>
              <button class="btn-small" onclick="openManualPfContribution('${pf.id}')">Add Contribution</button>
              <button class="btn-small" onclick="viewRetirementContributionHistory('pf','${pf.id}')">View History</button>
            </div></td>
          </tr>
        `;
      }).join('');
      updateAnnualInterestColumn('pf');
      refreshRetirementCategoryDialog();
    }

    function editPf(id) { openInvestmentEditModal('pf',id); }
    function deletePf(id) {
      if (confirm('Delete this PF account and its recorded contribution history?')) {
        state.pf = state.pf.filter(p => p.id !== id);
        state.retirementContributions=state.retirementContributions.filter(row=>row.investmentType!=='pf'||row.accountId!==id);
        saveData();
        renderPf();
        updateDashboard();
      }
    }

    function viewRetirementContributionHistory(type,accountId) {
      if(!['nps','ppf','pf'].includes(type))return;
      const account=state[type].find(row=>row.id===accountId);
      if(!account)return;
      const typeLabel=type==='nps'?'NPS':type==='ppf'?'PPF':'PF';
      const accountLabel=account.account||account.scheme||typeLabel;
      const modal=document.getElementById('retirementContributionHistoryModal');
      modal.dataset.investmentType=type;modal.dataset.accountId=accountId;modal.dataset.historyMode='contributions';
      document.getElementById('retirementContributionHistoryTitle').textContent=`${typeLabel} History — ${accountLabel}`;
      const typeWrap=document.getElementById('retirementHistoryTypeWrap');typeWrap.hidden=type==='nps';
      document.getElementById('retirementHistoryType').querySelectorAll('[data-pf-only]').forEach(option=>{option.hidden=type!=='pf';option.disabled=type!=='pf';});
      document.getElementById('retirementHistoryType').value='contributions';
      const yearSelect=document.getElementById('retirementContributionHistoryFinancialYear');
      delete yearSelect.dataset.preferredYear;
      renderRetirementContributionHistory();
      modal.hidden=false;syncInvestmentOverlayBodyLock();
    }
    function renderRetirementContributionHistory() {
      const modal=document.getElementById('retirementContributionHistoryModal');
      const type=modal.dataset.investmentType,accountId=modal.dataset.accountId;
      if(!type||!accountId)return;
      const previousMode=modal.dataset.historyMode||'contributions';
      const historyMode=type==='nps'?'contributions':(document.getElementById('retirementHistoryType').value||'contributions');
      modal.dataset.historyMode=historyMode;
      const periodHeading=document.getElementById('retirementHistoryPeriodHeading'),amountHeading=document.getElementById('retirementContributionAmountHeading'),creditDateHeading=document.getElementById('retirementHistoryCreditDateHeading');
      const body=document.getElementById('retirementContributionHistoryBody');
      if(type==='pf'&&historyMode==='eps'){renderPfEpsHistory(accountId,historyMode,previousMode);return;}
      if(historyMode==='interest'&&['pf','ppf'].includes(type)) {
        const account=state[type].find(row=>row.id===accountId);if(!account)return;
        const credits=Array.isArray(account.interestCredits)?account.interestCredits:[];
        const latestYear=credits.length?Math.max(...credits.map(row=>Number(row.financialYearStartYear))):currentFinancialYearStartYear();
        const months=credits.map(row=>`${row.financialYearStartYear}-04`);
        const year=populateHistoryFinancialYear('retirementContributionHistoryFinancialYear',months,previousMode==='interest'?undefined:latestYear);
        const records=credits.filter(row=>Number(row.financialYearStartYear)===year).sort((a,b)=>String(b.creditedDate).localeCompare(String(a.creditedDate)));
        const total=records.reduce((sum,row)=>sum+Number(row.amount||0),0);
        periodHeading.textContent='Financial Year';amountHeading.textContent='Interest Credited';creditDateHeading.textContent='Credited Date';creditDateHeading.hidden=false;
        document.getElementById('retirementContributionHistorySummary').textContent=`${records.length} interest ${records.length===1?'credit':'credits'} in ${financialYearLabel(year)} · Total ${formatCurrency(total)}`;
        body.innerHTML=records.length?records.map(row=>`<tr><td data-label="Financial year">${financialYearLabel(row.financialYearStartYear)}</td><td class="text-right" data-label="Interest credited">${formatCurrency(row.amount)}</td><td data-label="Credited date">${analyticEscape(row.creditedDate)}</td><td data-label="Actions"><button type="button" class="btn-small" onclick="editAnnualInterestCredit('${type}','${accountId}',${row.financialYearStartYear})">Edit</button></td></tr>`).join(''):`<tr><td colspan="4" class="text-muted">No interest credits recorded for ${financialYearLabel(year)}.</td></tr>`;
        paginateHistoryTable('retirementContributionHistoryBody',true);return;
      }
      const visibleIds=new Set(profileRows(state[type]||[]).map(row=>row.id));
      const all=(state.retirementContributions||[]).filter(row=>row.investmentType===type&&visibleIds.has(row.accountId)&&row.accountId===accountId);
      const year=populateHistoryFinancialYear('retirementContributionHistoryFinancialYear',all.map(row=>row.date.slice(0,7)));
      const records=all.filter(row=>monthKeyInFinancialYear(row.date.slice(0,7),year)).sort((a,b)=>b.date.localeCompare(a.date));
      const total=records.reduce((sum,row)=>sum+Number(row.amount||0),0);
      periodHeading.textContent='Contribution Date';amountHeading.textContent=type==='pf'?'PF contribution (excluding EPS)':'Contribution';creditDateHeading.hidden=true;
      document.getElementById('retirementContributionHistorySummary').textContent=`${records.length} contribution ${records.length===1?'entry':'entries'} in ${financialYearLabel(year)} · Total ${formatCurrency(total)}`;
      body.innerHTML=records.length?records.map(row=>`<tr><td data-label="Contribution date">${calendarDate(row.date).toLocaleDateString('en-IN')}</td><td class="text-right" data-label="Amount">${formatCurrency(row.amount)}</td><td hidden></td><td data-label="Actions"><button type="button" class="btn-small" onclick="editRetirementContribution('${row.id}')">Edit</button></td></tr>`).join(''):`<tr><td colspan="4" class="text-muted">No contributions recorded for ${financialYearLabel(year)}.</td></tr>`;
      paginateHistoryTable('retirementContributionHistoryBody',true);
    }
    function recordPfEpsBalanceUpdate(account,next){
      const before=Number(account.epsCurrent)||0;if(next===before)return;
      (account.epsBalanceUpdates||=[]).push({id:generateId(),date:localDateKey(),before,after:next,amount:Math.round((next-before)*100)/100});
      account.epsCurrent=next;
    }
    function pfEpsLedger(account){
      const entries=(state.retirementContributions||[]).filter(row=>row.investmentType==='pf'&&row.accountId===account.id&&row.epsAmount!==undefined).map(row=>({id:row.id,date:row.date,amount:row.epsAmount,kind:'contribution'}));
      entries.push(...(account.epsBalanceUpdates||[]).map(row=>({...row,kind:'balance'})));
      entries.sort((a,b)=>a.date.localeCompare(b.date)||(Number(a.kind==='balance')-Number(b.kind==='balance')));
      let balance=(Number(account.epsCurrent)||0)-entries.reduce((sum,row)=>sum+row.amount,0);
      return entries.map(row=>{balance+=row.amount;return {...row,balance};});
    }
    function renderPfEpsHistory(accountId,mode,previousMode){
      const account=state.pf.find(row=>row.id===accountId);if(!account)return;
      const all=pfEpsLedger(account);
      const year=populateHistoryFinancialYear('retirementContributionHistoryFinancialYear',all.map(row=>row.date.slice(0,7)));
      const rows=all.filter(row=>monthKeyInFinancialYear(row.date.slice(0,7),year)).reverse();
      document.getElementById('retirementHistoryPeriodHeading').textContent='Date';
      document.getElementById('retirementContributionAmountHeading').textContent='EPS amount';
      const balanceHeading=document.getElementById('retirementHistoryCreditDateHeading');balanceHeading.hidden=false;balanceHeading.textContent='EPS balance';
      document.getElementById('retirementContributionHistorySummary').textContent=`${rows.length} entries in ${financialYearLabel(year)} · Current EPS ${formatCurrency(account.epsCurrent||0)} · No interest`;
      document.getElementById('retirementContributionHistoryBody').innerHTML=rows.length?rows.map(row=>`<tr><td data-label="Date">${analyticEscape(row.date)}<small style="display:block;color:var(--text-light)">${row.kind==='balance'?'Balance correction':'Monthly contribution'}</small></td><td data-label="EPS amount" class="text-right">${formatCurrency(row.amount)}</td><td data-label="EPS balance" class="text-right">${formatCurrency(row.balance)}</td><td data-label="Actions"><button class="btn-small" onclick="editPfEpsHistory('${accountId}','${row.id}','${row.kind}')">Edit</button></td></tr>`).join(''):'<tr><td colspan="4" class="text-muted">No EPS entries for this financial year.</td></tr>';
      paginateHistoryTable('retirementContributionHistoryBody',true);
    }
    async function editPfEpsHistory(accountId,id,kind){
      const account=state.pf.find(row=>row.id===accountId);if(!account)return;
      const row=kind==='contribution'?state.retirementContributions.find(row=>row.id===id&&row.accountId===accountId&&row.investmentType==='pf'):account.epsBalanceUpdates?.find(row=>row.id===id);if(!row)return;
      const original=JSON.stringify([account,row]);
      const values=await openRecordEditor(kind==='contribution'?'Correct EPS contribution':'Correct EPS balance update',[{key:'amount',label:kind==='contribution'?'EPS contribution ₹':'Corrected EPS balance after this update ₹',type:'number',min:0,value:kind==='contribution'?row.epsAmount:row.after}]);
      if(!values)return;if(!state.pf.includes(account)||JSON.stringify([account,row])!==original){alert('This account changed. Reopen the history and try again.');return;}
      const difference=Number(values.amount)-(kind==='contribution'?Number(row.epsAmount):Number(row.after));
      if((account.epsCurrent||0)+difference<0||(kind==='contribution'&&(row.amount-difference<0||account.current-difference<0||account.invested-difference<0))){alert('This correction would make a PF or EPS balance negative.');return;}
      account.epsCurrent=(account.epsCurrent||0)+difference;
      if(kind==='contribution'){row.epsAmount=Number(values.amount);row.amount-=difference;account.current-=difference;account.invested-=difference;}
      else{row.after=Number(values.amount);row.amount=Math.round((row.after-row.before)*100)/100;}
      await saveData('Corrected EPS history');renderPf();renderRetirementContributionHistory();updateDashboard();
    }
    function closeRetirementContributionHistory() {
      const modal=document.getElementById('retirementContributionHistoryModal');
      modal.hidden=true;delete modal.dataset.investmentType;delete modal.dataset.accountId;delete modal.dataset.historyMode;syncInvestmentOverlayBodyLock();
    }

