    // NPS Management
    function calculateXirr(cashflows) {
      const flows=cashflows.filter(flow=>validCalendarDate(flow.date)&&Number.isFinite(flow.amount)&&flow.amount!==0);
      if(!flows.some(flow=>flow.amount<0)||!flows.some(flow=>flow.amount>0))return null;
      const origin=flows.reduce((earliest,flow)=>Math.min(earliest,Date.parse(flow.date+'T00:00:00Z')),Infinity);
      const dated=flows.map(flow=>({amount:flow.amount,years:(Date.parse(flow.date+'T00:00:00Z')-origin)/(365*86400000)}));
      const npv=rate=>dated.reduce((sum,flow)=>sum+flow.amount/Math.pow(1+rate,flow.years),0);
      let low=-0.9999,high=0.1,lowValue=npv(low),highValue=npv(high);
      while((lowValue>0)===(highValue>0)&&high<1000000){high=high*2+0.1;highValue=npv(high);}
      if(!Number.isFinite(lowValue)||Number.isNaN(highValue)||(lowValue>0)===(highValue>0))return null;
      for(let i=0;i<240;i++){
        const mid=(low+high)/2,value=npv(mid);
        if(!Number.isFinite(value))return null;
        if(Math.abs(value)<0.000001)return mid;
        if((value>0)===(lowValue>0)){low=mid;lowValue=value;}else{high=mid;highValue=value;}
      }
      return (low+high)/2;
    }
    function npsAbsoluteReturn(account) {
      return stallionAbsoluteReturn(account);
    }
    function npsCagr(account,asOf=localDateKey()) {
      const startDate=account.date,invested=Number(account.invested),current=Number(account.current);
      if(!validCalendarDate(startDate)||!validCalendarDate(asOf)||startDate>=asOf||!Number.isFinite(invested)||invested<=0||!Number.isFinite(current)||current<0)return null;
      const days=(Date.parse(asOf+'T00:00:00Z')-Date.parse(startDate+'T00:00:00Z'))/86400000;
      if(days<=0)return null;
      if(current===0)return -1;
      return Math.pow(current/invested,365/days)-1;
    }
    function npsXirr(account,asOf=localDateKey(),accountContributions=null) {
      if(!validCalendarDate(account.date)||!validCalendarDate(asOf)||account.date>asOf)return null;
      const contributions=(accountContributions||state.retirementContributions||[]).filter(row=>row.investmentType==='nps'&&row.accountId===account.id&&row.date>=account.date&&row.date<=asOf&&row.amount>0);
      const contributionTotal=contributions.reduce((sum,row)=>sum+row.amount,0);
      const openingInvested=Number(account.invested)-contributionTotal;
      if(!Number.isFinite(openingInvested)||openingInvested< -0.01||Number(account.current)<=0)return null;
      const flows=[];
      if(openingInvested>0)flows.push({date:account.date,amount:-openingInvested});
      contributions.forEach(row=>flows.push({date:row.date,amount:-row.amount}));
      flows.push({date:asOf,amount:Number(account.current)});
      return calculateXirr(flows);
    }
    function stallionXirr(investment,asOf=localDateKey(),portfolioContributions=null) {
      const startDate=investment.date||state.stallionPms.find(row=>row.id===investment.id)?.createdDate;
      if(!validCalendarDate(startDate)||!validCalendarDate(asOf)||startDate>asOf)return null;
      const contributions=(portfolioContributions||state.stallionContributions||[]).filter(row=>row.stallionId===investment.id&&row.date>=startDate&&row.date<=asOf&&Number(row.amount)>0);
      const openingInvested=Number(investment.invested)-contributions.reduce((sum,row)=>sum+Number(row.amount),0);
      if(!Number.isFinite(openingInvested)||openingInvested< -0.01||Number(investment.current)<=0)return null;
      const flows=[];
      if(openingInvested>0)flows.push({date:startDate,amount:-openingInvested});
      contributions.forEach(row=>flows.push({date:row.date,amount:-Number(row.amount)}));
      flows.push({date:asOf,amount:Number(investment.current)});
      return calculateXirr(flows);
    }
    function stallionAbsoluteReturn(investment) {
      const invested=Number(investment.invested),current=Number(investment.current);
      if(!Number.isFinite(invested)||invested<=0||!Number.isFinite(current))return null;
      return (current-invested)/invested;
    }
    function stallionCagr(investment,asOf=localDateKey()) {
      const startDate=investment.date||state.stallionPms.find(row=>row.id===investment.id)?.createdDate;
      const invested=Number(investment.invested),current=Number(investment.current);
      if(!validCalendarDate(startDate)||!validCalendarDate(asOf)||startDate>=asOf||!Number.isFinite(invested)||invested<=0||!Number.isFinite(current)||current<0)return null;
      const days=(Date.parse(asOf+'T00:00:00Z')-Date.parse(startDate+'T00:00:00Z'))/86400000;
      if(days<=0)return null;
      if(current===0)return -1;
      return Math.pow(current/invested,365/days)-1;
    }
    function investmentAbsoluteReturn(investment) { return stallionAbsoluteReturn(investment); }
    function investmentCagr(investment,asOf=localDateKey()) { return stallionCagr(investment,asOf); }
    function investmentCategoryRateSummary(items,field,suffix) {
      const present=items.map(item=>item[field]).filter(value=>value!==undefined&&value!==null&&value!=='').map(Number).filter(Number.isFinite);
      if(!present.length)return {label:'—',title:'No rate recorded'};
      const unique=[...new Set(present.map(value=>value.toFixed(2)))];
      if(unique.length===1&&present.length===items.length)return {label:`${unique[0]}${suffix}`,title:`Recorded values: ${unique[0]}${suffix}`};
      return {label:'Multiple rates',title:`Recorded values: ${unique.map(value=>`${value}${suffix}`).join(', ')}`};
    }
    function investmentCategoryXirr(items,contributionsById,asOf=localDateKey()) {
      if(!items.length||!validCalendarDate(asOf))return null;
      const flows=[];
      for(const investment of items){
        if(!validCalendarDate(investment.date)||investment.date>asOf)return null;
        const contributions=(contributionsById.get(investment.id)||[]).filter(row=>row.date>=investment.date&&row.date<=asOf&&Number(row.amount)>0);
        const contributed=contributions.reduce((sum,row)=>sum+Number(row.amount),0);
        const invested=Number(investment.invested),current=Number(investment.current);
        const openingInvested=invested-contributed;
        if(!Number.isFinite(openingInvested)||openingInvested<-.01||!Number.isFinite(current)||current<0)return null;
        if(openingInvested>.01)flows.push({date:investment.date,amount:-openingInvested});
        contributions.forEach(row=>flows.push({date:row.date,amount:-Number(row.amount)}));
        if(current>0)flows.push({date:asOf,amount:current});
      }
      return calculateXirr(flows);
    }
    function investmentCategoryCagr(items,asOf=localDateKey()){
      if(!items.length||!validCalendarDate(asOf))return null;
      const flows=[];
      for(const investment of items){
        const invested=Number(investment.invested),current=Number(investment.current);
        if(!validCalendarDate(investment.date)||investment.date>=asOf||investment.date>asOf||!Number.isFinite(invested)||invested<=0||!Number.isFinite(current)||current<0)return null;
        flows.push({date:investment.date,amount:-invested});if(current>0)flows.push({date:asOf,amount:current});
      }
      return calculateXirr(flows);
    }
    function investmentXirr(investment,asOf=localDateKey(),investmentContributionsForHolding=null) {
      if(!investmentUsesReturnMetrics(investment.type)||!validCalendarDate(investment.date)||!validCalendarDate(asOf)||investment.date>asOf)return null;
      const contributions=(investmentContributionsForHolding||state.investmentContributions||[]).filter(row=>row.investmentId===investment.id&&row.date>=investment.date&&row.date<=asOf&&row.amount>0);
      const openingInvested=Number(investment.invested)-contributions.reduce((sum,row)=>sum+Number(row.amount),0);
      if(!Number.isFinite(openingInvested)||openingInvested< -0.01||Number(investment.current)<=0)return null;
      const flows=[];
      if(openingInvested>0)flows.push({date:investment.date,amount:-openingInvested});
      contributions.forEach(row=>flows.push({date:row.date,amount:-Number(row.amount)}));
      flows.push({date:asOf,amount:Number(investment.current)});
      return calculateXirr(flows);
    }
    function openInvestmentContributionModal(investmentId) {
      const investment=state.investments.find(row=>row.id===investmentId);
      if(!investment||investment.type==='Stallion PMS')return;
      const modal=document.getElementById('investmentContributionModal');
      modal.dataset.investmentId=investmentId;modal.dataset.mode='history';delete modal.dataset.editContributionId;
      document.getElementById('investmentContributionEntryForm').hidden=true;document.getElementById('investmentContributionHistoryPanel').hidden=false;
      document.getElementById('investmentContributionTitle').textContent=`${investment.type} Contributions — ${investment.name}`;
      const summary=document.getElementById('investmentContributionSummary');summary.replaceChildren();
      const figures=[['Invested',formatCurrency(investment.invested)],['Current value',formatCurrency(investment.current)]];
      if(investmentUsesReturnMetrics(investment.type))for(const [label,value] of [['Absolute return',investmentAbsoluteReturn(investment)],['CAGR',investmentCagr(investment)],['XIRR',investmentXirr(investment)]])figures.push([label,value===null?'N/A':(value*100).toFixed(2)+'%']);
      for(const [label,value] of figures){const item=document.createElement('span'),caption=document.createElement('span'),amount=document.createElement('strong');item.className='contribution-summary-metric';caption.textContent=label;amount.textContent=value;item.append(caption,amount);summary.append(item);}
      document.getElementById('investmentContributionDate').value=localDateKey();
      document.getElementById('investmentContributionAmount').value='';
      document.getElementById('investmentContributionFilter').value='all';
      document.getElementById('saveInvestmentContribution').textContent='Add Contribution';
      renderInvestmentContributionHistory(investmentId);
      modal.hidden=false;syncInvestmentOverlayBodyLock();modal.querySelector('button[data-close-investment-contribution]')?.focus();
    }
    function openManualInvestmentContribution(investmentId){
      const investment=state.investments.find(row=>row.id===investmentId);if(!investment||investment.type==='Stallion PMS')return;
      const modal=document.getElementById('investmentContributionModal');modal.dataset.investmentId=investmentId;modal.dataset.mode='manual';delete modal.dataset.editContributionId;
      document.getElementById('investmentContributionTitle').textContent=`Add Contribution — ${investment.name}`;
      document.getElementById('investmentContributionSummary').textContent=`${investment.type} · Invested ${formatCurrency(investment.invested)} · Current ${formatCurrency(investment.current)}`;
      document.getElementById('investmentContributionFilter').value='all';document.getElementById('investmentContributionEntryForm').hidden=false;document.getElementById('investmentContributionHistoryPanel').hidden=true;
      const contributionDate=document.getElementById('investmentContributionDate');contributionDate.min=investment.date||'';contributionDate.max=localDateKey();contributionDate.value=localDateKey();document.getElementById('investmentContributionAmount').value='';document.getElementById('saveInvestmentContribution').textContent='Add Contribution';
      modal.hidden=false;syncInvestmentOverlayBodyLock();document.getElementById('investmentContributionDate').focus();
    }
    function openManualRetirementContribution(kind,accountId){
      if(!['pf','ppf'].includes(kind))return;
      const account=(state[kind]||[]).find(row=>row.id===accountId);if(!account)return;
      if(typeof window!=='undefined'&&window.financeCloud?.canEdit===false)return;
      const modal=document.getElementById('investmentContributionModal');modal.dataset.mode='retirement-manual';modal.dataset.retirementType=kind;modal.dataset.investmentId=accountId;delete modal.dataset.editContributionId;
      document.getElementById('investmentContributionTitle').textContent=`Add Contribution — ${account.account||kind.toUpperCase()+' Account'}`;
      document.getElementById('investmentContributionSummary').textContent=`${kind.toUpperCase()} · One-off additional contribution · Invested ${formatCurrency(account.invested)} · Current ${formatCurrency(account.current)} · Automatic monthly credits remain separate`;
      document.getElementById('investmentContributionFilter').value='all';document.getElementById('investmentContributionEntryForm').hidden=false;document.getElementById('investmentContributionHistoryPanel').hidden=true;
      const date=document.getElementById('investmentContributionDate');date.value=localDateKey();date.min=account.date||'';date.max=localDateKey();
      document.getElementById('investmentContributionAmount').value='';document.getElementById('saveInvestmentContribution').textContent='Add Contribution';
      modal.hidden=false;syncInvestmentOverlayBodyLock();date.focus();
    }
    function openManualPpfContribution(accountId){openManualRetirementContribution('ppf',accountId);}
    function openManualPfContribution(accountId){openManualRetirementContribution('pf',accountId);}
    function renderInvestmentContributionHistory(investmentId) {
      const filter=document.getElementById('investmentContributionFilter')?.value||'all';
      const allRows=(state.investmentContributions||[]).filter(row=>row.investmentId===investmentId).sort((a,b)=>b.date.localeCompare(a.date));
      const rows=allRows.filter(row=>filter==='all'||(filter==='automatic'?row.automatic===true:row.automatic!==true));
      const emptyMessage=allRows.length?'No contributions match this filter.':'No contributions recorded.';
      document.getElementById('investmentContributionBody').innerHTML=rows.length?rows.map(row=>`<tr><td data-label="Contribution date">${analyticEscape(row.date)}</td><td class="text-right" data-label="Amount">${formatCurrency(row.amount)}</td><td data-label="Type">${row.automatic===true?'Automatic':'Manual'}</td><td data-label="Actions"><button class="btn-small" onclick="editInvestmentContribution('${row.id}')">Edit</button> <button class="btn-small btn-danger" onclick="deleteInvestmentContribution('${row.id}')">Delete</button></td></tr>`).join(''):`<tr><td colspan="4" class="text-muted">${emptyMessage}</td></tr>`;
    }
    function editInvestmentContribution(contributionId) {
      const row=(state.investmentContributions||[]).find(item=>item.id===contributionId);if(!row)return;
      const modal=document.getElementById('investmentContributionModal');modal.dataset.mode='edit';modal.dataset.editContributionId=contributionId;
      document.getElementById('investmentContributionEntryForm').hidden=false;document.getElementById('investmentContributionHistoryPanel').hidden=false;
      document.getElementById('investmentContributionDate').value=row.date;document.getElementById('investmentContributionAmount').value=row.amount;
      document.getElementById('saveInvestmentContribution').textContent='Save changes';
    }
    function validFundContributionChange(investment,difference) {
      if (![investment.invested+difference,investment.current+difference].every(n=>Number.isFinite(n)&&n>=0)) {alert('This correction would make the invested amount or current value negative. Update the holding balances before correcting this contribution.');return false;}
      return true;
    }
    function saveInvestmentContribution() {
      const modal=document.getElementById('investmentContributionModal');
      const amount=Number(document.getElementById('investmentContributionAmount').value),date=document.getElementById('investmentContributionDate').value;
      if(!Number.isFinite(amount)||amount<=0){alert('Enter a contribution amount greater than zero.');return;}
      if(modal.dataset.mode==='retirement-manual'){
        const kind=modal.dataset.retirementType;
        if(!['pf','ppf'].includes(kind))return;
        if(typeof window!=='undefined'&&window.financeCloud?.canEdit===false)return;
        const account=(state[kind]||[]).find(row=>row.id===modal.dataset.investmentId);
        if(!account)return;
        if(!validCalendarDate(date)||date<account.date||date>localDateKey()){alert('Choose a valid contribution date between the '+kind.toUpperCase()+' opening date and today.');return;}
        // One-off credits do not change the recurring PF/PPF amount, EPS, or annual interest.
        state.retirementContributions.push({id:generateId(),investmentType:kind,accountId:account.id,member:account.member||'',accountName:account.account||kind.toUpperCase(),amount,date,automatic:false});
        account.invested=(Number(account.invested)||0)+amount;account.current=(Number(account.current)||0)+amount;
        saveData();closeInvestmentContributionModal();renderInvestments();if(kind==='pf')renderPf();else renderPpf();updateDashboard();viewRetirementContributionHistory(kind,account.id);return;
      }
      const investment=state.investments.find(row=>row.id===modal.dataset.investmentId);if(!investment)return;
      if(!validCalendarDate(date)||date<investment.date||date>localDateKey()){alert('Choose a valid contribution date between the investment start date and today.');return;}
      const editingId=modal.dataset.editContributionId;
      if(editingId){const row=state.investmentContributions.find(item=>item.id===editingId);if(!row)return;if(row.automatic===true&&state.investmentContributions.some(item=>item.id!==row.id&&item.investmentId===investment.id&&item.automatic===true&&item.date===date)){alert('An automatic contribution already exists for this holding and date.');return;}const difference=amount-row.amount;if(!validFundContributionChange(investment,difference))return;investment.invested+=difference;investment.current+=difference;row.amount=amount;row.date=date;}
      else {state.investmentContributions.push({id:generateId(),investmentId:investment.id,amount,date,automatic:false});investment.invested+=amount;investment.current+=amount;}
      const saving=saveData();
      if(typeof window!=='undefined'&&window.financeWorkbench?.isReviewEditing('investment'))return window.financeWorkbench.saveAndReturn(saving,()=>{closeInvestmentContributionModal();renderInvestments();updateDashboard();});
      delete modal.dataset.editContributionId;document.getElementById('investmentContributionDate').value=localDateKey();document.getElementById('investmentContributionAmount').value='';document.getElementById('saveInvestmentContribution').textContent='Add Contribution';
      renderInvestments();openInvestmentContributionModal(investment.id);updateDashboard();
    }
    function deleteInvestmentContribution(contributionId) {
      const row=(state.investmentContributions||[]).find(item=>item.id===contributionId);if(!row||!confirm('Delete this contribution?'))return;
      const investment=state.investments.find(item=>item.id===row.investmentId);if(investment){if(!validFundContributionChange(investment,-row.amount))return;investment.invested-=row.amount;investment.current-=row.amount;}
      state.investmentContributions=state.investmentContributions.filter(item=>item.id!==contributionId);
      saveData();renderInvestments();openInvestmentContributionModal(row.investmentId);updateDashboard();
    }
    function closeInvestmentContributionModal() { const modal=document.getElementById('investmentContributionModal');modal.hidden=true;delete modal.dataset.investmentId;delete modal.dataset.editContributionId;delete modal.dataset.retirementType;delete modal.dataset.mode;syncInvestmentOverlayBodyLock(); }
    document.getElementById('addNpsBtn').addEventListener('click', () => {
      const member = document.getElementById('npsMember').value;
      const account = document.getElementById('npsAccount').value;
      let invested = Number(document.getElementById('npsInvested').value);
      let current = Number(document.getElementById('npsCurrent').value);
      const date = document.getElementById('npsDate').value || localDateKey();
      const scheme = document.getElementById('npsScheme').value;
      const monthly = Number(document.getElementById('npsMonthly').value);
      const autoMonthlyContribution=document.getElementById('npsAutomaticMonthly').checked;

      if (!member || !account || !Number.isFinite(invested) || invested <= 0 || !Number.isFinite(current) || current < 0 || !Number.isFinite(monthly) || monthly < 0 || (autoMonthlyContribution&&monthly<=0)) {
        alert('Fill all required fields with valid amounts');
        return;
      }

      // Entered invested/current balances are authoritative; monthly amount is a separate schedule.

      state.nps.push({
        id: generateId(),
        member: member,
        account: account,
        invested: invested,
        current: current,
        valuationDate:localDateKey(),
        date: date,
        scheme: scheme,
        monthly: monthly,
        autoMonthlyContribution,
        contributionsThrough: currentMonthKey()
      });

      document.getElementById('npsAccount').value = '';
      document.getElementById('npsInvested').value = '';
      document.getElementById('npsCurrent').value = '';
      document.getElementById('npsDate').value = '';
      document.getElementById('npsMonthly').value = '';
      document.getElementById('npsAutomaticMonthly').checked=false;syncRetirementMonthlyForm('nps');

      saveData();
      renderNps();
      closeInvestmentEntry('npsAddPanel');
      updateDashboard();
    });

    function lastCompletedFinancialYearStartYear(now = new Date()) { return currentFinancialYearStartYear(now) - 1; }
    function hasAnnualInterestCredit(account, financialYearStartYear) {
      return Array.isArray(account.interestCredits) && account.interestCredits.some(credit => Number(credit.financialYearStartYear) === Number(financialYearStartYear));
    }
    function annualInterestControl(kind, account) {
      const year=lastCompletedFinancialYearStartYear(),label=financialYearLabel(year).replace(/^FY /,'');
      if(hasAnnualInterestCredit(account,year)) return '';
      return `<button type="button" class="btn-small" onclick="openAnnualInterestModal('${kind}','${account.id}')">Record FY ${label} Interest</button>`;
    }
    function updateAnnualInterestColumn(kind) {
      const tbody=document.getElementById(kind==='pf'?'pfBody':'ppfBody');if(!tbody)return;
      const year=lastCompletedFinancialYearStartYear();
      const hide=state[kind].length===0||state[kind].every(account=>hasAnnualInterestCredit(account,year));
      const table=tbody.closest('table');
      table?.querySelectorAll('.annual-interest-column').forEach(cell=>cell.hidden=hide);
    }
    function editAnnualInterestCredit(kind,id,year) {
      const account=state[kind]?.find(item=>item.id===id),credit=account?.interestCredits?.find(item=>Number(item.financialYearStartYear)===Number(year));if(!account||!credit)return;
      document.getElementById('retirementContributionHistoryModal').hidden=true;
      const modal=document.getElementById('accountUpdateModal');modal.dataset.mode='annual-interest-edit';modal.dataset.accountType=kind;modal.dataset.recordId=id;modal.dataset.financialYearStartYear=String(year);
      document.getElementById('accountUpdateTitle').textContent=`Edit ${kind.toUpperCase()} Interest`;
      document.getElementById('accountUpdateValueLabel').textContent=`Interest credited for ${financialYearLabel(year)} (₹)`;
      document.getElementById('accountUpdateNote').textContent='Enter the corrected credited interest. Current balance will change by the difference; invested amount and credit date stay unchanged.';
      document.getElementById('accountUpdateNpsAccountWrap').hidden=true;
      document.getElementById('accountUpdateContributionMonthWrap').hidden=true;
      const input=document.getElementById('accountUpdateValue');input.value=Number(credit.amount)||0;input.min='0.01';
      modal.hidden=false;syncInvestmentOverlayBodyLock();input.focus();input.select();
    }
    function openAnnualInterestModal(kind,id) {
      if(!['pf','ppf'].includes(kind))return;
      const account=state[kind].find(item=>item.id===id);if(!account)return;
      const year=lastCompletedFinancialYearStartYear();
      if(hasAnnualInterestCredit(account,year)){alert(`Interest for ${financialYearLabel(year)} is already recorded for this account.`);return;}
      const modal=document.getElementById('accountUpdateModal');
      modal.dataset.mode='annual-interest';modal.dataset.accountType=kind;modal.dataset.recordId=id;modal.dataset.financialYearStartYear=String(year);
      document.getElementById('accountUpdateTitle').textContent=`Record ${kind.toUpperCase()} Interest`;
      document.getElementById('accountUpdateValueLabel').textContent=`Interest credited for ${financialYearLabel(year)} (₹)`;
      document.getElementById('accountUpdateNote').textContent='Enter the actual interest amount credited in your account statement. It will be added to Current Value; Invested amount stays unchanged. This entry can be made once for this financial year.';
      document.getElementById('accountUpdateNpsAccountWrap').hidden=true;
      document.getElementById('accountUpdateContributionMonthWrap').hidden=true;
      const input=document.getElementById('accountUpdateValue');input.value='';input.min='0.01';
      modal.hidden=false;syncInvestmentOverlayBodyLock();input.focus();
    }
    function openNpsCurrentBalanceModal() {
      if(!state.nps.length)return;
      const modal=document.getElementById('accountUpdateModal');
      const accountSelect=document.getElementById('accountUpdateNpsAccount');
      accountSelect.replaceChildren();
      state.nps.forEach(account=>{const option=document.createElement('option');option.value=account.id;option.textContent=`${account.member} — ${account.account}`;accountSelect.appendChild(option);});
      const selectedAccount=state.nps[0];
      modal.dataset.mode='nps-current';modal.dataset.accountType='nps';modal.dataset.recordId=selectedAccount.id;delete modal.dataset.financialYearStartYear;
      document.getElementById('accountUpdateTitle').textContent='Update NPS Current Balance';
      document.getElementById('accountUpdateValueLabel').textContent='Current balance (₹)';
      document.getElementById('accountUpdateNote').textContent='Enter the latest balance from your NPS statement. Invested amount and contribution history stay unchanged; gain, loss, and XIRR will recalculate.';
      document.getElementById('accountUpdateNpsAccountWrap').hidden=false;
      document.getElementById('accountUpdateContributionMonthWrap').hidden=true;
      const input=document.getElementById('accountUpdateValue');input.value=Number(selectedAccount.current)||0;input.min='0';
      modal.hidden=false;syncInvestmentOverlayBodyLock();accountSelect.focus();
    }
    function closeAccountUpdateModal() {
      const modal=document.getElementById('accountUpdateModal'),mode=modal.dataset.mode,kind=modal.dataset.accountType,id=modal.dataset.recordId;modal.hidden=true;delete modal.dataset.mode;delete modal.dataset.accountType;delete modal.dataset.recordId;delete modal.dataset.financialYearStartYear;delete modal.dataset.contributionId;syncInvestmentOverlayBodyLock();
      document.getElementById('accountUpdateNpsAccountWrap').hidden=true;
      document.getElementById('accountUpdateContributionMonthWrap').hidden=true;
      if(['annual-interest-edit','retirement-contribution-edit'].includes(mode)){const historyModal=document.getElementById('retirementContributionHistoryModal');if(historyModal.dataset.investmentType===kind&&historyModal.dataset.accountId===id){renderRetirementContributionHistory();historyModal.hidden=false;syncInvestmentOverlayBodyLock();}}
    }
    function editRetirementContribution(contributionId) {
      const row=(state.retirementContributions||[]).find(item=>item.id===contributionId);if(!row)return;
      const account=state[row.investmentType]?.find(item=>item.id===row.accountId);if(!account)return;
      const modal=document.getElementById('accountUpdateModal');modal.dataset.mode='retirement-contribution-edit';modal.dataset.accountType=row.investmentType;modal.dataset.recordId=row.accountId;modal.dataset.contributionId=row.id;
      document.getElementById('retirementContributionHistoryModal').hidden=true;
      document.getElementById('accountUpdateTitle').textContent=`Edit ${row.investmentType.toUpperCase()} Contribution`;
      document.getElementById('accountUpdateValueLabel').textContent='Contribution amount (₹)';
      document.getElementById('accountUpdateNote').textContent='Correct the amount or date. Invested and current balances will adjust by the amount difference.';
      document.getElementById('accountUpdateNpsAccountWrap').hidden=true;
      const monthInput=document.getElementById('accountUpdateContributionMonth');monthInput.value=row.date;monthInput.min=String(account.date||'');monthInput.max=localDateKey();
      document.getElementById('accountUpdateContributionMonthWrap').hidden=false;
      const input=document.getElementById('accountUpdateValue');input.value=Number(row.amount)||0;input.min='0.01';
      modal.hidden=false;syncInvestmentOverlayBodyLock();monthInput.focus();
    }
    function saveAccountUpdateModal() {
      const modal=document.getElementById('accountUpdateModal'),mode=modal.dataset.mode,kind=modal.dataset.accountType,id=modal.dataset.recordId;
      const record=state[kind]?.find(item=>item.id===id);if(!record)return;
      const value=Number(document.getElementById('accountUpdateValue').value);
      if(!Number.isFinite(value)||value<Number(document.getElementById('accountUpdateValue').min||0)){alert('Enter a valid amount.');return;}
      if(mode==='annual-interest') {
        const year=Number(modal.dataset.financialYearStartYear);
        if(year!==lastCompletedFinancialYearStartYear()){alert('The financial year has changed. Reopen the action to record interest for the last completed financial year.');closeAccountUpdateModal();renderPf();renderInvestments();renderPpf();return;}
        if(hasAnnualInterestCredit(record,year)){alert(`Interest for ${financialYearLabel(year)} is already recorded for this account.`);closeAccountUpdateModal();return;}
        if(!Array.isArray(record.interestCredits))record.interestCredits=[];
        record.interestCredits.push({financialYearStartYear:year,amount:value,creditedDate:localDateKey()});
        record.current=(Number(record.current)||0)+value;
      } else if(mode==='annual-interest-edit') {
        const year=Number(modal.dataset.financialYearStartYear),credit=record.interestCredits?.find(item=>Number(item.financialYearStartYear)===year);
        if(!credit){alert('The recorded interest entry could not be found.');return;}
        const correctedCurrent=(Number(record.current)||0)+(value-Number(credit.amount||0));
        if(correctedCurrent<0){alert('This interest correction would make the current balance negative. Update the account balance before correcting this interest entry.');return;}
        record.current=correctedCurrent;credit.amount=value;
      } else if(mode==='retirement-contribution-edit') {
        const contribution=(state.retirementContributions||[]).find(item=>item.id===modal.dataset.contributionId&&item.investmentType===kind&&item.accountId===id);
        const newDate=document.getElementById('accountUpdateContributionMonth').value,month=newDate.slice(0,7);
        if(!contribution){alert('The contribution entry could not be found.');return;}
        if(!validCalendarDate(newDate)||newDate<record.date||newDate>localDateKey()||(contribution.automatic!==false&&newDate.slice(-2)!=='01')){alert('Choose a valid contribution date. Automatic contributions must remain on the first of the month.');return;}
        if(contribution.automatic!==false&&state.retirementContributions.some(item=>item.id!==contribution.id&&item.investmentType===kind&&item.accountId===id&&item.automatic!==false&&item.date.slice(0,7)===month)){alert('An automatic contribution is already recorded for this account and month.');return;}
        const difference=value-Number(contribution.amount||0),invested=Number(record.invested??record.current)||0,current=Number(record.current)||0;
        if(invested+difference<0||current+difference<0){alert('This correction would make the invested or current balance negative. Update the account balance before correcting this contribution.');return;}
        record.invested=invested+difference;record.current=current+difference;contribution.amount=value;contribution.date=newDate;
        document.getElementById('retirementContributionHistoryFinancialYear').dataset.preferredYear=String(financialYearStartYearForMonthKey(month));
      } else if(mode==='nps-current'){record.current=value;record.valuationDate=localDateKey();}
      else return;
      const finish=()=>{closeAccountUpdateModal();if(kind==='pf')renderPf();else if(kind==='ppf'){renderInvestments();renderPpf();}else if(kind==='nps')renderNps();updateDashboard();},saving=saveData();
      if(typeof window!=='undefined'&&window.financeWorkbench?.isReviewEditing('retirement'))return window.financeWorkbench.saveAndReturn(saving,finish);
      finish();
    }

    function renderNps() {
      const viewAccounts=profileRows(state.nps||[]);
      updateRetirementTilesVisibility();
      const tbody = document.getElementById('npsBody');
      // Per-account Update value controls replace the legacy portfolio-header button.
      document.getElementById('openNpsBalanceUpdate').hidden=true;
      updateRetirementAccountSummary('nps');
      renderInvestmentOverview();
      renderAccountPager('nps','npsBody',renderNps);
      if (viewAccounts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" class="text-muted">No NPS added yet.</td></tr>';
        refreshRetirementCategoryDialog();return;
      }

      const valuationDate=localDateKey(),contributionsByAccount=new Map();
      for(const row of state.retirementContributions||[])if(row.investmentType==='nps'){
        if(!contributionsByAccount.has(row.accountId))contributionsByAccount.set(row.accountId,[]);
        contributionsByAccount.get(row.accountId).push(row);
      }
      const showMonthly=viewAccounts.some(row=>retirementMonthlyAmount(row,'nps')>0);
      tbody.innerHTML = pageAccountRows('nps',viewAccounts).map(nps => {
        const gain = nps.current - nps.invested;
        const absoluteReturn=npsAbsoluteReturn(nps),cagr=npsCagr(nps,valuationDate),xirr=npsXirr(nps,valuationDate,contributionsByAccount.get(nps.id)||[]);
        return `
          <tr>
            <td><strong>${analyticEscape(nps.member)}</strong></td>
            <td>${analyticEscape(nps.account)}</td>
            <td>${analyticEscape(nps.scheme)}</td>
            ${showMonthly?`<td class="text-right monthly-contribution-column">${formatCurrency(retirementMonthlyAmount(nps,'nps'))}</td>`:''}
            <td class="text-right">${formatCurrency(nps.invested)}</td>
            <td class="text-right">${formatCurrency(nps.current)}</td>
            <td class="text-right ${gain >= 0 ? 'positive' : 'negative'}">${gain >= 0 ? '+' : ''}${formatCurrency(gain)}</td>
            <td class="text-right">${absoluteReturn===null?'N/A':(absoluteReturn*100).toFixed(2)+'%'}</td>
            <td class="text-right">${cagr===null?'N/A':(cagr*100).toFixed(2)+'%'}</td>
            <td class="text-right">${xirr===null?'N/A':(xirr*100).toFixed(2)+'%'}</td>
            <td class="account-action-buttons">
              <button type="button" class="investment-icon-action" aria-label="Update value" title="Update value" onclick="financeWorkbench.valuations('nps','${nps.id}')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M6 8a7 7 0 0 1 12-2l2 3M4 15l2 3a7 7 0 0 0 12-2"/></svg></button><button class="btn-small" onclick="editNps('${nps.id}')">Edit</button>
              <button class="btn-small btn-danger" onclick="deleteNps('${nps.id}')">Delete</button>
              <button class="btn-small" onclick="viewRetirementContributionHistory('nps','${nps.id}')">View History</button>
            </td>
          </tr>
        `;
      }).join('');
      refreshRetirementCategoryDialog();
    }

    function editNps(id) { openInvestmentEditModal('nps',id); }
    function deleteNps(id) {
      if (confirm('Delete this NPS account and its recorded contribution history?')) {
        state.nps = state.nps.filter(n => n.id !== id);
        state.retirementContributions=state.retirementContributions.filter(row=>row.investmentType!=='nps'||row.accountId!==id);
        saveData();
        renderNps();
        updateDashboard();
      }
    }


