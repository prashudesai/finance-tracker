

    // Shared form modal keeps the original form nodes and event handlers intact.
    let entryModalHome=null,entryModalTrigger=null;
    function entryPanelIsModal(panel) { return Boolean(panel?.closest('#entryFormModal')); }
    function openEntryFormModal(panelId,trigger=null) {
      closeEntryFormModal(false);
      const panel=document.getElementById(panelId),modal=document.getElementById('entryFormModal');if(!panel||!modal)return;
      if(['stallionContributionAddPanel','stallionProfitAddPanel'].includes(panelId))populateStallionDropdowns();
      const marker=document.createComment(`entry-form-home:${panelId}`);panel.before(marker);entryModalHome=marker;entryModalTrigger=trigger||document.activeElement;
      modal.dataset.panelId=panelId;document.getElementById('entryFormModalTitle').textContent=panel.querySelector('h2')?.textContent||'Add record';
      document.getElementById('entryFormModalContent').appendChild(panel);panel.hidden=false;panel.classList.add('is-open');modal.hidden=false;
      if(trigger)trigger.setAttribute('aria-expanded','true');syncInvestmentOverlayBodyLock();
      requestAnimationFrame(()=>{
        const singlePms=panel.querySelector('.pms-single-portfolio');
        const target=singlePms?document.getElementById(panelId==='stallionContributionAddPanel'?'stallionContribAmount':'stallionProfitAmount'):panel.querySelector('input:not([type="hidden"]),select,textarea,button');
        target?.focus();
      });
    }
    function closeEntryFormModal(restoreFocus=true) {
      const modal=document.getElementById('entryFormModal');if(!modal||modal.hidden)return;
      const panel=document.getElementById(modal.dataset.panelId);
      if(panel){panel.classList.remove('is-open');if(entryModalHome?.isConnected)entryModalHome.replaceWith(panel);else document.getElementById('entryFormParking').appendChild(panel);if(panel.id==='loanAddPanel')panel.hidden=true;}
      entryModalHome?.remove();entryModalHome=null;modal.hidden=true;delete modal.dataset.panelId;
      if(entryModalTrigger){entryModalTrigger.setAttribute?.('aria-expanded','false');if(restoreFocus&&entryModalTrigger.isConnected)entryModalTrigger.focus?.();}entryModalTrigger=null;
      syncInvestmentOverlayBodyLock();
    }
    function actionIconSvg(kind) {
      const paths={history:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',edit:'<path d="m4 16.5-.8 4.3 4.3-.8L19 8.5 15.5 5 4 16.5Z"/><path d="m13.5 7 3.5 3.5"/>',delete:'<path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',add:'<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',balance:'<path d="M4 7h16M4 12h10M4 17h7"/><path d="m17 14 3 3-3 3m3-3h-6"/>',interest:'<circle cx="12" cy="12" r="9"/><path d="m8 16 8-8"/><circle cx="8" cy="8" r="1"/><circle cx="16" cy="16" r="1"/>'};
      return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[kind]||paths.edit}</svg>`;
    }
    function decorateActionButtons(root=document) {
      const selector='td button,.gratuity-row-actions button,#archiveList button,.custom-investment-profile-edit';
      const buttons=[...(root.matches?.(selector)?[root]:[]),...(root.querySelectorAll?.(selector)||[])];
      for(const button of buttons){if(button.dataset.actionIcon||button.querySelector('svg'))continue;const label=button.textContent.trim().replace(/\s+/g,' ');let kind;
        if(/^Edit(?:\s|$)/i.test(label))kind='edit';else if(/^Delete(?:\s|$)/i.test(label))kind='delete';else if(/^View(?:\s|$)/i.test(label))kind='history';else if(/^(?:Add|Record) Contribution$/i.test(label))kind='add';else if(/^Restore$/i.test(label))kind='balance';else if(/^Update Balance$/i.test(label))kind='balance';else if(/^Record FY .*Interest$/i.test(label))kind='interest';else continue;
        button.dataset.actionIcon=kind;button.title=label;button.setAttribute('aria-label',label);button.classList.remove('btn-small','btn-danger');button.classList.add('investment-icon-action');if(kind==='delete')button.classList.add('is-danger');button.innerHTML=actionIconSvg(kind);
      }
    }
    function openStallionHistory(portfolioId='') {
      const modal=document.getElementById('stallionHistoryModal');modal.dataset.portfolioId=portfolioId;
      document.getElementById('stallionHistoryType').value='';document.getElementById('stallionHistoryFinancialYear').value=String(currentFinancialYearStartYear());delete document.getElementById('stallionHistoryFinancialYear').dataset.preferredYear;
      modal.hidden=false;renderStallionHistoryModal();syncInvestmentOverlayBodyLock();document.getElementById('stallionHistoryType').focus();
    }
    function closeStallionHistory() {document.getElementById('stallionHistoryModal').hidden=true;syncInvestmentOverlayBodyLock();}
    function renderStallionHistoryModal() {
      const modal=document.getElementById('stallionHistoryModal');if(modal.hidden)return;
      const id=modal.dataset.portfolioId||'',portfolio=state.investments.find(row=>row.id===id&&row.type==='Stallion PMS');
      if(id&&(!portfolio||!profileRows([portfolio]).length)){closeStallionHistory();return;}
      const mode=document.getElementById('stallionHistoryType').value;
      document.getElementById('stallionHistoryTitle').textContent=portfolio?`Stallion PMS History — ${portfolio.name}`:'Stallion PMS History';
      document.getElementById('stallionHistoryResults').hidden=!mode;document.getElementById('stallionHistoryYearWrap').hidden=!mode;
      document.getElementById('stallionHistorySummary').textContent=mode?'':'Choose Contribution history or Gain / loss history.';
      const visibleIds=new Set(profileRows(state.investments.filter(row=>row.type==='Stallion PMS')).map(row=>row.id));
      const all=(mode==='profit'?state.stallionProfitHistory:state.stallionContributions).filter(row=>visibleIds.has(row.stallionId)&&(!id||row.stallionId===id));
      const year=populateHistoryFinancialYear('stallionHistoryFinancialYear',all.map(row=>row.date.slice(0,7)));
      const rows=all.filter(row=>monthKeyInFinancialYear(row.date.slice(0,7),year)).sort((a,b)=>b.date.localeCompare(a.date));
      delete document.getElementById('stallionHistoryAmountHeading').dataset.sortLabel;delete document.getElementById('stallionHistoryKindHeading').dataset.sortLabel;
      document.getElementById('stallionHistoryAmountHeading').textContent=mode==='profit'?'Gain / loss snapshot':'Contribution';
      document.getElementById('stallionHistoryKindHeading').textContent=mode==='profit'?'':'Entry type';
      document.getElementById('stallionHistoryKindHeading').hidden=mode==='profit';
      if(mode)document.getElementById('stallionHistorySummary').textContent=`${rows.length} ${mode==='profit'?'gain / loss snapshots':'contributions'} · ${financialYearLabel(year)}${mode==='profit'?'':` · Total ${formatCurrency(rows.reduce((sum,row)=>sum+row.amount,0))}`}`;
      document.getElementById('stallionModalHistoryBody').innerHTML=rows.map(row=>{const account=state.investments.find(inv=>inv.id===row.stallionId);return `<tr><td data-label="Date">${analyticEscape(row.date)}</td><td data-label="Portfolio">${analyticEscape(account?.name||'—')}</td><td class="text-right" data-label="${mode==='profit'?'Gain / loss':'Contribution'}">${formatCurrency(mode==='profit'?row.profit:row.amount)}</td>${mode==='profit'?'<td hidden></td>':`<td data-label="Type">${row.automatic===true?'Automatic':'Manual'}</td>`}<td data-label="Actions">${mode==='profit'?`<button type="button" class="btn-small" onclick="editStallionProfitSnapshot('${row.id}')">Edit</button>`:`<button type="button" class="btn-small" onclick="editStallionContrib('${row.id}')">Edit</button><button type="button" class="btn-small btn-danger" onclick="deleteStallionContrib('${row.id}')">Delete</button>`}</td></tr>`;}).join('')||`<tr><td colspan="${mode==='profit'?4:5}" class="text-muted">No records for this financial year.</td></tr>`;
      decorateActionButtons(document.getElementById('stallionHistoryResults'));initialiseTableSorting();paginateHistoryTable('stallionModalHistoryBody',true);
    }
    async function editStallionProfitSnapshot(id) {
      const row=state.stallionProfitHistory.find(item=>item.id===id),portfolio=state.investments.find(item=>item.id===row?.stallionId&&item.type==='Stallion PMS');if(!row||!portfolio)return;
      const original=JSON.stringify(row),values=await openRecordEditor('Edit PMS gain / loss snapshot',[{key:'date',label:'As of date',type:'date',value:row.date},{key:'profit',label:'Gain / loss ₹',type:'number',value:row.profit}],v=>{
        if(v.date<portfolio.date)return 'The snapshot cannot be before the portfolio opening date.';
        if(!Number.isFinite(Number(v.profit))||portfolio.invested+Number(v.profit)<0)return 'Enter a valid gain or loss; current value cannot be negative.';
        if(state.stallionProfitHistory.some(item=>item.id!==id&&item.stallionId===row.stallionId&&item.date===v.date))return 'A snapshot already exists for this portfolio and date.';
        return null;
      });
      if(!values)return;if(!state.stallionProfitHistory.includes(row)||JSON.stringify(row)!==original||!state.investments.includes(portfolio)){alert('This record changed while editing. Reopen it and try again.');return;}
      const profit=Number(values.profit);if(!validCalendarDate(values.date)||values.date<portfolio.date||!Number.isFinite(profit)||portfolio.invested+profit<0||state.stallionProfitHistory.some(item=>item.id!==id&&item.stallionId===row.stallionId&&item.date===values.date)){alert('Enter a unique valid snapshot date and gain / loss.');return;}
      Object.assign(row,{date:values.date,profit});
      const latest=state.stallionProfitHistory.filter(item=>item.stallionId===row.stallionId).sort((a,b)=>b.date.localeCompare(a.date))[0],pms=state.stallionPms.find(item=>item.id===row.stallionId);
      portfolio.current=portfolio.invested+latest.profit;portfolio.valuationDate=latest.date;if(pms)pms.profit=latest.profit;
      await saveData('Edited PMS gain / loss snapshot');renderInvestments();updateDashboard();
    }
    function setupModernModals() {
      document.querySelectorAll('[data-close-entry-modal]').forEach(button=>button.addEventListener('click',()=>closeEntryFormModal()));
      document.querySelectorAll('[data-close-stallion-history]').forEach(button=>button.addEventListener('click',closeStallionHistory));
      document.getElementById('stallionHistoryType').addEventListener('change',renderStallionHistoryModal);document.getElementById('stallionHistoryFinancialYear').addEventListener('change',renderStallionHistoryModal);
      document.addEventListener('keydown',event=>{if(event.key!=='Escape')return;const childOpen=['investmentEditModal','accountUpdateModal','gratuityEditModal','investmentContributionModal','retirementContributionHistoryModal','debtEmiHistoryModal'].some(id=>!document.getElementById(id).hidden);if(childOpen||document.getElementById('recordEditorDialog').open)return;
        if(!document.getElementById('entryFormModal').hidden){event.preventDefault();event.stopImmediatePropagation();closeEntryFormModal();}
        else if(!document.getElementById('stallionHistoryModal').hidden){event.preventDefault();event.stopImmediatePropagation();closeStallionHistory();}
      },true);
      // Keep keyboard focus within custom modal overlays. Native record editors provide their own trap.
      document.addEventListener('keydown',event=>{if(event.key!=='Tab'||document.getElementById('recordEditorDialog').open)return;
        const layers=[...document.querySelectorAll('.investment-edit-modal:not([hidden]),#growthAssumptionDialog:not([hidden]),#investmentCategoryDialog:not([hidden]),#retirementCategoryDialog:not([hidden])')].sort((a,b)=>(Number(getComputedStyle(a).zIndex)||0)-(Number(getComputedStyle(b).zIndex)||0)),top=layers.at(-1);if(!top)return;
        const focusable=[...top.querySelectorAll('button,input,select,textarea,a[href],[tabindex="0"]')].filter(el=>!el.disabled&&!el.hidden&&el.getClientRects().length);if(!focusable.length)return;const first=focusable[0],last=focusable.at(-1);if(!top.contains(document.activeElement)||(event.shiftKey&&document.activeElement===first)||(!event.shiftKey&&document.activeElement===last)){event.preventDefault();(event.shiftKey?last:first).focus();}
      });
      decorateActionButtons();new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node.nodeType===1)decorateActionButtons(node);}).observe(document.body,{childList:true,subtree:true});
    }

    function validCalendarDate(value) { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value; }
    function localDateKey() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
    function calendarDate(value) { return new Date(value + 'T12:00:00'); }
    function previousMonthKey(month) { const [y,m]=month.split('-').map(Number);return `${m===1?y-1:y}-${String(m===1?12:m-1).padStart(2,'0')}`; }
    function currentMonthKey() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }
    function inMonth(date, month) { return typeof date === 'string' && date.slice(0,7) === month; }
    function financialYearAverages(now = new Date()) {
      const year=now.getFullYear(), month=now.getMonth();
      const startYear=month>=3?year:year-1;
      const elapsedMonths=(year-startYear)*12+month-2;
      const throughKey=`${year}-${String(month+1).padStart(2,'0')}`;
      const incomeByMonth=new Map(),expensesByMonth=new Map(),contributionsByMonth=new Map();
      const startDate=`${startYear}-04-01`;
      const addRowsByMonth=(rows,map)=>{for(const row of rows||[]){if(!row||typeof row.date!=='string'||row.date<startDate||row.date.slice(0,7)>throughKey)continue;const key=row.date.slice(0,7);const total=map.get(key)||{amount:0,count:0};total.amount+=Number(row.amount)||0;total.count++;map.set(key,total);}};
      addRowsByMonth(profileRows(state.income),incomeByMonth);
      addRowsByMonth(state.expenses,expensesByMonth);
      addRowsByMonth(profileRows(state.retirementContributions).map(row=>({...row,amount:row.amount+(Number(row.epsAmount)||0)})),contributionsByMonth);
      const selectedInvestmentIds=new Set(profileRows(state.investments).map(row=>row.id));
      addRowsByMonth((state.investmentContributions||[]).filter(row=>selectedInvestmentIds.has(row.investmentId)),contributionsByMonth);
      const selectedStallionIds=new Set((state.investments||[]).filter(row=>row.type==='Stallion PMS'&&profileRows([row]).length).map(row=>row.id));
      addRowsByMonth((state.stallionContributions||[]).filter(row=>selectedStallionIds.has(row.stallionId)),contributionsByMonth);
      let income=0,expenses=0,contributions=0,incomeMonths=0,expenseMonths=0,contributionMonths=0;
      for(let offset=0;offset<elapsedMonths;offset++) {
        const d=new Date(startYear,3+offset,1),key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        const incomeMonth=incomeByMonth.get(key),expenseMonth=expensesByMonth.get(key),contributionMonth=contributionsByMonth.get(key);
        if(incomeMonth){income+=incomeMonth.amount;incomeMonths++;}
        if(expenseMonth){expenses+=expenseMonth.amount;expenseMonths++;}
        if(contributionMonth){contributions+=contributionMonth.amount;contributionMonths++;}
      }
      const endYear=startYear+1;
      const through=new Date(year,month,1).toLocaleDateString('en-IN',{month:'long'});
      return {startYear,endYear,elapsedMonths,through,incomeMonths,expenseMonths,contributionMonths,incomeTotal:income,expenseTotal:expenses,contributionTotal:contributions,averageIncome:incomeMonths?income/incomeMonths:0,averageExpense:expenseMonths?expenses/expenseMonths:0,averageContribution:contributionMonths?contributions/contributionMonths:0,expenseIncomeRatio:income>0?expenses/income*100:null};
    }
    function renderAnalyticsAverageSnapshot(average) {
      const period=document.getElementById('analyticsAveragePeriod');
      if(!period)return;
      const shortMonth=average.through.slice(0,3);
      period.textContent=`FY ${String(average.startYear).slice(-2)}–${String(average.endYear).slice(-2)} · Apr–${shortMonth}`;
      const setText=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value;};
      const compactAverage=value=>Math.abs(value)>=100000?`₹${(Math.abs(value)/100000).toFixed(2)}L`:formatCurrency(value);
      setText('analyticsAverageIncome',average.incomeMonths?compactAverage(average.averageIncome):formatCurrency(0));
      setText('analyticsAverageExpenses',average.expenseMonths?compactAverage(average.averageExpense):formatCurrency(0));
      setText('analyticsAverageContributions',average.contributionMonths?compactAverage(average.averageContribution):formatCurrency(0));
      setText('analyticsAverageExpenseRatio',average.expenseIncomeRatio===null?'—':`${average.expenseIncomeRatio.toFixed(1)}%`);
      setText('analyticsAverageIncomeCount',average.incomeMonths?`Across ${average.incomeMonths} month${average.incomeMonths===1?'':'s'} with income entries`:'No income entries recorded');
      setText('analyticsAverageExpenseCount',average.expenseMonths?`Across ${average.expenseMonths} month${average.expenseMonths===1?'':'s'} with expense entries`:'No expense entries recorded');
      setText('analyticsAverageContributionCount',average.contributionMonths?`Across ${average.contributionMonths} month${average.contributionMonths===1?'':'s'} with contributions`:'No contribution entries recorded');
      const ratioLabel=document.getElementById('analyticsAverageRatioLabel');
      const ratioFill=document.getElementById('analyticsAverageRatioFill');
      const ratioGraphic=document.getElementById('analyticsAverageRatioGraphic');
      const ratio=average.expenseIncomeRatio;
      if(ratioLabel)ratioLabel.textContent=ratio===null?'No income recorded':`${ratio.toFixed(1)}%`;
      if(ratioFill)ratioFill.style.width=`${Math.max(0,Math.min(100,ratio||0))}%`;
      if(ratioGraphic)ratioGraphic.setAttribute('aria-label',ratio===null?'No recorded income; expense to income ratio is unavailable':`Reported expenses are ${ratio.toFixed(1)} percent of reported income for this financial year`);
      setText('analyticsAverageNote',`Income and expense averages use their respective months with entries. Annual expenses count in full in the month recorded. Contribution average uses months with recorded PF, PPF, NPS, mutual fund / ETF or PMS contributions.`);
    }
    function retirementOutflow(month) {
      return [...state.nps.map(x=>({row:x,kind:'nps'})), ...state.ppf.map(x=>({row:x,kind:'ppf'}))].filter(x => !x.row.date || x.row.date.slice(0,7) <= month).reduce((a,x) => a + retirementMonthlyAmount(x.row,x.kind), 0);
    }
    function monthTotals(month) {
      return {
        income: state.income.filter(x => inMonth(x.date,month)).reduce((a,x)=>a+x.amount,0),
        expenses: state.expenses.filter(x => inMonth(x.date,month)).reduce((a,x)=>a+x.amount,0),
        stallion: state.stallionContributions.filter(x => inMonth(x.date,month)).reduce((a,x)=>a+x.amount,0),
        retirement: retirementOutflow(month)
      };
    }
    function buildMonthlyTotalsIndex() {
      const totals=new Map();
      const addRows=(rows,key)=>{for(const row of rows||[]){const month=typeof row?.date==='string'?row.date.slice(0,7):'';if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))continue;let total=totals.get(month);if(!total){total={income:0,expenses:0,stallion:0,retirement:0};totals.set(month,total);}total[key]+=Number(row.amount)||0;}};
      addRows(state.income,'income');addRows(state.expenses,'expenses');addRows(state.stallionContributions,'stallion');
      for(const row of state.monthlyBalances||[])if(!totals.has(row.month))totals.set(row.month,{income:0,expenses:0,stallion:0,retirement:0});
      for(const month of totals.keys())totals.get(month).retirement=retirementOutflow(month);
      return totals;
    }
    function monthTotalsFromIndex(index,month) { return index.get(month)||{income:0,expenses:0,stallion:0,retirement:0}; }
    function recalculateHouseExpenses() {
      state.monthlyBalances.sort((a,b)=>b.month.localeCompare(a.month));
      const totalsByMonth=new Map();
      const addMonthTotal=(rows,keyName)=>rows.forEach(row=>{const key=row.date?.slice(0,7);if(!key)return;let totals=totalsByMonth.get(key);if(!totals){totals={income:0,expenses:0,stallion:0};totalsByMonth.set(key,totals);}totals[keyName]+=Number(row.amount||0);});
      addMonthTotal(state.income,'income');addMonthTotal(state.expenses,'expenses');addMonthTotal(state.stallionContributions,'stallion');
      const balancesByMonth=new Map(state.monthlyBalances.map(row=>[row.month,row]));
      state.monthlyBalances.forEach(b => {
        const [y,m] = b.month.split('-').map(Number);
        const next = `${m===12?y+1:y}-${String(m===12?1:m+1).padStart(2,'0')}`;
        const n = balancesByMonth.get(next); const t=totalsByMonth.get(b.month)||{income:0,expenses:0,stallion:0};
        b.houseExpense = n ? b.startBalance+t.income-t.expenses-t.stallion-n.startBalance : null;
        b.houseExpenseNextMonth = n ? next : null;
      });
      return totalsByMonth;
    }
    function accrueScheduledRetirementContributions() {
      if(window.financeCloud?.canEdit===false||(typeof dataOperationBusy!=='undefined'&&dataOperationBusy))return false;
      const through=currentMonthKey();
      const target=(Number(through.slice(0,4))*12+Number(through.slice(5,7))-1);
      let changed=false;
      const recordedContributionDates=new Set(state.retirementContributions.filter(row=>row.automatic!==false).map(row=>JSON.stringify([row.investmentType,row.accountId,row.date])));
      for(const [key,accounts] of [['nps',state.nps],['ppf',state.ppf],['pf',state.pf]]) for(const account of accounts) {
        if(!account.contributionsThrough) { account.contributionsThrough=through; changed=true; }
        if(account.autoMonthlyContribution===false)continue;
        const [year,month]=account.contributionsThrough.split('-').map(Number);
        const last=year*12+month-1, count=target-last;
        if(count<=0)continue;
        const eps=key==='pf'?(Number(account.epsMonthly)||0):0;
        const monthly=key==='pf'?(Number(account.employee)||0)+(Number(account.employer)||0)-eps:(Number(account.monthly)||0);
        let added=0,epsAdded=0;
        for(let period=last+1;period<=target;period++) {
          const contributionYear=Math.floor(period/12), contributionMonth=period%12+1;
          const monthKey=`${contributionYear}-${String(contributionMonth).padStart(2,'0')}`;
          if (`${monthKey}-01` < account.date || recordedContributionDates.has(JSON.stringify([key,account.id,`${monthKey}-01`]))) continue;
          if(monthly>0||eps>0) { added+=monthly;epsAdded+=eps; state.retirementContributions.push({
            id:generateId(), investmentType:key, accountId:account.id,
            member:account.member||'', accountName:account.account||account.scheme||key.toUpperCase(),
            amount:monthly, ...(key==='pf'?{epsAmount:eps}:{}), date:`${monthKey}-01`, automatic:true
          }); }
        }
        account.invested=(Number(account.invested??account.current)||0)+added;
        account.current=(Number(account.current)||0)+added;
        if(key==='pf')account.epsCurrent=(Number(account.epsCurrent)||0)+epsAdded;
        account.contributionsThrough=through;
        changed=true;
      }
      if(changed){saveData();renderNps();renderPpf();renderPf();}
      return changed;
    }
    function addMonthsClamped(dateKey,months,dayAnchor=null){
      const [year,month,day]=dateKey.split('-').map(Number),absolute=year*12+(month-1)+months,nextYear=Math.floor(absolute/12),nextMonth=absolute%12+1;
      const lastDay=new Date(Date.UTC(nextYear,nextMonth,0)).getUTCDate(),targetDay=Math.min(dayAnchor||day,lastDay);
      return `${nextYear}-${String(nextMonth).padStart(2,'0')}-${String(targetDay).padStart(2,'0')}`;
    }
    function accrueScheduledInvestmentContributions(){
      if(window.financeCloud?.canEdit===false||(typeof dataOperationBusy!=='undefined'&&dataOperationBusy))return false;
      const today=localDateKey();let changed=false,stallionChanged=false;
      const alreadyRecorded=new Set((state.investmentContributions||[]).filter(row=>row.automatic===true).map(row=>`${row.investmentId}|${row.date}`));
      const alreadyRecordedStallion=new Set((state.stallionContributions||[]).filter(row=>row.automatic===true).map(row=>`${row.stallionId}|${row.date}`));
      for(const investment of state.investments||[]){
        if(investment.autoMonthlyContribution!==true||!(Number(investment.monthly)>0)||!validCalendarDate(investment.monthlyContributionDate||''))continue;
        let due=validCalendarDate(investment.monthlyContributionNextDate||'')?investment.monthlyContributionNextDate:investment.monthlyContributionDate;
        let posted=0,iterations=0;const dayAnchor=Number(investment.monthlyContributionDate.slice(-2));
        while(due<=today&&iterations++<1200){
          const stallion=investment.type==='Stallion PMS',recorded=stallion?alreadyRecordedStallion.has(`${investment.id}|${due}`):alreadyRecorded.has(`${investment.id}|${due}`);
          if(due>=investment.date&&!recorded){
            if(stallion){
              state.stallionContributions.push({id:generateId(),stallionId:investment.id,amount:Number(investment.monthly),date:due,automatic:true});
              alreadyRecordedStallion.add(`${investment.id}|${due}`);
              const pms=state.stallionPms.find(row=>row.id===investment.id);
              investment.invested+=Number(investment.monthly);investment.current+=Number(investment.monthly);
              if(pms){pms.invested=investment.invested;pms.profit=investment.current-investment.invested;}
              stallionChanged=true;
            }else{
              state.investmentContributions.push({id:generateId(),investmentId:investment.id,amount:Number(investment.monthly),date:due,automatic:true});
              alreadyRecorded.add(`${investment.id}|${due}`);investment.invested+=Number(investment.monthly);investment.current+=Number(investment.monthly);
            }
            posted++;changed=true;
          }
          due=addMonthsClamped(due,1,dayAnchor);
        }
        if(investment.monthlyContributionNextDate!==due){investment.monthlyContributionNextDate=due;changed=true;}
      }
      if(changed){saveData();renderInvestments();if(stallionChanged)renderStallionContributions();renderGrowthProjection();}
      return changed;
    }
    function refreshScheduledContributions(){const changed=accrueScheduledRetirementContributions()|accrueScheduledInvestmentContributions();if(changed)updateDashboard();}
    setInterval(()=>{if(storageBackend!=='loading'&&!storageLoadFailed&&!dataOperationBusy)refreshScheduledContributions();}, 60*1000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden&&storageBackend!=='loading'&&!storageLoadFailed&&!dataOperationBusy) refreshScheduledContributions(); });
    const CUSTOM_VALUE_CONFIG = {
      incomeSources: { label: 'Income source', selectIds: ['incomeSource'], usage: [{ collection: 'income', field: 'source' }] },
      expenseCategories: { label: 'Expense category', selectIds: ['expenseCategory'], usage: [{ collection: 'expenses', field: 'category' }] },
      debtTypes: { label: 'Debt type', selectIds: ['debtType'], usage: [{ collection: 'debts', field: 'type' }] },
      investmentTypes: { label: 'Investment type', selectIds: ['investType'], usage: [{ collection: 'investments', field: 'type' }] },
      familyMembers: { label: 'Family member', selectIds: ['incomeMember','expenseMember','pfMember','npsMember','ppfMember','investMember','gratuityMember','debtMember'], usage: ['income','expenses','debts','investments','nps','ppf','pf','stallionPms','stallionContributions','stallionProfitHistory','retirementContributions','investmentContributions','gratuityAccounts'].map(collection=>({ collection, field: 'member' })) }
    };
    const CUSTOM_VALUE_DEFAULT_OPTIONS = Object.fromEntries(Object.entries(CUSTOM_VALUE_CONFIG).map(([key,config])=>[key,Object.fromEntries(config.selectIds.map(id=>{const select=document.getElementById(id);return [id,Array.from(select?.options||[]).map((option,index)=>({option:option.cloneNode(true),index}))]}))]));
    function validateCustomValues(data) {
      if (data.customValues === undefined) data.customValues = {};
      if (!data.customValues || typeof data.customValues !== 'object' || Array.isArray(data.customValues)) throw new Error('customValues must be an object');
      if (data.removedValues === undefined) data.removedValues = {};
      if (!data.removedValues || typeof data.removedValues !== 'object' || Array.isArray(data.removedValues)) throw new Error('removedValues must be an object');
      for (const [key, config] of Object.entries(CUSTOM_VALUE_CONFIG)) {
        if (data.customValues[key] === undefined) data.customValues[key] = [];
        const values = data.customValues[key];
        if (!Array.isArray(values)) throw new Error('customValues.' + key + ' must be an array');
        const selects = config.selectIds.map(id=>document.getElementById(id)).filter(Boolean);
        const builtInSeen = new Set(Object.values(CUSTOM_VALUE_DEFAULT_OPTIONS[key]||{}).flat().map(({option})=>option.value.trim().toLocaleLowerCase()));
        const seen = new Set(key==='familyMembers'?[]:builtInSeen);
        data.customValues[key] = values.map(value => {
          if (typeof value !== 'string') throw new Error('customValues.' + key + ' must contain text values');
          const cleaned = value.trim();
          if (!cleaned || cleaned.length > 60) throw new Error('customValues.' + key + ' contains an empty or overly long value');
          const normalized = cleaned.toLocaleLowerCase();
          if (key === 'familyMembers' && builtInSeen.has(normalized) && Object.values(CUSTOM_VALUE_DEFAULT_OPTIONS[key]||{}).flat().some(({option})=>option.value.trim()===cleaned)) return null;
          if (seen.has(normalized)) throw new Error('customValues.' + key + ' contains a duplicate value');
          seen.add(normalized);
          return cleaned;
        }).filter(value=>value!==null);
        const activeCustomValues=new Set(data.customValues[key].map(value=>value.toLocaleLowerCase()));
        if (data.removedValues[key] === undefined) data.removedValues[key] = [];
        if (!Array.isArray(data.removedValues[key])) throw new Error('removedValues.' + key + ' must be an array');
        const removedSeen=new Set();
        data.removedValues[key]=data.removedValues[key].map(value=>{
          if(typeof value!=='string')throw new Error('removedValues.'+key+' must contain text values');
          const cleaned=value.trim(),normalized=cleaned.toLocaleLowerCase();
          if(!cleaned||cleaned.length>60||removedSeen.has(normalized))throw new Error('removedValues.'+key+' contains an empty, overly long or duplicate value');
          if(activeCustomValues.has(normalized))throw new Error('removedValues.'+key+' conflicts with a custom value');
          removedSeen.add(normalized);return cleaned;
        });
      }
      if(data.customInvestmentProfiles===undefined)data.customInvestmentProfiles={};
      if(!data.customInvestmentProfiles||typeof data.customInvestmentProfiles!=='object'||Array.isArray(data.customInvestmentProfiles))throw new Error('customInvestmentProfiles must be an object');
      const customInvestmentNames=new Set(data.customValues.investmentTypes.map(value=>value.toLocaleLowerCase()));
      for(const [name,profile] of Object.entries(data.customInvestmentProfiles)){
        if(!name.trim()||name.length>60||!customInvestmentNames.has(name.toLocaleLowerCase())||!profile||typeof profile!=='object'||Array.isArray(profile))throw new Error('Invalid custom investment growth profile');
        if(!['market','fixed','no-return'].includes(profile.growthType))throw new Error('Custom investment growth behavior must be Market Linked, Fixed Return, or No Return');
      }
      for(const name of data.customValues.investmentTypes)if(!data.customInvestmentProfiles[name])throw new Error(`Investment type “${name}” needs a Growth Projection mapping`);
    }
    function validateBackupCore(input) {
      if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Backup must be an object');
      if (input.schemaVersion !== undefined && input.schemaVersion !== 2) throw new Error('Unsupported backup version');
      const data = JSON.parse(JSON.stringify(input));
      validateCustomValues(data);
      if(data.firstNameSetup!==undefined&&(!data.firstNameSetup||data.firstNameSetup.completed!==true||typeof data.firstNameSetup.firstName!=='string'||!data.firstNameSetup.firstName.trim()||data.firstNameSetup.firstName.length>60))throw new Error('Invalid first-name setup');
      if (data.stallionProfitHistory === undefined) data.stallionProfitHistory = [];
      if (!Array.isArray(data.stallionProfitHistory)) throw new Error('stallionProfitHistory must be an array');
      if (data.retirementContributions === undefined) data.retirementContributions = [];
      if (!Array.isArray(data.retirementContributions)) throw new Error('retirementContributions must be an array');
      if (data.investmentContributions === undefined) data.investmentContributions = [];
      if (!Array.isArray(data.investmentContributions)) throw new Error('investmentContributions must be an array');
      if (data.projectionSettings === undefined) data.projectionSettings = { years: 5, monthlyContributions: {}, returns: {} };
      if (!data.projectionSettings || typeof data.projectionSettings !== 'object' || Array.isArray(data.projectionSettings)) throw new Error('projectionSettings must be an object');
      if (data.projectionSettings.years === undefined) data.projectionSettings.years = 5;
      if (!Number.isInteger(data.projectionSettings.years) || data.projectionSettings.years<1 || data.projectionSettings.years>10) throw new Error('projectionSettings.years must be a whole number from 1 to 10');
      if (data.projectionSettings.annualStepUpPercentByAsset === undefined) data.projectionSettings.annualStepUpPercentByAsset = {};
      if (!data.projectionSettings.annualStepUpPercentByAsset || typeof data.projectionSettings.annualStepUpPercentByAsset !== 'object' || Array.isArray(data.projectionSettings.annualStepUpPercentByAsset)) throw new Error('projectionSettings.annualStepUpPercentByAsset must be an object');
      if (data.projectionSettings.annualStepUpPercent !== undefined) throw new Error('Use per-asset projection step-up settings in this backup.');
      for(const [asset,rate] of Object.entries(data.projectionSettings.annualStepUpPercentByAsset)) if(!asset.trim()||asset.length>80||typeof rate!=='number'||!Number.isFinite(rate)||rate<0||rate>100) throw new Error('Investment step-up percentages must be between 0 and 100');
      if (data.projectionSettings.includeMonthlyContributions === undefined) data.projectionSettings.includeMonthlyContributions = true;
      if (typeof data.projectionSettings.includeMonthlyContributions !== 'boolean') throw new Error('projectionSettings.includeMonthlyContributions must be true or false');
      if (data.projectionSettings.includeGratuityBalance === undefined) data.projectionSettings.includeGratuityBalance = true;
      if (typeof data.projectionSettings.includeGratuityBalance !== 'boolean') throw new Error('projectionSettings.includeGratuityBalance must be true or false');
      if (data.projectionSettings.excludedMonthlyContributions === undefined) data.projectionSettings.excludedMonthlyContributions = [];
      if (!Array.isArray(data.projectionSettings.excludedMonthlyContributions) || data.projectionSettings.excludedMonthlyContributions.some(name=>typeof name!=='string'||!name.trim()||name.length>80)) throw new Error('projectionSettings.excludedMonthlyContributions must be an array of investment names');
      data.projectionSettings.excludedMonthlyContributions=[...new Set(data.projectionSettings.excludedMonthlyContributions)];
      for (const field of ['monthlyContributions','returns']) {
        if (data.projectionSettings[field] === undefined) data.projectionSettings[field] = {};
        if (!data.projectionSettings[field] || typeof data.projectionSettings[field] !== 'object' || Array.isArray(data.projectionSettings[field])) throw new Error('projectionSettings.'+field+' must be an object');
      }
      for (const [asset,amount] of Object.entries(data.projectionSettings.monthlyContributions)) {
        if (!asset.trim() || asset.length>80 || typeof amount!=='number' || !Number.isFinite(amount) || amount<0) throw new Error('Invalid projected monthly contribution');
      }
      for (const [asset,rates] of Object.entries(data.projectionSettings.returns)) {
        if (!asset.trim() || asset.length>80 || !rates || typeof rates!=='object' || Array.isArray(rates)) throw new Error('Invalid projected return assumptions');
        for (const key of ['stress','base','optimistic']) if (rates[key]!==undefined && (typeof rates[key]!=='number' || !Number.isFinite(rates[key]) || rates[key]<-100 || rates[key]>100)) throw new Error('Projected return assumptions must be between -100% and 100%');
      }
      if (data.projectionAdjustments === undefined) data.projectionAdjustments = [];
      if (!Array.isArray(data.projectionAdjustments)) throw new Error('projectionAdjustments must be an array');
      const required = ['income','expenses','debts','investments'];
      const numeric = {income:['amount'],expenses:['amount'],debts:['principal','remaining','rate','emi'],investments:['invested','current','monthly'],nps:['invested','current','monthly'],ppf:['invested','current','monthly','rate'],pf:['employee','employer','current','rate'],gratuityAccounts:['basicSalary'],stallionPms:['invested'],stallionContributions:['amount'],monthlyBalances:['startBalance']};
      const dateOK = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0,10)===v;
      const projectionAdjustmentIds = new Set();
      for (const row of data.projectionAdjustments) {
        if (!row || typeof row!=='object' || Array.isArray(row) || typeof row.id!=='string' || !/^[a-zA-Z0-9_-]+$/.test(row.id) || projectionAdjustmentIds.has(row.id)) throw new Error('Invalid or duplicate projected change ID');
        projectionAdjustmentIds.add(row.id);
        if (typeof row.category!=='string' || !row.category.trim() || row.category.length>80 || !dateOK(row.date)) throw new Error('Projected change requires a valid investment and date');
        if (!['add','withdraw'].includes(row.type) || typeof row.amount!=='number' || !Number.isFinite(row.amount) || row.amount<=0) throw new Error('Projected change requires a valid type and positive amount');
        if (row.notes===undefined) row.notes='';
        if (typeof row.notes!=='string' || row.notes.length>120) throw new Error('Projected change description is invalid');
      }
      for (const [key,fields] of Object.entries(numeric)) {
        if (data[key] === undefined && !required.includes(key)) data[key]=[];
        if (!Array.isArray(data[key])) throw new Error(key+' must be an array');
        const ids=new Set(); const months=new Set();
        for (const row of data[key]) {
          if (!row || typeof row !== 'object' || Array.isArray(row) || typeof row.id!=='string' || !/^[a-zA-Z0-9_-]+$/.test(row.id) || ids.has(row.id)) throw new Error(key+': invalid or duplicate record ID');
          ids.add(row.id);
          if(['investments','nps'].includes(key)&&row.valuationDate!==undefined&&!dateOK(row.valuationDate))throw new Error(key+': invalid valuation date');
          if (key==='investments' && row.monthly===undefined) row.monthly=0;
          if (key==='investments' && row.autoMonthlyContribution!==undefined && typeof row.autoMonthlyContribution!=='boolean') throw new Error('investments: automatic monthly contribution must be true or false');
          if (key==='investments' && row.monthlyContributionDate!==undefined && row.monthlyContributionDate!=='' && !dateOK(row.monthlyContributionDate)) throw new Error('investments: invalid monthly contribution date');
          if (key==='investments' && row.monthlyContributionNextDate!==undefined && row.monthlyContributionNextDate!=='' && !dateOK(row.monthlyContributionNextDate)) throw new Error('investments: invalid next monthly contribution date');
          if (key==='investments' && row.autoMonthlyContribution===true && (!(row.monthly>0) || !dateOK(row.monthlyContributionDate||'') || !dateOK(row.monthlyContributionNextDate||'') || row.monthlyContributionDate<row.date)) throw new Error('investments: invalid automatic contribution setup');
          if (key==='pf' && row.rate===undefined) row.rate=0;
          if(key==='pf'){
            for(const field of ['epsMonthly','epsCurrent']){if(row[field]===undefined)row[field]=0;if(typeof row[field]!=='number'||!Number.isFinite(row[field])||row[field]<0)throw new Error('PF: invalid '+field);}
            if(row.epsMonthly>row.employer)throw new Error('EPS portion cannot exceed employer contribution');
            if(row.epsBalanceUpdates===undefined)row.epsBalanceUpdates=[];
            if(!Array.isArray(row.epsBalanceUpdates))throw new Error('PF: invalid EPS balance updates');
            const updateIds=new Set();
            for(const update of row.epsBalanceUpdates){if(!update||typeof update.id!=='string'||!/^[a-zA-Z0-9_-]+$/.test(update.id)||updateIds.has(update.id)||!dateOK(update.date)||!Number.isFinite(update.amount)||!Number.isFinite(update.before)||!Number.isFinite(update.after)||update.before<0||update.after<0||Math.abs(update.after-update.before-update.amount)>.011)throw new Error('PF: invalid EPS balance correction');updateIds.add(update.id);}
          }
          if (['pf','ppf','nps'].includes(key) && row.autoMonthlyContribution!==undefined && typeof row.autoMonthlyContribution!=='boolean') throw new Error(key+': automatic monthly contribution must be true or false');
          for (const f of fields) if (typeof row[f]!=='number' || !Number.isFinite(row[f]) || row[f]<0) throw new Error(key+': invalid '+f);
          for (const [f,v] of Object.entries(row)) {
            if (['member','source','notes','type','name','account','scheme','category','subcategory','date','month','stallionId','createdDate','repaymentType'].includes(f) && typeof v !== 'string') throw new Error(key+': invalid text in '+f);
            if (f === 'loanId' && v !== null && typeof v !== 'string') throw new Error(key+': invalid loan reference');
            if (['principalPaid','interestPaid'].includes(f) && (typeof v !== 'number' || !Number.isFinite(v) || v < 0)) throw new Error(key+': invalid '+f);
            if (typeof v==='number' && !Number.isFinite(v)) throw new Error(key+': invalid number');
          }
          if (key==='monthlyBalances') {
            if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(row.month) || months.has(row.month)) throw new Error('Invalid or duplicate balance month');
            months.add(row.month);
          } else if (key!=='stallionPms' && !dateOK(row.date)) throw new Error(key+': invalid date');
          if (key==='expenses' && typeof row.isAnnual!=='boolean') throw new Error('Invalid annual expense flag');
          if (['nps','ppf','pf'].includes(key)) {
            if (row.invested === undefined && key==='pf') row.invested = row.current;
            if (row.invested !== undefined && (typeof row.invested!=='number' || !Number.isFinite(row.invested) || row.invested<0)) throw new Error(key+': invalid invested');
            if (row.contributionsThrough === undefined) row.contributionsThrough = currentMonthKey();
            if (typeof row.contributionsThrough!=='string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(row.contributionsThrough)) throw new Error(key+': invalid contribution month');
          }
          if (key==='investments' && row.rate!==undefined && (typeof row.rate!=='number' || !Number.isFinite(row.rate) || row.rate<0)) throw new Error('investments: invalid interest rate');
          if (key==='debts' && row.emiDueDay!==undefined && (!Number.isInteger(row.emiDueDay) || row.emiDueDay<1 || row.emiDueDay>31)) throw new Error('debts: monthly EMI due day must be a whole day from 1 to 31');
          if(key==='debts')PFT_LOAN_LEDGER.validate(row);
          if (key==='income') delete row.frequency;
          if (key==='investments') delete row.sip;
        }
      }
      const gratuityMembers=new Set();
      for(const account of data.gratuityAccounts){
        if(typeof account.member!=='string'||!account.member.trim()||account.member.length>60)throw new Error('gratuityAccounts: family member is required');
        if(account.basicSalary<=0)throw new Error('gratuityAccounts: basic salary must be greater than zero');
        const memberKey=account.member.trim().toLocaleLowerCase();
        if(gratuityMembers.has(memberKey))throw new Error('gratuityAccounts: only one gratuity record is allowed per family member');
        gratuityMembers.add(memberKey);
      }
      for (const type of ['pf','ppf']) for (const account of data[type]) {
        if (account.interestCredits === undefined) account.interestCredits = [];
        if (!Array.isArray(account.interestCredits)) throw new Error(type+': interestCredits must be an array');
        const years = new Set();
        for (const credit of account.interestCredits) {
          if (!credit || typeof credit !== 'object' || Array.isArray(credit) || !Number.isInteger(credit.financialYearStartYear) || credit.financialYearStartYear < 1900 || credit.financialYearStartYear > 9999) throw new Error(type+': invalid interest financial year');
          if (typeof credit.amount !== 'number' || !Number.isFinite(credit.amount) || credit.amount <= 0) throw new Error(type+': invalid interest amount');
          if (!dateOK(credit.creditedDate)) throw new Error(type+': invalid interest credit date');
          if (years.has(credit.financialYearStartYear)) throw new Error(type+': duplicate interest credit for a financial year');
          years.add(credit.financialYearStartYear);
        }
      }
      const investmentsById=new Map(data.investments.map(row=>[row.id,row]));
      const stallionPortfoliosById=new Map(data.investments.filter(row=>row.type==='Stallion PMS').map(row=>[row.id,row]));
      const stallionContributionTotals=new Map(),stallionAutomaticDates=new Set();
      for (const c of data.stallionContributions) {
        if(c.automatic!==undefined&&typeof c.automatic!=='boolean')throw new Error('stallionContributions: automatic must be true or false');
        if(c.automatic===true){const key=JSON.stringify([c.stallionId,c.date]);if(stallionAutomaticDates.has(key))throw new Error('Duplicate automatic PMS contribution for this portfolio and date');stallionAutomaticDates.add(key);}
        const portfolio=stallionPortfoliosById.get(c.stallionId);
        if(!portfolio)throw new Error('Contribution references missing Stallion portfolio');
        if(c.date<portfolio.date)throw new Error('PMS contribution date precedes the portfolio opening date');
        stallionContributionTotals.set(c.stallionId,(stallionContributionTotals.get(c.stallionId)||0)+c.amount);
      }
      for(const [id,total] of stallionContributionTotals)if(total>stallionPortfoliosById.get(id).invested+0.01)throw new Error('PMS contributions exceed the portfolio invested balance');
      const profitHistoryIds=new Set(),profitHistoryDates=new Set();
      for (const row of data.stallionProfitHistory) {
        if (!row || typeof row!=='object' || Array.isArray(row) || typeof row.id!=='string' || !/^[a-zA-Z0-9_-]+$/.test(row.id) || profitHistoryIds.has(row.id)) throw new Error('stallionProfitHistory: invalid or duplicate record ID');
        profitHistoryIds.add(row.id);
        if (typeof row.stallionId!=='string' || !stallionPortfoliosById.has(row.stallionId)) throw new Error('Profit history references missing Stallion portfolio');
        if (typeof row.profit!=='number' || !Number.isFinite(row.profit)) throw new Error('stallionProfitHistory: invalid profit');
        if (!dateOK(row.date)) throw new Error('stallionProfitHistory: invalid date');
        const snapshotKey=JSON.stringify([row.stallionId,row.date]);
        if(profitHistoryDates.has(snapshotKey))throw new Error('Duplicate PMS profit snapshot for this portfolio and date');
        profitHistoryDates.add(snapshotKey);
      }
      const retirementContributionIds=new Set(), retirementPeriods=new Set(),retirementContributionTotals=new Map();
      const retirementAccountsByKey=new Map(['nps','ppf','pf'].flatMap(type=>data[type].map(account=>[JSON.stringify([type,account.id]),account])));
      for (const row of data.retirementContributions) {
        if (!row || typeof row!=='object' || Array.isArray(row) || typeof row.id!=='string' || !/^[a-zA-Z0-9_-]+$/.test(row.id) || retirementContributionIds.has(row.id)) throw new Error('retirementContributions: invalid or duplicate record ID');
        retirementContributionIds.add(row.id);
        if (!['nps','ppf','pf'].includes(row.investmentType)) throw new Error('retirementContributions: invalid investment type');
        if (typeof row.accountId!=='string' || typeof row.member!=='string' || typeof row.accountName!=='string') throw new Error('retirementContributions: invalid account details');
        const account=retirementAccountsByKey.get(JSON.stringify([row.investmentType,row.accountId]));
        if(!account)throw new Error('Retirement contribution references a missing '+row.investmentType.toUpperCase()+' account');
        if (typeof row.amount!=='number' || !Number.isFinite(row.amount) || row.amount<0) throw new Error('retirementContributions: invalid amount');
        if(row.epsAmount!==undefined&&(row.investmentType!=='pf'||typeof row.epsAmount!=='number'||!Number.isFinite(row.epsAmount)||row.epsAmount<0))throw new Error('Invalid EPS contribution');
        if (!dateOK(row.date) || (row.automatic!==false&&row.date.slice(8,10)!=='01')) throw new Error('retirementContributions: invalid contribution date');
        if(row.date<account.date)throw new Error('Retirement contribution history is inconsistent with the account date or invested balance');
        if(row.automatic!==undefined&&typeof row.automatic!=='boolean')throw new Error('retirementContributions: invalid contribution type');
        if(row.automatic!==false){const periodKey=JSON.stringify([row.investmentType,row.accountId,row.date.slice(0,7)]);if(retirementPeriods.has(periodKey))throw new Error('Duplicate automatic contribution for this account and month');retirementPeriods.add(periodKey);}
        const key=JSON.stringify([row.investmentType,row.accountId]);retirementContributionTotals.set(key,(retirementContributionTotals.get(key)||0)+row.amount);
      }
      for(const type of ['pf','ppf','nps'])for(const account of data[type]){
        if((retirementContributionTotals.get(JSON.stringify([type,account.id]))||0)>account.invested+0.01)throw new Error('Retirement contribution history is inconsistent with the account date or invested balance');
      }
      const investmentContributionIds=new Set(),investmentContributionTotals=new Map(),investmentAutomaticDates=new Set();
      for (const row of data.investmentContributions) {
        if (!row || typeof row!=='object' || Array.isArray(row) || typeof row.id!=='string' || !/^[a-zA-Z0-9_-]+$/.test(row.id) || investmentContributionIds.has(row.id)) throw new Error('investmentContributions: invalid or duplicate record ID');
        investmentContributionIds.add(row.id);
        const account=investmentsById.get(row.investmentId);
        const contributionTypeIsSupported=account&&account.type!=='Stallion PMS';
        if (!contributionTypeIsSupported) throw new Error('Investment contribution must reference a non-PMS holding');
        if (typeof row.amount!=='number' || !Number.isFinite(row.amount) || row.amount<=0) throw new Error('investmentContributions: invalid amount');
        if (!dateOK(row.date) || row.date<account.date) throw new Error('investmentContributions: invalid contribution date');
        if(row.automatic!==undefined&&typeof row.automatic!=='boolean')throw new Error('investmentContributions: invalid contribution type');
        if(row.automatic===true){const key=JSON.stringify([row.investmentId,row.date]);if(investmentAutomaticDates.has(key))throw new Error('Duplicate automatic investment contribution for this holding and date');investmentAutomaticDates.add(key);}
        investmentContributionTotals.set(row.investmentId,(investmentContributionTotals.get(row.investmentId)||0)+row.amount);
      }
      for(const [id,total] of investmentContributionTotals)if(total>investmentsById.get(id).invested+0.01)throw new Error('Dated contributions exceed the invested balance');
      const debtsById=new Map(data.debts.map(row=>[row.id,row])),recordedPrincipalByDebt=new Map(),recordedInterestByDebt=new Map(),paymentsByDebt=new Map();
      for(const d of data.debts)if(d.repaymentBaseEmi!==undefined&&(typeof d.repaymentBaseEmi!=='number'||!Number.isFinite(d.repaymentBaseEmi)||d.repaymentBaseEmi<0))throw new Error('Invalid original loan EMI');
      for (const d of data.debts){PFT_LOAN_LEDGER.validate(d);if(d.loanChanges?.some(e=>e.date>localDateKey()))throw new Error('Future loan changes are not supported');if(!d.dailyInterestBasis&&d.remaining>loanTotalPrincipal(d))throw new Error('Loan balance exceeds total borrowed');}
      for (const e of data.expenses) {
        if (e.loanId && !debtsById.has(e.loanId)) throw new Error('Expense references missing loan');
        if (e.category === 'EMI Payment' && e.loanId) {
          if (typeof e.principalPaid !== 'number' || typeof e.interestPaid !== 'number' || Math.abs(e.principalPaid + e.interestPaid - e.amount) > 0.01) throw new Error('EMI payment requires a valid principal and interest breakdown matching its amount');
          if(e.partPaymentAction!==undefined&&(e.category!=='EMI Payment'||e.repaymentType!=='part-payment'||!['keep','reduce'].includes(e.partPaymentAction)))throw new Error('Invalid part payment choice');
          if (e.repaymentType !== undefined && !['emi','part-payment'].includes(e.repaymentType)) throw new Error('EMI payment type must be Monthly EMI or Part Payment');
          if (e.interestOverride !== undefined && typeof e.interestOverride !== 'boolean') throw new Error('EMI interest override must be true or false');
          if (e.repaymentType === 'part-payment' && (Math.abs(e.principalPaid-e.amount)>0.01 || e.interestPaid!==0)) throw new Error('Part payments must reduce principal only and contain no interest');
        } else if (e.loanId || (e.principalPaid || 0) !== 0 || (e.interestPaid || 0) !== 0 || e.repaymentType!==undefined || e.interestOverride!==undefined || e.partPaymentAction!==undefined) throw new Error('Only linked EMI payments may contain a loan repayment breakdown');
        if(e.loanId){if(!paymentsByDebt.has(e.loanId))paymentsByDebt.set(e.loanId,[]);paymentsByDebt.get(e.loanId).push(e);recordedPrincipalByDebt.set(e.loanId,(recordedPrincipalByDebt.get(e.loanId)||0)+(e.principalPaid||0));recordedInterestByDebt.set(e.loanId,(recordedInterestByDebt.get(e.loanId)||0)+(e.interestPaid||0));}
      }
      for (const d of data.debts) {
        const recordedPrincipal=recordedPrincipalByDebt.get(d.id)||0;
        if (!d.dailyInterestBasis && recordedPrincipal > loanTotalPrincipal(d) - d.remaining + 0.01) throw new Error('Recorded EMI principal exceeds the loan repayment total');
        // Preserve repayments made before this tracker acquired detailed ledger entries.
        if(d.principalPaidBeforeTracking===undefined)d.principalPaidBeforeTracking=Math.round(Math.max(0,loanTotalPrincipal(d)-d.remaining-recordedPrincipal)*100)/100;
        if(d.interestPaidBeforeTracking===undefined)d.interestPaidBeforeTracking=d.dailyInterestBasis?0:Math.round(Math.max(0,(d.interestPaid||0)-(recordedInterestByDebt.get(d.id)||0))*100)/100;
        for(const field of ['principalPaidBeforeTracking','interestPaidBeforeTracking'])if(typeof d[field]!=='number'||!Number.isFinite(d[field])||d[field]<0)throw new Error('Invalid pre-tracker loan repayment balance');
        if(!d.dailyInterestBasis&&Math.abs(d.principalPaidBeforeTracking+recordedPrincipal-(loanTotalPrincipal(d)-d.remaining))>0.011)throw new Error('Loan opening repayments and recorded principal do not match the outstanding balance');
      }
      for(const d of data.debts)if(Array.isArray(d.loanChanges)||d.firstEmiDate!==undefined||d.firstEmiExtraInterest!==undefined||d.firstEmiInterestMethod!==undefined||d.dailyInterestBasis===true){
        const rows=paymentsByDebt.get(d.id)||[],rowsById=new Map(rows.map(row=>[row.id,row])),fields=['remaining','rate','emi','interestPaid'];
        const today=localDateKey(),asOf=d.dailyInterestBasis===true?(d.dailyBalanceAsOf||today):today;
        if(d.dailyInterestBasis===true&&(!validCalendarDate(asOf)||asOf>today||asOf<d.date||rows.some(row=>row.date>asOf)||(d.loanChanges||[]).some(row=>row.date>asOf)))throw new Error('Invalid daily loan balance date');
        const result=PFT_LOAN_LEDGER.rebuild(d,rows,undefined,asOf);
        if(result.error)throw new Error(result.error);
        for(const field of fields)if(Math.abs((d[field]||0)-result[field])>.011)throw new Error('Loan history does not match '+field);
        for(const split of result.payments){const row=rowsById.get(split.id);if(!row||Math.abs(row.principalPaid-split.principalPaid)>.011||Math.abs(row.interestPaid-split.interestPaid)>.011)throw new Error('Loan payment split does not match dated history');}
        if(d.dailyInterestBasis===true){
          const current=asOf===today?result:PFT_LOAN_LEDGER.rebuild(d,rows,undefined,today);
          if(current.error)throw new Error(current.error);
          Object.assign(d,{remaining:current.remaining,rate:current.rate,emi:current.emi,interestPaid:current.interestPaid,dailyBalanceAsOf:today});
        }

      }
      PFT_RECURRING.validate(data);
      data.schemaVersion=2;
      return data;
    }


    // State Management
    function familyMutationControl(element){
      const id=element.id||'',handler=element.getAttribute?.('onclick')||'';
      return /^(add|save|update|edit|delete|clear|remove|restore|archive|correctStatement|openImport|toggleBalanceForm)/i.test(id)||/^\s*(add|save|update|edit|delete|remove|restore|archive|record|correct|openInvestmentEntry|openAccountUpdate|openInvestmentEdit)/i.test(handler);
    }
    function familyOwnerControl(element){return ['openImportBtn','importBtn','clearBtn','clearBackupBtn','restoreRecoveryBtn'].includes(element.id);}
    function applyFamilyRoleControls(){
      if(!window.financeCloud||window.financeCloud.canEdit!==false&&window.financeCloud.canManage!==false)return;
      document.querySelectorAll('.container button,.container input[type="file"]').forEach(element=>{
        if((window.financeCloud.canEdit===false&&familyMutationControl(element))||(window.financeCloud.canManage===false&&familyOwnerControl(element))){element.disabled=true;element.title=familyOwnerControl(element)?'Only the owner can use this action':'Viewer access: read only';}
      });
    }
    document.addEventListener('click',event=>{
      const control=event.target.closest('button,input[type="file"]');if(!control)return;
      if((window.financeCloud?.canEdit===false&&familyMutationControl(control))||(window.financeCloud?.canManage===false&&familyOwnerControl(control))){event.preventDefault();event.stopImmediatePropagation();}
    },true);
    document.addEventListener('submit',event=>{if(window.financeCloud?.canEdit===false&&event.target.id!=='familyInviteForm'){event.preventDefault();event.stopImmediatePropagation();}},true);
    document.addEventListener('change',event=>{if(window.financeCloud?.canManage===false&&event.target.id==='importBtn'){event.preventDefault();event.stopImmediatePropagation();event.target.value='';}},true);
    if(typeof MutationObserver!=='undefined')new MutationObserver(applyFamilyRoleControls).observe(document.querySelector('.container'),{childList:true,subtree:true});
    let settingsTileTrigger=null;
    function closeSettingsTile(force=false){
      const dialog=document.getElementById('settingsTileDialog');if(!dialog?.open||(dialog.dataset.deleting==='true'&&force!==true))return;
      document.querySelectorAll('.family-detail-dialog[open]').forEach(inner=>inner.close());
      dialog.close();
    }
    window.closeSettingsTile=closeSettingsTile;
    function openSettingsTile(panelId,trigger){
      const dialog=document.getElementById('settingsTileDialog'),panel=document.getElementById(panelId);if(!dialog||!panel)return;
      document.getElementById('settingsPanelParking').append(...document.getElementById('settingsTileContent').children);
      document.getElementById('settingsTileContent').append(panel);
      document.getElementById('settingsTileTitle').textContent=trigger.querySelector('strong').textContent;
      settingsTileTrigger=trigger;document.body.classList.add('settings-tile-open');dialog.showModal();
      document.getElementById('settingsTileClose').focus();applyFamilyRoleControls();updateClearControls();
    }
    function normalizeAppInfo(){
      const raw=window.PFT_APP_INFO,info=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
      const sections=Array.isArray(info.sections)?info.sections.filter(row=>Array.isArray(row)&&row.length>=2&&typeof row[0]==='string'&&typeof row[1]==='string'):[];
      window.PFT_APP_INFO={...info,version:typeof info.version==='string'?info.version:'2026.10.24.28',released:typeof info.released==='string'?info.released:'2026-10-24',releaseNotes:Array.isArray(info.releaseNotes)?info.releaseNotes.filter(note=>typeof note==='string'):[],sections:sections.length?sections:[['App info temporarily unavailable','The tracker can still be used. Reload when connected to restore the full features and calculation guide.']]};
    }
    function setupSettingsTiles(){
      normalizeAppInfo();
      const settings=document.getElementById('settings'),layout=settings.querySelector('.settings-layout');
      const grid=document.createElement('div');grid.id='settingsQuickTiles';grid.setAttribute('aria-label','Settings sections');
      const parking=document.createElement('div');parking.id='settingsPanelParking';parking.hidden=true;
      const accountPanel=document.createElement('section');accountPanel.id='settingsAccountPanel';accountPanel.className='panel settings-panel';
      accountPanel.innerHTML='<h2>Account</h2><p>Signed in as <strong id="accountSignedInEmail"></strong></p>';
      accountPanel.append(document.getElementById('cloudSignOut'),document.getElementById('clearTrackerSection'));
      parking.append(accountPanel);
      const infoPanel=document.createElement('section');infoPanel.id='settingsInfoPanel';infoPanel.className='panel settings-panel';
      infoPanel.innerHTML='<h2>App info</h2><p>Your family finance tracker: features and calculation guide.</p><button type="button" id="downloadAppInfoPdf">Download PDF</button><p id="appInfoPdfStatus" role="status"></p>';
      for(const [title,body] of window.PFT_APP_INFO.sections){const heading=document.createElement('h3'),text=document.createElement('p');heading.textContent=title;text.textContent=body;infoPanel.append(heading,text);}
      parking.append(infoPanel);
      infoPanel.querySelector('#downloadAppInfoPdf').addEventListener('click',async()=>{const button=infoPanel.querySelector('#downloadAppInfoPdf');button.disabled=true;document.getElementById('appInfoPdfStatus').textContent='Preparing PDF…';try{await window.downloadTrackerGuide();document.getElementById('appInfoPdfStatus').textContent='PDF downloaded.';}catch(error){document.getElementById('appInfoPdfStatus').textContent=error.message;}finally{button.disabled=false;}});
      const tiles=[
        ['settingsInfoPanel','App info','Features, calculations and PDF guide','<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>'],
        ['settingsAccountPanel','Account','Profile details, security and account deletion','<circle cx="12" cy="8" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/>'],
        ['familyAccessPanel','Family access','Invite members and manage permissions','<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 5"/>'],
        ['settingsAppearancePanel','Appearance','Choose colors and display preferences','<path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1-3.7 1.5 1.5 0 0 1 1-2.8h2a4 4 0 0 0 4-4C21 6 17 3 12 3Z"/><path d="M7 10h.01M10 6h.01M15 6h.01M18 10h.01"/>'],
        ['settingsBackupPanel','Data & backup','Export, import and recovery tools','<path d="M5 4h14v16H5zM8 8h8M8 12h5M12 15v6m-3-3 3 3 3-3"/>'],
        ['settingsAppPanel','App & updates','Version '+window.PFT_APP_INFO.version+' · Updates and release notes','<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 18h4M9 9l3-3 3 3m-3-3v8"/>'],

      ];
      settings.querySelector('.settings-appearance-panel').id='settingsAppearancePanel';settings.querySelector('.settings-data-panel').id='settingsBackupPanel';settings.querySelector('[aria-labelledby="pwaTitle"]').id='settingsAppPanel';settings.querySelector('.record-tools-panel').id='settingsRecordsPanel';
      const recordsDetails=document.createElement('details');recordsDetails.id='backupRecordsChecks';
      recordsDetails.innerHTML='<summary>Records &amp; checks</summary>';
      recordsDetails.append(document.getElementById('settingsRecordsPanel'));
      document.getElementById('settingsBackupPanel').append(recordsDetails);
      const appPanel=document.getElementById('settingsAppPanel'),versionInfo=document.createElement('div');
      versionInfo.className='app-version-section';
      versionInfo.innerHTML='<p class="app-installed-version"><span>Installed version</span><strong id="appInstalledVersion"></strong></p><p id="appLatestVersion" role="status">Latest available: checking when online</p><details id="appReleaseNotes"><summary>Release notes</summary><p>Released '+window.PFT_APP_INFO.released+'</p><ul></ul></details>';
      versionInfo.querySelector('#appInstalledVersion').textContent=window.PFT_APP_INFO.version;
      for(const note of window.PFT_APP_INFO.releaseNotes){const item=document.createElement('li');item.textContent=note;versionInfo.querySelector('ul').append(item);}appPanel.prepend(versionInfo);
      fetch('./version.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(meta=>{document.getElementById('appLatestVersion').textContent='Latest available: '+meta.version+(meta.version!==window.PFT_APP_INFO.version?' · Check for updates to install':' · Up to date');}).catch(()=>{document.getElementById('appLatestVersion').textContent='Latest available: connect to check. Installed version '+window.PFT_APP_INFO.version;});
      for(const [id,title,description,svg] of tiles){
        const tile=document.createElement('button');tile.type='button';tile.className='settings-quick-tile';tile.setAttribute('aria-haspopup','dialog');tile.setAttribute('aria-controls','settingsTileDialog');
        tile.innerHTML=`<span class="settings-tile-icon" aria-hidden="true"><svg viewBox="0 0 24 24">${svg}</svg></span><span class="settings-tile-copy"><strong>${title}</strong><small>${description}</small></span><span class="settings-tile-arrow" aria-hidden="true">›</span>`;
        tile.addEventListener('click',()=>openSettingsTile(id,tile));grid.append(tile);parking.append(document.getElementById(id));
      }
      layout.prepend(grid);settings.append(parking);
      const dialog=document.createElement('dialog');dialog.id='settingsTileDialog';dialog.setAttribute('aria-labelledby','settingsTileTitle');dialog.innerHTML='<header class="settings-modal-heading"><h2 id="settingsTileTitle"></h2><button id="settingsTileClose" type="button" aria-label="Close settings section">×</button></header><div id="settingsTileContent"></div>';settings.append(dialog);
      document.getElementById('settingsTileClose').addEventListener('click',closeSettingsTile);
      dialog.addEventListener('cancel',event=>{if(dialog.dataset.deleting==='true')event.preventDefault();});
      dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeSettingsTile();}});
      dialog.addEventListener('close',()=>{const clearPhrase=document.getElementById('clearTrackerPhrase');if(clearPhrase){clearPhrase.value='';updateClearControls();}parking.append(...document.getElementById('settingsTileContent').children);document.body.classList.remove('settings-tile-open');settingsTileTrigger?.focus();settingsTileTrigger=null;});
    }
    function setupFamilyDetailTiles(){
      const panel=document.getElementById('familyAccessPanel');
      panel.addEventListener('click',event=>{
        const close=event.target.closest('[data-close-family-dialog]');if(close){close.closest('dialog').close();return;}
        const tile=event.target.closest('[data-family-dialog]');if(!tile)return;
        if(tile.dataset.familyOwner==='true'&&window.financeCloud?.canManage!==true)return;
        const dialog=document.getElementById(tile.dataset.familyDialog);if(!dialog)return;
        const status=document.getElementById('familyAccessStatus');dialog.append(status);dialog.showModal();applyFamilyRoleControls();
      });
      panel.querySelectorAll('.family-detail-dialog').forEach(dialog=>{
        dialog.addEventListener('close',()=>{panel.append(document.getElementById('familyAccessStatus'));panel.querySelector('[data-family-dialog="'+dialog.id+'"]')?.focus();});
        dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();});
      });
      document.getElementById('settingsTileDialog').addEventListener('close',()=>panel.querySelectorAll('.family-detail-dialog[open]').forEach(dialog=>dialog.close()));
    }
    function firstNameSetupNeeded(data,members) {
      return !data.firstNameSetup?.completed && !members.some(name=>String(name).trim());
    }
    function withFirstNameSetup(data,value,builtInMembers=[]) {
      const firstName=String(value||'').trim().replace(/\s+/g,' ');
      if(!firstName||firstName.length>60||/[<>\x00-\x1f\x7f]/.test(firstName))throw new Error('Enter your first name (up to 60 characters).');
      const next=JSON.parse(JSON.stringify(data)),key=firstName.toLocaleLowerCase();
      next.customValues=next.customValues||{};
      const members=next.customValues.familyMembers=next.customValues.familyMembers||[];
      next.removedValues=next.removedValues||{};
      next.removedValues.familyMembers=(next.removedValues.familyMembers||[]).filter(name=>name.trim().toLocaleLowerCase()!==key);
      if(!members.concat(builtInMembers).some(name=>name.trim().toLocaleLowerCase()===key))members.push(firstName);
      next.firstNameSetup={completed:true,firstName};
      return next;
    }
    async function setupFirstName() {
      if(window.financeCloud?.role&&window.financeCloud.role!=='owner')return;
      if(!firstNameSetupNeeded(state,profileMemberNames()))return;
      const dialog=document.getElementById('firstNameSetup'),form=document.getElementById('firstNameSetupForm'),input=document.getElementById('firstNameInput'),button=document.getElementById('firstNameContinue'),error=document.getElementById('firstNameError');
      input.value=(window.financeCloud?.displayName||'').trim().split(/\s+/)[0]||'';
      dialog.hidden=false;document.querySelector('.container').inert=true;input.focus();
      await new Promise(resolve=>{form.onsubmit=async event=>{
        event.preventDefault();if(button.disabled)return;error.textContent='';
        try{
          const builtIns=Object.values(CUSTOM_VALUE_DEFAULT_OPTIONS.familyMembers||{}).flat().map(item=>item.option.value);
          state=withFirstNameSetup(state,input.value,builtIns);
          button.disabled=true;button.textContent='Saving…';
          if(!await saveData('Completed first-name setup'))throw new Error('Could not save your name on this device. Please try again.');
          populateCustomValueSelects();renderCustomValuesPanel();initializeFamilyProfile();
          form.onsubmit=null;dialog.hidden=true;document.querySelector('.container').inert=false;resolve();
        }catch(e){error.textContent=e.message;button.disabled=false;button.textContent='Continue';input.focus();}
      };});
    }
    function createEmptyState() { return {
      recurringRules: [],
      recurringOccurrences: [],
      archivedAccounts: [],
      reconciliations: [],
      debts: [],
      income: [],
      expenses: [],
      investments: [],
      nps: [],
      ppf: [],
      pf: [],
      gratuityAccounts: [],
      stallionPms: [],
      stallionContributions: [],
      stallionProfitHistory: [],
      retirementContributions: [],
      investmentContributions: [],
      projectionSettings: { years: 5, includeMonthlyContributions: true, includeGratuityBalance: true, annualStepUpPercentByAsset: {}, excludedMonthlyContributions: [], monthlyContributions: {}, returns: {} },
      projectionAdjustments: [],
      monthlyBalances: [],
      customValues: { incomeSources: [], expenseCategories: [], debtTypes: [], investmentTypes: [], familyMembers: [] },
      customInvestmentProfiles: {},
      removedValues: { incomeSources: [], expenseCategories: [], debtTypes: [], investmentTypes: [], familyMembers: [] },
      lastUpdate: new Date().toLocaleString()
    }; }
    let state = createEmptyState();

    function populateCustomValueSelects() {
      if (!state.customValues) state.customValues = { incomeSources: [], expenseCategories: [], debtTypes: [], investmentTypes: [], familyMembers: [] };
      if (!state.removedValues) state.removedValues = { incomeSources: [], expenseCategories: [], debtTypes: [], investmentTypes: [], familyMembers: [] };
      if (!state.customInvestmentProfiles) state.customInvestmentProfiles = {};
      for (const [key, config] of Object.entries(CUSTOM_VALUE_CONFIG)) {
        const removed=new Set((state.removedValues[key]||[]).map(value=>value.toLocaleLowerCase()));
        for(const id of config.selectIds) {
          const select=document.getElementById(id);if(!select)continue;
          const selected=select.value;
          select.querySelectorAll('option[data-inline-add]').forEach(option=>option.remove());
          select.querySelectorAll('option[data-shared-family-member="true"]').forEach(option=>option.remove());
          select.querySelectorAll('option[data-custom-value="true"]').forEach(option=>option.remove());
          (CUSTOM_VALUE_DEFAULT_OPTIONS[key]?.[id]||[]).forEach(({option,index})=>{
            if(removed.has(option.value.trim().toLocaleLowerCase()))return;
            const exists=Array.from(select.options).some(current=>current.value.trim().toLocaleLowerCase()===option.value.trim().toLocaleLowerCase());
            if(!exists)select.insertBefore(option.cloneNode(true),select.options[index]||null);
          });
          Array.from(select.options).filter(option=>removed.has(option.value.trim().toLocaleLowerCase())).forEach(option=>option.remove());
          (state.customValues[key]||[]).forEach(value=>{
            const exists=Array.from(select.options).some(option=>option.value.trim().toLocaleLowerCase()===value.toLocaleLowerCase());
            if(!exists){const option=new Option(value,value);option.dataset.customValue='true';select.appendChild(option);}
          });
          if(Array.from(select.options).some(option=>option.value===selected))select.value=selected;
        }
      }
      const generalInvestmentTypeSelect=document.getElementById('investType');
      if(generalInvestmentTypeSelect){const retirementTypes=new Set(['PF','PPF','NPS','GRATUITY']);Array.from(generalInvestmentTypeSelect.options).filter(option=>retirementTypes.has(option.value.trim().toLocaleUpperCase())).forEach(option=>option.remove());}
      for(const [key,config] of Object.entries(CUSTOM_VALUE_CONFIG))if(key!=='familyMembers')for(const id of config.selectIds)wireInlineCustomSelect(document.getElementById(id),key);
      const familyConfig=CUSTOM_VALUE_CONFIG.familyMembers;
      const familyValues=getAvailableCustomValueOptions('familyMembers').map(option=>option.value);
      for(const id of familyConfig.selectIds){
        const select=document.getElementById(id);if(!select)continue;
        const existing=new Set(Array.from(select.options,option=>option.value.trim().toLocaleLowerCase()));
        familyValues.forEach(value=>{
          const normalized=value.trim().toLocaleLowerCase();
          if(!existing.has(normalized)){
            const option=new Option(value,value);option.dataset.sharedFamilyMember='true';select.appendChild(option);existing.add(normalized);
          }
        });
      }
      const canonicalNames=new Map((state.customValues.familyMembers||[]).map(name=>[name.trim().toLocaleLowerCase(),name]));
      for(const id of familyConfig.selectIds){const select=document.getElementById(id);if(!select)continue;for(const option of select.options){const canonical=canonicalNames.get(option.value.trim().toLocaleLowerCase());if(canonical){option.value=canonical;option.textContent=canonical;}}}
      syncEntryMemberFields();
    }
    function getAvailableCustomValueOptions(key){
      const config=CUSTOM_VALUE_CONFIG[key];if(!config)return[];
      const removed=new Set((state.removedValues?.[key]||[]).map(value=>value.trim().toLocaleLowerCase()));
      const seen=new Set(),values=[];
      for(const id of config.selectIds){
        const select=document.getElementById(id);if(!select)continue;
        for(const option of select.options){
          const value=option.value.trim(),normalized=value.toLocaleLowerCase();
          if(option.dataset.inlineAdd||!value||value.startsWith('--')||removed.has(normalized)||seen.has(normalized))continue;
          seen.add(normalized);values.push(option);
        }
      }
      return values;
    }
    const INLINE_ADD_VALUE='__pft_add_new_value__';
    function wireInlineCustomSelect(select,key){
      if(!select||key==='familyMembers')return;
      select.querySelectorAll('option[data-inline-add]').forEach(option=>option.remove());
      const add=new Option('+ Add new…',INLINE_ADD_VALUE);add.dataset.inlineAdd='true';select.append(add);select.dataset.customValueKey=key;
      if(select.value!==INLINE_ADD_VALUE)select.dataset.previousCustomValue=select.value;
    }
    function setupInlineCustomValues(){
      const dialog=document.createElement('dialog');dialog.id='inlineValueDialog';dialog.setAttribute('aria-labelledby','inlineValueTitle');
      dialog.innerHTML='<form id="inlineValueForm"><h2 id="inlineValueTitle">Add new value</h2><label for="inlineValueName">Name</label><input id="inlineValueName" required maxlength="60"><div id="inlineGrowthGroup"><label for="inlineGrowthType">Growth calculation</label><select id="inlineGrowthType"><option value="">Choose calculation</option><option value="market">Market linked</option><option value="fixed">Fixed return</option><option value="no-return">No return</option></select></div><p id="inlineValueError" role="alert"></p><div class="record-editor-actions"><button type="button" id="inlineValueCancel">Cancel</button><button type="submit" id="inlineValueSave">Save and select</button></div></form>';
      document.body.append(dialog);let target,key,saving=false;
      const input=dialog.querySelector('input'),growth=dialog.querySelector('select'),error=dialog.querySelector('[role="alert"]');
      const close=()=>{if(saving)return;dialog.close();target?.focus();};
      dialog.querySelector('#inlineValueCancel').onclick=close;dialog.oncancel=e=>{e.preventDefault();close();};
      document.addEventListener('change',event=>{
        const select=event.target;if(!select.matches('select[data-custom-value-key]'))return;
        if(select.value!==INLINE_ADD_VALUE){select.dataset.previousCustomValue=select.value;return;}
        event.stopImmediatePropagation();select.value=select.dataset.previousCustomValue||[...select.options].find(o=>!o.dataset.inlineAdd)?.value||'';
        if(window.financeCloud?.canEdit===false)return;
        target=select;key=select.dataset.customValueKey;input.value='';growth.value='';error.textContent='';dialog.querySelector('#inlineValueTitle').textContent='Add '+CUSTOM_VALUE_CONFIG[key].label.toLowerCase();dialog.querySelector('#inlineGrowthGroup').hidden=key!=='investmentTypes';growth.required=key==='investmentTypes';dialog.showModal();input.focus();
      },true);
      dialog.querySelector('form').onsubmit=async event=>{
        event.preventDefault();if(saving||window.financeCloud?.canEdit===false||!event.target.reportValidity())return;
        const value=input.value.trim(),normalized=value.toLocaleLowerCase();
        if(!value||value.length>60){error.textContent='Enter a name using 1 to 60 characters.';return;}
        const values=getAvailableCustomValueOptions(key);if(values.some(o=>o.value.toLocaleLowerCase()===normalized)){error.textContent='That value already exists.';return;}
        if(key==='investmentTypes'&&!['market','fixed','no-return'].includes(growth.value)){error.textContent='Choose a growth calculation.';return;}
        saving=true;dialog.querySelector('#inlineValueSave').disabled=true;
        try{
          state.customValues[key]??=[];state.removedValues[key]??=[];state.removedValues[key]=state.removedValues[key].filter(v=>v.toLocaleLowerCase()!==normalized);
          if(!state.customValues[key].some(v=>v.toLocaleLowerCase()===normalized))state.customValues[key].push(value);
          if(key==='investmentTypes')state.customInvestmentProfiles[value]={growthType:growth.value};
          if(!await saveData('Added '+CUSTOM_VALUE_CONFIG[key].label.toLowerCase()))throw Error('Could not save this value. Please retry.');
          populateCustomValueSelects();
          if(target.isConnected){if(![...target.options].some(o=>o.value===value))target.add(new Option(value,value));target.value=value;target.dataset.previousCustomValue=value;target.dispatchEvent(new Event('change',{bubbles:true}));}
          dialog.close();target?.focus();
        }catch(e){error.textContent=e.message;}finally{saving=false;dialog.querySelector('#inlineValueSave').disabled=false;}
      };
    }
    let recurringUI;
    function startRecurringItems(){
      recurringUI=initializeRecurringUI({get:()=>state,today:localDateKey,id:generateId,escape:analyticEscape,currency:formatCurrency,edit:openRecordEditor,preferredMember:preferredEntryMember,source:incomeSourceForStorage,subcategories:EXPENSE_SUBCATEGORY_OPTIONS,wire:wireInlineCustomSelect,
        ready:()=>!storageLoadFailed&&!dataOperationBusy&&storageBackend!=='loading',
        commit:async(next,action)=>{if(window.financeCloud?.canEdit===false||dataOperationBusy)return false;state=validateBackup(next);const saved=await saveData(action);if(saved)refreshAllPageViews();return saved;}
      });
    }

    let activeFamilyProfile='__combined__';
    const FAMILY_PROFILE_STORAGE_KEY='personalFinanceActiveProfile';
    const isCombinedFamilyProfile=()=>activeFamilyProfile==='__combined__';
    function profileRows(rows,options={}){
      const list=Array.isArray(rows)?rows:[];
      if(isCombinedFamilyProfile()||options.household===true)return list;
      return list.filter(row=>String(options.memberOf?options.memberOf(row)||'':row?.member||'').trim()===activeFamilyProfile);
    }
    function profileMemberNames(){return getAvailableCustomValueOptions('familyMembers').map(option=>option.value).filter(Boolean);}
    function preferredEntryMember(names=profileMemberNames()){
      if(names.length===1)return names[0];
      const identity=String(window.financeCloud?.displayName||'').trim().toLocaleLowerCase();
      if(!identity)return '';
      const exact=names.filter(name=>name.trim().toLocaleLowerCase()===identity);
      if(exact.length===1)return exact[0];
      const first=identity.split(/\s+/)[0];
      const matches=names.filter(name=>name.trim().toLocaleLowerCase().split(/\s+/)[0]===first);
      return matches.length===1?matches[0]:'';
    }
    function syncEntryMemberFields(){
      const names=profileMemberNames(),sole=names.length===1?names[0]:'';
      for(const id of CUSTOM_VALUE_CONFIG.familyMembers.selectIds){
        const select=document.getElementById(id);if(!select)continue;
        if(sole)select.value=sole;
        else if(select.dataset.memberDefaultApplied!=='true'){
          const preferred=preferredEntryMember(names);if(preferred)select.value=preferred;
        }
        select.dataset.memberDefaultApplied='true';
        const group=select.closest('.form-group');if(group)group.hidden=!!sole;
      }
    }
    // Native form.reset() can reset a hidden select to its blank placeholder.
    document.addEventListener('submit',event=>{
      if(profileMemberNames().length!==1)return;
      for(const id of CUSTOM_VALUE_CONFIG.familyMembers.selectIds){
        const select=document.getElementById(id);
        if(select&&event.target.contains(select))select.value=profileMemberNames()[0];
      }
    },true);
    function profileLabel(){return isCombinedFamilyProfile()?'Combined household':activeFamilyProfile;}
    function profileStatusText(){return isCombinedFamilyProfile()?'All family members':`${activeFamilyProfile} · personal records`}
    const HOUSEHOLD_PROFILE_ICON='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><circle cx="18" cy="9" r="2.5"/><path d="M2 21v-2a7 7 0 0 1 14 0v2zm15 0v-2a9 9 0 0 0-1.6-5.1A5 5 0 0 1 23 18v3z"/></svg>';
    const PERSONAL_PROFILE_ICON='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0z"/></svg>';
    function syncFamilyProfileButtons(){
      const multiple=profileMemberNames().length>1;
      if(!multiple){activeFamilyProfile='__combined__';const menu=document.getElementById('familyProfileMenu');if(menu)menu.hidden=true;try{trackerStorage.setItem(FAMILY_PROFILE_STORAGE_KEY,activeFamilyProfile);}catch(error){}}

      document.querySelectorAll('[data-family-profile-trigger]').forEach(button=>{button.dataset.householdIcon=HOUSEHOLD_PROFILE_ICON;button.dataset.personalIcon=PERSONAL_PROFILE_ICON;
        button.dataset.familyProfileView=multiple&&isCombinedFamilyProfile()?'combined':'personal';
        if(!button.classList.contains('has-account-photo'))button.innerHTML=button.dataset.familyProfileView==='combined'?HOUSEHOLD_PROFILE_ICON:PERSONAL_PROFILE_ICON;
        button.disabled=!multiple;button.style.cursor=multiple?'pointer':'default';button.setAttribute('aria-haspopup',String(multiple));button.setAttribute('aria-expanded',String(multiple&&!document.getElementById('familyProfileMenu')?.hidden));button.setAttribute('aria-label',multiple?`Choose family profile. Current: ${profileLabel()}`:`Profile: ${profileMemberNames()[0]||'Your account'}`);button.title=`Profile: ${profileLabel()}`;});
      window.dispatchEvent(new Event('pft-profile-view-change'));
      const sidebarLabel=document.getElementById('familyProfileSidebarLabel');if(sidebarLabel){const combined=isCombinedFamilyProfile();sidebarLabel.hidden=combined;sidebarLabel.textContent=combined?'':activeFamilyProfile;}
      const context=document.querySelector('.advanced-header-context span');if(context)context.textContent=isCombinedFamilyProfile()?'Personal Finance Tracker':'Personal Finance Tracker · '+activeFamilyProfile+' · personal view; expenses remain household-wide';
    }
    function renderFamilyProfileMenu(){
      const menu=document.getElementById('familyProfileMenu');if(!menu)return;
      const options=[{value:'__combined__',label:'Combined household',hint:'All family members'},...profileMemberNames().map(name=>({value:name,label:name,hint:'Personal records'}))];
      menu.innerHTML=`<div class="family-profile-menu-title">View profile</div>${options.map(option=>`<button type="button" class="family-profile-option" role="option" aria-selected="${activeFamilyProfile===option.value}" data-family-profile="${analyticEscape(option.value)}"><span class="family-profile-avatar" aria-hidden="true">${option.value==='__combined__'?HOUSEHOLD_PROFILE_ICON:PERSONAL_PROFILE_ICON}</span><span><span class="family-profile-option-name">${analyticEscape(option.label)}</span><small style="display:block;color:var(--text-light);font-size:9px;margin-top:2px">${analyticEscape(option.hint)}</small></span><span class="family-profile-check" aria-hidden="true">${activeFamilyProfile===option.value?'✓':''}</span></button>`).join('')}${options.length===1?'<div class="family-profile-empty">Add family members in Settings → Add a custom value to create individual profiles.</div>':''}`;
    }
    function positionFamilyProfileMenu(trigger){
      const menu=document.getElementById('familyProfileMenu'),rect=trigger.getBoundingClientRect();if(!menu)return;
      menu.hidden=false;menu.style.visibility='hidden';
      const width=menu.offsetWidth,height=menu.offsetHeight;
      let left=window.innerWidth<=700?rect.right-width:Math.min(rect.left,window.innerWidth-width-12);
      let top=window.innerWidth<=700?rect.bottom+8:Math.min(rect.bottom+8,window.innerHeight-height-12);
      left=Math.max(12,Math.min(left,window.innerWidth-width-12));top=Math.max(12,Math.min(top,window.innerHeight-height-12));
      menu.style.left=`${left}px`;menu.style.top=`${top}px`;menu.style.visibility='';
    }
    function toggleFamilyProfileMenu(trigger){
      if(profileMemberNames().length<2)return;
      const menu=document.getElementById('familyProfileMenu');if(!menu)return;
      if(!menu.hidden){menu.hidden=true;syncFamilyProfileButtons();return;}
      renderFamilyProfileMenu();positionFamilyProfileMenu(trigger);syncFamilyProfileButtons();
    }
    function applyFamilyProfile(value){
      const next=value==='__combined__'?'__combined__':profileMemberNames().find(name=>name===value);
      if(!next){activeFamilyProfile='__combined__';}else activeFamilyProfile=next;
      try{trackerStorage.setItem(FAMILY_PROFILE_STORAGE_KEY,activeFamilyProfile);}catch(error){console.warn('Profile selection could not be saved:',error);}
      const menu=document.getElementById('familyProfileMenu');if(menu)menu.hidden=true;
      if(!document.getElementById('stallionHistoryModal').hidden)closeStallionHistory();
      if(!document.getElementById('retirementContributionHistoryModal').hidden)closeRetirementContributionHistory();
      if(!document.getElementById('debtEmiHistoryModal').hidden)closeDebtEmiHistory();
      syncFamilyProfileButtons();refreshAllPageViews();
    }
    function initializeFamilyProfile(){
      try{const saved=trackerStorage.getItem(FAMILY_PROFILE_STORAGE_KEY);activeFamilyProfile=saved==='__combined__'||profileMemberNames().includes(saved)?saved||'__combined__':'__combined__';}catch(error){activeFamilyProfile='__combined__';}
      document.querySelectorAll('[data-family-profile-trigger]').forEach(button=>button.addEventListener('click',event=>{event.stopPropagation();toggleFamilyProfileMenu(button);}));
      document.getElementById('familyProfileMenu')?.addEventListener('click',event=>{const option=event.target.closest('[data-family-profile]');if(option)applyFamilyProfile(option.dataset.familyProfile);});
      document.addEventListener('click',event=>{if(event.target.closest('[data-family-profile-trigger],#familyProfileMenu'))return;const menu=document.getElementById('familyProfileMenu');if(menu&&!menu.hidden){menu.hidden=true;syncFamilyProfileButtons();}});
      document.addEventListener('keydown',event=>{if(event.key==='Escape'){const menu=document.getElementById('familyProfileMenu');if(menu&&!menu.hidden){menu.hidden=true;syncFamilyProfileButtons();}}});
      window.addEventListener('resize',()=>{const menu=document.getElementById('familyProfileMenu');if(menu&&!menu.hidden){const trigger=document.querySelector((document.documentElement.dataset.appStyle==='modern'||window.innerWidth<=700)?'.family-profile-mobile-trigger':'.family-profile-sidebar-trigger');if(trigger)positionFamilyProfileMenu(trigger);}});
      syncFamilyProfileButtons();
    }
    function updateCustomInvestmentProfileFields() {
      const key=document.getElementById('customValueType')?.value,profile=document.getElementById('customInvestmentProfileFields'),growth=document.getElementById('customInvestmentGrowthType')?.value,note=document.getElementById('customInvestmentProfileNote'),form=document.getElementById('customValueForm');
      if(!profile)return;
      const isInvestment=key==='investmentTypes';profile.hidden=!isInvestment;form?.classList.toggle('has-investment-profile',isInvestment);
      if(note&&isInvestment)note.textContent=growth==='market'?'Market-linked: each holding can have an automatic monthly contribution with its own first payment date. Contributions update invested and current values, are recorded in history, and can be included in projections. One-off contributions can be recorded from that holding’s Actions.':growth==='fixed'?'Fixed return: enter the annual interest rate for each holding in Investments. Optional automatic contributions add to invested and current values on the selected monthly date; interest credits are updated separately. Projections use the entered rate.':growth==='no-return'?'No return: current value follows the invested amount. Optional automatic monthly contributions increase both values and are recorded in history; no interest or investment growth is assumed.':'Choose how this investment behaves so the tracker can show the right fields and projection logic.';
    }
    function resetCustomValueMappingEdit() {
      const button=document.getElementById('addCustomValueBtn'),input=document.getElementById('customValueInput');
      if(button){delete button.dataset.editProfileValue;button.textContent='+ Add';}
      if(input)input.disabled=false;
    }
    function editCustomInvestmentProfile(name) {
      const profile=state.customInvestmentProfiles?.[name]||{};
      document.getElementById('customValueType').value='investmentTypes';
      const input=document.getElementById('customValueInput'),button=document.getElementById('addCustomValueBtn');
      input.value=name;input.disabled=true;button.dataset.editProfileValue=name;button.textContent='Save mapping';
      document.getElementById('customInvestmentGrowthType').value=profile.growthType||'';
      updateCustomInvestmentProfileFields();renderCustomValuesPanel();
      document.getElementById('customValueStatus').textContent=`Update the Growth Projection mapping for ${name}.`;
      document.getElementById('customInvestmentGrowthType').focus();
    }
    function familyMemberNameDraft(name){
      const value=String(name??'').trim(),normalized=value.toLocaleLowerCase();
      if(!value)return{error:'Enter a family member name.'};
      if(value.length>60)return{error:'Use 60 characters or fewer.'};
      if(profileMemberNames().some(item=>item.trim().toLocaleLowerCase()===normalized))return{error:'This family member name is already available.'};
      const builtIn=Object.values(CUSTOM_VALUE_DEFAULT_OPTIONS.familyMembers||{}).flat().some(item=>item.option.value.trim().toLocaleLowerCase()===normalized);
      return{value,normalized,builtIn};
    }
    function memberRecordCount(data,name){
      const key=String(name).trim().toLocaleLowerCase();let count=0;
      const visit=node=>{if(!node||typeof node!=='object')return;if(!Array.isArray(node)&&typeof node.member==='string'&&node.member.trim().toLocaleLowerCase()===key)count++;for(const value of Object.values(node))if(value&&typeof value==='object')visit(value);};
      visit(data);return count;
    }
    function buildFamilyMemberChange(data,names,oldName,newName,remove=false){
      const norm=value=>String(value??'').trim().toLocaleLowerCase(),oldKey=norm(oldName),nextName=String(newName??'').trim(),nextKey=norm(nextName);
      if(!names.some(name=>norm(name)===oldKey))throw Error('This family member is no longer available. Reopen Family Access.');
      if(!remove&&(!nextName||nextName.length>60))throw Error('Enter a name using 1 to 60 characters.');
      if(!remove&&names.some(name=>norm(name)!==oldKey&&norm(name)===nextKey))throw Error('That name already exists. To combine members, use Remove and reassign their records.');
      const count=memberRecordCount(data,oldName);
      if(remove&&count&&(!nextName||nextKey===oldKey||!names.some(name=>norm(name)===nextKey)))throw Error('Choose another family member for the linked records before removing this member.');
      const next=JSON.parse(JSON.stringify(data));
      if(nextName){
        const visit=node=>{if(!node||typeof node!=='object')return;if(!Array.isArray(node)&&typeof node.member==='string'&&norm(node.member)===oldKey)node.member=nextName;for(const value of Object.values(node))if(value&&typeof value==='object')visit(value);};visit(next);
      }
      if(remove&&nextName){
        const oldRules=(data.recurringRules||[]).filter(rule=>rule.kind==='income'&&!rule.paused&&norm(rule.member)===oldKey);
        if(oldRules.some(rule=>(data.recurringRules||[]).some(other=>other.kind==='income'&&!other.paused&&norm(other.member)===nextKey&&norm(other.source)===norm(rule.source))))throw Error('Both members have an active recurring income rule for the same source. Pause or adjust one rule before reassigning.');
        if((next.gratuityAccounts||[]).filter(row=>norm(row.member)===nextKey).length>1)throw Error('Both members have a gratuity account. Resolve those accounts before reassigning; no records have been changed.');
      }
      next.customValues??={};next.removedValues??={};
      next.customValues.familyMembers=(next.customValues.familyMembers||[]).filter(name=>norm(name)!==oldKey);
      next.removedValues.familyMembers=(next.removedValues.familyMembers||[]).filter(name=>!nextName||norm(name)!==nextKey);
      if(remove||oldKey!==nextKey){if(!next.removedValues.familyMembers.some(name=>norm(name)===oldKey))next.removedValues.familyMembers.push(oldName);}
      if(!remove&&!next.customValues.familyMembers.some(name=>norm(name)===nextKey))next.customValues.familyMembers.push(nextName);
      return{data:next,count};
    }
    let familyNameChangeBusy=false;
    async function changeFamilyMemberName(name,remove=false){
      if(familyNameChangeBusy||window.financeCloud?.canEdit===false||dataOperationBusy)return;
      const status=document.getElementById('familyMemberNameStatus'),original=JSON.stringify(state),names=profileMemberNames(),count=memberRecordCount(state,name),others=names.filter(item=>item!==name);
      let nextName='';
      if(remove&&count&&!others.length){status.textContent='Add another family member first, then reassign these records before removing this member.';return;}
      if(!remove||count){
        const fields=remove?[{key:'replacement',label:'Reassign all linked records to',value:others[0],options:others}]:[{key:'name',label:'Correct family member name',value:name,maxLength:60}];
        const values=await openRecordEditor(remove?'Remove family member · reassign records':'Edit family member name',fields,values=>{
          try{buildFamilyMemberChange(state,profileMemberNames(),name,remove?values.replacement:values.name,remove);return null;}catch(error){return error.message;}
        });
        if(!values)return;nextName=remove?values.replacement:values.name.trim();
        if(!remove&&nextName===name){status.textContent='The name is unchanged.';return;}
      }
      const message=remove?(count?`Remove “${name}” and reassign ${count} linked entries to “${nextName}”? Financial records will be kept.`:`Remove unused family member “${name}”?`):`Rename “${name}” to “${nextName}” across ${count} linked entries, including recurring entries?`;
      if(!confirm(message+' Login access will not change.'))return;
      if(JSON.stringify(state)!==original){status.textContent='Records changed while this dialog was open. Please try again.';return;}
      if(window.financeCloud?.canEdit===false||dataOperationBusy)return;
      try{
        const result=buildFamilyMemberChange(state,profileMemberNames(),name,nextName,remove),candidate=validateBackup(result.data);
        familyNameChangeBusy=true;dataOperationBusy=true;renderFamilyMemberNames();state=candidate;
        const saved=await saveData(remove?'Removed family member and reassigned records':'Renamed family member');
        if(activeFamilyProfile===name)activeFamilyProfile=nextName||'__combined__';
        try{trackerStorage.setItem(FAMILY_PROFILE_STORAGE_KEY,activeFamilyProfile);}catch(error){}
        refreshAllPageViews();
        status.textContent=saved?(remove?name+' removed. Financial records kept.':name+' renamed to '+nextName+'. Linked records updated.'):'Could not finish saving. Check the sync status and export a backup before closing.';
      }catch(error){status.textContent=error.message||'Unable to update this family member.';}
      finally{familyNameChangeBusy=false;dataOperationBusy=false;renderFamilyMemberNames();}
    }
    function renderFamilyMemberNames(){
      const list=document.getElementById('familyMemberNamesList');if(!list)return;list.replaceChildren();
      const readonly=window.financeCloud?.canEdit===false||familyNameChangeBusy;
      for(const name of profileMemberNames()){
        const chip=document.createElement('span');chip.className='custom-value-chip';
        const label=document.createElement('span');label.textContent=name;chip.append(label);
        for(const [action,title] of [['edit','Edit'],['remove','Remove']]){
          const button=document.createElement('button');button.type='button';button.className='btn-small';button.textContent=title;button.setAttribute('aria-label',title+' family member '+name);button.disabled=readonly;
          button.addEventListener('click',()=>changeFamilyMemberName(name,action==='remove'));chip.append(button);
        }
        list.append(chip);
      }
      if(!list.children.length)list.textContent='No family member names added yet.';
      document.getElementById('familyMemberNameInput').disabled=readonly;document.getElementById('addFamilyMemberNameBtn').disabled=readonly;
    }
    document.getElementById('familyMemberNameForm').addEventListener('submit',async event=>{
      event.preventDefault();if(window.financeCloud?.canEdit===false)return;
      const input=document.getElementById('familyMemberNameInput'),button=document.getElementById('addFamilyMemberNameBtn'),status=document.getElementById('familyMemberNameStatus');if(button.disabled)return;
      const draft=familyMemberNameDraft(input.value);if(draft.error){status.textContent=draft.error;input.focus();return;}
      button.disabled=true;
      try{
        state.removedValues.familyMembers=(state.removedValues.familyMembers||[]).filter(name=>name.trim().toLocaleLowerCase()!==draft.normalized);
        if(!draft.builtIn&&!state.customValues.familyMembers.some(name=>name.trim().toLocaleLowerCase()===draft.normalized))state.customValues.familyMembers.push(draft.value);
        populateCustomValueSelects();renderCustomValuesPanel();renderFamilyProfileMenu();syncFamilyProfileButtons();
        const saved=await saveData('Added family member name');renderFamilyMemberNames();
        status.textContent=saved?draft.value+' is now available in Family Member dropdowns.':'Could not finish saving. Check the sync status before closing.';
        if(saved)input.value='';
      }finally{button.disabled=window.financeCloud?.canEdit===false;}
    });
    function renderCustomValuesPanel() {
      renderFamilyMemberNames();
      const typeSelect = document.getElementById('customValueType');
      const summary = document.getElementById('customValuesSummary');
      const list = document.getElementById('customValuesList');
      if (!typeSelect || !summary || !list) return;
      const key = typeSelect.value;
      const config = CUSTOM_VALUE_CONFIG[key];
      const values = getAvailableCustomValueOptions(key).map(option => ({ value: option.value, custom: option.dataset.customValue === 'true' }));
      summary.textContent = `Available ${config.label.toLocaleLowerCase()} values · ${values.length}`;
      list.innerHTML = values.map(item => {
        const inUse=customValueIsInUse(key,item.value),profile=key==='investmentTypes'?state.customInvestmentProfiles?.[item.value]:null;
        const growthLabel=profile?.growthType==='market'?'Market Linked':profile?.growthType==='fixed'?'Fixed Return':profile?.growthType==='no-return'?'No Return':null;
        const tag=key==='investmentTypes'?(growthLabel||(item.custom?'Mapping needed':'')):'',edit=key==='investmentTypes'&&item.custom?`<button type="button" class="custom-investment-profile-edit" data-edit-investment-profile="${analyticEscape(item.value)}">${growthLabel?'Edit type':'Set type'}</button>`:'';
        const action=inUse?'<span class="custom-value-in-use" title="This value is used by saved records">In use</span>':`<button type="button" class="custom-value-remove" data-remove-value="${analyticEscape(item.value)}" aria-label="Remove ${analyticEscape(item.value)}" title="Remove ${analyticEscape(item.value)}">×</button>`;
        return `<span class="custom-value-chip"><span>${analyticEscape(item.value)}</span>${tag?`<small class="custom-investment-profile-tag">${analyticEscape(tag)}</small>`:''}${edit}${action}</span>`;
      }).join('');
    }
    function incomeSourceForStorage(source,member) {
      const cleaned=String(source??'').trim();
      if(cleaned.toLocaleLowerCase()==='salary')return 'Salary';
      const match=cleaned.match(/^(.+?)\s+salary$/i);
      if(!match)return cleaned;
      const prefix=match[1].replace(/[^\p{L}\p{N}]/gu,'').toLocaleLowerCase();
      const memberName=String(member??'').replace(/[^\p{L}\p{N}]/gu,'').toLocaleLowerCase();
      const knownMembers=CUSTOM_VALUE_CONFIG.familyMembers.selectIds.flatMap(id=>Array.from(document.getElementById(id)?.options||[],option=>option.value)).concat(state.customValues?.familyMembers||[]).map(name=>String(name).replace(/[^\p{L}\p{N}]/gu,'').toLocaleLowerCase()).filter(Boolean);
      const candidates=memberName?[memberName]:knownMembers;
      const matchesMember=candidates.some(name=>name===prefix||(prefix.length>=5&&name.startsWith(prefix))||(name.length>=5&&prefix.startsWith(name)));
      return matchesMember?'Salary':cleaned;
    }
    function customValueIsInUse(key,value) {
      const normalized=String(value).trim().toLocaleLowerCase(),config=CUSTOM_VALUE_CONFIG[key];
      if(!config)return false;
      return Boolean(config.usage?.some(({collection,field})=>Array.isArray(state[collection])&&[...state[collection],...(state.archivedAccounts||[]).filter(a=>a.kind===collection).map(a=>a.record)].some(row=>{
        const saved=String(row?.[field]??'').trim().toLocaleLowerCase();
        if(saved===normalized)return true;
        return key==='incomeSources'&&normalized==='salary'&&incomeSourceForStorage(row?.source,row?.member||'').toLocaleLowerCase()==='salary';
      })));
    }
    function addCustomValue() {
      const key=document.getElementById('customValueType').value,config=CUSTOM_VALUE_CONFIG[key],input=document.getElementById('customValueInput'),status=document.getElementById('customValueStatus'),button=document.getElementById('addCustomValueBtn'),value=input.value.trim(),editingName=button.dataset.editProfileValue||'',selects=config.selectIds.map(id=>document.getElementById(id)).filter(Boolean);
      const growthType=document.getElementById('customInvestmentGrowthType')?.value||'';
      if(!value){status.textContent='Enter a value first.';input.focus();return;}
      if(value.length>60){status.textContent='Use 60 characters or fewer.';input.focus();return;}
      let investmentProfile=null;
      if(key==='investmentTypes'){
        if(!['market','fixed','no-return'].includes(growthType)){status.textContent='Choose Market Linked, Fixed Return, or No Return.';document.getElementById('customInvestmentGrowthType').focus();return;}
        investmentProfile={growthType};
      }
      if(editingName){
        const previousProfile=state.customInvestmentProfiles?.[editingName];
        state.customInvestmentProfiles=state.customInvestmentProfiles||{};state.customInvestmentProfiles[editingName]=investmentProfile;resetCustomValueMappingEdit();input.value='';
        if(JSON.stringify(previousProfile)!==JSON.stringify(investmentProfile)&&state.projectionSettings?.returns)delete state.projectionSettings.returns[editingName];
        updateInvestmentRateField();populateCustomValueSelects();saveData();renderCustomValuesPanel();renderInvestments();renderGrowthProjection();updateDashboard();status.textContent=`Growth Projection mapping updated for ${editingName}.`;input.focus();return;
      }
      if((state.removedValues[key]||[]).some(item=>item.toLocaleLowerCase()===value.toLocaleLowerCase())) {
        state.removedValues[key]=state.removedValues[key].filter(item=>item.toLocaleLowerCase()!==value.toLocaleLowerCase());
        if(key==='investmentTypes'){state.customInvestmentProfiles=state.customInvestmentProfiles||{};state.customInvestmentProfiles[value]=investmentProfile;}
        populateCustomValueSelects();saveData();renderCustomValuesPanel();renderFamilyProfileMenu();syncFamilyProfileButtons();status.textContent=`${value} is available again.`;input.value='';input.focus();return;
      }
      if(selects.some(select=>Array.from(select.options).some(option=>option.value.trim().toLocaleLowerCase()===value.toLocaleLowerCase()))){status.textContent='That value is already available in this category.';input.focus();return;}
      state.customValues[key].push(value);
      if(key==='investmentTypes'){state.customInvestmentProfiles=state.customInvestmentProfiles||{};state.customInvestmentProfiles[value]=investmentProfile;}
      populateCustomValueSelects();saveData();renderCustomValuesPanel();renderFamilyProfileMenu();syncFamilyProfileButtons();status.textContent=`${value} added to ${config.label.toLocaleLowerCase()} options.`;input.value='';input.focus();
    }
    function removeCustomValue(value) {
      if(document.getElementById('customValueType').value==='familyMembers'){changeFamilyMemberName(value,true);return;}
      const key=document.getElementById('customValueType').value,config=CUSTOM_VALUE_CONFIG[key],status=document.getElementById('customValueStatus');
      const matchingOption=config.selectIds.map(id=>document.getElementById(id)).filter(Boolean).flatMap(select=>Array.from(select.options)).find(option=>option.value.toLocaleLowerCase()===value.toLocaleLowerCase());
      if(!matchingOption)return;
      if(customValueIsInUse(key,value)){status.textContent=`${value} is in use by saved records and cannot be removed.`;renderCustomValuesPanel();return;}
      if(!confirm(`Remove “${value}” from ${config.label.toLocaleLowerCase()} choices? Existing records will remain unchanged.`))return;
      const isCustom=(state.customValues[key]||[]).some(item=>item.toLocaleLowerCase()===value.toLocaleLowerCase());
      if(isCustom)state.customValues[key]=state.customValues[key].filter(item=>item.toLocaleLowerCase()!==value.toLocaleLowerCase());
      else if(!(state.removedValues[key]||[]).some(item=>item.toLocaleLowerCase()===value.toLocaleLowerCase()))state.removedValues[key].push(value);
      if(key==='investmentTypes'&&isCustom)delete state.customInvestmentProfiles?.[value];
      populateCustomValueSelects();saveData();renderCustomValuesPanel();
      if(key==='familyMembers'&&activeFamilyProfile===value){activeFamilyProfile='__combined__';try{trackerStorage.setItem(FAMILY_PROFILE_STORAGE_KEY,activeFamilyProfile);}catch(error){}}
      renderFamilyProfileMenu();syncFamilyProfileButtons();refreshAllPageViews();
      status.textContent=`${value} removed from ${config.label.toLocaleLowerCase()} choices. Existing records were not changed.`;
    }
    document.getElementById('customValueType').addEventListener('change',()=>{resetCustomValueMappingEdit();updateCustomInvestmentProfileFields();renderCustomValuesPanel();});
    document.getElementById('customInvestmentGrowthType').addEventListener('change',updateCustomInvestmentProfileFields);
    document.getElementById('addCustomValueBtn').addEventListener('click', addCustomValue);
    document.getElementById('customValuesList').addEventListener('click',event=>{const edit=event.target.closest('[data-edit-investment-profile]');if(edit){editCustomInvestmentProfile(edit.dataset.editInvestmentProfile);return;}const button=event.target.closest('[data-remove-value]');if(button)removeCustomValue(button.dataset.removeValue);});
    document.getElementById('customValueInput').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); addCustomValue(); } });

    const STORAGE_KEY = 'familyWealthTracker';

    let storageLoadFailed = false;

    // Theme Management
    const themeToggle = document.getElementById('themeToggle');
    const themeOptions = document.getElementById('themeOptions');
    const htmlElement = document.documentElement;
    const COLOR_THEME_KEY = 'familyWealthColorTheme';
    const COLOR_THEMES = {
      'obsidian-black': {label:'Obsidian Black', colors:['#000000','#171717','#a3e6cd','#a3a3a3'], darkHeader:['#111111','#000000'], light:['#242424','#000000','#ededed','#18765b'], dark:['#a3e6cd','#c6f3e2','#20352d','#c4b5fd']},
      'navy-emerald': {label:'Navy + Emerald', colors:['#127c70','#1e3346','#d5a85f','#e5f2ef'], darkHeader:['#1e3346','#142638'], light:['#127c70','#1e3346','#e5f2ef','#d5a85f'], dark:['#55c4a0','#bae6d6','#143737','#e0b766']},
      'classic-teal': {label:'Classic Teal', colors:['#0f7c7e','#084b4d','#d4976f','#e8f5f5'], darkHeader:['#0b3f40','#062a2b'], light:['#0f7c7e','#084b4d','#e8f5f5','#d4976f'], dark:['#5eead4','#b5fff0','#173e44','#99f6e4']},
      'emerald-green': {label:'Emerald Green', colors:['#059669','#064e3b','#34d399','#d1fae5'], darkHeader:['#064e3b','#032d22'], light:['#059669','#064e3b','#ecfdf5','#34d399'], dark:['#34d399','#a7f3d0','#064e3b','#6ee7b7']},
      'sunset-luxe': {label:'Sunset Luxe', colors:['#e6536f','#8f2749','#f5a65b','#ffe4e6'], darkHeader:['#63253b','#3c1729'], light:['#c2415d','#7f1d3d','#fff1f2','#f5a65b'], dark:['#fb7185','#fecdd3','#4c1d2a','#fdba74']},
      'forest-gold': {label:'Forest & Gold', colors:['#357a57','#1f5139','#d4a72c','#dcfce7'], darkHeader:['#163d2b','#0b281c'], light:['#357a57','#1f5139','#f0fdf4','#d4a72c'], dark:['#86efac','#bbf7d0','#123b2a','#facc15']},
      'arctic-glass': {label:'Arctic Glass', colors:['#0e7490','#164e63','#67e8f9','#cffafe'], darkHeader:['#0b3e52','#062a39'], light:['#0e7490','#164e63','#ecfeff','#67e8f9'], dark:['#67e8f9','#a5f3fc','#083344','#a5f3fc']}
    };

    function renderThemeOptions() {
      if (!themeOptions) return;
      themeOptions.innerHTML = Object.entries(COLOR_THEMES).filter(([key])=>key!=='obsidian-black').map(([key,theme]) => `<button type="button" class="theme-choice" data-theme-key="${key}" aria-pressed="false" aria-label="Apply ${theme.label} theme"><span class="theme-choice-colors" aria-hidden="true">${theme.colors.map(color=>`<span style="background:${color}"></span>`).join('')}</span><span class="theme-choice-name">${theme.label}</span></button>`).join('');
    }
    renderThemeOptions();

    function applyColorTheme(key, persist = true) {
      const safeKey = Object.prototype.hasOwnProperty.call(COLOR_THEMES, key) ? key : 'navy-emerald';
      const theme = COLOR_THEMES[safeKey];
      const mode = htmlElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
      const [primary, primaryDark, primaryLight, accent] = theme[mode];
      const vars = {'primary':primary,'primary-dark':primaryDark,'primary-light':primaryLight,'accent':accent,
        'header-from':mode === 'dark' ? theme.darkHeader[0] : primary,'header-to':mode === 'dark' ? theme.darkHeader[1] : primaryDark,
        'button-text':mode === 'dark' ? '#0f172a' : '#ffffff','button-hover':primaryDark,
        'chart-secondary':theme.colors[1],'chart-tertiary':theme.colors[2],'chart-quaternary':theme.colors[3]};
      if (safeKey === 'obsidian-black') Object.assign(vars,{'chart-secondary':mode==='dark'?'#a7bdf2':'#3157a5','chart-tertiary':mode==='dark'?'#f1c58a':'#945807','chart-quaternary':mode==='dark'?'#d8b4fe':'#7841a5'});
      if (safeKey === 'arctic-glass') vars['card-bg'] = mode === 'dark' ? 'rgba(8, 51, 68, .88)' : 'rgba(255, 255, 255, .88)';
      else htmlElement.style.removeProperty('--card-bg');
      Object.entries(vars).forEach(([name,value]) => htmlElement.style.setProperty(`--${name}`,value));
      htmlElement.setAttribute('data-color-theme',safeKey);window.PFTPaint?.remember();
      themeOptions?.querySelectorAll('.theme-choice').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.themeKey===safeKey)));
      if (persist) { try { trackerStorage.setItem(COLOR_THEME_KEY,safeKey); } catch (error) { /* Theme still changes for this session. */ } }
    }

    function syncThemeModeSwitch(mode) {
      const button=themeToggle?.querySelector('[data-mode]');
      if(!button)return;
      const next=mode==='dark'?'light':'dark';
      const label=`Switch to ${next} mode`;
      button.dataset.mode=next;
      button.setAttribute('aria-label',label);
      button.title=label;
      themeToggle.setAttribute('aria-label',label);
      button.innerHTML=next==='light'
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.9 13A8.7 8.7 0 0 1 11 3.1 8.9 8.9 0 1 0 20.9 13Z"/></svg>';
    }

    function initTheme() {
      let saved = 'dark';
      try { saved = trackerStorage.getItem('theme') || 'dark'; } catch (error) { /* Use default theme when storage is unavailable. */ }
      if (saved !== 'dark' && saved !== 'light') saved = 'dark';
      htmlElement.setAttribute('data-theme', saved);
      syncThemeModeSwitch(saved);
      let savedColors = 'navy-emerald';
      try { savedColors = trackerStorage.getItem(COLOR_THEME_KEY) || 'navy-emerald'; } catch (error) { /* Use default colors when storage is unavailable. */ }
      // Retired appearance choices migrate as one coherent preference pair:
      // Modern page layout + Navy & Emerald colors, without touching finance records.
      let retiredLayout=false;
      try { retiredLayout=trackerStorage.getItem('displayStyle')==='emerald-flow'; } catch (error) {}
      const retiredColors=savedColors==='ocean-blue'||savedColors==='midnight-aurora'||savedColors==='warm-amber';
      if(retiredLayout||retiredColors){
        savedColors='navy-emerald';
        try { trackerStorage.setItem('displayStyle','modern'); } catch (error) {}
        applyColorTheme(savedColors,true);
      }else{
        applyColorTheme(savedColors,!Object.prototype.hasOwnProperty.call(COLOR_THEMES,savedColors));
      }
    }

    window.PFTBlackTheme = {
      select() {
        const old=htmlElement.getAttribute('data-color-theme');
        if(old&&old!=='obsidian-black'){try{trackerStorage.setItem('pft:colorBeforeBlack',old);trackerStorage.setItem('pft:modeBeforeBlack',htmlElement.getAttribute('data-theme')||'dark');}catch(_){}}
        htmlElement.setAttribute('data-theme','dark');try{trackerStorage.setItem('theme','dark');}catch(_){}syncThemeModeSwitch('dark');applyColorTheme('obsidian-black');
      },
      leave() {
        if(htmlElement.getAttribute('data-color-theme')!=='obsidian-black')return;
        let old='navy-emerald',mode='dark';try{old=trackerStorage.getItem('pft:colorBeforeBlack')||old;mode=trackerStorage.getItem('pft:modeBeforeBlack')||mode;}catch(_){}
        if(old==='obsidian-black'||!COLOR_THEMES[old])old='navy-emerald';if(!['dark','light'].includes(mode))mode='dark';
        htmlElement.setAttribute('data-theme',mode);try{trackerStorage.setItem('theme',mode);}catch(_){}syncThemeModeSwitch(mode);applyColorTheme(old);
      }
    };

    themeToggle.addEventListener('click', event => {
      const option=event.target.closest('[data-mode]');
      if(!option)return;
      const next=option.dataset.mode;
      if(next!=='dark'&&next!=='light')return;
      htmlElement.setAttribute('data-theme', next);
      try { trackerStorage.setItem('theme', next); } catch (error) { /* Theme still changes for this session. */ }
      applyColorTheme(htmlElement.getAttribute('data-color-theme'),false);
      syncThemeModeSwitch(next);
      if(document.getElementById('analytics')?.classList.contains('active'))renderCharts();
    });
    themeOptions?.addEventListener('click', event => {
      const button=event.target.closest('.theme-choice');
      if(!button||!COLOR_THEMES[button.dataset.themeKey])return;
      if(htmlElement.getAttribute('data-color-theme')==='obsidian-black')window.PFT_STYLE?.apply('modern');
      applyColorTheme(button.dataset.themeKey);
      if(document.getElementById('analytics')?.classList.contains('active'))renderCharts();
    });

    // Durable storage, record lifecycle and statement reconciliation.
    const ACCOUNT_KINDS=['pf','ppf','nps','investments','debts','gratuityAccounts'];
    let financeDB=null, storageBackend='loading', storageRevision=0, saveQueue=Promise.resolve(), pendingSaves=0, lastAccepted=null, persistenceDirty=false;
    let accountPages={}, auditPage=0;
    let cloudRecovery=null, cloudCommittedState=null, cloudSaveBlocked=false;
    function storageMessage(message,error=false){const status=document.getElementById('cloudSyncStatus');if(status){status.textContent=message;status.hidden=message==='All changes synced';}const e=document.getElementById('storageHealth');if(e){e.textContent=message;e.style.color=error?'var(--danger)':'var(--text-muted)';}}
    function openFinanceDB(){return new Promise((resolve,reject)=>{
      if(!window.indexedDB)return reject(new Error('IndexedDB is unavailable'));
      const r=indexedDB.open('PersonalFinanceTracker:'+window.financeCloud.uid,1);
      r.onupgradeneeded=()=>{const db=r.result;db.createObjectStore('records');db.createObjectStore('changes',{keyPath:'sequence',autoIncrement:true});};
      r.onerror=()=>reject(r.error);r.onblocked=()=>reject(new Error('Close other tracker windows and reload to finish opening storage.'));
      r.onsuccess=()=>{r.result.onversionchange=()=>{r.result.close();storageLoadFailed=true;storageMessage('Storage changed in another window. Reload before editing.',true);};resolve(r.result);};
    });}
    function readStoredFinance(){return new Promise((resolve,reject)=>{const r=financeDB.transaction('records').objectStore('records').get('current');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
    function readPendingCloudSync(){return new Promise((resolve,reject)=>{const r=financeDB.transaction('records').objectStore('records').get('cloudSync');r.onsuccess=()=>resolve(Boolean(r.result?.pending));r.onerror=()=>reject(r.error);});}
    function financeDiff(previous,next){
      const changes=[];
      for(const key of new Set([...Object.keys(previous||{}),...Object.keys(next)])){
        if(['lastUpdate','schemaVersion','auditLog'].includes(key))continue;
        const before=previous?.[key],after=next[key];
        if(Array.isArray(before)&&Array.isArray(after)&&[...before,...after].every(r=>r&&typeof r==='object'&&r.id)){
          const old=new Map(before.map(r=>[r.id,JSON.stringify(r)]));
          for(const row of after){const current=JSON.stringify(row),was=old.get(row.id);if(current!==was)changes.push({collection:key,id:row.id,action:was?'Updated':'Added',before:was?JSON.parse(was):null,after:row});old.delete(row.id);}
          for(const [id,row] of old)changes.push({collection:key,id,action:'Deleted',before:JSON.parse(row),after:null});
        }else if(JSON.stringify(before)!==JSON.stringify(after))changes.push({collection:key,action:'Updated',before:before??null,after:after??null});
      }return changes;
    }
    function withFinanceWriteLock(operation){return navigator.locks?navigator.locks.request('pft-write:'+window.financeCloud.uid,operation):operation();}
    function commitFinance(snapshot,action='Update',importedAudit=null,lockHeld=false){if(!lockHeld)return withFinanceWriteLock(()=>commitFinance(snapshot,action,importedAudit,true));return new Promise((resolve,reject)=>{
      const tx=financeDB.transaction(['records','changes'],'readwrite');let failure;
      const records=tx.objectStore('records'),log=tx.objectStore('changes'),read=records.get('current');
      read.onsuccess=()=>{
        try {
        const existing=read.result;
        if((existing?.revision||0)!==storageRevision){failure=new Error('Records changed in another tracker window. Export this session, then reload before editing.');tx.abort();return;}
        const changes=existing?financeDiff(existing.data,snapshot):[];
        if(action==='Imported backup'&&existing)records.put({at:new Date().toISOString(),data:existing.data},'recovery');
        if(action==='Clear all data')records.delete('recovery');
        const revision=storageRevision+1;
        records.put({revision,data:snapshot},'current');
        const reviewRestore=syncRecord?.pending?syncRecord.envelope?.reviewRestore:null;
        if(reviewRestore){records.put(reviewRestore,'backupReviewRestore:v1');if(action==='Imported backup')for(const id of reviewRestore.discardOps||[])records.delete('reviewOp:v1:'+id);}
        else records.delete('backupReviewRestore:v1');
        if(syncRecord){const queued=records.get('cloudSync');queued.onsuccess=()=>{if(syncRecord.pending&&queued.result)syncRecord.baseRevision=Math.max(syncRecord.baseRevision,queued.result.baseRevision);records.put(syncRecord,'cloudSync');};}
        if(action==='Clear all data'){log.clear();changes.length=0;}
        if(importedAudit?.length)log.add({at:new Date().toISOString(),action:'Imported backup history',changes:[],importedHistory:importedAudit});
        if(changes.length||!existing||action!=='Update')log.add({at:new Date().toISOString(),action,changes,actor:{email:window.financeCloud?.email||'',role:window.financeCloud?.role||''}});
        tx.oncomplete=()=>{storageRevision=revision;resolve(true);};
        } catch(error){failure=error;try{tx.abort();}catch(ignored){}reject(error);}
      };
      tx.onabort=()=>reject(failure||tx.error||new Error('Save transaction aborted'));tx.onerror=()=>{};
    });}
    let syncRecord=null,syncBusy=false,syncTimer=null,startupRevisionTimer=null;
    function readSync(){return new Promise((resolve,reject)=>{const r=financeDB.transaction('records').objectStore('records').get('cloudSync');r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error);});}
    function syncStatus(){renderCloudUpdated();if(window.financeStartupChecking){storageMessage('Saved on device · Checking cloud revision');return;}storageMessage(syncRecord?.pending?(navigator.onLine?'Saved on device · Waiting to sync':'Saved on device · Offline'):(navigator.onLine?'All changes synced':'Offline · Showing saved records'));}
    function renderCloudUpdated(){
      let value=window.financeCloud?.updatedAt?.()||syncRecord?.lastCloudUpdated||null;
      if(value&&!Number.isNaN(Date.parse(value))){try{trackerStorage.setItem('lastCloudUpdated',value);}catch(_){} }
      else {try{value=trackerStorage.getItem('lastCloudUpdated');}catch(_){} }
      const profile=document.querySelector('.cloud-account-panel');if(profile)profile.dataset.syncState=value&&!Number.isNaN(Date.parse(value))&&!syncRecord?.pending&&!cloudSaveBlocked&&!window.financeStartupChecking&&navigator.onLine?'synced':'pending';
    }
    async function syncCloud(){
      if(window.financeStartupChecking||window.financeCloud?.deleting||window.financeCloud?.canEdit===false||window.financeCloud?.accessValid?.()===false||syncBusy||!syncRecord?.pending||!navigator.onLine||cloudSaveBlocked)return;
      syncBusy=true;
      try{
        await saveQueue;
        const sent=JSON.parse(JSON.stringify(syncRecord));
        window.financeCloud.resume(sent.baseRevision);
        storageMessage('Saved on device · Syncing…');
        const revision=await window.financeCloud.save(sent.envelope,{clearHistory:sent.clearHistory});
        await new Promise((resolve,reject)=>{const tx=financeDB.transaction('records','readwrite'),store=tx.objectStore('records'),r=store.get('cloudSync');r.onsuccess=()=>{const latest=r.result;if(!latest)return;latest.baseRevision=revision;latest.lastCloudUpdated=window.financeCloud?.updatedAt?.()||new Date().toISOString();if(latest.token===sent.token){latest.pending=false;latest.clearHistory=false;if(latest.envelope)delete latest.envelope.reviewRestore;}store.put(latest,'cloudSync');syncRecord=latest;};tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});
        syncStatus();
      }catch(error){
        if(error.code==='tracker/conflict'){cloudSaveBlocked=true;storageMessage('Saved on device · Another device has newer changes. Export this device’s backup before refreshing cloud records.',true);}
        else storageMessage('Saved on device · Sync will retry when connected');
      }finally{syncBusy=false;clearTimeout(syncTimer);if(syncRecord?.pending&&!cloudSaveBlocked)syncTimer=setTimeout(syncCloud,15000);}
    }
    function readStartupSnapshot(){return new Promise((resolve,reject)=>{
      const tx=financeDB.transaction('records','readonly'),store=tx.objectStore('records'),values=[];
      for(const [index,key]of ['current','cloudSync','forceRemoteRead'].entries()){const request=store.get(key);request.onsuccess=()=>{values[index]=request.result||null;};}
      tx.oncomplete=()=>resolve(values);tx.onabort=()=>reject(tx.error||new Error('Device snapshot could not be read'));
    });}
    async function loadData(){
      await window.financeCloudReady;
      try{
        financeDB=await openFinanceDB();storageBackend='IndexedDB';
        const [cached,savedSync,forceRemote]=await readStartupSnapshot();storageRevision=cached?.revision||0;syncRecord=savedSync;
        let envelope,openingCached=false,freshCloud=false;
        window.PFTPerformance?.mark('device-read');
        if(window.financeCloud?.canEdit!==false&&cached&&syncRecord&&(syncRecord.pending||!navigator.onLine))envelope=syncRecord.pending?syncRecord.envelope:{data:cached.data,recovery:syncRecord.envelope?.recovery||null};
        else if(!forceRemote&&window.financeCloud?.role==='owner'&&cached&&syncRecord&&window.financeCloud.checkRevision){
          try{validateBackup(cached.data);envelope={data:cached.data,recovery:syncRecord.envelope?.recovery||null};openingCached=true;window.financeCloud.resume(syncRecord.baseRevision||0);window.financeStartupChecking=true;}catch(_){envelope=await window.financeCloud.load();freshCloud=true;syncRecord={baseRevision:window.financeCloud.revision(),pending:false,envelope,lastCloudUpdated:window.financeCloud?.updatedAt?.()||null};}
        }
        else try{envelope=await window.financeCloud.load();freshCloud=true;syncRecord={baseRevision:window.financeCloud.revision(),pending:false,envelope,lastCloudUpdated:window.financeCloud?.updatedAt?.()||null};}
        catch(error){if(window.financeCloud?.role!=='owner'||!cached||!syncRecord)throw error;envelope={data:cached.data,recovery:syncRecord.envelope?.recovery||null};}
        cloudRecovery=envelope?.recovery||null;state=validateBackup(envelope?.data||createEmptyState());
        cloudCommittedState=JSON.parse(JSON.stringify(state));
        if(window.financeCloud?.canEdit!==false){syncStallionPmsFromInvestments();}
        if(!openingCached||JSON.stringify(state)!==JSON.stringify(cached.data))await commitFinance(state,'Opened cloud account');
        if(forceRemote&&freshCloud)await new Promise((resolve,reject)=>{const tx=financeDB.transaction('records','readwrite');tx.objectStore('records').delete('forceRemoteRead');tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});
        window.PFTPerformance?.mark(openingCached?'cached-records-ready':'cloud-records-ready');
        lastAccepted=JSON.parse(JSON.stringify(state));initTheme();syncStatus();setTimeout(syncCloud,0);
      }catch(error){storageLoadFailed=true;storageMessage('Records could not be loaded. '+error.message,true);window.financeCloud.lock(error);}
    }
    async function verifyStartupRevision(){
      if(!window.financeStartupChecking||!navigator.onLine||!financeDB)return;
      clearTimeout(startupRevisionTimer);
      try{const expected=syncRecord?.baseRevision||0,revision=await window.financeCloud.checkRevision();if(!financeDB)return;window.financeStartupChecking=false;
        if(revision!==expected){cloudSaveBlocked=true;storageMessage('Saved records · New cloud records need review',true);}
        else{window.PFTPerformance?.mark('cloud-verified');syncStatus();void syncCloud();}
      }catch(_){if(financeDB)startupRevisionTimer=setTimeout(verifyStartupRevision,15000);}
    }
    function saveData(action='Update',importedAudit=null,reviewRestore=null){
      if(typeof action!=='string')action='Update';
      if(window.financeCloud?.deleting||window.financeCloud?.canEdit===false||window.financeCloud?.accessValid?.()===false){if(lastAccepted)state=JSON.parse(JSON.stringify(lastAccepted));scheduleAllViewsRefresh();return Promise.resolve(false);}
      if(window.financeCloud?.canManage===false&&['Imported backup','Clear all data','Restored recovery snapshot'].includes(action)){if(lastAccepted)state=JSON.parse(JSON.stringify(lastAccepted));return Promise.resolve(false);}
      if(action==='Clear all data'&&!navigator.onLine)return Promise.resolve(false);
      if(storageLoadFailed)return Promise.resolve(false);
      let snapshot;
      try{recalculateHouseExpenses();snapshot=validateBackup(state);snapshot.lastUpdate=new Date().toLocaleString();}
      catch(error){if(lastAccepted)state=JSON.parse(JSON.stringify(lastAccepted));showImportStatus('Change rejected: '+error.message,true);scheduleAllViewsRefresh();return Promise.resolve(false);}
      state=snapshot;lastAccepted=JSON.parse(JSON.stringify(snapshot));snapshot=lastAccepted;pendingSaves++;persistenceDirty=true;scheduleAllViewsRefresh();
      const operation=saveQueue.then(async()=>{
        try{
          const previous=syncRecord;
          const recovery=action==='Imported backup'?{at:new Date().toISOString(),data:cloudCommittedState}:action==='Clear all data'?null:cloudRecovery;
          syncRecord={baseRevision:previous?.baseRevision||0,pending:true,token:crypto.randomUUID(),lastCloudUpdated:previous?.lastCloudUpdated||window.financeCloud?.updatedAt?.()||null,clearHistory:action==='Clear all data'||previous?.clearHistory===true,envelope:{data:snapshot,recovery}};const inheritedRestore=reviewRestore===false?null:reviewRestore||(!['Imported backup','Clear all data','Resolved device/cloud differences','Restored dated snapshot','Restored recovery snapshot'].includes(action)?(previous?.pending?previous.envelope?.reviewRestore:null):null);if(inheritedRestore)syncRecord.envelope.reviewRestore=inheritedRestore;syncRecord.envelope.mutationId=syncRecord.token;
          try{await commitFinance(snapshot,action,importedAudit);if(syncRecord?.envelope?.reviewRestore||window.financeReviews?.hasRestore?.())await window.financeReviews?.refreshJournal?.();}catch(error){syncRecord=previous;throw error;}
          cloudRecovery=recovery;cloudCommittedState=JSON.parse(JSON.stringify(snapshot));
          document.getElementById('lastUpdate').textContent=snapshot.lastUpdate;persistenceDirty=pendingSaves>1;syncStatus();setTimeout(syncCloud,0);return true;
        }catch(error){persistenceDirty=true;showImportStatus('Device save failed. Export a backup before closing. '+error.message,true);storageMessage('Not saved · Export a backup',true);return false;}
        finally{pendingSaves--;}
      });saveQueue=operation;return operation;
    }
    window.addEventListener('online',()=>{void verifyStartupRevision();syncCloud();});
    window.addEventListener('offline',syncStatus);
    window.financeBridge={
      pendingSync:async()=>{await saveQueue;return Boolean(syncRecord?.pending)||(financeDB?await readPendingCloudSync():false);},
      settle:()=>saveQueue,dirty:()=>persistenceDirty||pendingSaves>0,
      reset(){clearTimeout(syncTimer);clearTimeout(startupRevisionTimer);window.financeStartupChecking=false;state=createEmptyState();lastAccepted=null;if(financeDB){financeDB.close();financeDB=null;}},
      exportUnsaved(){const blob=new Blob([JSON.stringify(makeDeviceRecoveryBackup(),null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='finance-unsaved-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},
      async refreshRemote(){await saveQueue;if(!navigator.onLine){alert('Connect to the internet to refresh cloud records.');return;}if(syncRecord?.pending){if(!confirm('This device has changes waiting to sync. Export a backup first. Replace this device’s pending changes with the latest cloud records?'))return;await window.financeCloud.load();await new Promise((resolve,reject)=>{const tx=financeDB.transaction('records','readwrite');tx.objectStore('records').delete('cloudSync');tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});}await new Promise((resolve,reject)=>{const tx=financeDB.transaction('records','readwrite');tx.objectStore('records').put(true,'forceRemoteRead');tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});location.reload();},
      async retry(){await saveQueue;await syncCloud();}
    };

    async function readChangeLog(limit=20,offset=0){
      await saveQueue;if(!financeDB)return [];
      return new Promise((resolve,reject)=>{const rows=[];let skipped=0;const request=financeDB.transaction('changes').objectStore('changes').openCursor(null,'prev');request.onerror=()=>reject(request.error);request.onsuccess=()=>{const cursor=request.result;if(!cursor||rows.length>=limit)return resolve(rows);if(skipped++>=offset)rows.push(cursor.value);cursor.continue();};});
    }
    function allAccounts(kind){return [...(state[kind]||[]),...(state.archivedAccounts||[]).filter(a=>a.kind===kind).map(a=>a.record)];}
    function validateBackup(input){
      if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Backup must be an object');
      const copy=JSON.parse(JSON.stringify(input)),archives=copy.archivedAccounts||[];
      if(!Array.isArray(archives))throw new Error('archivedAccounts must be an array');
      const seen=new Set();
      for(const item of archives){
        if(!item||!ACCOUNT_KINDS.includes(item.kind)||!item.record||!validCalendarDate(item.archivedDate))throw new Error('Invalid archived account');
        const id=item.kind+':'+item.record.id;if(seen.has(id))throw new Error('Duplicate archived account');seen.add(id);
        if(!Array.isArray(copy[item.kind]))copy[item.kind]=[];if(item.archivedDate<item.record.date)throw new Error('Archive date precedes account opening');copy[item.kind].push(item.record);
      }
      const data=validateBackupCore(copy);
      data.archivedAccounts=archives.map(item=>({...item,record:data[item.kind].find(r=>r.id===item.record.id)}));
      for(const item of archives)data[item.kind]=data[item.kind].filter(r=>r.id!==item.record.id);
      data.reconciliations=data.reconciliations||[];
      if(!Array.isArray(data.reconciliations))throw new Error('reconciliations must be an array');
      const ids=new Set();
      for(const row of data.reconciliations){if(!row||typeof row.id!=='string'||ids.has(row.id)||!validCalendarDate(row.date)||!ACCOUNT_KINDS.includes(row.kind)||typeof row.accountId!=='string'||!['statementBalance','trackerBalance','difference'].every(k=>typeof row[k]==='number'&&Number.isFinite(row[k]))||row.statementBalance<0||row.trackerBalance<0||Math.abs(row.difference-(row.statementBalance-row.trackerBalance))>0.01||typeof row.notes!=='string'||row.notes.length>240)throw new Error('Invalid reconciliation record');ids.add(row.id);}
      if(data.auditLog!==undefined){if(!Array.isArray(data.auditLog)||data.auditLog.some(r=>!r||typeof r.action!=='string'||!Array.isArray(r.changes)||!Number.isFinite(Date.parse(r.at))))throw new Error('Invalid change log');delete data.auditLog;}
      delete data.backupMetadata;delete data.reviewMetadata;delete data.backupFormat;delete data.backupVersion;delete data.backupKind;
      return data;
    }
    async function archiveAccount(kind,id){
      if(!ACCOUNT_KINDS.includes(kind))return;
      const record=state[kind].find(r=>r.id===id);if(!record)return;
      if(kind==='debts'&&record.remaining>0){alert('Only a fully repaid debt can be archived.');return;}
      if(!confirm('Archive this account? It will leave current totals and projections. Its recorded history will remain available.'))return;
      state.archivedAccounts=state.archivedAccounts||[];
      state.archivedAccounts.push({kind,record:JSON.parse(JSON.stringify(record)),archivedDate:localDateKey()});state[kind]=state[kind].filter(r=>r.id!==id);
      await saveData('Archived '+kind+' account');refreshAllPageViews();renderRecordTools();
    }
    async function restoreArchivedAccount(index){
      const row=state.archivedAccounts?.[index];if(!row)return;
      if(state[row.kind].some(r=>r.id===row.record.id)){alert('An active account already has this ID.');return;}
      if(['pf','ppf','nps'].includes(row.kind))row.record.contributionsThrough=currentMonthKey();
      state[row.kind].push(row.record);state.archivedAccounts.splice(index,1);
      await saveData('Restored '+row.kind+' account');refreshAllPageViews();renderRecordTools();
    }
    function renderRecordTools(){
      const select=document.getElementById('recordAccount');if(!select)return;
      const old=select.value;select.innerHTML=ACCOUNT_KINDS.flatMap(kind=>(state[kind]||[]).map(r=>`<option value="${kind}:${r.id}">${analyticEscape(kind.toUpperCase()+' · '+(r.member||'')+' '+(r.account||r.name||r.type||r.scheme||r.id))}</option>`)).join('');if([...select.options].some(o=>o.value===old))select.value=old;
      const archives=state.archivedAccounts||[];
      document.getElementById('archiveList').innerHTML=archives.length?archives.map((a,i)=>`<p>${analyticEscape(a.kind.toUpperCase()+' · '+(a.record.member||'')+' '+(a.record.account||a.record.name||a.record.type||''))} · ${a.archivedDate} <button class="btn-small" onclick="viewArchivedAccount(${i})">View history</button> <button class="btn-small" onclick="restoreArchivedAccount(${i})">Restore</button></p>`).join(''):'No archived accounts.';
      renderReconciliations();populateStatementPayments();
    }
    function recordReconciliation(){
      const [kind,id]=document.getElementById('recordAccount').value.split(':'),record=state[kind]?.find(r=>r.id===id);if(!record){alert('Select an account.');return;}
      if(kind==='gratuityAccounts'){alert('Gratuity is an estimate, not a statement balance.');return;}
      const input=document.getElementById('statementBalance'),statement=Number(input.value),notes=document.getElementById('statementNotes').value.trim();
      if(!input.value.trim()||!Number.isFinite(statement)||statement<0||notes.length>240){alert('Enter a valid statement balance and a note of up to 240 characters.');return;}
      const tracker=kind==='debts'?record.remaining:record.current;
      state.reconciliations=state.reconciliations||[];state.reconciliations.push({id:generateId(),kind,accountId:id,date:localDateKey(),statementBalance:statement,trackerBalance:tracker,difference:Math.round((statement-tracker)*100)/100,notes});
      saveData('Recorded statement comparison');renderReconciliations();
    }
    function renderReconciliations(){const el=document.getElementById('reconciliationList');if(!el)return;const rows=(state.reconciliations||[]).slice().reverse();const page=accountPages.reconciliation||0,start=page*8;el.innerHTML=rows.slice(start,start+8).map(r=>`<p>${analyticEscape(r.date+' · '+r.kind.toUpperCase()+' · '+(allAccounts(r.kind).find(a=>a.id===r.accountId)?.member||r.accountId))}: tracker ${formatCurrency(r.trackerBalance)} · statement ${formatCurrency(r.statementBalance)} · <strong>${Math.abs(r.difference)<0.01?'Matched':'Difference '+formatCurrency(r.difference)}</strong>${r.notes?' · '+analyticEscape(r.notes):''}</p>`).join('')||'No statement checks yet.';if(rows.length>8)el.innerHTML+=`<button class="btn-small" onclick="accountPages.reconciliation=Math.max(0,${page}-1);renderReconciliations()" ${page===0?'disabled':''}>Previous</button> ${page+1} / ${Math.ceil(rows.length/8)} <button class="btn-small" onclick="accountPages.reconciliation=${page}+1;renderReconciliations()" ${start+8>=rows.length?'disabled':''}>Next</button>`;}
    async function renderChangeLog(){const el=document.getElementById('changeLogList');try{const rows=await readChangeLog(9,auditPage*8);el.innerHTML=rows.slice(0,8).map(r=>`<details><summary>${analyticEscape(r.at.replace('T',' ').slice(0,19)+' · '+r.action)} · ${r.changes.length} change(s)</summary><pre style="white-space:pre-wrap;overflow-wrap:anywhere;max-height:260px;overflow:auto">${analyticEscape(JSON.stringify(r.changes.length?r.changes.slice(0,50):r.importedHistory?{importedEntries:r.importedHistory.length,note:'Full imported history is included in JSON export.'}:[],null,2))}</pre></details>`).join('')||'No change log available.';el.innerHTML+=`<p><button class="btn-small" onclick="auditPage=Math.max(0,auditPage-1);renderChangeLog()" ${auditPage===0?'disabled':''}>Previous</button> Page ${auditPage+1} <button class="btn-small" onclick="auditPage++;renderChangeLog()" ${rows.length<=8?'disabled':''}>Next</button></p>`;}catch(error){el.textContent=error.message;}}
    function pageAccountRows(kind,rows){
      const keys={pf:['member','account','employee','employer','invested','current','epsCurrent','gain','rate'],ppf:['member','account','monthly','invested','current','gain','rate'],nps:['member','account','scheme','monthly','invested','current','gain','absolute','cagr','xirr'],debts:['type','principal','rate','emi','remaining','remainingEmis','status']};
      const choice=tableSortChoices[kind==='debts'?'debtsBody':kind+'Body'],field=keys[kind]?.[choice?.column];
      const value=r=>field==='gain'?r.current-r.invested:field==='absolute'?npsAbsoluteReturn(r):field==='cagr'?npsCagr(r,localDateKey()):field==='xirr'?npsXirr(r,localDateKey()):field==='remainingEmis'?remainingEmiEstimate(r).count:field==='status'?(r.remaining<=0?'Paid off':'Active'):r[field];
      if(field)rows=rows.slice().sort((a,b)=>{const x=value(a),y=value(b);if(x==null||y==null)return x==null?(y==null?0:1):-1;const cmp=typeof x==='number'&&typeof y==='number'?x-y:String(x).localeCompare(String(y),'en',{numeric:true,sensitivity:'base'});return choice.direction==='desc'?-cmp:cmp;});
const total=Math.max(1,Math.ceil(rows.length/8));const page=Math.max(0,Math.min(accountPages[kind]||0,total-1));accountPages[kind]=page;return rows.slice(page*8,page*8+8);}
    function renderAccountPager(kind,bodyId,render){const body=document.getElementById(bodyId),table=body?.closest('table');if(!table)return;let pager=document.getElementById('accountPager-'+kind);if(!pager){pager=document.createElement('div');pager.id='accountPager-'+kind;pager.style='display:flex;gap:10px;align-items:center;padding:10px;flex-wrap:wrap';table.parentElement.after(pager);}const count=profileRows(state[kind]||[]).length,page=accountPages[kind]||0;pager.innerHTML=count>8?`<button class="btn-small" data-direction="-1" ${page===0?'disabled':''}>Previous</button><span>${page*8+1}–${Math.min(count,page*8+8)} of ${count}</span><button class="btn-small" data-direction="1" ${(page+1)*8>=count?'disabled':''}>Next</button>`:'';pager.onclick=e=>{const button=e.target.closest('[data-direction]');if(button){accountPages[kind]+=Number(button.dataset.direction);render();}};}
    function datedInterestEntries(){return ['pf','ppf'].flatMap(kind=>allAccounts(kind).flatMap(a=>(a.interestCredits||[]).map(c=>({id:a.id+'-'+c.financialYearStartYear,date:c.creditedDate,member:a.member,accountName:a.account||a.scheme||kind.toUpperCase(),investmentType:kind,amount:c.amount,financialYear:financialYearLabel(c.financialYearStartYear)}))));}
    window.addEventListener('beforeunload',event=>{if(pendingSaves||persistenceDirty){event.preventDefault();event.returnValue='Changes are still being saved.';}});

    function archivedExpenseGuard(id){const expense=state.expenses.find(r=>r.id===id);if(expense?.loanId&&(state.archivedAccounts||[]).some(a=>a.kind==='debts'&&a.record.id===expense.loanId)){alert('Restore the archived debt in Settings before editing or deleting its EMI payments.');return true;}return false;}
    function viewArchivedAccount(index,page=0){
      const a=state.archivedAccounts[index],el=document.getElementById('archivedRecordDetails');if(!a||!el)return;
      const records=[...(state.retirementContributions||[]).filter(r=>r.investmentType===a.kind&&r.accountId===a.record.id),...(state.investmentContributions||[]).filter(r=>a.kind==='investments'&&r.investmentId===a.record.id),...(state.stallionContributions||[]).filter(r=>a.kind==='investments'&&r.stallionId===a.record.id),...(state.stallionProfitHistory||[]).filter(r=>a.kind==='investments'&&r.stallionId===a.record.id),...(state.expenses||[]).filter(r=>a.kind==='debts'&&r.loanId===a.record.id),...(a.record.interestCredits||[]).map(r=>({...r,date:r.creditedDate}))].sort((x,y)=>String(y.date).localeCompare(String(x.date)));
      el.innerHTML=`<details open><summary>${analyticEscape(a.kind.toUpperCase()+' · '+(a.record.member||a.record.type||''))} · archived record</summary><pre style="white-space:pre-wrap">${analyticEscape(JSON.stringify(a.record,null,2))}</pre><h3>Recorded history · ${records.length}</h3>${records.slice(page*8,page*8+8).map(r=>`<p>${analyticEscape(r.date)} · ${formatCurrency(r.amount??r.profit??0)}${r.profit!==undefined?' gain / loss snapshot':''}</p>`).join('')||'No dated entries.'}<p><button class="btn-small" onclick="viewArchivedAccount(${index},${page-1})" ${page===0?'disabled':''}>Previous</button> ${page+1} / ${Math.max(1,Math.ceil(records.length/8))} <button class="btn-small" onclick="viewArchivedAccount(${index},${page+1})" ${(page+1)*8>=records.length?'disabled':''}>Next</button></p></details>`;
    }
    function populateStatementPayments(){
      const select=document.getElementById('statementPayment');if(!select)return;const [kind,id]=document.getElementById('recordAccount').value.split(':');const old=select.value;
      const rows=kind==='debts'?state.expenses.filter(r=>r.loanId===id&&r.category==='EMI Payment'&&r.repaymentType!=='part-payment').sort((a,b)=>b.date.localeCompare(a.date)):[];
      select.innerHTML='<option value="">Choose a recorded EMI</option>'+rows.map(r=>`<option value="${r.id}">${r.date} · ${formatCurrency(r.amount)}</option>`).join('');if(rows.some(r=>r.id===old))select.value=old;
      document.getElementById('statementSplitPanel').hidden=kind!=='debts';
    }
    async function correctStatementPayment(){
      const id=document.getElementById('statementPayment').value,row=state.expenses.find(r=>r.id===id),loan=state.debts.find(d=>d.id===row?.loanId);if(!row||!loan){alert('Choose an EMI for an active debt. Restore archived debt before correcting payments.');return;}
      const text=document.getElementById('statementPrincipal').value,principal=Number(text),interest=Math.round((row.amount-principal)*100)/100;
      if(!text.trim()||!Number.isFinite(principal)||principal<0||interest<0){alert('Principal must be between zero and the EMI amount.');return;}
      const loanSnapshot=JSON.stringify(loan),rows=(state.expenses||[]).filter(r=>r.category==='EMI Payment'&&r.loanId===loan.id).map(r=>[r,JSON.stringify(r)]);
      row.principalPaid=principal;row.interestPaid=interest;row.interestOverride=true;
      const error=rebuildDebtRepaymentHistory(loan.id);
      if(error){Object.assign(loan,JSON.parse(loanSnapshot));for(const [entry,snapshot] of rows)Object.assign(entry,JSON.parse(snapshot));alert(error);return;}
      if(await saveData('Corrected EMI split from statement')){refreshAllPageViews();showImportStatus('EMI split updated. Total expense is unchanged; outstanding principal has been corrected.');}
    }

    function paginateHistoryTable(bodyId,reset=false){
      const body=document.getElementById(bodyId),table=body?.closest('table');if(!table)return;
      const rows=Array.from(body.rows).filter(r=>r.cells.length>1&&r.cells[0].colSpan===1),key='history-'+bodyId,total=Math.max(1,Math.ceil(rows.length/8));
      if(reset)accountPages[key]=0;const page=Math.min(Math.max(0,accountPages[key]||0),total-1);accountPages[key]=page;
      rows.forEach((row,i)=>{row.hidden=i<page*8||i>=page*8+8;});
      let pager=document.getElementById(key);if(!pager){pager=document.createElement('div');pager.id=key;pager.style='display:flex;gap:10px;align-items:center;padding:10px';table.parentElement.after(pager);}
      const html=rows.length>8?`<button class="btn-small" data-delta="-1" ${page===0?'disabled':''}>Previous</button><span>${page*8+1}–${Math.min(rows.length,page*8+8)} of ${rows.length}</span><button class="btn-small" data-delta="1" ${page+1===total?'disabled':''}>Next</button>`:'';
      if(pager._renderedHTML!==html){pager.innerHTML=html;pager._renderedHTML=html;}pager.onclick=e=>{const b=e.target.closest('[data-delta]');if(b){accountPages[key]+=Number(b.dataset.delta);paginateHistoryTable(bodyId);}};
    }

    // Backup care and mobile record editing.
    let recoveryAvailable=false, recoveryBusy=false, dataOperationBusy=false;
    function readRecovery(){
      return Promise.resolve(cloudRecovery);
    }
    function readLocalRecovery(){
      if(!financeDB){try{return Promise.resolve(JSON.parse(trackerStorage.getItem('personalFinanceRecovery')||'null'));}catch(error){return Promise.reject(error);}}
      return new Promise((resolve,reject)=>{const request=financeDB.transaction('records').objectStore('records').get('recovery');request.onsuccess=()=>resolve(request.result||null);request.onerror=()=>reject(request.error);});
    }
    async function renderRecovery(){
      const label=document.getElementById('recoveryStatus'),button=document.getElementById('restoreRecoveryBtn');if(!label)return;
      try{const snapshot=await readRecovery();recoveryAvailable=!!snapshot;label.textContent=snapshot?'Snapshot from '+new Date(snapshot.at).toLocaleString()+' · restores records from before the most recent import.':'A recovery snapshot will be kept automatically before your next successful import.';button.disabled=!snapshot||recoveryBusy;}
      catch(error){label.textContent='Recovery storage could not be read: '+error.message;button.disabled=true;}
    }
    async function restoreRecovery(){
      if(recoveryBusy||dataOperationBusy)return;
      if(!confirm('Restore the pre-import snapshot? This replaces current records. Export current records first if you want to keep them.'))return;
      recoveryBusy=true;dataOperationBusy=true;document.querySelector('.container').inert=true;const original=JSON.parse(JSON.stringify(state));
      try{await saveQueue;const snapshot=await readRecovery();if(!snapshot)throw new Error('No recovery snapshot is available');state=validateBackup(snapshot.data);storageLoadFailed=false;const saved=await saveData('Restored recovery snapshot');if(!saved){state=original;lastAccepted=JSON.parse(JSON.stringify(original));throw new Error('Restore could not be saved; current records were kept');}refreshImportedData();showImportStatus('Pre-import records restored and saved.');openDashboardAfterImport();}
      catch(error){showImportStatus(error.message,true);}
      finally{recoveryBusy=false;dataOperationBusy=false;document.querySelector('.container').inert=false;await renderRecovery();}
    }
    function readBackupCare(){try{return JSON.parse(trackerStorage.getItem('personalFinanceBackupCare')||'{}')||{};}catch(error){return {};}}
    function renderBackupCare(){
      const data=readBackupCare(),select=document.getElementById('backupReminderDays'),label=document.getElementById('backupCareStatus');if(!select||!label)return;
      const days=[0,7,30].includes(data.days)?data.days:7;select.value=String(days);
      const time=Date.parse(data.exportAt),valid=Number.isFinite(time),due=days>0&&(!valid||Date.now()-time>=days*86400000);
      label.textContent=(valid?'Last export requested: '+new Date(time).toLocaleString()+'.':'No backup export recorded in this browser.')+(due?' Backup reminder: export your latest records.':'');
      label.style.color=due?'var(--warning)':'var(--text-muted)';
    }
    function setBackupReminder(){const data=readBackupCare();data.days=Number(document.getElementById('backupReminderDays').value);try{trackerStorage.setItem('personalFinanceBackupCare',JSON.stringify(data));renderBackupCare();}catch(error){showImportStatus('Reminder preference could not be saved.',true);}}
    function recordBackupExport(){const data=readBackupCare();data.exportAt=new Date().toISOString();try{trackerStorage.setItem('personalFinanceBackupCare',JSON.stringify(data));renderBackupCare();}catch(error){showImportStatus('Backup download requested, but the export date could not be saved.',true);}}
    function runDataHealth(){
      const findings=[];let valid=true;
      try{validateBackup(state);}catch(error){valid=false;findings.push({level:'Error',text:error.message});}
      for(const kind of ['income','expenses']){
        const groups=new Map();for(const row of state[kind]||[]){const key=JSON.stringify([row.date,row.amount,row.member||'',row.source||row.category||'',row.subcategory||'',row.loanId||'']);const group=groups.get(key)||[];group.push(row.id);groups.set(key,group);}
        for(const ids of groups.values())if(ids.length>1)findings.push({level:'Review',text:`${kind}: ${ids.length} matching date/amount/category entries (${ids.slice(0,5).join(', ')}${ids.length>5?', …':''}). These may be legitimate separate receipts or payments.`});
      }
      for(const kind of ['pf','ppf'])for(const account of state[kind]||[])if(account.current<account.invested)findings.push({level:'Review',text:`${kind.toUpperCase()} · ${account.member||''} · ${account.account||account.id}: current balance is below invested amount. Check any withdrawals or balance corrections.`});
      for(const kind of ['pf','ppf','nps'])for(const a of state[kind]||[]){const monthly=retirementMonthlyAmount(a,kind);if(monthly>0&&a.contributionsThrough&&a.contributionsThrough<currentMonthKey())findings.push({level:'Review',text:`${kind.toUpperCase()} · ${a.account||a.id}: automatic contributions have not yet caught up to the current month.`});}
      for(const row of state.reconciliations||[]){if(!allAccounts(row.kind).some(a=>a.id===row.accountId))findings.push({level:'Information',text:`Statement check ${row.id} refers to a deleted account; the historical comparison is retained.`});}
      const target=document.getElementById('dataHealthResults');target.innerHTML=`<p><strong>${valid?'Structural validation passed.':'Structural validation needs attention.'}</strong> ${findings.length} finding(s). No data was changed.</p>`+findings.slice(0,100).map(f=>`<p><strong>${analyticEscape(f.level)}</strong> · ${analyticEscape(f.text)}</p>`).join('')+(findings.length>100?'<p>Showing the first 100 findings. Review entries, then run the check again.</p>':'');return{valid,findings};
    }
    function openRecordEditor(title,fields,validate,deleteRecord){
      const dialog=document.getElementById('recordEditorDialog'),form=document.getElementById('recordEditorForm');
      if(dialog.open)return Promise.resolve(null);
      document.getElementById('recordEditorTitle').textContent=title;document.getElementById('recordEditorError').textContent='';
      document.getElementById('recordEditorFields').innerHTML=fields.map(f=>`<div class="form-group" data-editor-field="${analyticEscape(f.key)}"><label for="recordEdit_${f.key}">${analyticEscape(f.label)}</label>${f.options?`<select id="recordEdit_${f.key}" name="${f.key}">${f.optional?`<option value="" ${String(f.value??'')===''?'selected':''}>${analyticEscape(f.placeholder||'-- Optional --')}</option>`:''}${[...new Set([...f.options,String(f.value??'')])].filter(Boolean).map(o=>`<option value="${analyticEscape(o)}" ${String(o)===String(f.value)?'selected':''}>${analyticEscape(f.optionLabels?.[o]||o)}</option>`).join('')}</select>`:f.type==='textarea'?`<textarea id="recordEdit_${f.key}" name="${f.key}" maxlength="${f.maxLength||240}" rows="3">${analyticEscape(String(f.value??''))}</textarea>`:`<input id="recordEdit_${f.key}" name="${f.key}" type="${f.type||'text'}" value="${analyticEscape(String(f.value??''))}" ${f.required===false?'':'required'} ${f.type==='number'?`step="any" min="${f.min??0}" ${f.max!==undefined?`max="${f.max}"`:''} inputmode="decimal"`:''} ${f.maxLength?`maxlength="${f.maxLength}"`:''}>`}</div>`).join('');
      for(const field of fields.filter(f=>f.autoCalc==='first-emi-extra')){const wrapper=document.querySelector(`[data-editor-field="${field.key}"]`),button=document.createElement('button'),help=document.createElement('small');button.type='button';button.className='btn-small';button.id=`recordEdit_${field.key}Recalculate`;button.textContent='Use calculated estimate';help.className='text-muted';help.textContent='Auto-estimated for days after one monthly cycle using actual days ÷ 365. Editable to match the bank. A first EMI under one month already uses pro-rata interest.';wrapper?.append(button,help);}
      const conditionalFields=fields.filter(f=>f.hideWhen),syncConditionalFields=()=>{const values=Object.fromEntries(new FormData(form));for(const field of conditionalFields){const condition=field.hideWhen,wrapper=document.querySelector(`[data-editor-field="${field.key}"]`);if(wrapper)wrapper.hidden=String(values[condition.key]??'')===String(condition.value);}};
      for(const field of conditionalFields)document.getElementById(`recordEdit_${field.hideWhen.key}`)?.addEventListener('change',syncConditionalFields);syncConditionalFields();
      for(const field of fields.filter(f=>f.autoCalc==='first-emi-extra')){
        const input=document.getElementById(`recordEdit_${field.key}`),recalculate=document.getElementById(`recordEdit_${field.key}Recalculate`);let manuallyEdited=false,initialized=false;
        const updateEstimate=force=>{if(manuallyEdited&&!force)return;const values=Object.fromEntries(new FormData(form));if(!initialized&&input.value!==''){initialized=true;manuallyEdited=true;return;}initialized=true;const firstEmiDate=values.firstEmiDate||firstLoanEmiDueDate({date:values.date,emiDueDay:values.emiDueDay?Number(values.emiDueDay):undefined});input.value=firstEmiDate?PFT_LOAN_LEDGER.estimateExtraFirstEmiInterest({principal:Number(values.principal),rate:Number(values.rate),date:values.date,firstEmiDate}).toFixed(2):'';};
        input?.addEventListener('input',()=>{manuallyEdited=true;});
        for(const key of ['principal','rate','date','firstEmiDate']){const source=document.getElementById(`recordEdit_${key}`);source?.addEventListener('input',()=>updateEstimate(false));source?.addEventListener('change',()=>updateEstimate(false));}
        recalculate?.addEventListener('click',()=>{manuallyEdited=false;initialized=true;updateEstimate(true);});updateEstimate(false);
      }
      const memberField=fields.find(f=>f.key==='member'&&/^Family member/i.test(f.label));
      if(memberField){
        const names=profileMemberNames(),select=document.getElementById('recordEdit_member');
        // Preserve historical assignments, including a removed member or an unassigned record.
        const creating=!/^Edit\b/i.test(title);
        if(creating&&!memberField.value&&select){const preferred=preferredEntryMember(names);if(preferred)select.value=preferred;}
        if(select&&names.length===1&&(creating||String(memberField.value||'')===names[0])){
          select.value=names[0];select.closest('.form-group').hidden=true;
        }
      }
      const previousFocus=document.activeElement;
      dialog.querySelector('[data-record-delete]')?.remove();
      const remove=deleteRecord?document.createElement('button'):null;
      if(remove){remove.type='button';remove.className='btn-small btn-danger';remove.dataset.recordDelete='';remove.textContent='Delete';remove.setAttribute('aria-label','Delete transaction');remove.title='Delete transaction';form.querySelector('.record-editor-actions').prepend(remove);}
      const initialFocus=dialog.querySelector('button[aria-label*="Close"],button.modal-close-button,button');
      initialFocus?.setAttribute('autofocus','');
      dialog.showModal();
      initialFocus?.focus({preventScroll:true});
      return new Promise(resolve=>{
        const finish=value=>{remove?.remove();form.onsubmit=null;dialog.oncancel=null;document.getElementById('cancelRecordEditor').onclick=null;dialog.close();previousFocus?.focus();resolve(value);};
        if(remove)remove.onclick=()=>{finish(null);deleteRecord();};
        document.getElementById('cancelRecordEditor').onclick=()=>finish(null);document.getElementById('closeRecordEditor').onclick=()=>finish(null);dialog.oncancel=event=>{event.preventDefault();finish(null);};
        form.onsubmit=event=>{event.preventDefault();if(!form.reportValidity())return;const values=Object.fromEntries(new FormData(form));for(const f of fields){if(f.type==='date'&&!(f.required===false&&values[f.key]==='')&&!validCalendarDate(values[f.key])){document.getElementById('recordEditorError').textContent='Enter a valid calendar date.';return;}}
          const error=validate?.(values);if(error){document.getElementById('recordEditorError').textContent=error;return;}finish(values);};
      });
    }
    async function editPlannedAdjustment(row){
      const id=row.id,original=JSON.stringify(row);
      const values=await openRecordEditor('Edit planned change',[{key:'date',label:'Date',type:'date',value:row.date},{key:'category',label:'Investment',value:row.category,maxLength:80},{key:'type',label:'Change',value:row.type,options:['add','withdraw']},{key:'amount',label:'Amount ₹',type:'number',min:0.01,value:row.amount},{key:'notes',label:'Description',type:'textarea',maxLength:120,value:row.notes||''}],v=>!v.category.trim()?'Enter an investment name.':null);
      if(!values)return;const current=state.projectionAdjustments.find(r=>r.id===id);if(!current||JSON.stringify(current)!==original){alert('This record changed while editing. Reopen it and try again.');return;}
      Object.assign(current,{date:values.date,category:values.category.trim(),type:values.type,amount:Number(values.amount),notes:values.notes});await saveData('Edited planned change');renderGrowthProjection();
    }

    // Storage
    function syncStallionPmsFromInvestments() {
      const existingById=new Map(state.stallionPms.map(row=>[row.id,row]));
      const validIds=new Set(allAccounts('investments').filter(row=>row.type==='Stallion PMS').map(row=>row.id));
      for(const inv of state.investments){
        if(inv.type!=='Stallion PMS')continue;
        const existing=existingById.get(inv.id);
        const values={member:inv.member,name:inv.name,invested:inv.invested,profit:inv.current-inv.invested};
        if(existing)Object.assign(existing,values);
        else{const row={id:inv.id,...values,createdDate:inv.date};state.stallionPms.push(row);existingById.set(inv.id,row);}
      }
      state.stallionPms=state.stallionPms.filter(row=>validIds.has(row.id));
    }

    // Tab Navigation
    const pageNav=document.querySelector('.nav-tabs');
    const mobileNavReveal=document.getElementById('mobileNavReveal');
    const mobileNavItems=document.getElementById('mobileNavItems');
    const mobileNavPrevious=document.getElementById('mobileNavPrevious');
    const mobileNavNext=document.getElementById('mobileNavNext');
    let mobileNavStart=0;
    function refreshMobileNavPages(ensureActive=false){
      const mobile=window.matchMedia('(max-width:700px)').matches;
      const tabs=[...document.querySelectorAll('.nav-tab')];
      const count=4;
      const maximum=Math.max(0,tabs.length-count);
      mobileNavStart=Math.max(0,Math.min(mobileNavStart,maximum));
      if(ensureActive){
        const index=tabs.findIndex(tab=>tab.classList.contains('active'));
        if(index>=0&&(index<mobileNavStart||index>=mobileNavStart+count))mobileNavStart=Math.min(maximum,Math.floor(index/count)*count);
      }
      mobileNavItems?.style.setProperty('--mobile-nav-count',String(count));
      tabs.forEach((tab,index)=>{tab.hidden=mobile&&(index<mobileNavStart||index>=mobileNavStart+count);});
      if(mobileNavPrevious)mobileNavPrevious.disabled=!mobile||mobileNavStart===0;
      if(mobileNavNext)mobileNavNext.disabled=!mobile||mobileNavStart>=maximum;
    }
    function moveMobileNavPages(direction){
      if(!window.matchMedia('(max-width:700px)').matches)return;
      mobileNavStart+=direction*4;
      refreshMobileNavPages();
    }
    mobileNavPrevious?.addEventListener('click',()=>moveMobileNavPages(-1));
    mobileNavNext?.addEventListener('click',()=>moveMobileNavPages(1));
    refreshMobileNavPages(true);
    let mobileNavLastY=Math.max(0,window.scrollY),mobileNavDownDistance=0,mobileNavUpDistance=0;
    function setMobileNavHidden(hidden){
      const isMobile=window.matchMedia('(max-width:700px)').matches;
      const shouldHide=Boolean(hidden&&isMobile);
      document.body.classList.toggle('mobile-nav-hidden',shouldHide);
      if(pageNav){pageNav.inert=shouldHide;pageNav.setAttribute('aria-hidden',String(shouldHide));}
      if(mobileNavReveal){mobileNavReveal.setAttribute('aria-hidden',String(!shouldHide));mobileNavReveal.tabIndex=shouldHide?0:-1;}
    }
    window.addEventListener('scroll',()=>{
      const y=Math.max(0,window.scrollY),delta=y-mobileNavLastY;
      if(!window.matchMedia('(max-width:700px)').matches){setMobileNavHidden(false);mobileNavDownDistance=mobileNavUpDistance=0;mobileNavLastY=y;return;}
      if(y<=48){mobileNavDownDistance=mobileNavUpDistance=0;setMobileNavHidden(false);}
      else if(delta>0){mobileNavDownDistance+=delta;mobileNavUpDistance=0;if(mobileNavDownDistance>=16){if(pageNav?.contains(document.activeElement))document.activeElement.blur();setMobileNavHidden(true);}}
      else if(delta<0){mobileNavUpDistance+=-delta;mobileNavDownDistance=0;if(mobileNavUpDistance>=8)setMobileNavHidden(false);}
      mobileNavLastY=y;
    },{passive:true});
    mobileNavReveal?.addEventListener('click',()=>{setMobileNavHidden(false);pageNav?.querySelector('.nav-tab.active')?.focus({preventScroll:true});});
    window.addEventListener('resize',()=>{refreshMobileNavPages(true);if(!window.matchMedia('(max-width:700px)').matches)setMobileNavHidden(false);});
    const pageSwipeIgnoreSelector='button,a,input,select,textarea,summary,[contenteditable="true"],[role="button"],[role="dialog"],[aria-modal="true"],[role="listbox"],dialog,canvas,#familyProfileMenu,.nav-tabs,.table-wrapper,.investment-returns-chart-scroll,.modal,.dialog';
    let pageSwipeStart=null;
    function hasHorizontalScrollArea(target){
      for(let node=target;node&&node!==document.body;node=node.parentElement){
        const overflow=getComputedStyle(node).overflowX;
        if((overflow==='auto'||overflow==='scroll')&&node.scrollWidth>node.clientWidth+8)return true;
      }
      return false;
    }
    document.addEventListener('touchstart',event=>{
      pageSwipeStart=null;
      if(!window.matchMedia('(max-width:700px)').matches||event.touches.length!==1)return;
      const touch=event.touches[0],target=event.target instanceof Element?event.target:null;
      if(!target||touch.clientX<24||touch.clientX>window.innerWidth-24||target.closest(pageSwipeIgnoreSelector)||hasHorizontalScrollArea(target))return;
      pageSwipeStart={x:touch.clientX,y:touch.clientY,time:Date.now()};
    },{passive:true});
    document.addEventListener('touchend',event=>{
      if(!pageSwipeStart||!window.matchMedia('(max-width:700px)').matches||event.changedTouches.length!==1){pageSwipeStart=null;return;}
      const start=pageSwipeStart;pageSwipeStart=null;
      const touch=event.changedTouches[0],dx=touch.clientX-start.x,dy=touch.clientY-start.y;
      if(Date.now()-start.time>700||Math.abs(dx)<65||Math.abs(dx)<Math.abs(dy)*1.35)return;
      const tabs=[...document.querySelectorAll('.nav-tab')],activeIndex=tabs.findIndex(tab=>tab.classList.contains('active'));
      if(activeIndex<0)return;
      const nextIndex=dx<0?activeIndex-1:activeIndex+1;
      if(nextIndex>=0&&nextIndex<tabs.length)tabs[nextIndex].click();
    },{passive:true});
    document.querySelectorAll('[data-open-tab]').forEach(button=>button.addEventListener('click',()=>document.querySelector(`.nav-tab[data-tab="${button.dataset.openTab}"]`)?.click()));
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        setMobileNavHidden(false);
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        tab.classList.add('active');
        const tabId = tab.dataset.tab;
        try{trackerStorage.setItem('activePage',tabId);}catch(_){}
        const layoutTitle=document.getElementById('layoutPageTitle');
        if(layoutTitle)layoutTitle.textContent=tab.getAttribute('aria-label')||tab.textContent.trim().replace(/\s+/g,' ');
        refreshMobileNavPages(true);
        const tabContent = document.getElementById(tabId);
        if (tabContent) {
          tabContent.classList.add('active');
          if(window.matchMedia('(max-width:700px)').matches)window.scrollTo({top:0,behavior:'instant'});
          renderStartupPage(tabId);
          if (tabId === 'analytics') renderCharts();
          if (tabId === 'reports'){populateReportFinancialYears();if(document.getElementById('reportStartDate')?.value)renderRangeReport();}
          if (tabId === 'growth-projection') renderGrowthProjection();
        } else {
          console.warn(' Tab content not found for:', tabId);
        }
      });
    });

    // Format Currency
    function formatCurrency(amount) {
      return '₹' + Math.round(amount).toLocaleString('en-IN');
    }
    function formatProjectionLakh(amount) {
      const value=Number(amount);
      if(!Number.isFinite(value))return '—';
      const lakhs=Math.round(Math.abs(value)/100000*10)/10;
      const label=Number.isInteger(lakhs)?String(lakhs):lakhs.toFixed(1);
      return `${value<0?'-':''}₹${label}L`;
    }

    // Generate ID
    function generateId() {
      return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    function scheduledEmiDueDate(paymentDate,dueDay){
      if(!validCalendarDate(paymentDate)||!Number.isInteger(Number(dueDay))||Number(dueDay)<1||Number(dueDay)>31)return null;
      const [year,month]=paymentDate.split('-').map(Number),lastDay=new Date(Date.UTC(year,month,0)).getUTCDate();
      return `${year}-${String(month).padStart(2,'0')}-${String(Math.min(Number(dueDay),lastDay)).padStart(2,'0')}`;
    }
    function nextLoanDueMonth(date,dueDay){
      const [year,month]=date.split('-').map(Number),next=new Date(Date.UTC(year,month,1));
      return scheduledEmiDueDate(next.toISOString().slice(0,10),dueDay);
    }
    function firstLoanEmiDueDate(debt){
      if(debt.firstEmiDate&&validCalendarDate(debt.firstEmiDate))return debt.firstEmiDate;
      let due=scheduledEmiDueDate(debt.date,debt.emiDueDay);
      if(!due)return null;
      const start=Date.parse(debt.date+'T00:00:00Z');
      while((Date.parse(due+'T00:00:00Z')-start)/86400000<30)due=nextLoanDueMonth(due,debt.emiDueDay);
      return due;
    }
    function nextLoanEmiDueDate(debt){
      let due=firstLoanEmiDueDate(debt);
      if(!due||Number(debt.remaining)<=0)return null;
      const payments=(state.expenses||[]).filter(row=>row.category==='EMI Payment'&&row.loanId===debt.id&&row.repaymentType!=='part-payment'&&validCalendarDate(row.date)).sort((a,b)=>a.date.localeCompare(b.date));
      for(const payment of payments)if(payment.date>=due)due=nextLoanDueMonth(payment.date,debt.emiDueDay??Number(debt.firstEmiDate?.slice(-2)));
      return due;
    }
    function loanDueDateLabel(debt){
      const due=nextLoanEmiDueDate(debt);
      return Number(debt.remaining)<=0?'Paid off':due?calendarDate(due).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}):'Not set';
    }
    function confirmLateEmiPaymentDate(debt,paymentDate){
      if(!debt?.emiDueDay||!validCalendarDate(paymentDate))return true;
      const dueDate=scheduledEmiDueDate(paymentDate,debt.emiDueDay);
      if(!dueDate||paymentDate<=dueDate)return true;
      const display=value=>calendarDate(value).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
      return confirm(`This Monthly EMI is dated ${display(paymentDate)}, after its scheduled due date (${display(dueDate)}). Recorded part payments are prorated within the EMI interval; late-payment fees are not added. Continue with this date?`);
    }



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
        const principal=accounts.reduce((sum,debt)=>sum+(Number(debt.principal)||Number(debt.remaining)||0),0);
        const share=total>0?amount/total*100:0;
        const paid=principal>0?Math.max(0,Math.min(100,(principal-amount)/principal*100)):0;
        const key=`debt-summary-${index}`;
        const details=accounts.map((debt,accountIndex)=>{
          const schedule=remainingEmiEstimate(debt);
          const label=debt.notes?analyticEscape(debt.notes):`${analyticEscape(type)} account ${accountIndex+1}`;
          return `<tr><td><strong>${label}</strong></td><td class="text-right">${formatCurrency(debt.remaining)}</td><td class="text-right">${formatCurrency(debt.emi)}</td><td class="text-right">${schedule.label}</td></tr>`;
        }).join('');
        return `<section class="debt-summary-card" style="--debt-color:${colors[index%colors.length]}">
          <button type="button" class="debt-summary-card-toggle" data-debt-summary-toggle aria-expanded="false" aria-controls="${key}">
            <span class="debt-summary-card-top"><span class="debt-summary-type"><i class="debt-summary-dot"></i>${analyticEscape(type)}</span><span class="debt-summary-share">${share.toFixed(1)}% of total debt</span></span>
            <span class="debt-summary-card-amount"><strong>${formatCurrency(amount)}</strong></span>
            <span class="debt-summary-track" role="img" aria-label="${paid.toFixed(1)}% paid, ${(100-paid).toFixed(1)}% remaining"><i style="width:${paid.toFixed(1)}%"></i></span>
            <span class="debt-summary-card-hint"><span>${accounts.length} account${accounts.length===1?'':'s'} · View details <span class="debt-summary-chevron" aria-hidden="true">⌄</span></span><span class="debt-summary-paid">Paid: ${paid.toFixed(1)}%</span></span>
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

    // INCOME
    document.getElementById('incomeDate').value = localDateKey();
    document.getElementById('expenseDate').value = localDateKey();
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
      document.getElementById('incomeDate').value = localDateKey();
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
      const years = [...new Set([currentYear, ...(['surplusTrendFinancialYear','stallionProfitTrendFinancialYear'].includes(selectId) && preferredStartYear ? [preferredStartYear] : []), ...monthKeys.map(financialYearStartYearForMonthKey).filter(year => year <= currentYear)])].sort((a,b)=>b-a);
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
    function filterTransactionHistory(rows,kind) {
      const query=(document.getElementById(`${kind}HistorySearch`)?.value||'').trim().toLocaleLowerCase();
      if(!query)return rows;
      return rows.filter(row=>{const debt=row.loanId?allAccounts('debts').find(item=>item.id===row.loanId):null;return [row.member,row.source,row.category,row.subcategory,row.notes,row.date,row.amount,formatCurrency(row.amount),debt?.type,row.category==='EMI Payment'?'EMI':row.isAnnual?'Annual':'Monthly'].some(value=>String(value??'').toLocaleLowerCase().includes(query));});
    }
    function renderTransactionPagination(kind,total) {
      const pageCount=Math.max(1,Math.ceil(total/TRANSACTION_HISTORY_PAGE_SIZE));
      transactionHistoryPages[kind]=Math.min(Math.max(transactionHistoryPages[kind]||1,1),pageCount);
      const page=transactionHistoryPages[kind],start=total?(page-1)*TRANSACTION_HISTORY_PAGE_SIZE+1:0,end=Math.min(page*TRANSACTION_HISTORY_PAGE_SIZE,total);
      const title=kind==='income'?'Income':'Expense';
      document.getElementById(`${kind}HistoryPaginationSummary`).innerHTML=`<span>Showing ${start}–${end} of ${total} entries</span>`;
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
      const month=document.getElementById(`${kind}HistoryMonth`).value;const rows=kind==='income'?profileRows(state.income):state.expenses;const total=filterTransactionHistory(rows.filter(row=>row.date.slice(0,7)===month),kind).length;
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
      const monthRecords=incomeRows.filter(i=>i.date.slice(0,7)===selectedMonth);
      const records = sortTransactionHistoryRecords(filterTransactionHistory(monthRecords,'income').sort((a,b)=>b.date.localeCompare(a.date)),'income');
      renderTransactionHistorySummary('income',monthRecords);
      const pageCount=Math.max(1,Math.ceil(records.length/TRANSACTION_HISTORY_PAGE_SIZE));
      transactionHistoryPages.income=Math.min(Math.max(transactionHistoryPages.income||1,1),pageCount);
      const pageStart=(transactionHistoryPages.income-1)*TRANSACTION_HISTORY_PAGE_SIZE;
      const pageRecords=records.slice(pageStart,pageStart+TRANSACTION_HISTORY_PAGE_SIZE);
      if (records.length === 0) {
        const label = selectedMonth ? new Date(selectedMonth + '-01T12:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : financialYearLabel(selectedYear);
        tbody.innerHTML = `<tr><td colspan="5" class="text-muted">${document.getElementById('incomeHistorySearch').value.trim()?'No matching income transactions.':`No income recorded for ${analyticEscape(label)}.`}</td></tr>`;
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
      const values=await openRecordEditor('Edit income',[{key:'member',label:'Family member',value:income.member||'',options:Array.from(document.getElementById('incomeMember').options,o=>o.value)},{key:'amount',label:'Amount ₹',type:'number',min:0.01,value:income.amount},{key:'date',label:'Receipt date',type:'date',value:income.date},{key:'notes',label:'Notes',type:'textarea',value:income.notes||''}],v=>income.recurringMonth&&v.date.slice(0,7)!==income.recurringMonth?'Keep this recurring entry in its scheduled month. Adjust its amount or day within that month.':null,()=>deleteIncome(id));
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
      const values=await openRecordEditor('Edit expense',fields,v=>expense.recurringMonth&&v.date.slice(0,7)!==expense.recurringMonth?'Keep this recurring entry in its scheduled month. Adjust its amount or day within that month.':null,()=>deleteExpense(id));
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


    // INVESTMENTS
    // Mobile-only section switcher: one view at a time; no changes to financial data.
    const investmentSectionTabs=document.getElementById('investmentMobileSectionTabs');
    const setInvestmentMobileSection=(section,focus=false)=>{
      const choice=section==='retirement'?'retirement':'investments';
      const page=document.getElementById('investments');
      if(!page||!investmentSectionTabs)return;
      page.dataset.mobileInvestmentView=choice;
      for(const tab of investmentSectionTabs.querySelectorAll('[data-investment-mobile-tab]')){
        const active=tab.dataset.investmentMobileTab===choice;
        tab.setAttribute('aria-selected',String(active));
        tab.tabIndex=active?0:-1;
        if(active&&focus)tab.focus();
      }
      try{localStorage.setItem('pft-mobile-investment-section',choice);}catch(_){}
    };
    if(investmentSectionTabs){
      let initial='investments';
      try{initial=localStorage.getItem('pft-mobile-investment-section')||initial;}catch(_){}
      setInvestmentMobileSection(initial);
      investmentSectionTabs.addEventListener('click',event=>{
        const tab=event.target.closest('[data-investment-mobile-tab]');
        if(tab&&investmentSectionTabs.contains(tab))setInvestmentMobileSection(tab.dataset.investmentMobileTab);
      });
      investmentSectionTabs.addEventListener('keydown',event=>{
        if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
        event.preventDefault();
        const current=document.getElementById('investments')?.dataset.mobileInvestmentView;
        const next=event.key==='Home'?'investments':event.key==='End'?'retirement':current==='investments'?'retirement':'investments';
        setInvestmentMobileSection(next,true);
      });
    }
    function customInvestmentProfile(type){return state.customInvestmentProfiles?.[String(type||'').trim()]||null;}
    function investmentGrowthType(type){
      const name=String(type||'').trim();
      if(name==='Mutual Funds'||name==='Stallion PMS'||name==='NPS')return 'market';
      if(name==='Bonds'||name==='Fixed Deposits'||name==='PF'||name==='PPF')return 'fixed';
      const profile=customInvestmentProfile(name);
      if(profile?.growthType)return profile.growthType;
      return 'market';
    }
    function investmentUsesInterestRate(type) { return type==='Bonds'||type==='Fixed Deposits'||customInvestmentProfile(type)?.growthType==='fixed'; }
    function investmentUsesReturnMetrics(type) { return investmentGrowthType(type)==='market'&&type!=='Stallion PMS'; }
    function investmentMonthlyAmount(row){
      const profile=customInvestmentProfile(row?.type);
      const growthType=profile?.growthType||investmentGrowthType(row?.type);
      if(row?.autoMonthlyContribution===false)return 0;
      if(row?.autoMonthlyContribution===true)return Number(row?.monthly)||0;
      return growthType==='market'?Number(row?.monthly)||0:0;
    }
    function retirementMonthlyAmount(row,kind){
      if(row?.autoMonthlyContribution===false)return 0;
      return kind==='pf'?(Number(row?.employee)||0)+(Number(row?.employer)||0)-(Number(row?.epsMonthly)||0):(Number(row?.monthly)||0);
    }
    function updateRetirementMonthlyColumn(kind){
      const accounts=state[kind]||[],show=accounts.some(row=>retirementMonthlyAmount(row,kind)>0),prefix=kind==='pf'?'pf':kind==='nps'?'nps':'ppf';
      const tbody=document.getElementById(`${prefix}Body`),table=tbody?.closest('table');
      table?.querySelectorAll('.monthly-contribution-column').forEach(cell=>cell.hidden=!show);
      const tile=document.getElementById(`${prefix}TileMonthlyWrap`);if(tile)tile.hidden=!show;
    }
    function syncRetirementMonthlyForm(kind){
      const toggle=document.getElementById(`${kind}AutomaticMonthly`),enabled=Boolean(toggle?.checked);
      const ids=kind==='pf'?['pfEmployeeMonthlyGroup','pfEmployerMonthlyGroup','pfEpsMonthlyGroup']:[`${kind}MonthlyGroup`];
      ids.forEach(id=>{const group=document.getElementById(id);if(group)group.hidden=!enabled;});
    }
    [['pf','pfAutomaticMonthly'],['ppf','ppfAutomaticMonthly'],['nps','npsAutomaticMonthly']].forEach(([kind,id])=>{
      const toggle=document.getElementById(id);toggle?.addEventListener('change',()=>syncRetirementMonthlyForm(kind));syncRetirementMonthlyForm(kind);
    });
    function updateInvestmentRateField() {
      const type=document.getElementById('investType')?.value,profile=customInvestmentProfile(type),group=document.getElementById('investRateGroup'),currentGroup=document.getElementById('investCurrentGroup'),monthlyGroup=document.getElementById('investMonthlyGroup'),autoGroup=document.getElementById('investAutomaticMonthlyGroup'),autoToggle=document.getElementById('investAutomaticMonthly'),monthlyInput=document.getElementById('investMonthly'),rateInput=document.getElementById('investRate');
      const noReturn=investmentGrowthType(type)==='no-return',monthlyDateGroup=document.getElementById('investMonthlyDateGroup');
      if(group)group.hidden=!investmentUsesInterestRate(type);
      if(currentGroup)currentGroup.hidden=Boolean(noReturn);
      if(autoGroup)autoGroup.hidden=false;
      if(monthlyGroup)monthlyGroup.hidden=!autoToggle?.checked;
      if(monthlyDateGroup)monthlyDateGroup.hidden=!autoToggle?.checked;
      if(autoToggle?.checked&&monthlyInput&&monthlyInput.value==='')monthlyInput.value='';
    }
    document.getElementById('investAutomaticMonthly')?.addEventListener('change',updateInvestmentRateField);
    function syncInvestmentOverlayBodyLock() {
      const parents=[document.getElementById('investmentCategoryDialog'),document.getElementById('retirementCategoryDialog'),document.getElementById('growthAssumptionDialog')].filter(dialog=>dialog&&!dialog.hidden);
      const actionOpen=[...document.querySelectorAll('.investment-edit-modal')].some(modal=>!modal.hidden);
      parents.forEach(dialog=>dialog.setAttribute('aria-modal',actionOpen?'false':'true'));
      document.body.style.overflow=parents.length||actionOpen?'hidden':'';
    }
    function renderInvestmentCategoryDialog(type,show=false) {
      const dialog=document.getElementById('investmentCategoryDialog');
      const card=[...document.querySelectorAll('.investment-category-card')].find(item=>item.dataset.investmentType===type);
      if(!dialog||!card){if(dialog&&!dialog.hidden)closeInvestmentCategoryDialog();return;}
      const sourceSummary=card.querySelector('.investment-category-summary-grid');
      const summary=document.getElementById('investmentCategoryDialogSummary');
      const table=document.getElementById('investmentCategoryDialogTable');
      document.getElementById('investmentCategoryDialogTitle').textContent=type;
      document.getElementById('investmentCategoryDialogSubtitle').textContent=card.querySelector('.investment-category-summary')?.textContent||'Investment holdings';
      summary.replaceChildren();
      [...(sourceSummary?.children||[])].filter(item=>!item.classList.contains('investment-summary-chevron')).forEach(item=>(()=>{const clone=item.cloneNode(true);clone.removeAttribute?.('id');clone.querySelectorAll?.('[id]').forEach(element=>element.removeAttribute('id'));summary.appendChild(clone);})());
      const tableSource=card.querySelector('.investment-category-dialog-source .table-wrapper');
      table.replaceChildren();
      if(tableSource){const clone=tableSource.cloneNode(true);clone.classList.add('investment-category-dialog-table');table.appendChild(clone);labelInvestmentDialogCells(table);renderPmsStyleModalActions(table);}
      else table.textContent='No holdings available.';
      delete dialog.dataset.stallionId;dialog.dataset.investmentType=type;
      if(show&&dialog.hidden){dialog.hidden=false;document.body.style.overflow='hidden';dialog.querySelector('[data-close-investment-category-dialog]')?.focus();}
    }
    // Preserve the original data table for mobile, and create a full-width
    // Stallion PMS-style action area OUTSIDE the desktop table for each holding.
    function labelInvestmentDialogCells(container) {
      container.querySelectorAll('table').forEach(table=>{
        const labels=[...table.querySelectorAll('thead th')].map(cell=>cell.textContent.trim().replace(/[↕▲▼]/g,'').trim());
        table.querySelectorAll('tbody tr').forEach(row=>{
          [...row.children].forEach((cell,index)=>{
            if(cell.matches('td,th'))cell.dataset.mobileLabel=labels[index]||'Details';
          });
        });
      });
    }
    function renderPmsStyleModalActions(container) {
      const table=container.querySelector('.investment-category-dialog-table table');
      if(!table)return;
      const rows=[...table.querySelectorAll('tbody tr')];
      const entries=rows.map(row=>{
        const cell=row.querySelector('td.investment-row-actions,td.account-action-buttons');
        return cell?{row,cell,buttons:[...cell.querySelectorAll('button')]}:null;
      }).filter(entry=>entry&&entry.buttons.length);
      if(!entries.length)return;
      const header=table.querySelector('thead tr th:last-child');
      header?.classList.add('pms-modal-original-actions');
      const list=document.createElement('div');
      list.className='pms-modal-action-list';
      list.setAttribute('aria-label','Holding actions');
      const definitions=[
        {key:'history',text:'View History',path:['M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18','M12 7v5l3 2']},
        {key:'edit',text:'Edit',path:['m4 16.5-.8 4.3 4.3-.8L19 8.5 15.5 5 4 16.5Z','m13.5 7 3.5 3.5']},
        {key:'delete',text:'Delete',path:['M4 7h16','M10 11v6m4-6v6','M6 7l1 13h10l1-13','M9 7V4h6v3']},
        {key:'add',text:'Add contribution',path:['M12 5v14','M5 12h14']},
        {key:'update',text:'Update value',path:['m4 16 5-5 4 3 7-9','M15 5h5v5']}
      ];
      const kindFor=button=>{
        const label=[button.getAttribute('aria-label'),button.getAttribute('title'),button.dataset.shortAction,button.textContent].filter(Boolean).join(' ').toLowerCase();
        if(/histor/.test(label))return 'history';
        if(/edit/.test(label))return 'edit';
        if(/delet/.test(label))return 'delete';
        if(/contribution|\badd\b/.test(label))return 'add';
        if(/updat|valuat/.test(label))return 'update';
        return '';
      };
      const svgNamespace='http://www.w3.org/2000/svg';
      for(const {row,cell,buttons} of entries){
        cell.classList.add('pms-modal-original-actions');
        const section=document.createElement('section');
        section.className='pms-modal-holding-actions';
        if(entries.length>1){
          const heading=document.createElement('strong');
          heading.className='pms-modal-holding-name';
          heading.textContent=row.children[1]?.textContent.trim()||row.children[0]?.textContent.trim()||'Holding';
          section.append(heading);
        }
        const bar=document.createElement('div');
        bar.className='pms-modal-action-bar';
        for(const sourceButton of buttons.sort((a,b)=>{
          const aRank=definitions.findIndex(item=>item.key===kindFor(a)),bRank=definitions.findIndex(item=>item.key===kindFor(b));
          return (aRank<0?99:aRank)-(bRank<0?99:bRank);
        })){
          const definition=definitions.find(item=>item.key===kindFor(sourceButton));
          const button=document.createElement('button');
          button.type='button';
          button.className='pms-modal-action-button'+(definition?.key==='delete'?' is-danger':'');
          const label=definition?.text||sourceButton.textContent.trim()||sourceButton.getAttribute('aria-label')||'Action';
          button.setAttribute('aria-label',label);
          button.disabled=sourceButton.disabled;
          if(definition){
            const svg=document.createElementNS(svgNamespace,'svg');
            svg.setAttribute('viewBox','0 0 24 24');
            svg.setAttribute('aria-hidden','true');
            for(const pathData of definition.path){
              const path=document.createElementNS(svgNamespace,'path');
              path.setAttribute('d',pathData);
              svg.append(path);
            }
            button.append(svg);
          }
          const name=document.createElement('span');
          name.textContent=label;
          button.append(name);
          // Delegate to the original control to preserve every account-specific action.
          button.addEventListener('click',()=>sourceButton.click());
          bar.append(button);
        }
        section.append(bar);
        list.append(section);
      }
      container.append(list);
    }
    function refreshInvestmentCategoryDialog() {
      const dialog=document.getElementById('investmentCategoryDialog');
      if(dialog&&!dialog.hidden&&dialog.dataset.investmentType)renderInvestmentCategoryDialog(dialog.dataset.investmentType,false);
    }
    function closeInvestmentCategoryDialog() {
      const dialog=document.getElementById('investmentCategoryDialog');
      if(dialog&&!dialog.hidden){dialog.hidden=true;delete dialog.dataset.investmentType;delete dialog.dataset.stallionId;syncInvestmentOverlayBodyLock();}
    }
    function renderRetirementCategoryDialog(type,show=false) {
      const dialog=document.getElementById('retirementCategoryDialog');
      const card=[...document.querySelectorAll('.retirement-account-card')].find(item=>item.dataset.retirementType===type);
      if(!dialog||!card||card.hidden){if(dialog&&!dialog.hidden)closeRetirementCategoryDialog();return;}
      const summarySource=card.querySelector('.retirement-account-summary');
      const tableSource=card.querySelector('.retirement-account-details .table-wrapper');
      const title=card.querySelector('.panel-header h2')?.textContent||type.toUpperCase();
      document.getElementById('retirementCategoryDialogTitle').textContent=title;
      document.getElementById('retirementCategoryDialogSubtitle').textContent=card.querySelector('.retirement-account-count')?.textContent||'Retirement account details';
      const summary=document.getElementById('retirementCategoryDialogSummary');summary.replaceChildren();
      [...(summarySource?.children||[])].filter(item=>!item.classList.contains('investment-summary-chevron')).forEach(item=>(()=>{const clone=item.cloneNode(true);clone.removeAttribute?.('id');clone.querySelectorAll?.('[id]').forEach(element=>element.removeAttribute('id'));summary.appendChild(clone);})());
      const table=document.getElementById('retirementCategoryDialogTable');table.replaceChildren();
      if(tableSource){const clone=tableSource.cloneNode(true);clone.classList.add('investment-category-dialog-table');clone.querySelectorAll('[id]').forEach(element=>element.removeAttribute('id'));table.appendChild(clone);labelInvestmentDialogCells(table);renderPmsStyleModalActions(table);}
      else table.textContent='No account details available.';
      const pagerSource=card.querySelector(`#accountPager-${type}`);
      if(pagerSource){const pager=pagerSource.cloneNode(true);pager.removeAttribute('id');pager.onclick=event=>{const button=event.target.closest('[data-direction]');if(!button)return;accountPages[type]=Math.max(0,(accountPages[type]||0)+Number(button.dataset.direction));({pf:renderPf,ppf:renderPpf,nps:renderNps}[type]||(()=>{}))();};table.appendChild(pager);}
      const actions=document.getElementById('retirementCategoryDialogActions');actions.replaceChildren();
      const sourceActions=card.querySelector('.retirement-account-actions');
      // NPS balance updates live in each account's shared action footer, not the modal header.
      if(sourceActions&&type!=='nps'){const clone=sourceActions.cloneNode(true);clone.querySelectorAll('[id]').forEach(element=>element.removeAttribute('id'));actions.appendChild(clone);}
      document.getElementById('retirementCategoryDialogNote').textContent=card.querySelector('.retirement-account-help')?.textContent||'';
      dialog.dataset.retirementType=type;
      if(show&&dialog.hidden){dialog.hidden=false;document.body.style.overflow='hidden';dialog.querySelector('[data-close-retirement-category-dialog]')?.focus();}
    }
    function refreshRetirementCategoryDialog() {
      const dialog=document.getElementById('retirementCategoryDialog');
      if(dialog&&!dialog.hidden&&dialog.dataset.retirementType)renderRetirementCategoryDialog(dialog.dataset.retirementType,false);
    }
    function closeRetirementCategoryDialog() {
      const dialog=document.getElementById('retirementCategoryDialog');
      if(dialog&&!dialog.hidden){dialog.hidden=true;delete dialog.dataset.retirementType;syncInvestmentOverlayBodyLock();}
    }
    function retirementAccountRateSummary(accounts) {
      if(!accounts.length)return {label:'—',title:'No account interest rates yet'};
      const rates=[...new Set(accounts.map(account=>Number(account.rate)||0).map(rate=>rate.toFixed(2)))];
      return rates.length===1?{label:`${rates[0]}% p.a.`,title:`Interest rate ${rates[0]}% p.a.`}:{label:'Multiple rates',title:`Rates: ${rates.map(rate=>`${rate}%`).join(', ')}`};
    }
    function npsPortfolioXirr(accounts=state.nps,asOf=localDateKey()) {
      if(!accounts.length||!validCalendarDate(asOf))return null;
      const flows=[];
      const contributionsByAccount=new Map();
      for(const row of state.retirementContributions||[])if(row.investmentType==='nps'){
        if(!contributionsByAccount.has(row.accountId))contributionsByAccount.set(row.accountId,[]);
        contributionsByAccount.get(row.accountId).push(row);
      }
      for(const account of accounts){
        if(!validCalendarDate(account.date)||account.date>asOf)return null;
        const contributions=(contributionsByAccount.get(account.id)||[]).filter(row=>row.date>=account.date&&row.date<=asOf&&row.amount>0);
        const contributionTotal=contributions.reduce((sum,row)=>sum+Number(row.amount||0),0);
        const openingInvested=Number(account.invested)-contributionTotal,current=Number(account.current);
        if(!Number.isFinite(openingInvested)||openingInvested<-.01||!Number.isFinite(current)||current<0)return null;
        if(openingInvested>.01)flows.push({date:account.date,amount:-openingInvested});
        contributions.forEach(row=>flows.push({date:row.date,amount:-Number(row.amount)}));
        if(current>0)flows.push({date:asOf,amount:current});
      }
      return calculateXirr(flows);
    }
    function updateRetirementAccountSummary(kind) {
      const accounts=profileRows(state[kind]||[]),current=accounts.reduce((sum,row)=>sum+(Number(row.current)||0),0);
      const invested=accounts.reduce((sum,row)=>sum+(Number(row.invested??(kind==='pf'?row.current:0))||0),0);
      const gain=current-invested;
      const monthly=accounts.reduce((sum,row)=>sum+retirementMonthlyAmount(row,kind),0);
      const prefix=kind==='pf'?'pf':kind==='nps'?'nps':'ppf';
      const count=document.getElementById(`${prefix}TileCount`),balance=document.getElementById(`${prefix}TileCurrent`),investedNode=document.getElementById(`${prefix}TileInvested`),gainNode=document.getElementById(`${prefix}TileGain`),monthlyNode=document.getElementById(`${prefix}TileMonthly`);
      if(count)count.textContent=`${accounts.length} ${accounts.length===1?'account':'accounts'}`;
      if(balance)balance.textContent=formatCurrency(current);
      if(investedNode)investedNode.textContent=formatCurrency(invested);
      if(gainNode){gainNode.textContent=`${gain>=0?'+':''}${formatCurrency(gain)}`;gainNode.classList.toggle('positive',gain>=0);gainNode.classList.toggle('negative',gain<0);}
      if(monthlyNode)monthlyNode.textContent=formatCurrency(monthly+(kind==='pf'?accounts.reduce((sum,row)=>sum+(row.autoMonthlyContribution===false?0:Number(row.epsMonthly)||0),0):0));
      updateRetirementMonthlyColumn(kind);
      if(kind==='pf'){document.getElementById('pfTileEpsCurrent').textContent=formatCurrency(accounts.reduce((sum,row)=>sum+(Number(row.epsCurrent)||0),0));}
      if(kind==='pf'||kind==='ppf'){
        const rateNode=document.getElementById(`${prefix}TileRate`),rate=retirementAccountRateSummary(accounts);
        if(rateNode){rateNode.textContent=rate.label;rateNode.title=rate.title;}
      }else if(kind==='nps'){
        const xirr=npsPortfolioXirr(accounts),xirrNode=document.getElementById('npsTileXirr');
        if(xirrNode)xirrNode.textContent=xirr===null?'—':`${(xirr*100).toFixed(2)}%`;
      }
      const card=document.getElementById(`${prefix}ListPanel`)||document.querySelector('[data-retirement-type="ppf"]');
      if(card)card.classList.toggle('is-expanded',Boolean(card.querySelector('.retirement-account-details[open]')));
    }
    function renderInvestmentOverview() {
      const investments=profileRows(state.investments||[]),nps=profileRows(state.nps||[]),ppf=profileRows(state.ppf||[]),pf=profileRows(state.pf||[]);
      const current=investments.reduce((sum,row)=>sum+(Number(row.current)||0),0)+nps.reduce((sum,row)=>sum+(Number(row.current)||0),0)+ppf.reduce((sum,row)=>sum+(Number(row.current)||0),0)+pf.reduce((sum,row)=>sum+(Number(row.current)||0),0);
      const invested=investments.reduce((sum,row)=>sum+(Number(row.invested)||0),0)+nps.reduce((sum,row)=>sum+(Number(row.invested)||0),0)+ppf.reduce((sum,row)=>sum+(Number(row.invested)||0),0)+pf.reduce((sum,row)=>sum+(Number(row.invested??row.current)||0),0);
      const gain=current-invested,returnRate=invested>0?gain/invested:0;
      const visibleInvestmentIds=new Set(investments.map(row=>row.id));
      const monthly=investments.filter(row=>row.type!=='Stallion PMS').reduce((sum,row)=>sum+investmentMonthlyAmount(row),0)+nps.reduce((sum,row)=>sum+retirementMonthlyAmount(row,'nps'),0)+ppf.reduce((sum,row)=>sum+retirementMonthlyAmount(row,'ppf'),0)+pf.reduce((sum,row)=>sum+retirementMonthlyAmount(row,'pf')+(row.autoMonthlyContribution===false?0:Number(row.epsMonthly)||0),0)+(state.stallionContributions||[]).filter(row=>visibleInvestmentIds.has(row.stallionId)&&inMonth(row.date,currentMonthKey())).reduce((sum,row)=>sum+(Number(row.amount)||0),0);
      const currentNode=document.getElementById('investmentOverviewCurrent'),investedNode=document.getElementById('investmentOverviewInvested'),gainNode=document.getElementById('investmentOverviewGain'),returnNode=document.getElementById('investmentOverviewReturn'),monthlyNode=document.getElementById('investmentOverviewMonthly'),gainCard=document.getElementById('investmentOverviewGainCard');
      if(currentNode)currentNode.textContent=formatCurrency(current);
      if(investedNode)investedNode.textContent=formatCurrency(invested);
      if(gainNode)gainNode.textContent=`${gain>=0?'+':''}${formatCurrency(gain)}`;
      if(returnNode)returnNode.textContent=`${returnRate>=0?'+':''}${(returnRate*100).toFixed(1)}% return`;
      if(gainCard){gainCard.classList.toggle('is-positive',gain>=0);gainCard.classList.toggle('is-negative',gain<0);}
      if(monthlyNode)monthlyNode.textContent=formatCurrency(monthly);
      const allocation=new Map();
      for(const row of investments){const amount=Number(row.current)||0;if(amount>0){const name=row.type||'Other';allocation.set(name,(allocation.get(name)||0)+amount);}}
      for(const [name,rows] of [['PF',pf],['PPF',ppf],['NPS',nps]]){const value=rows.reduce((sum,row)=>sum+(Number(row.current)||0),0);if(value>0)allocation.set(name,(allocation.get(name)||0)+value);}
      const slices=[...allocation].sort((a,b)=>b[1]-a[1]),total=slices.reduce((sum,item)=>sum+item[1],0),colors=['#71d9bd','#4da88f','#367c6c','#76a9a2','#587b80','#a0b5a4'];
      const ring=document.getElementById('investmentAllocationRing'),legend=document.getElementById('investmentAllocationLegend'),totalNode=document.getElementById('investmentAllocationTotal');
      if(totalNode)totalNode.textContent=formatCurrency(total);
      if(ring){let offset=0;const stops=slices.map(([,value],index)=>{const start=offset;offset+=value/total*100;return `${colors[index%colors.length]} ${start}% ${offset}%`;});ring.style.background=stops.length?`conic-gradient(${stops.join(',')})`:'';ring.setAttribute('aria-label',total?`Asset allocation: ${slices.map(([name,value])=>`${name} ${formatCurrency(value)}, ${(value/total*100).toFixed(1)}%`).join('; ')}. Excludes gratuity.`:'No investment balances recorded; gratuity is excluded.');}
      if(legend){legend.replaceChildren();if(!slices.length){const empty=document.createElement('p');empty.textContent='No assets added yet';legend.append(empty);}else for(const [index,[name,value]] of slices.entries()){const row=document.createElement('div'),dot=document.createElement('i'),label=document.createElement('span'),amount=document.createElement('strong');row.className='investment-allocation-item';dot.setAttribute('aria-hidden','true');dot.style.backgroundColor=colors[index%colors.length];label.textContent=name;amount.textContent=`${(value/total*100).toFixed(1)}%`;row.append(dot,label,amount);legend.append(row);}}
    }
    function syncCustomFixedInvestmentCurrent(resetManual=false){
        const type=document.getElementById('investType')?.value,current=document.getElementById('investCurrent'),invested=document.getElementById('investAmount');
        if(!current||customInvestmentProfile(type)?.growthType!=='fixed')return;
        if(resetManual)current.dataset.manualOverride='false';
        if(current.dataset.manualOverride!=='true')current.value=invested?.value||'';
      }
      document.getElementById('investType').addEventListener('change',event=>{const profile=customInvestmentProfile(event.currentTarget.value);document.getElementById('investAutomaticMonthly').checked=false;syncCustomFixedInvestmentCurrent(true);updateInvestmentRateField();});
      document.getElementById('investAmount').addEventListener('input',()=>syncCustomFixedInvestmentCurrent());
      document.getElementById('investCurrent').addEventListener('input',event=>{event.currentTarget.dataset.manualOverride='true';});
    document.getElementById('addInvestBtn').addEventListener('click', () => {
      const member = document.getElementById('investMember').value;
      const type = document.getElementById('investType').value;
      const name = document.getElementById('investName').value;
      const invested = Number(document.getElementById('investAmount').value);
      const profile=customInvestmentProfile(type),growthType=investmentGrowthType(type),automaticMonthly=document.getElementById('investAutomaticMonthly').checked;
      const currentInput=Number(document.getElementById('investCurrent').value);
      const current=growthType==='no-return'?invested:currentInput;
      const monthlyInput=Number(document.getElementById('investMonthly').value||0);
      const monthly=automaticMonthly?monthlyInput:0;
      const monthlyContributionDate=document.getElementById('investMonthlyDate').value;
      const date = document.getElementById('investDate').value || localDateKey();
      const notes = document.getElementById('investNotes').value;
      const rateInputValue=document.getElementById('investRate').value.trim();
      const rate=Number(rateInputValue);
      if(!member){alert('Add a family member in Settings before recording an investment.');return;}

      if (!Number.isFinite(invested) || invested <= 0 || (growthType!=='no-return'&&(!Number.isFinite(current)||current<0)) || !Number.isFinite(monthly) || monthly < 0 || (automaticMonthly&&monthly<=0)) {
        alert('Enter valid amounts');
        return;
      }

      if(automaticMonthly&&(!validCalendarDate(monthlyContributionDate)||monthlyContributionDate<localDateKey()||monthlyContributionDate<date)){alert('Choose a first monthly contribution date today or later than the purchase date.');return;}
      if (!name) {
        alert('Enter investment name');
        return;
      }
      if((state.customValues?.investmentTypes||[]).includes(type)&&!profile){alert('Choose a growth calculation when adding this investment type.');return;}
      if (investmentUsesInterestRate(type) && (!Number.isFinite(rate) || rate<0 || rateInputValue==='')) { alert('Enter a valid annual interest rate.'); return; }

      const investId = generateId();
      state.investments.push({
        id: investId,
        member: member,
        type: type,
        name: name,
        invested: invested,
        current: current,
        valuationDate:localDateKey(),
        monthly: monthly,
        autoMonthlyContribution:automaticMonthly,
        monthlyContributionDate:automaticMonthly?monthlyContributionDate:'',
        monthlyContributionNextDate:automaticMonthly?monthlyContributionDate:'',
        date: date,
        notes: notes
      });
      if(investmentUsesInterestRate(type))state.investments[state.investments.length-1].rate=rate;

      // Also add to Stallion PMS tracking if type is Stallion PMS
      if (type === 'Stallion PMS') {
        const profit = current - invested;
        state.stallionPms.push({
          id: investId,
          member: member,
          name: name,
          invested: invested,
          profit: profit,
          createdDate: date
        });
        populateStallionDropdowns();
      }

      document.getElementById('investMember').value = '';
      document.getElementById('investName').value = '';
      document.getElementById('investAmount').value = '';
      document.getElementById('investCurrent').value = '';
      document.getElementById('investCurrent').dataset.manualOverride='false';
      document.getElementById('investMonthly').value = '';
      document.getElementById('investMonthlyDate').value = '';
      document.getElementById('investDate').value = '';
      document.getElementById('investNotes').value = '';
      document.getElementById('investRate').value = '';
      document.getElementById('investAutomaticMonthly').checked=false;
      updateInvestmentRateField();

      saveData();
      renderInvestments();
      closeInvestmentEntry('otherInvestmentAddPanel');
      updateDashboard();
    });

    const GRATUITY_CAP=2000000;
    function shiftGratuityDate(dateString,months){
      const [year,month,day]=dateString.split('-').map(Number),index=year*12+(month-1)+months,targetYear=Math.floor(index/12),targetMonth=index%12;
      const lastDay=new Date(targetYear,targetMonth+1,0).getDate();
      return `${targetYear}-${String(targetMonth+1).padStart(2,'0')}-${String(Math.min(day,lastDay)).padStart(2,'0')}`;
    }
    function gratuityService(account,asOf=localDateKey()){
      if(!validCalendarDate(account?.date)||!validCalendarDate(asOf)||account.date>asOf)return {completedYears:0,countedYears:0,eligible:false};
      const [joinYear]=account.date.split('-').map(Number),[asOfYear]=asOf.split('-').map(Number);
      let completedYears=asOfYear-joinYear;
      if(shiftGratuityDate(account.date,completedYears*12)>asOf)completedYears--;
      completedYears=Math.max(0,completedYears);
      const sixMonthMark=shiftGratuityDate(account.date,completedYears*12+6);
      const countedYears=completedYears+(asOf>sixMonthMark?1:0);
      return {completedYears,countedYears,eligible:completedYears>=5};
    }
    function estimateGratuity(account,asOf=localDateKey()){
      const service=gratuityService(account,asOf),salary=Number(account?.basicSalary)||0;
      const amount=service.eligible?Math.min(GRATUITY_CAP,salary*15/26*service.countedYears):0;
      return {...service,amount};
    }
    function totalGratuityEstimate(asOf=localDateKey()){
      return profileRows(state.gratuityAccounts||[]).reduce((sum,account)=>sum+estimateGratuity(account,asOf).amount,0);
    }
    function openGratuityModal(id=null){
      const modal=document.getElementById('gratuityEditModal'),account=(state.gratuityAccounts||[]).find(row=>row.id===id);
      if(!modal)return;
      populateCustomValueSelects();
      const select=document.getElementById('gratuityMember'),used=new Set((state.gratuityAccounts||[]).filter(row=>row.id!==account?.id).map(row=>row.member.trim().toLocaleLowerCase())),available=Array.from(select.options).filter(option=>option.value&&!option.value.startsWith('--')&&(!used.has(option.value.trim().toLocaleLowerCase())||option.value===account?.member));
      select.replaceChildren(new Option('-- Select family member --',''),...available.map(option=>option.cloneNode(true)));
      select.value=account?.member||'';
      document.getElementById('gratuityDate').value=account?.date||localDateKey();
      document.getElementById('gratuityBasicSalary').value=account?.basicSalary??'';
      document.getElementById('gratuityEditTitle').textContent=account?'Edit gratuity estimate':'Add gratuity estimate';
      modal.dataset.recordId=account?.id||'';modal.hidden=false;syncInvestmentOverlayBodyLock();
    }
    function closeGratuityModal(){const modal=document.getElementById('gratuityEditModal');modal.hidden=true;delete modal.dataset.recordId;syncInvestmentOverlayBodyLock();}
    function saveGratuityAccount(){
      const modal=document.getElementById('gratuityEditModal'),id=modal.dataset.recordId,member=document.getElementById('gratuityMember').value.trim(),date=document.getElementById('gratuityDate').value,basicSalary=Number(document.getElementById('gratuityBasicSalary').value);
      if(!member||member.startsWith('--')){alert('Choose a family member.');return;}
      if(!validCalendarDate(date)||date>localDateKey()){alert('Enter a valid date of joining that is not in the future.');return;}
      if(!Number.isFinite(basicSalary)||basicSalary<=0){alert('Enter a Basic salary greater than zero.');return;}
      const duplicate=(state.gratuityAccounts||[]).find(row=>row.id!==id&&row.member.trim().toLocaleLowerCase()===member.toLocaleLowerCase());
      if(duplicate){alert(`${member} already has a gratuity record. Edit the existing tile instead.`);return;}
      if(id){const account=state.gratuityAccounts.find(row=>row.id===id);if(!account)return;Object.assign(account,{date,basicSalary});}
      else {
        state.gratuityAccounts=Array.isArray(state.gratuityAccounts)?state.gratuityAccounts:[];
        state.gratuityAccounts.push({id:generateId(),member,date,basicSalary});
      }
      closeGratuityModal();saveData();renderInvestments();renderGrowthProjection();updateDashboard();
    }
    function editGratuityAccount(id){openGratuityModal(id);}
    function deleteGratuityAccount(id){
      const account=(state.gratuityAccounts||[]).find(row=>row.id===id);if(!account)return;
      if(!confirm(`Delete the gratuity estimate for ${account.member}?`))return;
      state.gratuityAccounts=state.gratuityAccounts.filter(row=>row.id!==id);saveData();renderInvestments();renderGrowthProjection();updateDashboard();
    }
    function updateRetirementTilesVisibility(){
      const hasPf=profileRows(state.pf||[]).length>0,hasPpf=profileRows(state.ppf||[]).length>0,hasNps=profileRows(state.nps||[]).length>0,hasGratuity=profileRows(state.gratuityAccounts||[]).length>0;
      const pfCard=document.getElementById('pfListPanel'),npsCard=document.getElementById('npsListPanel');
      if(pfCard)pfCard.hidden=!hasPf;if(npsCard)npsCard.hidden=!hasNps;
      const any=hasPf||hasPpf||hasNps||hasGratuity;
      const addFormOpen=Boolean(document.querySelector('#retirementAccountPanels > .investment-add-section.is-open'));
      const empty=document.getElementById('retirementEmptyState');if(empty)empty.hidden=any||addFormOpen;
    }
    function renderInvestments() {
      const panels = document.getElementById('investmentCategoryPanels');
      if (!panels) return;
      const investmentList = document.getElementById('investmentListPanel');
      const retirementPanels=document.getElementById('retirementAccountPanels');
      const ppfSlot=document.getElementById('ppfRetirementTileSlot');
      const gratuitySlot=document.getElementById('gratuityRetirementTileSlot');
      const gratuityAccounts=profileRows(state.gratuityAccounts||[]);
      const stallionPanel = document.getElementById('stallionPmsPanel');
      const stallionBody = document.getElementById('stallionPmsTileBody');
      const stallionContributionAddPanel=document.getElementById('stallionContributionAddPanel');
      const addPanel = document.getElementById('otherInvestmentAddPanel');
      const stallionHistoryPanel = document.getElementById('stallionContributionListPanel');
      const stallionProfitPanel = document.getElementById('stallionProfitAddPanel');
      const ppfExpanded=Boolean(document.getElementById('ppfRetirementDetails')?.open);
      const gratuityExpanded=Boolean(document.getElementById('gratuityPortfolioDetails')?.open);
      [stallionHistoryPanel,stallionProfitPanel,addPanel].forEach(panel=>{if(panel&&(panels.contains(panel)||stallionBody.contains(panel)))investmentList.appendChild(panel);});

      const standardCategories = ['Mutual Funds','Bonds','Fixed Deposits'];
      const viewInvestments=profileRows(state.investments||[]);
      const viewPpf=profileRows(state.ppf||[]);
      const storedTypes = [...new Set(viewInvestments.map(inv => String(inv.type || 'Other').trim()).filter(Boolean))];
      const categories = [...standardCategories.filter(type => storedTypes.includes(type)), ...storedTypes.filter(type => type!=='Stallion PMS'&&!standardCategories.includes(type)).sort((a,b)=>a.localeCompare(b))];
      // Keep category tiles in their original order when a tile expands or its Add form opens.
      // This lets the expanded details stay beside the tile the user selected in the current viewport.
      const defaultCategoryOrder=[...categories];
      const investmentRowsByType=new Map();
      for(const inv of viewInvestments){const type=String(inv.type||'Other').trim()||'Other';if(!investmentRowsByType.has(type))investmentRowsByType.set(type,[]);investmentRowsByType.get(type).push(inv);}
      const investmentContributionsById=new Map();
      const viewInvestmentIds=new Set(viewInvestments.map(row=>row.id));
      for(const row of state.investmentContributions||[]){if(!viewInvestmentIds.has(row.investmentId))continue;if(!investmentContributionsById.has(row.investmentId))investmentContributionsById.set(row.investmentId,[]);investmentContributionsById.get(row.investmentId).push(row);}
      const stallionContributionsById=new Map();
      for(const row of state.stallionContributions||[]){if(!viewInvestmentIds.has(row.stallionId))continue;if(!stallionContributionsById.has(row.stallionId))stallionContributionsById.set(row.stallionId,[]);stallionContributionsById.get(row.stallionId).push(row);}
      const valuationDate=localDateKey();
      const stallionItems = investmentRowsByType.get('Stallion PMS')||[];
      const hasStallion = stallionItems.length>0;
      const categoryCards = categories.map((category, index) => {
        const items = investmentRowsByType.get(category)||[];
        const currentTotal = items.reduce((sum,inv)=>sum+(Number(inv.current)||0),0);
        const investedTotal = items.reduce((sum,inv)=>sum+(Number(inv.invested)||0),0);
        const monthlyTotal = items.reduce((sum,inv)=>sum+investmentMonthlyAmount(inv),0);
        const gainTotal = currentTotal-investedTotal;
        const hasReturnMetrics=investmentUsesReturnMetrics(category),hasRate=investmentUsesInterestRate(category);
        const hasMonthlyContribution=items.some(inv=>investmentMonthlyAmount(inv)>0);
        const categoryXirr=hasReturnMetrics?investmentCategoryXirr(items,investmentContributionsById,valuationDate):null;
        const absoluteReturn=investedTotal>0?(currentTotal-investedTotal)/investedTotal:null;
        const interestSummary=hasRate?investmentCategoryRateSummary(items,'rate','% p.a.'):null;
        const hasDatedContributions=items.some(inv=>investmentMonthlyAmount(inv)>0||(investmentContributionsById.get(inv.id)||[]).some(row=>Number(row.amount)>0));
        const categoryCagr=hasReturnMetrics&&!hasDatedContributions?investmentCategoryCagr(items,valuationDate):null;
        const tileMetric=hasReturnMetrics?(hasDatedContributions?{label:'XIRR',value:categoryXirr===null?'N/A':`${(categoryXirr*100).toFixed(2)}%`,key:'xirr'}:{label:'CAGR',value:categoryCagr===null?'N/A':`${(categoryCagr*100).toFixed(2)}%`,key:'cagr'}):hasRate?{label:'Interest rate',value:interestSummary.label,key:'rate',title:interestSummary.title}:{label:'Absolute return',value:absoluteReturn===null?'N/A':`${(absoluteReturn*100).toFixed(2)}%`,key:'absolute-return'};
        const rows = items.map(inv => {
          const gain = Number(inv.current || 0) - Number(inv.invested || 0);
          const hasReturnMetrics=investmentUsesReturnMetrics(category);
          const absoluteReturn=investmentAbsoluteReturn(inv),cagr=investmentCagr(inv,valuationDate),xirr=investmentXirr(inv,valuationDate,investmentContributionsById.get(inv.id)||[]);
          return `<tr>
            <td><strong>${analyticEscape(inv.member || '—')}</strong></td>
            <td>${analyticEscape(inv.name)}</td>
            <td class="text-right">${formatCurrency(inv.invested)}</td>
            <td class="text-right">${formatCurrency(inv.current)}</td>
            ${hasMonthlyContribution?`<td class="text-right">${formatCurrency(investmentMonthlyAmount(inv))}</td>`:''}
            <td class="text-right ${gain >= 0 ? 'positive' : 'negative'}">${gain >= 0 ? '+' : ''}${formatCurrency(gain)}</td>
            ${hasReturnMetrics?`<td class="text-right" data-label="Absolute Return">${absoluteReturn===null?'N/A':(absoluteReturn*100).toFixed(2)+'%'}</td><td class="text-right" data-label="CAGR">${cagr===null?'N/A':(cagr*100).toFixed(2)+'%'}</td><td class="text-right" data-label="XIRR">${xirr===null?'N/A':(xirr*100).toFixed(2)+'%'}</td>`:''}
            ${investmentUsesInterestRate(category)?`<td class="text-right">${Number.isFinite(Number(inv.rate))?Number(inv.rate).toFixed(2)+'%':'—'}</td>`:''}
            <td class="investment-row-actions"><div class="investment-row-action-group">${investmentUsesReturnMetrics(inv.type)?`<button type="button" class="investment-icon-action" aria-label="Update value" title="Update value" data-short-action="Update" onclick="financeWorkbench.valuations('investments','${inv.id}')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M6 8a7 7 0 0 1 12-2l2 3M4 15l2 3a7 7 0 0 0 12-2"/></svg></button>`:''}<button type="button" class="investment-icon-action" title="View History" data-short-action="History" aria-label="View contribution history" onclick="openInvestmentContributionModal('${inv.id}')"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg></button><button type="button" class="investment-icon-action" title="Add Contribution" data-short-action="Add" aria-label="Add contribution" onclick="openManualInvestmentContribution('${inv.id}')"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 8v8M8 12h8"></path></svg></button><button type="button" class="investment-icon-action" title="Edit" data-short-action="Edit" aria-label="Edit holding" onclick="editInvestment('${inv.id}')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 16.5-.8 4.3 4.3-.8L19 8.5 15.5 5 4 16.5Z"></path><path d="m13.5 7 3.5 3.5"></path></svg></button><button type="button" class="investment-icon-action is-danger" title="Delete" data-short-action="Delete" aria-label="Delete holding" onclick="deleteInvestment('${inv.id}')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3"></path></svg></button></div></td>
          </tr>`;
        }).join('');
        const extraHeaders=`${hasReturnMetrics?'<th class="text-right" title="(Current value − total invested) ÷ total invested">Absolute Return</th><th class="text-right" title="Annualized return from the holding start date; contribution dates are not weighted">CAGR</th><th class="text-right" title="Annualized return using initial investment, dated contributions and current value">XIRR</th>':''}${hasRate?'<th class="text-right" title="Annual interest rate entered for this holding">Interest Rate</th>':''}`;
        const emptySpan=6+(hasMonthlyContribution?1:0)+(hasReturnMetrics?3:0)+(hasRate?1:0);
        return `<section class="panel investment-category-card" data-category-index="${defaultCategoryOrder.indexOf(category)}" data-investment-type="${analyticEscape(category)}">
          <div class="panel-header"><div><h3>${analyticEscape(category)}</h3><div class="investment-category-summary"><span>${items.length} ${items.length===1?'holding':'holdings'}</span>${hasMonthlyContribution?`<span class="investment-monthly-inline"> · ${formatCurrency(monthlyTotal)}/mo</span>`:''}</div></div></div>
          <div class="investment-category-summary-grid" role="button" tabindex="0" aria-haspopup="dialog" aria-label="View ${analyticEscape(category)} holdings">
            <span class="investment-summary-value"><span>Current value</span><strong>${formatCurrency(currentTotal)}</strong></span>
            <span class="investment-summary-metric" data-category-summary-metric="${tileMetric.key}"${tileMetric.title?` title="${analyticEscape(tileMetric.title)}"`:''}><span>${tileMetric.label}</span><strong>${analyticEscape(tileMetric.value)}</strong></span>
            <span class="investment-summary-chevron" aria-hidden="true">›</span>
            <span class="investment-summary-detail"><span>Invested</span><strong>${formatCurrency(investedTotal)}</strong></span>
            <span class="investment-summary-detail"><span>Gain / loss</span><strong class="${gainTotal>=0?'positive':'negative'}">${gainTotal>=0?'+':''}${formatCurrency(gainTotal)}</strong></span>
            ${hasMonthlyContribution?`<span class="investment-summary-detail investment-summary-monthly"><span>Monthly</span><strong>${formatCurrency(monthlyTotal)}</strong></span>`:''}
          </div><div class="investment-category-dialog-source" hidden><div class="table-wrapper"><table><thead><tr><th>Member</th><th>Name</th><th class="text-right">Invested</th><th class="text-right">Current Value</th>${hasMonthlyContribution?'<th class="text-right">Monthly Contribution</th>':''}<th class="text-right">Gain/Loss</th>${extraHeaders}<th class="investment-row-actions-header">Actions</th></tr></thead><tbody>${rows||`<tr><td colspan="${emptySpan}" class="text-muted">No holdings.</td></tr>`}</tbody></table></div></div>
        </section>`;
      }).join('');
      const ppfItems=viewPpf;
      const ppfCurrent=ppfItems.reduce((sum,item)=>sum+(Number(item.current)||0),0);
      const ppfRate=retirementAccountRateSummary(ppfItems),ppfInvested=ppfItems.reduce((sum,item)=>sum+(Number(item.invested)||0),0),ppfGain=ppfCurrent-ppfInvested,ppfMonthly=ppfItems.reduce((sum,item)=>sum+retirementMonthlyAmount(item,'ppf'),0);
      const ppfTile=`<section class="panel retirement-account-card${ppfExpanded?' is-expanded':''}" data-retirement-type="ppf">
        <div class="panel-header"><div><h2>PPF Accounts</h2><div class="retirement-account-count" id="ppfTileCount">${ppfItems.length} ${ppfItems.length===1?'account':'accounts'}</div></div></div>
        <details class="retirement-account-details" id="ppfRetirementDetails"${ppfExpanded?' open':''}><summary class="retirement-account-summary investment-category-summary-grid">
          <span class="investment-summary-value retirement-summary-value"><span>Current value</span><strong id="ppfTileCurrent">${formatCurrency(ppfCurrent)}</strong></span>
          <span class="investment-summary-metric retirement-summary-metric"><span>Interest rate</span><strong id="ppfTileRate" title="${analyticEscape(ppfRate.title)}">${analyticEscape(ppfRate.label)}</strong></span>
          <span class="investment-summary-detail"><span>Invested</span><strong id="ppfTileInvested">${formatCurrency(ppfInvested)}</strong></span>
          <span class="investment-summary-detail"><span>Gain / loss</span><strong id="ppfTileGain" class="${ppfGain>=0?'positive':'negative'}">${ppfGain>=0?'+':''}${formatCurrency(ppfGain)}</strong></span>
          ${ppfMonthly>0?`<span class="investment-summary-detail" id="ppfTileMonthlyWrap"><span>Monthly</span><strong id="ppfTileMonthly">${formatCurrency(ppfMonthly)}</strong></span>`:''}
          <span class="investment-summary-chevron retirement-account-chevron" aria-hidden="true">›</span>
        </summary><div class="table-wrapper"><table><thead><tr><th>Member</th><th>Account</th><th class="text-right monthly-contribution-column">Monthly</th><th class="text-right">Invested</th><th class="text-right">Current Value</th><th class="text-right">Gain/Loss</th><th class="text-right">Interest Rate</th><th class="annual-interest-column">Last FY Interest</th><th>Actions</th></tr></thead><tbody id="ppfBody"></tbody></table></div><p class="retirement-account-help">Expand to review each PPF account, its interest rate, last FY interest and recorded history.</p></details>
      </section>`;
      const gratuityDetails=gratuityAccounts.map(account=>({account,estimate:estimateGratuity(account,valuationDate)}));
      const gratuityTotal=gratuityDetails.reduce((sum,row)=>sum+row.estimate.amount,0),gratuityEligible=gratuityDetails.filter(row=>row.estimate.eligible).length;
      const gratuityRows=gratuityDetails.map(({account,estimate})=>{
        const joinDate=calendarDate(account.date).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
        const serviceLabel=estimate.eligible?`${estimate.completedYears} years · ${estimate.countedYears} counted`:`${estimate.completedYears} of 5 years`;
        return `<tr data-gratuity-id="${analyticEscape(account.id)}"><td><strong>${analyticEscape(account.member)}</strong></td><td>${joinDate}</td><td class="text-right">${formatCurrency(account.basicSalary)}</td><td>${analyticEscape(serviceLabel)}</td><td><strong class="${estimate.eligible?'gratuity-status-eligible':'gratuity-status-not-eligible'}">${estimate.eligible?'Eligible':'Not yet eligible'}</strong></td><td class="text-right">${formatCurrency(estimate.amount)}</td><td><div class="gratuity-row-actions"><button type="button" class="btn-small" onclick="editGratuityAccount('${analyticEscape(account.id)}')">Edit</button><button type="button" class="btn-small btn-danger" onclick="deleteGratuityAccount('${analyticEscape(account.id)}')">Delete</button></div></td></tr>`;
      }).join('');
      if(gratuitySlot)gratuitySlot.innerHTML=gratuityAccounts.length?`<section class="panel retirement-account-card gratuity-combined-card${gratuityExpanded?' is-expanded':''}" id="gratuityPortfolioCard" data-retirement-type="gratuity">
        <div class="panel-header"><div><h2>Gratuity</h2><div class="retirement-account-count">${gratuityAccounts.length} ${gratuityAccounts.length===1?'member':'members'}</div></div></div>
        <details class="retirement-account-details" id="gratuityPortfolioDetails"${gratuityExpanded?' open':''}><summary class="retirement-account-summary investment-category-summary-grid">
          <span class="investment-summary-value retirement-summary-value"><span>Estimated value</span><strong>${formatCurrency(gratuityTotal)}</strong></span>
          <span class="investment-summary-metric retirement-summary-metric"><span>Eligible members</span><strong>${gratuityEligible} of ${gratuityAccounts.length}</strong></span>
          <span class="investment-summary-detail"><span>Members tracked</span><strong>${gratuityAccounts.length}</strong></span>
          <span class="investment-summary-detail"><span>Estimate checked</span><strong>As of today</strong></span>
          <span class="investment-summary-chevron retirement-account-chevron" aria-hidden="true">›</span>
        </summary><div class="table-wrapper"><table><thead><tr><th>Family member</th><th>Date of joining</th><th class="text-right">Basic / month</th><th>Service</th><th>Eligibility</th><th class="text-right">Estimated gratuity</th><th>Actions</th></tr></thead><tbody>${gratuityRows}</tbody></table></div><p class="retirement-account-help">This estimate is shown separately and is not included in your investment balance.</p></details>
      </section>`:'';
      panels.innerHTML = categoryCards;
      if(ppfSlot)ppfSlot.innerHTML=ppfItems.length?ppfTile:'';
      updateRetirementTilesVisibility();
      setupRetirementAccountDetails();

      if (!categories.length) panels.innerHTML = '<div class="retirement-empty-state investment-empty-state"><span class="account-empty-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 18v-5M12 18V9M19 18V5"/></svg></span><div class="account-empty-copy"><strong>No investment holdings yet</strong><span>Add an investment to see your holdings here.</span></div></div>';

      stallionPanel.hidden=!hasStallion;
      const showStallionMonthly=stallionItems.some(inv=>investmentMonthlyAmount(inv)>0);
      const pmsQuickActions=[document.getElementById('openStallionContributionBtn'),document.querySelector('#stallionPmsPanel [data-open-entry="stallionProfitAddPanel"]')].filter(Boolean);
      stallionBody.innerHTML=hasStallion?`<div class="table-wrapper"><table class="stallion-pms-holdings ${showStallionMonthly?'has-monthly':'no-monthly'}"><thead><tr><th>Member</th><th>Name</th><th class="text-right">Invested</th><th class="text-right">Current Value</th>${showStallionMonthly?'<th class="text-right">Monthly</th>':''}<th class="text-right">Gain/Loss</th><th class="text-right" title="(Current value − total invested) ÷ total invested">Absolute Return</th><th class="text-right" title="Annualized absolute return from the portfolio start date; monthly contribution dates are not weighted">CAGR</th><th class="text-right" title="Annualized return based on initial investment, dated PMS contributions and current value as of today">XIRR</th><th>Actions</th></tr></thead><tbody>${stallionItems.map(inv=>{const gain=Number(inv.current||0)-Number(inv.invested||0),absoluteReturn=stallionAbsoluteReturn(inv),cagr=stallionCagr(inv,valuationDate),xirr=stallionXirr(inv,valuationDate,stallionContributionsById.get(inv.id)||[]);return `<tr><td data-label="Member"><strong>${analyticEscape(inv.member||'—')}</strong></td><td data-label="Name">${analyticEscape(inv.name)}</td><td class="text-right" data-label="Invested">${formatCurrency(inv.invested)}</td><td class="text-right" data-label="Current Value">${formatCurrency(inv.current)}</td>${showStallionMonthly?`<td class="text-right" data-label="Monthly Contribution">${formatCurrency(investmentMonthlyAmount(inv))}</td>`:''}<td class="text-right ${gain===0?'':gain>0?'positive':'negative'}" data-label="Gain / Loss">${gain>=0?'+':''}${formatCurrency(gain)}</td><td class="text-right" data-label="Absolute Return">${absoluteReturn===null?'N/A':(absoluteReturn*100).toFixed(2)+'%'}</td><td class="text-right" data-label="CAGR">${cagr===null?'N/A':(cagr*100).toFixed(2)+'%'}</td><td class="text-right ${xirr===null||xirr===0?'':xirr>0?'positive':'negative'}" data-label="XIRR">${xirr===null?'N/A':(xirr*100).toFixed(2)+'%'}</td><td class="investment-row-actions" data-label="Actions"><button class="btn-small" onclick="openStallionHistory('${inv.id}')">View History</button> <button class="btn-small" onclick="editInvestment('${inv.id}')">Edit</button> <button class="btn-small btn-danger" onclick="deleteInvestment('${inv.id}')">Delete</button></td></tr>`;}).join('')}</tbody></table></div>`:'';
      const pmsActionRow=stallionBody.querySelector('td[data-label="Actions"]');
      const pmsHeaderControls=stallionPanel.querySelector('.panel-header .panel-controls');
      for(const [index,button] of pmsQuickActions.entries()){
        if(!button.dataset.pmsCompactAction){
          const label=index===0?'Add contribution':'Update PMS gain/loss';
          button.setAttribute('aria-label',label);button.title=label;button.dataset.pmsCompactAction='true';
          button.innerHTML=index===0?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 16 5-5 4 3 7-9M15 5h5v5"/></svg>';
        }
        (pmsActionRow||pmsHeaderControls)?.append(button);
      }
      if(pmsHeaderControls)pmsHeaderControls.hidden=Boolean(pmsActionRow);
      const pmsSource=stallionBody.querySelector('.table-wrapper');
      if(pmsSource&&hasStallion){
        pmsSource.classList.add('pms-detail-source');
        const summaries=document.createElement('div');summaries.className='pms-summary-list';
        stallionItems.forEach((inv,index)=>{
          const gain=Number(inv.current||0)-Number(inv.invested||0),absoluteReturn=stallionAbsoluteReturn(inv),cagr=stallionCagr(inv,valuationDate),xirr=stallionXirr(inv,valuationDate,stallionContributionsById.get(inv.id)||[]);
          const tile=document.createElement('button');tile.type='button';tile.className='pms-summary-tile';tile.setAttribute('aria-haspopup','dialog');
          tile.innerHTML='<span class="pms-summary-name">'+analyticEscape(inv.name)+'</span><span class="pms-summary-member">'+analyticEscape(inv.member||'—')+'</span><span class="pms-summary-metrics">'+[
            ['Current value',formatCurrency(inv.current),''],['Invested',formatCurrency(inv.invested),''],['Gain / loss',(gain>0?'+':'')+formatCurrency(gain),gain===0?'':gain>0?'positive':'negative'],['Absolute return',absoluteReturn===null?'N/A':(absoluteReturn*100).toFixed(2)+'%',absoluteReturn===null||absoluteReturn===0?'':absoluteReturn>0?'positive':'negative'],['CAGR',cagr===null?'N/A':(cagr*100).toFixed(2)+'%',cagr===null||cagr===0?'':cagr>0?'positive':'negative'],['XIRR',xirr===null?'N/A':(xirr*100).toFixed(2)+'%',xirr===null||xirr===0?'':xirr>0?'positive':'negative']
          ].map(([label,value,tone])=>'<span><small>'+label+'</small><strong class="'+tone+'">'+analyticEscape(value)+'</strong></span>').join('')+'</span>';
          tile.onclick=()=>{
            const dialog=document.getElementById('investmentCategoryDialog');delete dialog.dataset.investmentType;dialog.dataset.stallionId=inv.id;
            document.getElementById('investmentCategoryDialogTitle').textContent=inv.name||'Stallion PMS';
            document.getElementById('investmentCategoryDialogSubtitle').textContent='Stallion PMS · '+(inv.member||'');
            const summary=document.getElementById('investmentCategoryDialogSummary');summary.replaceChildren();
            tile.querySelectorAll('.pms-summary-metrics>span').forEach(metric=>{
              const item=document.createElement('span'),label=document.createElement('span'),value=document.createElement('strong');
              item.className='investment-summary-detail';label.textContent=metric.querySelector('small').textContent;value.textContent=metric.querySelector('strong').textContent;value.className=metric.querySelector('strong').className;item.append(label,value);summary.append(item);
            });
            const target=document.getElementById('investmentCategoryDialogTable');target.replaceChildren();
            const wrapper=pmsSource.cloneNode(true);wrapper.classList.remove('pms-detail-source');wrapper.classList.add('investment-category-dialog-table','pms-holding-details');
            wrapper.querySelectorAll('tbody tr').forEach((row,rowIndex)=>{if(rowIndex!==index)row.remove();});
            wrapper.querySelectorAll('[id]').forEach(node=>node.removeAttribute('id'));
            const rowActions=wrapper.querySelector('tbody td[data-label="Actions"]');
            if(rowActions){
              rowActions.querySelectorAll('[data-pms-compact-action]').forEach(node=>node.remove());
              rowActions.querySelectorAll('button').forEach(button=>{button.dataset.shortAction=button.getAttribute('aria-label')||button.title||button.textContent.trim();});
              pmsQuickActions.forEach(original=>{const copy=original.cloneNode(true);copy.removeAttribute('id');copy.removeAttribute('data-open-entry');copy.className='investment-icon-action';copy.dataset.shortAction=original.title||original.getAttribute('aria-label')||original.textContent.trim();copy.onclick=()=>original.click();rowActions.append(copy);});
            }
            target.append(wrapper);labelInvestmentDialogCells(target);
            dialog.hidden=false;document.body.style.overflow='hidden';dialog.querySelector('[data-close-investment-category-dialog]')?.focus();
          };
          summaries.append(tile);
          const activePmsDialog=document.getElementById('investmentCategoryDialog');if(!activePmsDialog.hidden&&activePmsDialog.dataset.stallionId===inv.id)tile.onclick();
        });
        stallionBody.prepend(summaries);
      }

      if(stallionContributionAddPanel&&!entryPanelIsModal(stallionContributionAddPanel))stallionBody.appendChild(stallionContributionAddPanel);
      if(stallionHistoryPanel)stallionBody.appendChild(stallionHistoryPanel);
      if(stallionProfitPanel&&!entryPanelIsModal(stallionProfitPanel))stallionBody.appendChild(stallionProfitPanel);
      const historyExpanded=false;
      if(stallionHistoryPanel){stallionHistoryPanel.hidden=!historyExpanded;if(!hasStallion)stallionHistoryPanel.dataset.historyExpanded='false';}
      const historyButton=document.getElementById('toggleStallionHistoryBtn');
      if(historyButton){historyButton.textContent=historyExpanded?'Hide History':'View History';historyButton.setAttribute('aria-expanded',String(historyExpanded));}
      if(stallionProfitPanel){stallionProfitPanel.hidden=!hasStallion;if(!hasStallion)stallionProfitPanel.classList.remove('is-open');}

      if (addPanel && !entryPanelIsModal(addPanel) && addPanel.parentElement !== investmentList) investmentList.appendChild(addPanel);
      updateRetirementAccountSummary('ppf');
      renderInvestmentOverview();
      refreshInvestmentCategoryDialog();
      refreshRetirementCategoryDialog();
      if(!document.getElementById('stallionHistoryModal').hidden)renderStallionHistoryModal();
    }

    function toggleStallionHistory() { openStallionHistory(); }

    function editInvestment(id) { openInvestmentEditModal('investment',id); }
    function deleteInvestment(id) {
      const investment = state.investments.find(inv => inv.id === id);
      if (confirm('Delete this investment?')) {
        state.investments = state.investments.filter(inv => inv.id !== id);
        state.investmentContributions=(state.investmentContributions||[]).filter(row=>row.investmentId!==id);
        
        // If Stallion PMS, also delete from stallionPms and related contributions
        if (investment && investment.type === 'Stallion PMS') {
          state.stallionPms = state.stallionPms.filter(s => s.id !== id);
          state.stallionContributions = state.stallionContributions.filter(c => c.stallionId !== id);
          state.stallionProfitHistory = state.stallionProfitHistory.filter(row => row.stallionId !== id);
          populateStallionDropdowns();
        }
        
        saveData();
        renderInvestments();
        renderStallionContributions();
        updateDashboard();
      }
    }


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


    // MONTHLY BALANCE TRACKING
    document.getElementById('toggleBalanceForm').addEventListener('click', () => {
      const form = document.getElementById('balanceEntryForm');
      const button = document.getElementById('toggleBalanceForm');
      const opening = form.hidden;
      form.hidden = !opening;
      button.textContent = opening ? 'Cancel' : '+ Set bank balance';
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
        alert('Select a month and enter a valid bank balance.');
        return;
      }

      // Check if record already exists for this month
      const existingIndex = state.monthlyBalances.findIndex(b => b.month === month);
      if (existingIndex !== -1) {
        if (confirm('A bank balance already exists for this month. Update the same record?')) {
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
      document.getElementById('toggleBalanceForm').textContent = '+ Set bank balance';
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
        const monthLabel = new Date(b.month + '-01T12:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
        const cell = (label, value, extra = '') => `<td data-label="${label}" class="balance-history-value ${extra}"><span class="balance-history-label">${label}</span><span class="balance-history-amount">${value}</span></td>`;
        return `<tr class="balance-history-record"><td class="balance-history-month" data-sort="${b.month}"><time datetime="${b.month}">${monthLabel}</time></td>${cell('Opening balance', formatCurrency(b.startBalance))}${cell('Monthly income', formatCurrency(t.income))}${cell('Expenses', formatCurrency(t.expenses))}${cell('Stallion PMS contributions', formatCurrency(t.stallion))}${cell('NPS + PPF contributions', formatCurrency(t.retirement))}${cell('Surplus balance', formatCurrency(b.startBalance + t.income - t.expenses - t.stallion), 'balance-history-surplus')}${cell('House expense', h === null ? 'Awaiting next month’s opening balance' : formatCurrency(h))}<td class="balance-history-actions"><button class="btn-small" aria-label="Delete opening balance for ${monthLabel}" onclick="deleteBalance('${b.id}')">Delete</button></td></tr>`;
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

    function renderCashFlowTrend(month) {
      const host=document.getElementById('cashFlowTrendChart');
      if(!host||!/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(month))return;
      const [year,number]=month.split('-').map(Number);
      const months=Array.from({length:6},(_,index)=>{
        const day=new Date(year,number-1-(5-index),1);
        const key=`${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}`;
        return {key,label:day.toLocaleDateString('en-IN',{month:'short'}),income:0,expenses:0};
      });
      const byMonth=new Map(months.map(row=>[row.key,row]));
      for(const row of profileRows(state.income)){
        const found=byMonth.get(String(row.date||'').slice(0,7));
        if(found)found.income+=Number(row.amount)||0;
      }
      for(const row of state.expenses){
        const found=byMonth.get(String(row.date||'').slice(0,7));
        if(found)found.expenses+=Number(row.amount)||0;
      }
      const hasRecords=months.some(row=>row.income!==0||row.expenses!==0);
      if(!hasRecords){
        host.replaceChildren();
        const note=document.createElement('p');
        note.className='cash-flow-trend-empty';
        note.textContent='No income or expenses recorded across these six months.';
        host.append(note);
        host.setAttribute('aria-label',note.textContent);
        return;
      }
      const maximum=Math.max(1,...months.flatMap(row=>[row.income,row.expenses]));
      const x=index=>34+index*52;
      const y=value=>126-Math.max(0,value)/maximum*100;
      const points=kind=>months.map((row,index)=>`${x(index)},${y(row[kind]).toFixed(2)}`).join(' ');
      const incomePoints=points('income'),expensePoints=points('expenses');
      const grid=[0,0.5,1].map(fraction=>`<line x1="26" y1="${126-fraction*100}" x2="302" y2="${126-fraction*100}" class="cash-flow-trend-grid"/>`).join('');
      const labels=months.map((row,index)=>`<text x="${x(index)}" y="146" text-anchor="middle">${row.label}</text>`).join('');
      host.innerHTML=`<svg viewBox="0 0 320 156" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">${grid}<polyline class="cash-flow-trend-income" points="${incomePoints}"/><polyline class="cash-flow-trend-expense" points="${expensePoints}"/>${labels}</svg>`;
      host.setAttribute('aria-label',`Recorded cash flow for ${months.map(row=>`${row.key}: income ${formatCurrency(row.income)}, expenses ${formatCurrency(row.expenses)}`).join('; ')}. Profile-filtered income and household expenses; future or missing months have no recorded transactions.`);
    }
    function renderTransactionOverview() {
      const cashKind=document.getElementById('income-expenses')?.dataset.cashKind;
      const month=document.getElementById('income-expenses')?.dataset.cashMonth||(cashKind&&document.getElementById(cashKind+'HistoryMonth')?.value)||currentMonthKey();
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
      renderCashFlowTrend(month);
      window.financeWorkbench?.refreshCommitmentsPreview?.();
      window.financeCashFlow?.refreshMonthFilter();
      window.financeCashFlow?.updateBar(income,expenses);
    }

    function updateDashboardExpenseVisual(house, full) {
      const visual=document.querySelectorAll('#dashboardExpenseSnapshot .dashboard-expense-visual');
      const valid=Number.isFinite(house)&&Number.isFinite(full)&&house>=0&&full>0&&house<=full;
      visual.forEach(node=>{node.hidden=!valid;});
      if(!valid)return;
      const share=Math.min(100,Math.max(0,house/full*100));
      document.getElementById('houseExpenseShareBar').style.width=share+'%';
      document.getElementById('fullExpenseHouseBar').style.width=share+'%';
      document.getElementById('fullExpenseRecordedBar').style.width=(100-share)+'%';
      document.getElementById('houseExpenseShareLabel').textContent=share.toFixed(1)+'% of full expense';
      document.getElementById('fullExpenseShareLabel').textContent=(100-share).toFixed(1)+'% recorded expenses';
    }

    // DASHBOARD UPDATE
    function updateDashboard() {
      renderBalanceHistory();
      renderTransactionOverview();
      accrueScheduledRetirementContributions();
      accrueScheduledInvestmentContributions();
      // Personal accounts follow the selected profile; household expenses and balances remain shared.
      const viewDebts=profileRows(state.debts),viewInvestments=profileRows(state.investments),viewNps=profileRows(state.nps),viewPpf=profileRows(state.ppf),viewPf=profileRows(state.pf);
      const totalDebts = viewDebts.reduce((sum, d) => sum + d.remaining, 0);
      const investmentGains = viewInvestments.reduce((sum, inv) => sum + (inv.current - inv.invested), 0) + viewPpf.reduce((sum,x)=>sum+(x.current-x.invested),0) + viewPf.reduce((sum,x)=>sum+(x.current-(x.invested??x.current)),0);
      const totalInvestment = viewInvestments.reduce((sum, inv) => sum + inv.current, 0);
      const npsTotal = viewNps.reduce((sum, nps) => sum + nps.current, 0);
      const ppfTotal = viewPpf.reduce((sum, ppf) => sum + ppf.current, 0);
      const pfTotal = viewPf.reduce((sum, pf) => sum + pf.current, 0);
      const npsGains = viewNps.reduce((sum, nps) => sum + (nps.current - nps.invested), 0);
      
      const totalRetirementFunds = npsTotal + ppfTotal + pfTotal;
      const totalAssets = totalInvestment + totalRetirementFunds;
      const netWorth = totalAssets - totalDebts;

      const viewIncome=profileRows(state.income);
      const monthlyIncome = viewIncome.filter(i => inMonth(i.date, currentMonthKey())).reduce((sum, i) => sum + i.amount, 0);
      const householdMonthlyIncome=state.income.filter(i=>inMonth(i.date,currentMonthKey())).reduce((sum,i)=>sum+(Number(i.amount)||0),0);

      // Combine all current-month income sources into each member's total.
      const incomeByMember = new Map();
      viewIncome.filter(i => inMonth(i.date, currentMonthKey())).forEach(i => {
        const member = String(i.member || 'Unassigned');
        incomeByMember.set(member, (incomeByMember.get(member) || 0) + (Number(i.amount) || 0));
      });
      const incomeBreakdown = [...incomeByMember.entries()].sort((a,b) => b[1]-a[1]);

      // Monthly contributions for NPS
      const npsMonthly = viewNps.reduce((sum, nps) => sum + retirementMonthlyAmount(nps,'nps'), 0);

      // Monthly contributions for PPF
      const ppfMonthly = viewPpf.reduce((sum, ppf) => sum + retirementMonthlyAmount(ppf,'ppf'), 0);

      // Monthly contributions for PF (Employee + Employer)
      const pfMonthly = viewPf.reduce((sum, pf) => sum + retirementMonthlyAmount(pf,'pf'), 0);



      // Monthly contributions for Stallion PMS (get latest month's contributions)
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth();
      const currentYear = currentDate.getFullYear();
      const visiblePortfolioIds=new Set(viewInvestments.filter(row=>row.type==='Stallion PMS').map(row=>row.id));
      const stallionMonthly = state.stallionContributions.filter(c => visiblePortfolioIds.has(c.stallionId)&&inMonth(c.date,currentMonthKey())).reduce((sum,c)=>sum+(c.amount||0),0);

      const totalMonthlyContrib = npsMonthly + ppfMonthly + pfMonthly + stallionMonthly;

      // Calculate monthly surplus balance
      const monthlyExpenses = state.expenses
        .filter(e => inMonth(e.date, currentMonthKey()))
        .reduce((sum, e) => sum + e.amount, 0);

      // Calculate Stallion PMS contributions for current month
      const stallionPmsExpenses = state.stallionContributions
        .filter(c => inMonth(c.date, currentMonthKey()))
        .reduce((sum, c) => sum + (c.amount || 0), 0);

      // Get current month's start balance
      const currentMonthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
      const currentMonthBalance = state.monthlyBalances.find(b => b.month === currentMonthStr);
      const surplusBalance = currentMonthBalance 
        ? currentMonthBalance.startBalance + householdMonthlyIncome - monthlyExpenses - stallionPmsExpenses
        : householdMonthlyIncome - monthlyExpenses - stallionPmsExpenses;

      const previousDate = new Date(currentYear, currentMonth - 1, 1);
      const expenseMonthName = previousDate.toLocaleDateString('en-IN', {month:'long'});
      document.getElementById('houseExpenseLabel').textContent = `${expenseMonthName} House Expense`;
      document.getElementById('fullExpenseLabel').textContent = `${expenseMonthName} Full Expense`;
      const expenseMonthChip=document.getElementById('dashboardExpenseMonth');

      const previousMonthKey = `${previousDate.getFullYear()}-${String(previousDate.getMonth()+1).padStart(2,'0')}`;
      const previousBalance = state.monthlyBalances.find(b => b.month === previousMonthKey);
      const houseCard = document.getElementById('lastMonthHouseExpense');
      const houseNote = document.getElementById('lastMonthHouseExpenseNote');
      const houseAmount = previousBalance?.houseExpense;
      const expenseSnapshot=document.getElementById('dashboardExpenseSnapshot');
      if(expenseSnapshot) expenseSnapshot.hidden=houseAmount==null;
      const monthLabel = previousDate.toLocaleDateString('en-IN', {month:'short', year:'numeric'});
      if (houseCard) {
        houseCard.textContent = houseAmount == null ? 'Pending' : formatCurrency(houseAmount);
        houseCard.style.color = houseAmount < 0 ? 'var(--danger)' : 'var(--primary)';
      }
      if (houseNote) houseNote.textContent = houseAmount == null
        ? `${monthLabel}: enter last month and this month starting balances`
        : `${monthLabel}: last month surplus − this month starting balance${houseAmount < 0 ? ' • Negative difference: review balances / missing inflows' : ''}`;

      const fullExpenseCard = document.getElementById('lastMonthFullExpense');
      const fullExpenseNote = document.getElementById('lastMonthFullExpenseNote');
      const lastRecordedExpenses = monthTotals(previousMonthKey).expenses;
      const fullExpense = houseAmount == null ? null : houseAmount + lastRecordedExpenses;
      updateDashboardExpenseVisual(houseAmount,fullExpense);
      window.PFT_DASHBOARD_INSIGHTS={profile:isCombinedFamilyProfile()?'Combined family':activeFamilyProfile,totalInvestment,npsTotal,ppfTotal,pfTotal,totalAssets,totalDebts,netWorth,currentMonthStr,householdMonthlyIncome,monthlyExpenses,stallionPmsExpenses,surplusBalance,opening:currentMonthBalance?.startBalance??0,hasOpening:!!currentMonthBalance,previousOpening:previousBalance?.startBalance??null,previousMonthKey,previousTotals:monthTotals(previousMonthKey),houseAmount:houseAmount??null,fullExpense,accounts:[...viewInvestments.map(r=>({name:(r.member||'')+' · '+(r.name||r.type),value:r.current})),...['nps','ppf','pf'].flatMap(kind=>profileRows(state[kind]).map(r=>({name:kind.toUpperCase()+' · '+(r.member||'')+' · '+(r.account||r.scheme||''),value:r.current}))),...viewDebts.map(r=>({name:'Debt · '+r.type,value:r.remaining}))]};
      if (fullExpenseCard) {
        fullExpenseCard.textContent = fullExpense == null ? 'Pending' : formatCurrency(fullExpense);
        fullExpenseCard.style.color = fullExpense < 0 ? 'var(--danger)' : 'var(--primary)';
      }
      if (fullExpenseNote) fullExpenseNote.textContent = fullExpense == null
        ? `${monthLabel}: pending last month's house expense`
        : `${monthLabel}: house ${formatCurrency(houseAmount)} + other expenses ${formatCurrency(lastRecordedExpenses)}; excludes investment contributions${houseAmount < 0 ? ' • Review negative house difference' : ''}`;

      // Update stat cards with null checks
      const els = {
        netWorth: document.getElementById('netWorth'),
        totalAssets: document.getElementById('totalAssets'),
        monthlyExpenses: document.getElementById('monthlyExpenses'),
        monthlyIncome: document.getElementById('monthlyIncome'),
        surplusBalance: document.getElementById('surplusBalance'),
        monthlyContrib: document.getElementById('monthlyContrib'),
        incomeBreakdown: document.getElementById('incomeBreakdown'),
        assetsBreakdown: document.getElementById('assetsBreakdown')
      };

      if (els.netWorth) els.netWorth.textContent = formatCurrency(netWorth);
      const netWorthRatio=document.getElementById('dashboardNetWorthRatio');
      if(netWorthRatio){netWorthRatio.hidden=true;netWorthRatio.textContent='';netWorthRatio.removeAttribute('title');}
      if (els.totalAssets) els.totalAssets.textContent = formatCurrency(totalAssets);
      if (els.monthlyExpenses) els.monthlyExpenses.textContent = formatCurrency(monthlyExpenses);
      const dashboardAssetsValue=document.getElementById('dashboardAssetsValue');
      const dashboardDebtValue=document.getElementById('dashboardDebtValue');
      const assetsSegment=document.getElementById('dashboardAssetsSegment');
      const debtsSegment=document.getElementById('dashboardDebtsSegment');
      const assetsShare=document.getElementById('dashboardAssetsShare');
      const debtsShare=document.getElementById('dashboardDebtsShare');
      const grossPosition=totalAssets+totalDebts;
      const assetShare=grossPosition>0?totalAssets/grossPosition*100:0;
      const debtShare=grossPosition>0?totalDebts/grossPosition*100:0;
      if(dashboardAssetsValue)dashboardAssetsValue.textContent=formatCurrency(totalAssets);
      if(dashboardDebtValue)dashboardDebtValue.textContent=formatCurrency(totalDebts);
      if(assetsSegment)assetsSegment.style.width=`${assetShare}%`;
      if(debtsSegment)debtsSegment.style.width=`${debtShare}%`;
      if(assetsShare)assetsShare.textContent=`${assetShare.toFixed(1)}%`;
      if(debtsShare)debtsShare.textContent=`${debtShare.toFixed(1)}%`;
      const positionBar=document.getElementById('dashboardPositionBar');
      if(positionBar)positionBar.setAttribute('aria-label',`Assets ${formatCurrency(totalAssets)} (${assetShare.toFixed(1)}%) and debts ${formatCurrency(totalDebts)} (${debtShare.toFixed(1)}%) of gross position`);
      if (els.monthlyIncome) els.monthlyIncome.textContent = formatCurrency(monthlyIncome);
      if (els.surplusBalance) els.surplusBalance.textContent = formatCurrency(surplusBalance);
      if (els.monthlyContrib) els.monthlyContrib.textContent = formatCurrency(totalMonthlyContrib);
      if (els.incomeBreakdown) els.incomeBreakdown.textContent = incomeBreakdown.length ? incomeBreakdown.slice(0,2).map(([member,amount])=>`${member}: ${formatCurrency(amount)}`).concat(incomeBreakdown.length>2?[`+${incomeBreakdown.length-2} more`]:[]).join(' · ') : 'No income recorded this month';
      if (els.assetsBreakdown) els.assetsBreakdown.textContent = `Inv: ${formatCurrency(totalInvestment)} + Ret: ${formatCurrency(totalRetirementFunds)}`;
      const fyAverage=financialYearAverages();
      const fyLabel=document.getElementById('fyAverageLabel');
      const fyIncome=document.getElementById('fyAvgIncome');
      const fyExpense=document.getElementById('fyAvgExpense');
      const fyNote=document.getElementById('fyAverageNote');
      if(fyLabel) fyLabel.textContent='Monthly Average';
      const dashboardFyLabel=document.getElementById('dashboardFyLabel');
      if(dashboardFyLabel) dashboardFyLabel.textContent=`FY ${String(fyAverage.startYear).slice(-2)}–${String(fyAverage.endYear).slice(-2)}`;
      if(fyIncome) fyIncome.textContent=formatCurrency(fyAverage.averageIncome);
      if(fyExpense) fyExpense.textContent=formatCurrency(fyAverage.averageExpense);
      if(fyNote) fyNote.textContent=`April–${fyAverage.through}; income avg uses ${fyAverage.incomeMonths} reported month${fyAverage.incomeMonths===1?'':'s'}, expense avg uses ${fyAverage.expenseMonths} reported month${fyAverage.expenseMonths===1?'':'s'}`;
      const analyticsYear=Number(document.getElementById('analyticsFinancialYear')?.value)||fyAverage.startYear;
      renderAnalyticsAverageSnapshot(analyticsYear===fyAverage.startYear?fyAverage:financialYearAverages(new Date(analyticsYear+1,2,31)));

      renderDebtSummary();

      renderDashboardExpenseSnapshot();

      // Reports
      const totalIncome = viewIncome.reduce((sum, i) => sum + i.amount, 0);
      const totalExpenses = state.expenses.reduce((sum, e) => sum + e.amount, 0);
      const savings = totalIncome - totalExpenses;

      const totalInvestmentGains = investmentGains + npsGains;

      // Update report elements if they exist
      const reportIncome = document.getElementById('reportIncome');
      const reportExpenses = document.getElementById('reportExpenses');
      const reportSavings = document.getElementById('reportSavings');
      const reportGains = document.getElementById('reportGains');

      if (reportIncome) reportIncome.textContent = formatCurrency(totalIncome);
      if (reportExpenses) reportExpenses.textContent = formatCurrency(totalExpenses);
      if (reportSavings) reportSavings.textContent = formatCurrency(savings);
      if (reportGains) reportGains.textContent = formatCurrency(totalInvestmentGains);

      console.log(' updateDashboard - all elements updated successfully');

      // Render complete investment portfolio
      renderCompletePortfolio();
      if(document.body.classList.contains('advanced-layout'))renderAdvancedDashboardInsights();
      const reportStart=document.getElementById('reportStartDate');
      if (reportStart?.value && document.getElementById('rangeReportResults')) renderRangeReport();

      // Draw analytics only when visible; refresh their totals in the background.
      if(document.getElementById('analytics')?.classList.contains('active'))renderCharts();
      else updateFinancialSummary();
    }


    function renderAdvancedDashboardInsights() {
      const insights=document.getElementById('advancedDashboardInsights');
      if(!insights)return;
      const enabled=document.body.classList.contains('advanced-layout');
      insights.hidden=!enabled;
      if(!enabled)return;
      const now=new Date(),startYear=now.getMonth()>=3?now.getFullYear():now.getFullYear()-1;
      const endMonth=now.getMonth(),monthCount=(now.getFullYear()-startYear)*12+endMonth-2;
      const periods=[];
      for(let offset=0;offset<monthCount;offset++){
        const date=new Date(startYear,3+offset,1),key=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
        periods.push({key,label:date.toLocaleDateString('en-IN',{month:'short'}),income:0,expenses:0});
      }
      const periodMap=new Map(periods.map(item=>[item.key,item]));
      for(const row of profileRows(state.income||[])){const key=row.date?.slice(0,7),period=periodMap.get(key);if(period)period.income+=Number(row.amount)||0;}
      for(const row of state.expenses||[]){const key=row.date?.slice(0,7),period=periodMap.get(key);if(period)period.expenses+=Number(row.amount)||0;}
      const cashSvg=document.getElementById('advancedDashboardCashflowChart');
      const cashPeriod=document.getElementById('advancedDashboardCashflowPeriod');
      if(cashSvg){
        if(!periods.length){cashSvg.innerHTML='<text x="320" y="100" text-anchor="middle" class="cash-axis">No months are available in this financial year.</text>';}
        else {
          const left=42,right=630,top=18,bottom=165,height=bottom-top,width=right-left,maxValue=Math.max(1,...periods.flatMap(row=>[row.income,row.expenses]))*1.12; const cashAxis=value=>value===0?'₹0':value>=100000?`₹${(value/100000).toFixed(1)}L`:formatCurrency(value);
          const desktopBars=(window.matchMedia?.('(min-width:701px)')?.matches??window.innerWidth>700);
          const step=width/periods.length,barWidth=Math.min(20,step*.28);
          const xAt=index=>desktopBars?left+step*(index+.5):periods.length===1?left+width/2:left+width*index/(periods.length-1),yAt=value=>bottom-height*value/maxValue;
          const lineFor=key=>periods.map((row,index)=>`${index?'L':'M'}${xAt(index).toFixed(1)},${yAt(row[key]).toFixed(1)}`).join(' ');
          const incomePath=lineFor('income'),expensePath=lineFor('expenses');
          const grid=[0,.5,1].map(fraction=>{const y=bottom-height*fraction,value=maxValue*fraction;return `<line class="cash-grid" x1="${left}" y1="${y.toFixed(1)}" x2="${right}" y2="${y.toFixed(1)}"/><text class="cash-axis" x="${left-7}" y="${(y+3).toFixed(1)}" text-anchor="end">${cashAxis(value)}</text>`;}).join('');
          const labels=periods.map((row,index)=>`<text class="cash-axis" x="${xAt(index).toFixed(1)}" y="188" text-anchor="middle">${analyticEscape(row.label)}</text>`).join('');
          const incomePoints=periods.map((row,index)=>`<circle class="cash-point-income" cx="${xAt(index).toFixed(1)}" cy="${yAt(row.income).toFixed(1)}" r="3.2"><title>${analyticEscape(row.label)} income: ${formatCurrency(row.income)}</title></circle>`).join('');
          const expensePoints=periods.map((row,index)=>`<circle class="cash-point-expense" cx="${xAt(index).toFixed(1)}" cy="${yAt(row.expenses).toFixed(1)}" r="3"><title>${analyticEscape(row.label)} expenses: ${formatCurrency(row.expenses)}</title></circle>`).join('');
          const area=`${incomePath} L${xAt(periods.length-1).toFixed(1)},${bottom} L${xAt(0).toFixed(1)},${bottom} Z`;
          const bars=desktopBars?periods.map((row,index)=>{
            const x=xAt(index),incomeHeight=bottom-yAt(row.income),expenseHeight=bottom-yAt(row.expenses);
            const label=analyticEscape(`${row.label}: income ${formatCurrency(row.income)}, expenses ${formatCurrency(row.expenses)}`);
            return `<g class="cash-month-bars" tabindex="0" role="img" aria-label="${label}"><title>${label}</title><rect class="cash-bar-income" x="${(x-barWidth-2).toFixed(1)}" y="${yAt(row.income).toFixed(1)}" width="${barWidth.toFixed(1)}" height="${incomeHeight.toFixed(1)}" rx="3"/><rect class="cash-bar-expense" x="${(x+2).toFixed(1)}" y="${yAt(row.expenses).toFixed(1)}" width="${barWidth.toFixed(1)}" height="${expenseHeight.toFixed(1)}" rx="3"/></g>`;
          }).join(''):'';
          cashSvg.innerHTML=`<g aria-hidden="true">${grid}${labels}</g>${desktopBars?bars:`<path class="cash-income-area" d="${area}"/><path class="cash-income" d="${incomePath}"/><path class="cash-expense" d="${expensePath}"/>${incomePoints}${expensePoints}`}<g class="cash-hover-layer" visibility="hidden" pointer-events="none"><line class="cash-hover-guide" x1="0" y1="${top}" x2="0" y2="${bottom}"/><circle class="cash-hover-income" cx="0" cy="0" r="4.5"/><circle class="cash-hover-expense" cx="0" cy="0" r="4.5"/><rect class="cash-hover-box" x="0" y="0" width="190" height="48" rx="7"/><text class="cash-hover-title" x="9" y="13"></text><text class="cash-hover-label" x="9" y="28">Income</text><text class="cash-hover-value cash-hover-income-value" x="48" y="28"></text><text class="cash-hover-label" x="9" y="40">Expenses</text><text class="cash-hover-value cash-hover-expense-value" x="56" y="40"></text></g>`;
          const hoverLayer=cashSvg.querySelector('.cash-hover-layer');
          const hideCashTooltip=()=>{if(hoverLayer)hoverLayer.setAttribute('visibility','hidden');};
          cashSvg.onpointermove=event=>{
            if(!hoverLayer||!periods.length)return;
            const matrix=cashSvg.getScreenCTM();if(!matrix)return;
            const point=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());
            if(point.x<left||point.x>right||point.y<top||point.y>bottom){hideCashTooltip();return;}
            const index=periods.length===1?0:Math.max(0,Math.min(periods.length-1,desktopBars?Math.floor((point.x-left)/step):Math.round((point.x-left)/width*(periods.length-1))));
            const row=periods[index],x=xAt(index),incomeY=yAt(row.income),expenseY=yAt(row.expenses),boxWidth=190,boxHeight=48;
            const boxX=Math.max(left,Math.min(right-boxWidth,point.x+12));
            const boxY=point.y-top>boxHeight+10?point.y-boxHeight-8:Math.min(bottom-boxHeight-3,point.y+9);
            const guide=hoverLayer.querySelector('.cash-hover-guide');guide.setAttribute('x1',x);guide.setAttribute('x2',x);
            const incomeMarker=hoverLayer.querySelector('.cash-hover-income');incomeMarker.setAttribute('cx',x);incomeMarker.setAttribute('cy',incomeY);
            const expenseMarker=hoverLayer.querySelector('.cash-hover-expense');expenseMarker.setAttribute('cx',x);expenseMarker.setAttribute('cy',expenseY);
            hoverLayer.querySelector('.cash-hover-box').setAttribute('x',boxX);hoverLayer.querySelector('.cash-hover-box').setAttribute('y',boxY);
            const texts=hoverLayer.querySelectorAll('text');texts[0].setAttribute('x',boxX+9);texts[0].setAttribute('y',boxY+13);texts[0].textContent=`${row.label} · ${financialYearLabel(startYear)}`;
            texts[1].setAttribute('x',boxX+9);texts[1].setAttribute('y',boxY+28);texts[2].setAttribute('x',boxX+48);texts[2].setAttribute('y',boxY+28);texts[2].textContent=formatCurrency(row.income);
            texts[3].setAttribute('x',boxX+9);texts[3].setAttribute('y',boxY+40);texts[4].setAttribute('x',boxX+56);texts[4].setAttribute('y',boxY+40);texts[4].textContent=formatCurrency(row.expenses);
            hoverLayer.setAttribute('visibility','visible');
          };
          cashSvg.onpointerleave=hideCashTooltip;
          cashSvg.setAttribute('aria-label',`Income and expense trend from ${periods[0].label} through ${periods[periods.length-1].label} in financial year ${startYear}-${startYear+1}. Hover anywhere in the plot area to see the nearest month's income and expenses. Annual expenses are included in full in the month recorded.`);
        }
      }
      if(cashPeriod)cashPeriod.textContent=`${financialYearLabel(startYear)} · April to ${periods[periods.length-1]?.label||'current month'}`;
      const allocations=new Map();
      for(const row of profileRows(state.investments||[])){const amount=Number(row.current)||0;if(amount>0){const name=row.type==='Stallion PMS'?'Stallion PMS':row.type||'Other';allocations.set(name,(allocations.get(name)||0)+amount);}}
      for(const [name,rows] of [['NPS',profileRows(state.nps)],['PPF',profileRows(state.ppf)],['PF',profileRows(state.pf)]]){const amount=(rows||[]).reduce((sum,row)=>sum+(Number(row.current)||0),0);if(amount>0)allocations.set(name,(allocations.get(name)||0)+amount);}
      let slices=[...allocations.entries()].map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);
      if(slices.length>6){const rest=slices.slice(5).reduce((sum,item)=>sum+item.value,0);slices=[...slices.slice(0,5),{name:'Other',value:rest}];}
      const total=slices.reduce((sum,item)=>sum+item.value,0),donut=document.getElementById('advancedDashboardAllocationChart'),legend=document.getElementById('advancedDashboardAllocationLegend');
      if(donut){
        const colors=['var(--primary)','#4f78c9','#d18b2c','#c96974','#8069a8','#468b87'],radius=60,circumference=2*Math.PI*radius;
        let offset=0;
        const segments=slices.map((item,index)=>{const length=total>0?circumference*item.value/total:0,color=item.name==='Other'?'#64748b':colors[index%colors.length],segment=`<circle class="advanced-dashboard-donut-segment" cx="90" cy="90" r="${radius}" stroke="${color}" stroke-dasharray="${length.toFixed(2)} ${(circumference-length).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}"><title>${analyticEscape(item.name)}: ${formatCurrency(item.value)} (${analyticPercent(item.value,total)})</title></circle>`;offset+=length;return segment;}).join('');
        donut.innerHTML=`<circle class="advanced-dashboard-donut-track" cx="90" cy="90" r="${radius}"/>${segments}<text class="advanced-dashboard-donut-total" x="90" y="87">${total?analyticEscape(analyticCompact(total)):'₹0'}</text><text class="advanced-dashboard-donut-caption" x="90" y="103">PORTFOLIO VALUE</text>`;
        donut.setAttribute('aria-label',total?`Investment portfolio allocation totaling ${formatCurrency(total)}, excluding gratuity. ${slices.map(item=>`${item.name} ${formatCurrency(item.value)}, ${analyticPercent(item.value,total)}`).join('; ')}.`:'No investment balances are recorded; gratuity is excluded.');
      }
      if(legend)legend.innerHTML=slices.length?slices.map((item,index)=>`<div class="advanced-dashboard-allocation-item" style="--allocation-color:${item.name==='Other'?'#64748b':['var(--primary)','#4f78c9','#d18b2c','#c96974','#8069a8','#468b87'][index%6]}"><i aria-hidden="true"></i><span title="${analyticEscape(item.name)}">${analyticEscape(item.name)}</span><strong>${analyticEscape(analyticCompact(item.value))} · ${analyticPercent(item.value,total)}</strong></div>`).join(''):'<p class="text-muted">Add an investment to see your allocation.</p>';
    }

    function populateReportFinancialYears() {
      const select=document.getElementById('reportFinancialYear');if(!select)return;
      const current=currentFinancialYearStartYear();
      let earliest=current;
      const includeDate=value=>{const date=value?.date||value?.asOfDate;if(validCalendarDate(date))earliest=Math.min(earliest,financialYearStartYearForMonthKey(date.slice(0,7)));};
      for(const key of ['income','expenses','investmentContributions','stallionContributions','stallionProfitHistory','retirementContributions'])for(const row of state[key]||[])includeDate(row);
      for(const row of datedInterestEntries())includeDate(row);
      for(const row of state.monthlyBalances||[])if(/^\d{4}-(0[1-9]|1[0-2])$/.test(row.month||''))earliest=Math.min(earliest,financialYearStartYearForMonthKey(row.month));
      const previous=select.value;
      select.innerHTML='<option value="">Custom date range</option>'+Array.from({length:Math.max(1,current-earliest+1)},(_,index)=>current-index).map(year=>`<option value="${year}">${financialYearLabel(year)}</option>`).join('');
      const selectedYear=Number(previous);if(previous&&Number.isInteger(selectedYear)&&selectedYear>=earliest&&selectedYear<=current)select.value=previous;else select.value='';
    }
    function applyReportFinancialYear() {
      const startYear=Number(document.getElementById('reportFinancialYear').value);
      if(!Number.isInteger(startYear)||startYear<1900)return;
      document.getElementById('reportStartDate').value=`${startYear}-04-01`;
      document.getElementById('reportEndDate').value=`${startYear+1}-03-31`;
      renderRangeReport(true);
    }
    function clearReportPresetSelection(){document.querySelectorAll('[data-report-preset]').forEach(button=>button.setAttribute('aria-pressed','false'));if(!document.getElementById('reportFinancialYear').value)document.querySelector('[data-report-preset=custom]')?.setAttribute('aria-pressed','true');}
    function applyReportDatePreset(preset){
      if(preset==='custom'){document.getElementById('reportFinancialYear').value='';clearReportPresetSelection();document.getElementById('reportStartDate').focus();return;}
      const now=new Date(),today=localDateKey(),year=now.getFullYear(),month=now.getMonth(),fyStart=month>=3?year:year-1;
      const dateKey=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
      let start='',end=today;
      if(preset==='this-month')start=`${currentMonthKey()}-01`;
      else if(preset==='this-fy')start=`${fyStart}-04-01`;
      else if(preset==='last-fy'){start=`${fyStart-1}-04-01`;end=`${fyStart}-03-31`;}
      else if(preset==='last-3-months')start=dateKey(new Date(year,month-2,1));
      else return;
      document.getElementById('reportFinancialYear').value='';
      document.getElementById('reportStartDate').value=start;
      document.getElementById('reportEndDate').value=end;
      clearReportPresetSelection();
      document.querySelector('[data-report-preset=custom]')?.setAttribute('aria-pressed','false');
      document.querySelector(`[data-report-preset="${preset}"]`)?.setAttribute('aria-pressed','true');
      renderRangeReport(true);
    }
    function reportDateWithinRange(value,start,end) {
      const dateKey=typeof value==='string'?value.slice(0,10):'';
      return validCalendarDate(dateKey)&&dateKey>=start&&dateKey<=end;
    }
    function rangeReportValueKey(value) { return JSON.stringify(value===undefined?null:value); }
    function rangeReportFilteredRows(group) {
      const filters=Object.entries(group?.columnFilters||{}).map(([column,selected])=>[column,new Set(selected)]);
      if(!filters.length)return group.rows;
      return group.rows.filter(row=>filters.every(([column,selected])=>selected.has(rangeReportValueKey(row[column]))));
    }
    function rangeReportColumnValues(group,column) {
      const values=new Map();
      group.rows.forEach(row=>{const value=row[column]===undefined?null:row[column];values.set(rangeReportValueKey(value),value);});
      return [...values.entries()].sort((a,b)=>{
        if(a[1]===null)return 1;if(b[1]===null)return -1;
        return String(a[1]).localeCompare(String(b[1]),'en',{numeric:true,sensitivity:'base'});
      });
    }
    function rangeReportData() {
      const start=document.getElementById('reportStartDate').value,end=document.getElementById('reportEndDate').value,type=document.getElementById('reportType').value;
      if(!validCalendarDate(start)||!validCalendarDate(end)||start>end)throw new Error('Select valid dates with From date on or before To date.');
      const totalsByMonth=recalculateHouseExpenses();
      const reportDebts=new Map(allAccounts('debts').map(row=>[row.id,row]));
      const reportInvestments=new Map(allAccounts('investments').map(row=>[row.id,row]));
      const money=['Amount','Invested','Current value','Monthly scheduled','Employee monthly','Employer monthly','Principal','Remaining principal','EMI','Interest paid','Principal paid','Starting balance','Income','Recorded expenses','PMS SIP','Surplus','House expense','Full expense','Gain / loss','EPS contribution','Total contribution'];
      const common=r=>({Date:r.date,Member:r.member||'',Notes:r.notes||''});
      const definitions=[
        ['interestCredits','PF / PPF annual interest',r=>({Date:r.date,Member:r.member,Account:r.accountName,Type:r.investmentType.toUpperCase(),'Financial year':r.financialYear,Amount:r.amount})],
        ['income','Income',r=>({...common(r),Source:r.source,Amount:r.amount})],
        ['expenses','Expenses',r=>({...common(r),Category:r.category,Subcategory:r.subcategory||'',Amount:r.amount,Annual:r.isAnnual?'Yes':'No',Loan:reportDebts.get(r.loanId)?.type||'','Payment type':r.category==='EMI Payment'?(r.repaymentType==='part-payment'?'Part Payment':'Monthly EMI'):'','Principal paid':r.principalPaid||0,'Interest paid':r.interestPaid||0})],
        ['stallionContributions','PMS SIP contributions',r=>{const inv=reportInvestments.get(r.stallionId);return {...common(r),Member:inv?.member||'',Portfolio:inv?.name||'',Amount:r.amount};}],
        ['investmentContributions','Investment contributions',r=>{const inv=reportInvestments.get(r.investmentId);return {...common(r),Member:inv?.member||'',Type:inv?.type||'',Name:inv?.name||'',Amount:r.amount};}],
        ['stallionProfitHistory','Stallion PMS gain / loss snapshots',r=>{const inv=reportInvestments.get(r.stallionId);return {...common(r),Member:inv?.member||'',Portfolio:inv?.name||'','Gain / loss':r.profit};}],
        ['npsContributions','NPS monthly contributions',r=>({Date:r.date,Member:r.member,Account:r.accountName,Amount:r.amount})],
        ['ppfContributions','PPF monthly contributions',r=>({Date:r.date,Member:r.member,Account:r.accountName,Amount:r.amount})],
        ['pfContributions','PF / EPS monthly contributions',r=>({Date:r.date,Member:r.member,Account:r.accountName,Amount:r.amount,'EPS contribution':r.epsAmount||0,'Total contribution':r.amount+(r.epsAmount||0)})],
        ['monthlyBalances','Monthly balances & house expenses',r=>{const t=totalsByMonth.get(r.month)||{income:0,expenses:0,stallion:0};return {Date:r.month+'-01',Month:r.month,'Starting balance':r.startBalance,Income:t.income,'Recorded expenses':t.expenses,'PMS SIP':t.stallion,Surplus:r.startBalance+t.income-t.expenses-t.stallion,'House expense':r.houseExpense,'Full expense':r.houseExpense===null?null:r.houseExpense+t.expenses};}]
      ];
      const contributionTypes={npsContributions:'nps',ppfContributions:'ppf',pfContributions:'pf'};
      const groups=definitions.filter(([key])=>type==='all'||key===type).map(([key,title,map])=>{
        const source=key==='interestCredits'?datedInterestEntries():contributionTypes[key]?state.retirementContributions.filter(r=>r.investmentType===contributionTypes[key]):state[key];
        const sourceForProfile=isCombinedFamilyProfile()?source:(source||[]).filter(row=>{
          if(key==='expenses'||key==='monthlyBalances')return true;
          if(key==='stallionContributions'||key==='stallionProfitHistory')return reportInvestments.get(row.stallionId)?.member===activeFamilyProfile;
          if(key==='investmentContributions')return reportInvestments.get(row.investmentId)?.member===activeFamilyProfile;
          return row.member===activeFamilyProfile;
        });
        return {key,title,rows:(sourceForProfile||[]).filter(r=>reportDateWithinRange(key==='monthlyBalances'?`${r.month}-01`:r.date,start,end)).map(map).sort((a,b)=>String(b.Date||'').localeCompare(String(a.Date||'')))};
      });
      return {start,end,money,groups};
    }
    const RANGE_REPORT_PAGE_SIZE = 10;
    let rangeReportPages = {};
    let rangeReportGroups = {};
    let rangeReportOpenFilter = null;
    function closeRangeReportColumnFilter() {
      const popover=document.getElementById('rangeReportColumnFilterPopover');
      if(!popover)return;
      if(rangeReportOpenFilter?.button?.isConnected)rangeReportOpenFilter.button.setAttribute('aria-expanded','false');
      popover.hidden=true;popover.innerHTML='';rangeReportOpenFilter=null;
    }
    const RANGE_FILTER_PAGE_SIZE=100;
    function renderRangeReportFilterOptions(resetPage=false) {
      const active=rangeReportOpenFilter,popover=document.getElementById('rangeReportColumnFilterPopover');
      if(!active||!popover)return;
      const query=popover.querySelector('[data-range-filter-search]').value.trim().toLocaleLowerCase();
      active.matches=active.options.filter(option=>option.search.includes(query));
      const pageCount=Math.max(1,Math.ceil(active.matches.length/RANGE_FILTER_PAGE_SIZE));
      active.page=resetPage?1:Math.min(Math.max(active.page,1),pageCount);
      const offset=(active.page-1)*RANGE_FILTER_PAGE_SIZE,items=active.matches.slice(offset,offset+RANGE_FILTER_PAGE_SIZE);
      const list=popover.querySelector('.range-report-filter-options');
      list.innerHTML=items.map(option=>`<label class="range-report-filter-option"><input type="checkbox" data-range-filter-option value="${analyticEscape(option.key)}"${active.selected.has(option.key)?' checked':''}><span title="${analyticEscape(option.label)}">${analyticEscape(option.label)}</span></label>`).join('')||'<p class="range-report-filter-empty">No matching values.</p>';
      list.scrollTop=0;
      popover.querySelector('[data-range-filter-count]').textContent=`${active.selected.size} selected`;
      popover.querySelector('[data-range-filter-select-all]').textContent=query?'Select matches':'Select all';
      popover.querySelector('[data-range-filter-select-none]').textContent=query?'Clear matches':'Clear selection';
      const paging=popover.querySelector('[data-range-filter-paging]');
      paging.hidden=active.matches.length<=RANGE_FILTER_PAGE_SIZE;
      paging.querySelector('[data-range-filter-prev]').disabled=active.page===1;
      paging.querySelector('[data-range-filter-next]').disabled=active.page===pageCount;
      paging.querySelector('[data-range-filter-page-label]').textContent=`${offset+1}–${offset+items.length} of ${active.matches.length}`;
    }
    function openRangeReportColumnFilter(button) {
      const table=button.closest('table[data-range-report-key]'),key=table?.dataset.rangeReportKey,group=rangeReportGroups[key],column=button.dataset.rangeReportColumn;
      const popover=document.getElementById('rangeReportColumnFilterPopover');if(!group||!popover)return;
      closeRangeReportColumnFilter();
      const label=group.cols[Number(column)],options=rangeReportColumnValues(group,label).map(([key,value])=>{const label=value===null?'Pending / not calculated':String(value);return {key,label,search:label.toLocaleLowerCase()};}),current=group.columnFilters[label];
      rangeReportOpenFilter={button,key,column:label,options,selected:new Set(current===undefined?options.map(option=>option.key):current),page:1,matches:options};
      popover.dataset.reportKey=key;popover.dataset.reportColumn=label;
      popover.innerHTML=`<div class="range-report-filter-popover-head"><strong>Filter: ${analyticEscape(label)}</strong><button type="button" data-range-filter-close aria-label="Close filter"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></div><input class="range-report-filter-search" type="search" placeholder="Search values" aria-label="Search ${analyticEscape(label)} values" data-range-filter-search><div class="range-report-filter-actions-top"><button type="button" data-range-filter-select-all>Select all</button><button type="button" data-range-filter-select-none>Clear selection</button><span data-range-filter-count></span></div><div class="range-report-filter-options"></div><div class="range-report-filter-actions-top" data-range-filter-paging><button type="button" data-range-filter-prev aria-label="Previous values">‹</button><span data-range-filter-page-label></span><button type="button" data-range-filter-next aria-label="Next values">›</button></div><div class="range-report-filter-footer"><button type="button" data-range-filter-clear>Clear filter</button><button type="button" class="btn-primary" data-range-filter-apply>Apply</button></div>`;
      renderRangeReportFilterOptions();
      const rect=button.getBoundingClientRect(),width=Math.min(280,window.innerWidth-24),left=Math.max(12,Math.min(rect.right-width,window.innerWidth-width-12));
      popover.style.left=`${left}px`;popover.hidden=false;
      const popoverHeight=Math.min(popover.scrollHeight,window.innerHeight-24);
      let top=rect.bottom+5;if(top+popoverHeight>window.innerHeight-12)top=Math.max(12,rect.top-popoverHeight-5);
      popover.style.top=`${top}px`;
      button.setAttribute('aria-expanded','true');
      popover.querySelector('[data-range-filter-search]')?.focus();
    }
    function applyRangeReportColumnFilter(clear=false) {
      const popover=document.getElementById('rangeReportColumnFilterPopover'),key=popover?.dataset.reportKey,column=popover?.dataset.reportColumn,group=rangeReportGroups[key];if(!group)return;
      if(clear)delete group.columnFilters[column];
      else {
        const selected=[...(rangeReportOpenFilter?.selected||[])];
        const allValues=rangeReportColumnValues(group,column).map(([valueKey])=>valueKey);
        if(selected.length===allValues.length)delete group.columnFilters[column];
        else group.columnFilters[column]=selected;
      }
      rangeReportPages[key]=1;closeRangeReportColumnFilter();renderRangeReport();
    }
    function rangeReportPageButtons(pageCount, currentPage) {
      const pages=pageCount<=7?Array.from({length:pageCount},(_,i)=>i+1):[...new Set([1,currentPage-1,currentPage,currentPage+1,pageCount].filter(page=>page>=1&&page<=pageCount))].sort((a,b)=>a-b);
      let previous=0,html='';
      pages.forEach(page=>{
        if(page-previous>1)html+='<span class="range-report-page-ellipsis" aria-hidden="true">…</span>';
        html+=`<button type="button" data-range-report-page="${page}" aria-label="Page ${page}"${page===currentPage?' class="range-report-page-active" aria-current="page"':''}>${page}</button>`;
        previous=page;
      });
      return html;
    }
    function rangeReportRowHtml(group,row) {
      const numericColumn=k=>group.money.includes(k)||/%|rate/i.test(k);
      const cell=(k,v)=>v==null?'Pending / not calculated':group.money.includes(k)?formatCurrency(v):analyticEscape(v);
      return `<tr>${group.cols.map(k=>`<td${numericColumn(k)?' class="text-right"':''}>${cell(k,row[k])}</td>`).join('')}</tr>`;
    }
    function rangeReportSummable(group,column){if(group.key==='stallionProfitHistory')return false;if(group.key==='monthlyBalances'&&['Starting balance','Surplus'].includes(column))return false;return group.money.includes(column);}
    function applyRangeReportPagination(table) {
      if(!table?.dataset.rangeReportKey)return;
      const key=table.dataset.rangeReportKey,group=rangeReportGroups[key];if(!group)return;
      const rows=rangeReportFilteredRows(group),pageCount=Math.max(1,Math.ceil(rows.length/RANGE_REPORT_PAGE_SIZE));
      const page=Math.min(Math.max(Number(rangeReportPages[key])||1,1),pageCount);rangeReportPages[key]=page;
      const start=(page-1)*RANGE_REPORT_PAGE_SIZE,end=Math.min(start+RANGE_REPORT_PAGE_SIZE,rows.length);
      table.tBodies[0].innerHTML=rows.length?rows.slice(start,end).map(row=>rangeReportRowHtml(group,row)).join(''):`<tr><td colspan="${group.cols.length}" class="range-report-no-match">No rows match these column filters.<button type="button" data-range-clear-all>Clear all filters</button></td></tr>`;
      const controls=table.closest('[data-range-report-section]')?.querySelector('[data-range-report-pagination]');
      if(controls){
        controls.querySelector('[data-range-report-count]').textContent=`Showing ${rows.length?start+1:0}–${end} of ${rows.length} entries`;
        controls.querySelector('[data-range-report-pages]').innerHTML=`<button type="button" data-range-report-page="prev" aria-label="Previous page"${page===1?' disabled':''}>‹</button>${rangeReportPageButtons(pageCount,page)}<button type="button" data-range-report-page="next" aria-label="Next page"${page===pageCount?' disabled':''}>›</button>`;
      }
      const section=table.closest('[data-range-report-section]');
      if(section){const heading=section.querySelector('h3');if(heading)heading.textContent=`${group.title} (${rows.length}${group.rows.length!==rows.length?` of ${group.rows.length}`:''})`;}
      const footer=table.tFoot?.rows[0];
      if(footer)group.cols.forEach((col,index)=>{const cell=footer.cells[index];if(!cell)return;if(index===0)cell.textContent=group.key==='stallionProfitHistory'?'Snapshots (not additive)':'Total';else if(rangeReportSummable(group,col))cell.textContent=!rows.length?'—':rows.some(row=>row[col]==null)?'Incomplete':formatCurrency(rows.reduce((sum,row)=>sum+(Number(row[col])||0),0));else cell.textContent='';});
    }
    function sortRangeReportRows(table,choice) {
      const group=rangeReportGroups[table?.dataset.rangeReportKey];if(!group||!choice)return;
      const heading=group.cols[choice.column];
      group.rows=group.rows.map((row,index)=>({row,index,value:row[heading]})).sort((a,b)=>{
        const aMissing=a.value==null,bMissing=b.value==null;
        if(aMissing!==bMissing)return aMissing?1:-1;
        let cmp=typeof a.value==='number'&&typeof b.value==='number'?a.value-b.value:String(a.value??'').localeCompare(String(b.value??''),'en',{numeric:true,sensitivity:'base'});
        return (choice.direction==='desc'?-cmp:cmp)||a.index-b.index;
      }).map(item=>item.row);
      rangeReportPages[table.dataset.rangeReportKey]=1;
      applyRangeReportPagination(table);
    }
    function rangeReportSummaryItems(groups,reportType){
      const find=key=>groups.find(group=>group.key===key&&group.rows.length);
      const sum=(group,column)=>{const values=(group?.rows||[]).map(row=>row[column]).filter(value=>value!==null&&value!==undefined&&Number.isFinite(Number(value))).map(Number);return values.length?values.reduce((total,value)=>total+value,0):null;};
      const items=[],add=(label,value,note)=>{if(value!==null&&value!==undefined)items.push({label,value:formatCurrency(value),note});};
      const contributionKeys=['investmentContributions','stallionContributions','npsContributions','ppfContributions','pfContributions'];
      if(reportType==='all'){
        const income=find('income'),expenses=find('expenses');
        if(income)add('Income total',sum(income,'Amount'),`${income.rows.length} entries in the selected period`);
        if(expenses)add('Expenses total',sum(expenses,'Amount'),`${expenses.rows.length} entries; annual expenses count in full`);
        const contributions=groups.filter(group=>contributionKeys.includes(group.key)&&group.rows.length);
        if(contributions.length){const count=contributions.reduce((n,group)=>n+group.rows.length,0);add('Investment contributions',contributions.reduce((n,group)=>n+sum(group,'Amount'),0),`${count} entries across contribution types`);}
        const interest=find('interestCredits');if(interest)add('PF / PPF interest credited',sum(interest,'Amount'),`${interest.rows.length} interest entries`);
        const pms=find('stallionProfitHistory');if(pms){const latest=[...pms.rows].sort((a,b)=>String(b.Date||'').localeCompare(String(a.Date||'')))[0];if(latest)add('Latest PMS gain / loss',Number(latest['Gain / loss'])||0,`Most recent selected snapshot · ${latest.Date||'date unavailable'}`);}
        const balances=find('monthlyBalances');if(balances)add('Monthly surplus total',sum(balances,'Surplus'),`${balances.rows.length} monthly snapshots; values are summed`);
      }else{
        const group=find(reportType);if(!group)return items;
        if(reportType==='monthlyBalances'){
          add('Income recorded',sum(group,'Income'),`${group.rows.length} monthly snapshots`);
          add('Full expenses',sum(group,'Full expense'),'Recorded expenses plus house expense');
          add('Surplus total',sum(group,'Surplus'),'Sum across selected monthly snapshots');
        }else if(reportType==='stallionProfitHistory'){
          const latest=[...group.rows].sort((a,b)=>String(b.Date||'').localeCompare(String(a.Date||'')))[0];
          if(latest)add('Latest PMS gain / loss',Number(latest['Gain / loss'])||0,`Most recent selected snapshot · ${latest.Date||'date unavailable'}`);
        }else{
          const label=reportType==='income'?'Income total':reportType==='expenses'?'Expenses total':reportType==='interestCredits'?'PF / PPF interest credited':reportType==='stallionContributions'?'PMS contributions':reportType==='npsContributions'?'NPS contributions':reportType==='ppfContributions'?'PPF contributions':reportType==='pfContributions'?'PF contributions':'Investment contributions';
          add(label,sum(group,'Amount'),`${group.rows.length} entries in the selected period`);
        }
      }
      return items;
    }
    function renderRangeReportSummary(groups,reportType,recordCount){
      const host=document.getElementById('rangeReportSummary');if(!host)return;
      const items=rangeReportSummaryItems(groups,reportType);
      if(!items.length&&recordCount)items.push({label:'Matching records',value:String(recordCount),note:'Use the table filters to narrow the report'});
      host.innerHTML=items.map(item=>`<article class="report-summary-card"><span class="report-summary-label">${analyticEscape(item.label)}</span><strong class="report-summary-value">${analyticEscape(item.value)}</strong><small class="report-summary-note">${analyticEscape(item.note)}</small></article>`).join('');
      host.hidden=!items.length;
    }
    function renderRangeReport(resetColumnFilters=false) {
      const output=document.getElementById('rangeReportResults'),status=document.getElementById('rangeReportStatus');
      try {
        closeRangeReportColumnFilter();
        const previousFilters=resetColumnFilters?{}:Object.fromEntries(Object.entries(rangeReportGroups).map(([key,group])=>[key,group.columnFilters||{}]));
        const report=rangeReportData();
        rangeReportPages={};rangeReportGroups={};
        const groups=report.groups.filter(group=>group.rows.length).map(group=>{
          const cols=Object.keys(group.rows[0]);
          rangeReportGroups[group.key]={...group,cols,money:report.money,columnFilters:{...(previousFilters[group.key]||{})}};
          return rangeReportGroups[group.key];
        });
        const activeFilters=groups.some(group=>Object.keys(group.columnFilters).length>0);
        const visibleGroups=groups.map(group=>({...group,rows:rangeReportFilteredRows(group)}));
        const recordCount=visibleGroups.reduce((sum,group)=>sum+group.rows.length,0);
        const reportType=document.getElementById('reportType').value;
        renderRangeReportSummary(visibleGroups,reportType,recordCount);
        output.innerHTML=groups.length?visibleGroups.map((view,index)=>{
          const group=rangeReportGroups[view.key],rows=view.rows;
          const numericColumn=k=>report.money.includes(k)||/%|rate/i.test(k);
          const pageRows=rows.slice(0,RANGE_REPORT_PAGE_SIZE).map(row=>rangeReportRowHtml(group,row)).join('')||`<tr><td colspan="${group.cols.length}" class="range-report-no-match">No rows match these column filters.<button type="button" data-range-clear-all>Clear all filters</button></td></tr>`;
          const totals=group.cols.map((k,i)=>i===0?(group.key==='stallionProfitHistory'?'Snapshots (not additive)':'Total'):rangeReportSummable(group,k)?(!rows.length?'—':rows.some(r=>r[k]==null)?'Incomplete':formatCurrency(rows.reduce((sum,r)=>sum+(Number(r[k])||0),0))):'');
          const pagination=rows.length>RANGE_REPORT_PAGE_SIZE?`<div class="range-report-pagination" data-range-report-pagination><span data-range-report-count></span><nav class="range-report-page-buttons" data-range-report-pages aria-label="${analyticEscape(group.title)} pages"></nav></div>`:'';
          const open=reportType!=='all'||index===0?' open':'';
          return `<details class="range-report-section" data-range-report-section="${analyticEscape(group.key)}"${open}><summary><h3>${analyticEscape(group.title)} (${rows.length}${group.rows.length!==rows.length?` of ${group.rows.length}`:''})</h3></summary><div class="report-section-body"><div class="table-wrapper"><table data-range-report-key="${analyticEscape(group.key)}"><thead><tr>${group.cols.map(k=>`<th${numericColumn(k)?' class="text-right"':''}>${analyticEscape(k)}</th>`).join('')}</tr></thead><tbody id="range-${analyticEscape(group.key)}">${pageRows}</tbody><tfoot><tr style="font-weight:bold">${totals.map((t,i)=>`<td${numericColumn(group.cols[i])?' class="text-right"':''}>${t}</td>`).join('')}</tr></tfoot></table></div>${pagination}</div></details>`;
        }).join(''):`<p class="text-muted">No report data was recorded in this date range.</p>`;
        output.querySelectorAll('table[data-range-report-key]').forEach(applyRangeReportPagination);
        const filteredGroups=visibleGroups.filter(group=>group.rows.length);
        status.textContent=`${report.start} to ${report.end} · ${recordCount} ${activeFilters?'matching ':''}record${recordCount===1?'':'s'}. Totals are separate for each report; account balances and transactions are not added together. Monthly balance totals are sums of snapshots, not a closing balance.`;
        const pageStatus=document.getElementById('reportPageStatus');if(pageStatus)pageStatus.textContent=`Report · ${recordCount} ${recordCount===1?'record':'records'}`;
        const exportCount=document.getElementById('rangeReportExportCount');
        if(exportCount)exportCount.textContent=recordCount?`${recordCount} matching ${recordCount===1?'record':'records'} · exports use active filters`:'No matching records';
        document.getElementById('exportRangeReport').disabled=recordCount===0;
        document.getElementById('printRangeReport').disabled=recordCount===0;
        renderRangeReportActiveFilters();
        output.dataset.generated='true';return {...report,groups:filteredGroups,activeFilters};
      }catch(error){const pageStatus=document.getElementById('reportPageStatus');if(pageStatus)pageStatus.textContent='Choose a valid report period';output.innerHTML='';document.getElementById('rangeReportSummary').hidden=true;document.getElementById('rangeReportSummary').innerHTML='';status.textContent=error.message;rangeReportGroups={};rangeReportPages={};document.getElementById('exportRangeReport').disabled=true;document.getElementById('printRangeReport').disabled=true;document.getElementById('rangeReportExportCount').textContent='Generate a valid report to export';renderRangeReportActiveFilters();return null;}
    }
    function rangeReportActiveFilterItems() {
      const items=[];
      Object.entries(rangeReportGroups).forEach(([key,group])=>Object.entries(group.columnFilters||{}).forEach(([column,selected])=>{
        const values=rangeReportColumnValues(group,column),chosen=new Set(selected);
        const labels=values.filter(([valueKey])=>chosen.has(valueKey)).map(([,value])=>value==null?'Pending / not calculated':String(value));
        items.push({key,column,title:group.title,labels,all:values.length});
      }));
      return items;
    }
    function renderRangeReportActiveFilters() {
      const host=document.getElementById('rangeReportActiveFilters');if(!host)return;
      const items=rangeReportActiveFilterItems();host.hidden=!items.length;
      host.innerHTML=items.length?`<span class="range-report-filter-strip-label">Active filters</span>${items.map((item,index)=>{const preview=item.labels.length?item.labels.slice(0,2).join(', ')+(item.labels.length>2?` +${item.labels.length-2}`:''):'None selected';return `<button type="button" class="range-report-filter-chip" data-range-filter-clear-key="${analyticEscape(item.key)}" data-range-filter-clear-column="${analyticEscape(item.column)}" title="Clear ${analyticEscape(item.title)} · ${analyticEscape(item.column)} filter: ${analyticEscape(item.labels.join(', '))}"><strong>${analyticEscape(item.column)}:</strong> ${analyticEscape(preview)} <span aria-hidden="true">×</span></button>`;}).join('')}<button type="button" class="range-report-clear-all" data-range-filter-clear-all>Clear all</button>`:'';
    }
    function clearAllRangeReportColumnFilters() {
      Object.values(rangeReportGroups).forEach(group=>{group.columnFilters={};});
      rangeReportPages={};closeRangeReportColumnFilter();renderRangeReport();
    }
    function renderRangeReportPrintView(report) {
      const host=document.getElementById('rangeReportPrintView');if(!host)return;
      const summary=rangeReportSummaryItems(report.groups,document.getElementById('reportType').value);
      const filters=rangeReportActiveFilterItems();
      const typeLabel=document.getElementById('reportType').selectedOptions[0]?.textContent||'All data';
      const tableSections=report.groups.map(group=>{
        const source=rangeReportGroups[group.key]||group,rows=rangeReportFilteredRows(source);
        if(!rows.length)return '';
        const totalCells=source.cols.map((column,index)=>index===0?'Total':source.money.includes(column)?rows.some(row=>row[column]==null)?'Incomplete':formatCurrency(rows.reduce((sum,row)=>sum+(Number(row[column])||0),0)):'');
        return `<section class="print-section"><h2>${analyticEscape(source.title)} · ${rows.length} ${rows.length===1?'record':'records'}</h2><table><thead><tr>${source.cols.map(column=>`<th>${analyticEscape(column)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>rangeReportRowHtml(source,row)).join('')}</tbody><tfoot><tr>${totalCells.map((value,index)=>`<td${source.money.includes(source.cols[index])?' class="text-right"':''}>${analyticEscape(value)}</td>`).join('')}</tr></tfoot></table></section>`;
      }).join('');
      host.innerHTML=`<h1>Personal Finance Tracker — Report</h1><p class="print-meta">${analyticEscape(typeLabel)} · ${analyticEscape(report.start)} to ${analyticEscape(report.end)} · ${report.groups.reduce((count,group)=>count+group.rows.length,0)} matching records</p><p class="print-meta">Column filters: ${filters.length?filters.map(item=>`${analyticEscape(item.title)} / ${analyticEscape(item.column)} = ${analyticEscape(item.labels.join(', '))}`).join(' · '):'None'}</p>${summary.length?`<div class="print-summary">${summary.map(item=>`<div class="print-summary-card"><small>${analyticEscape(item.label)}</small><strong>${analyticEscape(item.value)}</strong><small>${analyticEscape(item.note)}</small></div>`).join('')}</div>`:''}${tableSections}`;
    }
    function exportRangeReport() {
      const report=renderRangeReport();if(!report)return;
      const columns=['Report',...new Set(report.groups.flatMap(g=>g.rows.flatMap(r=>Object.keys(r))))];
      const escapeCsv=value=>{let s=value==null?'':String(value);if(typeof value==='string'&&/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
      const rows=[columns,...report.groups.flatMap(g=>g.rows.map(r=>columns.map(k=>k==='Report'?g.title:r[k])))];
      const blob=new Blob(['\uFEFF'+rows.map(row=>row.map(escapeCsv).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'});
      const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`wealth-report-${report.start}-to-${report.end}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }


    // Snapshot selection changes presentation only; it never writes financial records.
    function renderDashboardExpenseSnapshot(){
      const period=document.getElementById('dashboardPagePeriod');
      if(period)period.textContent=new Date().toLocaleDateString('en-IN',{month:'long',year:'numeric'});
      const select=document.getElementById('dashboardExpenseMonth'),card=document.getElementById('dashboardExpenseSnapshot');
      if(!select||!card)return;
      const defaultMonth=addMonthsClamped(currentMonthKey()+'-01',-1,1).slice(0,7);
      const months=[...new Set(state.monthlyBalances.filter(r=>Number.isFinite(r.houseExpense)).map(r=>r.month))].sort().reverse();
      const selected=months.includes(select.dataset.selectedMonth)?select.dataset.selectedMonth:defaultMonth;
      const signature=JSON.stringify(months);
      if(select.dataset.months!==signature){select.replaceChildren(...months.map(month=>{const option=document.createElement('option');option.value=month;option.textContent=new Date(month+'-01T12:00:00').toLocaleDateString('en-IN',{month:'long',year:'numeric'}).toLocaleUpperCase();return option;}));select.dataset.months=signature;}
      select.value=selected;
      select.onchange=()=>{select.dataset.selectedMonth=select.value;renderDashboardExpenseSnapshot();};
      const trigger=document.getElementById('dashboardExpenseMonthTrigger');
      const menu=document.getElementById('dashboardExpenseMonthMenu');
      const label=document.getElementById('dashboardExpenseMonthLabel');
      if(trigger&&menu&&label){
        // Portal the menu out of transformed dashboard cards so fixed viewport
        // coordinates are never relative to a card or animated ancestor.
        if(menu.parentElement!==document.body)document.body.appendChild(menu);
        const selectedOption=Array.from(select.options).find(option=>option.value===selected);
        label.textContent=selected?new Date(selected+'-01T12:00:00').toLocaleDateString('en-IN',{month:'short',year:'numeric'}):'Previous month';
        trigger.title=selectedOption?.textContent||'Previous month';
        const closeMenu=(returnFocus=false)=>{
          menu.hidden=true;
          trigger.setAttribute('aria-expanded','false');
          if(returnFocus)trigger.focus();
        };
        const placeMenu=()=>{
          const rect=trigger.getBoundingClientRect();
          const availableBelow=window.innerHeight-rect.bottom-12;
          const availableAbove=rect.top-12;
          const openAbove=availableBelow<230&&availableAbove>availableBelow;
          const height=Math.min(290,Math.max(100,openAbove?availableAbove:availableBelow));
          menu.style.position='fixed';
          menu.style.width=Math.max(190,Math.min(270,window.innerWidth-24))+'px';
          const menuWidth=parseFloat(menu.style.width)||270;
          menu.style.left=Math.max(12,Math.min(rect.right-menuWidth,window.innerWidth-menuWidth-12))+'px';
          menu.style.maxHeight=height+'px';
          menu.style.top=openAbove?'auto':Math.min(window.innerHeight-12,rect.bottom+7)+'px';
          menu.style.bottom=openAbove?(window.innerHeight-rect.top+7)+'px':'auto';
        };
        if(!trigger.dataset.monthPickerReady){
          trigger.dataset.monthPickerReady='true';
          trigger.addEventListener('click',()=>{
            if(!menu.hidden){closeMenu();return;}
            menu.hidden=false;
            trigger.setAttribute('aria-expanded','true');
            placeMenu();
            // Avoid scrolling the page while bringing the selected month into view.
            const selectedMonth=menu.querySelector('[aria-selected="true"]');
            if(selectedMonth)menu.scrollTop=Math.max(0,selectedMonth.offsetTop-menu.offsetTop-menu.clientHeight/2);
          });
          menu.addEventListener('click',event=>{
            const option=event.target.closest('[data-month]');
            if(!option||!menu.contains(option))return;
            select.value=option.dataset.month;
            select.dispatchEvent(new Event('change',{bubbles:true}));
            closeMenu(true);
          });
          document.addEventListener('pointerdown',event=>{
            if(!menu.hidden&&!menu.contains(event.target)&&!trigger.contains(event.target))closeMenu();
          });
          document.addEventListener('keydown',event=>{
            if(menu.hidden)return;
            if(event.key==='Escape'){event.preventDefault();closeMenu(true);}
            if(event.key==='ArrowDown'||event.key==='ArrowUp'){
              event.preventDefault();
              const options=Array.from(menu.querySelectorAll('[role="option"]'));
              const current=options.indexOf(document.activeElement);
              const index=current<0?options.findIndex(node=>node.getAttribute('aria-selected')==='true'):current;
              options[(index+(event.key==='ArrowDown'?1:-1)+options.length)%options.length]?.focus();
            }
            if(event.key==='Tab')closeMenu();
          });
          window.addEventListener('resize',()=>{if(!menu.hidden)placeMenu();},{passive:true});
          window.addEventListener('scroll',()=>{if(!menu.hidden)placeMenu();},{passive:true,capture:true});
        }
        menu.replaceChildren(...Array.from(select.options).map(option=>{
          const button=document.createElement('button');
          button.type='button';
          button.setAttribute('role','option');
          button.setAttribute('aria-selected',String(option.value===selected));
          button.dataset.month=option.value;
          button.className='dashboard-month-option';
          const name=document.createElement('span');
          name.textContent=option.textContent;
          button.append(name);
          if(option.value===selected){const check=document.createElement('span');check.className='dashboard-month-check';check.textContent='✓';check.setAttribute('aria-hidden','true');button.append(check);}
          return button;
        }));
        if(!menu.hidden)placeMenu();
      }
      const balance=state.monthlyBalances.find(r=>r.month===selected),house=balance?.houseExpense;
      const calculated=Number.isFinite(house);
      card.hidden=!calculated&&window.innerWidth<=700;
      const next=state.monthlyBalances.find(r=>r.month===addMonthsClamped(selected+'-01',1,1).slice(0,7));
      window.PFT_DASHBOARD_SNAPSHOT={previousMonthKey:selected,previousTotals:monthTotals(selected),previousOpening:balance?.startBalance??null,hasOpening:!!next,opening:next?.startBalance??null,houseAmount:house??null,fullExpense:Number.isFinite(house)?house+monthTotals(selected).expenses:null};
      const name=new Date(selected+'-01T12:00:00').toLocaleDateString('en-IN',{month:'long'});
      document.getElementById('houseExpenseLabel').textContent=name+' House Expense';
      document.getElementById('fullExpenseLabel').textContent=name+' Full Expense';
      const full=calculated?house+monthTotals(selected).expenses:null;
      updateDashboardExpenseVisual(house,full);
      for(const [id,value] of [['lastMonthHouseExpense',calculated?house:null],['lastMonthFullExpense',full]]){const node=document.getElementById(id);node.textContent=value===null?'Pending':formatCurrency(value);node.style.color=value!==null&&value<0?'var(--danger)':'var(--primary)';}
    }
    window.addEventListener('resize',renderDashboardExpenseSnapshot,{passive:true});

    window.matchMedia?.('(min-width:701px)')?.addEventListener('change',()=>{if(document.body.classList.contains('advanced-layout'))renderAdvancedDashboardInsights();});
    const chartLibraryCallbacks=new Set();
    let chartLibraryPromise=null;
    function requestChartLibrary(render){
      if(!window.PFTLoadScript)return;
      chartLibraryCallbacks.add(render);if(chartLibraryPromise)return;
      chartLibraryPromise=window.PFTLoadScript('chart').then(()=>{const callbacks=[...chartLibraryCallbacks];chartLibraryCallbacks.clear();chartLibraryPromise=null;document.getElementById('chartLoadError')?.remove();for(const fn of callbacks)fn();}).catch(()=>{chartLibraryCallbacks.clear();chartLibraryPromise=null;let notice=document.getElementById('chartLoadError');if(!notice){notice=document.createElement('div');notice.id='chartLoadError';notice.className='info-box';notice.setAttribute('role','status');const button=document.createElement('button');button.type='button';button.textContent='Retry charts';button.onclick=()=>requestChartLibrary(()=>{const active=document.querySelector('.nav-tab.active')?.dataset.tab;active==='growth-projection'?renderGrowthProjection({preserveAssumptions:true}):renderCharts();});notice.append('Charts could not load. Your records are still available. ',button);document.querySelector('.tab-content.active')?.prepend(notice);}});
    }

    // CHARTS & ANALYTICS
    let chartInstances = {};

    document.getElementById('analytics').addEventListener('click',event=>{
      const button=event.target.closest('[data-analytics-detail-toggle]');
      if(!button) return;
      const details=document.getElementById(button.getAttribute('aria-controls'));
      if(!details) return;
      const opening=button.getAttribute('aria-expanded')!=='true';
      button.setAttribute('aria-expanded',String(opening));
      details.hidden=!opening;
      button.querySelector('[data-detail-label]').textContent=opening?'Hide Details':'View Details';
    });

    function renderCharts() {
      try {
        if (typeof Chart === 'undefined') {
          requestChartLibrary(renderCharts);
          return;
        }
        
        setupAnalyticsBento();
        Chart.register(analyticLabels);
        console.log(' renderCharts called - Chart.js available, Processing analytics data...');
        renderIncomeExpenseChart();
        renderAssetAllocationChart();
        renderSurplusTrendChart();
        renderStallionProfitTrendChart();
        renderDebtProgressChart();
        renderRetirementFundsChart();
        renderFamilyContributionChart();
        renderInvestmentReturnsChart();
        enhanceAnalytics();
        updateFinancialSummary();
        updateAnalyticsBento();
        console.log(' All charts rendered successfully');
      } catch (e) {
        console.error(' Error rendering charts:', e);
      }
    }


    function analyticsSelectedYear(){return Number(document.getElementById('analyticsFinancialYear')?.value)||currentFinancialYearStartYear();}
    function setupAnalyticsBento(){
      const root=document.getElementById('analytics');if(root.dataset.bentoReady)return;root.dataset.bentoReady='yes';
      const select=document.getElementById('analyticsFinancialYear');
      select.addEventListener('change',()=>{for(const id of ['surplusTrendFinancialYear','stallionProfitTrendFinancialYear'])document.getElementById(id).dataset.preferredYear=select.value;renderCharts();});
      const groups=[['surplusTrendChart','stallionProfitTrendChart','Monthly Surplus','Stallion PMS','trend'],['assetAllocationChart','retirementFundsChart','All Assets','Retirement Only','allocation'],['investmentReturnsChart','familyContributionChart','Returns vs. Invested','Family Split','returns']];
      for(const [first,second,a,b,name] of groups){const cards=[first,second].map(id=>document.getElementById(id).closest('.analytics-card'));cards.forEach((card,index)=>{card.classList.add('analytics-bento-'+name);const controls=document.createElement('div');controls.className='analytics-segmented';controls.setAttribute('aria-label',name+' view');for(const [i,label] of [a,b].entries()){const button=document.createElement('button');button.type='button';button.textContent=label;button.setAttribute('aria-pressed',String(i===index));button.addEventListener('click',()=>{cards.forEach((target,j)=>{target.hidden=j!==i;target.querySelectorAll('.analytics-segmented button').forEach((x,k)=>x.setAttribute('aria-pressed',String(i===k)));});requestAnimationFrame(()=>{for(const id of [first,second])chartInstances[id]?.resize();});});controls.append(button);}card.querySelector('.panel-header').append(controls);card.hidden=index!==0;});}
      const debtCard=document.getElementById('debtProgressChart').closest('.analytics-card');debtCard.classList.add('analytics-bento-debt');const debtLegend=document.createElement('div');debtLegend.className='analytics-debt-legend';debtLegend.innerHTML='<span><i></i>Paid</span><span><i></i>Remaining</span>';debtCard.querySelector('.panel-header').append(debtLegend);const debtSummary=document.createElement('div');debtSummary.className='analytics-debt-summary';debtSummary.innerHTML='<div><span>Paid</span><strong id="analyticsDebtPaid">₹0</strong><small id="analyticsDebtPaidPercent">—</small></div><div><span>Remaining</span><strong id="analyticsDebtRemaining">₹0</strong><small id="analyticsDebtRemainingPercent">—</small></div>';document.getElementById('debtProgressChart').after(debtSummary);
      for(const card of root.querySelectorAll('.analytics-grid > .analytics-card')){const detail=card.querySelector('[data-analytics-detail-toggle]'),box=card.querySelector('.chart-detail'),note=card.querySelector('.chart-takeaway');if(detail&&box){const wrap=document.createElement('div');wrap.id=box.id+'Panel';wrap.hidden=true;box.before(wrap);if(note)wrap.append(note);wrap.append(box);box.hidden=false;detail.setAttribute('aria-controls',wrap.id);card.querySelector('.panel-header').append(detail);}}
    }
    function updateAnalyticsBento(){
      const current=currentFinancialYearStartYear(),select=document.getElementById('analyticsFinancialYear'),old=Number(select.value)||current;
      const months=[...(state.income||[]).map(x=>x.date),...(state.expenses||[]).map(x=>x.date),...(state.monthlyBalances||[]).map(x=>x.month),...(state.retirementContributions||[]).map(x=>x.date),...(state.investmentContributions||[]).map(x=>x.date),...(state.stallionContributions||[]).map(x=>x.date),...(state.stallionProfitHistory||[]).map(x=>x.date)].filter(x=>typeof x==='string'&&/^\d{4}-\d{2}/.test(x)).map(x=>x.slice(0,7));
      const years=[...new Set([current,old,...months.map(financialYearStartYearForMonthKey)])].filter(y=>y<=current).sort((a,b)=>b-a);select.replaceChildren(...years.map(y=>new Option(financialYearLabel(y)+(y===current?' · Apr–'+new Date().toLocaleDateString('en-IN',{month:'short'}):' · Apr–Mar'),String(y))));select.value=String(old);
      const average=financialYearAverages(old===current?new Date():new Date(old+1,2,31));renderAnalyticsAverageSnapshot(average);
      const empty={incomeExpenseChart:'No cash outflows recorded for this period',surplusTrendChart:'No monthly surplus records for this period',stallionProfitTrendChart:'No Stallion PMS profit snapshots for this period',investmentReturnsChart:'No investment data yet',familyContributionChart:'No family contributions recorded',debtProgressChart:'No active loan principal recorded'};
      for(const [id,message] of Object.entries(empty)){const canvas=document.getElementById(id),chart=chartInstances[id];if(!canvas||!chart)continue;const hasData=chart.data.datasets.some(ds=>(ds.data||[]).some(v=>v!==null&&Number.isFinite(Number(v))&&Number(v)!==0));const holder=id==='investmentReturnsChart'?document.getElementById('investmentReturnsChartScroll'):canvas;let placeholder=document.getElementById(id+'Empty');if(!placeholder){placeholder=document.createElement('p');placeholder.id=id+'Empty';placeholder.className='analytics-empty-chart';holder.after(placeholder);}holder.hidden=!hasData;placeholder.hidden=hasData;placeholder.textContent=id==='debtProgressChart'?'₹0 Paid / ₹0 Remaining · '+message:message;}
    }

    function analyticPercent(value, base) { return base > 0 ? `${(value/base*100).toFixed(1)}%` : 'N/A'; }
    function analyticCompact(value) {
      const sign=value<0?'−':''; const n=Math.abs(value);
      return sign+'₹'+(n>=100000?(n/100000).toFixed(2)+'L':n>=1000?(n/1000).toFixed(1)+'K':Math.round(n));
    }
    function analyticEscape(text) { return String(text).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
    function analyticsTable(id, headers, rows, takeaway) {
      document.getElementById(id+'Takeaway').textContent=takeaway;
      const numericColumn=header=>/(amount|value|share|percent|%|return|gain|loss|contribution|balance|expense|income|debt|principal|invested|surplus|outflow|change)/i.test(header);
      const heading=header=>'<th'+(numericColumn(header)?' class="text-right"':'')+'>'+analyticEscape(header)+'</th>';
      const cell=(value,index)=>'<td'+(numericColumn(headers[index])?' class="text-right"':'')+'>'+analyticEscape(value)+'</td>';
      document.getElementById(id+'Details').innerHTML='<table><thead><tr>'+headers.map(heading).join('')+'</tr></thead><tbody>'+
        (rows.length?rows.map(row=>'<tr>'+row.map(cell).join('')+'</tr>').join(''):'<tr><td colspan="'+headers.length+'">No records available</td></tr>')+'</tbody></table>';
    }
    function chartLabelColor(background) {
      const match=String(background||'').trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
      if(!match)return '#fff';
      let hex=match[1];if(hex.length===3)hex=hex.split('').map(char=>char+char).join('');
      const rgb=[0,2,4].map(index=>parseInt(hex.slice(index,index+2),16)/255).map(value=>value<=0.04045?value/12.92:Math.pow((value+0.055)/1.055,2.4));
      const luminance=0.2126*rgb[0]+0.7152*rgb[1]+0.0722*rgb[2];
      const whiteContrast=1.05/(luminance+0.05),darkContrast=(luminance+0.05)/(0.04);
      return darkContrast>=whiteContrast?'#1f2937':'#fff';
    }
    const analyticLabels = {
      id:'analyticLabels',
      afterDatasetsDraw(chart) {
        if(chart.options.plugins?.analyticLabels?.display===false)return;
        const ctx=chart.ctx;ctx.save();ctx.font='600 11px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
        const isPie=['pie','doughnut'].includes(chart.config.type);
        chart.data.datasets.forEach((ds,di)=>{
          if(!chart.isDatasetVisible(di))return;
          const meta=chart.getDatasetMeta(di);const total=ds.data.reduce((a,b)=>a+Number(b||0),0);
          meta.data.forEach((el,i)=>{
            const value=Number(ds.data[i]);if(!Number.isFinite(value))return;
            let label;
            if(value===0)return;
            if(isPie){if(total<=0||value/total<0.05)return;label=analyticPercent(value,total);const background=Array.isArray(ds.backgroundColor)?ds.backgroundColor[i]:ds.backgroundColor;ctx.fillStyle=chartLabelColor(background);const pt=el.tooltipPosition();ctx.fillText(label,pt.x,pt.y);return;}
            label=chart.$analyticLabels?.[di]?.[i] || analyticCompact(value);
            if(chart.width<500 && chart.config.type==='line' && i%Math.max(1,Math.ceil(ds.data.length/4))!==0)return;
            ctx.fillStyle=document.documentElement.getAttribute('data-theme')==='dark'?'#f1f5f9':'#1f2937';
            if(chart.options.indexAxis==='y'){const pt=el.tooltipPosition();const background=Array.isArray(ds.backgroundColor)?ds.backgroundColor[i]:ds.backgroundColor;ctx.fillStyle=chartLabelColor(background);if(Math.abs(el.x-el.base)>80)ctx.fillText(label,(el.x+el.base)/2,pt.y);}
            else if(chart.options.scales?.y?.stacked){if(Math.abs(el.y-el.base)>18){const background=Array.isArray(ds.backgroundColor)?ds.backgroundColor[i]:ds.backgroundColor;ctx.fillStyle=chartLabelColor(background);ctx.fillText(label,el.x,(el.y+el.base)/2);}}
            else {const isTrendChart=['stallionProfitTrendChart','surplusTrendChart'].includes(chart.canvas?.id);const offsetFromLeftAxis=isTrendChart&&i===0;let labelY=value>=0?el.y-12:el.y+13;if(isTrendChart&&chart.chartArea&&labelY<chart.chartArea.top+10)labelY=el.y+16;ctx.textAlign=offsetFromLeftAxis?'left':'center';ctx.fillText(label,el.x+(offsetFromLeftAxis?9:0),labelY);ctx.textAlign='center';}
          });
        });ctx.restore();
      }
    };
    function themeColor(name) { return getComputedStyle(htmlElement).getPropertyValue(`--${name}`).trim(); }
    function analyticsPalette() {
      const dark=htmlElement.getAttribute('data-theme')==='dark';
      const brand=themeColor('primary')||'#0f766e';
      const blue=dark?'#60a5fa':'#2563eb',violet=dark?'#c4b5fd':'#7c3aed',amber=dark?'#fbbf24':'#b45309';
      const rose=dark?'#fda4af':'#be123c',cyan=dark?'#67e8f9':'#0e7490',green=dark?'#6ee7b7':'#087c65',slate=dark?'#cbd5e1':'#64748b';
      return {brand,blue,violet,amber,rose,cyan,green,slate,series:[brand,blue,violet,amber,rose,cyan,slate]};
    }
    function analyticsFill(color,opacity=0.16) {
      const match=String(color||'').match(/^#([0-9a-f]{6})$/i);if(!match)return color;
      const hex=match[1];return `rgba(${parseInt(hex.slice(0,2),16)}, ${parseInt(hex.slice(2,4),16)}, ${parseInt(hex.slice(4,6),16)}, ${opacity})`;
    }
    function analyticsTrendGradient(context,color,opacity=0.2) {
      const chart=context.chart,area=chart?.chartArea;
      if(!area)return analyticsFill(color,opacity*0.6);
      const gradient=chart.ctx.createLinearGradient(0,area.top,0,area.bottom);
      gradient.addColorStop(0,analyticsFill(color,opacity));
      gradient.addColorStop(1,analyticsFill(color,0.015));
      return gradient;
    }
    function enhanceAnalytics() {
      const year=analyticsSelectedYear(),inPeriod=row=>typeof row.date==='string'&&monthKeyInFinancialYear(row.date.slice(0,7),year)&&(year!==currentFinancialYearStartYear()||row.date.slice(0,7)<=currentMonthKey());
      const visibleIds=new Set(profileRows(state.investments).map(row=>row.id));
      const t={income:profileRows(state.income).filter(inPeriod).reduce((sum,row)=>sum+(Number(row.amount)||0),0),expenses:state.expenses.filter(inPeriod).reduce((sum,row)=>sum+(Number(row.amount)||0),0),stallion:(state.stallionContributions||[]).filter(row=>visibleIds.has(row.stallionId)&&inPeriod(row)).reduce((sum,row)=>sum+(Number(row.amount)||0),0),retirement:profileRows(state.retirementContributions).filter(inPeriod).reduce((sum,row)=>sum+(Number(row.amount)||0)+(Number(row.epsAmount)||0),0)};
      const outflow=t.expenses+t.stallion+t.retirement;const remaining=t.income-outflow;
      // Stallion is shown as its own allocation slice below; exclude it here
      // so the portfolio total and percentages count it exactly once.
      const invest=profileRows(state.investments).filter(x=>x.type!=='Stallion PMS').reduce((a,x)=>a+(Number(x.current)||0),0);
      const stallionValue=profileRows(state.investments).filter(x=>x.type==='Stallion PMS').reduce((a,x)=>a+(Number(x.current)||0),0);
      const nps=profileRows(state.nps).reduce((a,x)=>a+(Number(x.current)||0),0),ppf=profileRows(state.ppf).reduce((a,x)=>a+(Number(x.current)||0),0),pf=profileRows(state.pf).reduce((a,x)=>a+(Number(x.current)||0),0);
      const total=invest+stallionValue+nps+ppf+pf;
      const cashChart=chartInstances.incomeExpenseChart;
      const palette=analyticsPalette();
      const darkTheme=document.documentElement.getAttribute('data-theme')==='dark';
      const subtleFlowColors=darkTheme
        ? ['#4f9d8a','#bd7781','#b79357','#718db7','#638f9a']
        : ['#79B7A7','#D98F91','#D5AE70','#8EAAD2','#79A8B0'];
      const subtleDebtColors=darkTheme?{paid:'#5b9b83',remaining:'#bd7781'}:{paid:'#78B59B',remaining:'#D9848E'};
      cashChart.config.type='bar';
      cashChart.data={labels:['Income','Expenses','Stallion','NPS + PPF','Cash remaining'],datasets:[{label:'Financial year cash flow',data:[t.income,t.expenses,t.stallion,t.retirement,remaining],backgroundColor:[subtleFlowColors[0],subtleFlowColors[1],subtleFlowColors[2],subtleFlowColors[3],remaining>=0?subtleFlowColors[4]:subtleFlowColors[1]],borderRadius:6,borderSkipped:false}]};
      cashChart.options.scales={y:{beginAtZero:true,ticks:{callback:v=>analyticCompact(v)}}};cashChart.options.plugins.legend.display=false;
      cashChart.$analyticLabels=[[analyticCompact(t.income),analyticPercent(t.expenses,t.income),analyticPercent(t.stallion,t.income),analyticPercent(t.retirement,t.income),analyticPercent(remaining,t.income)]];
      analyticsTable('incomeExpenseChart',['Item','Amount','% of income'],[['Income',formatCurrency(t.income),analyticPercent(t.income,t.income)],['Recorded expenses',formatCurrency(t.expenses),analyticPercent(t.expenses,t.income)],['Stallion contributions',formatCurrency(t.stallion),analyticPercent(t.stallion,t.income)],['NPS + PPF',formatCurrency(t.retirement),analyticPercent(t.retirement,t.income)],['Total outflows',formatCurrency(outflow),analyticPercent(outflow,t.income)],['Income less tracked outflows',formatCurrency(remaining),analyticPercent(remaining,t.income)]],
        `Annual expenses count fully in their recorded month. Recorded expenses use ${analyticPercent(t.expenses,t.income)} of income. Total outflows: ${formatCurrency(outflow)}; ${remaining<0?'income shortfall':'income left after tracked outflows'}: ${formatCurrency(Math.abs(remaining))}. This income comparison is separate from Monthly Surplus Balance, which uses starting balance + income − expenses − Stallion.`);
      const alloc=chartInstances.assetAllocationChart;analyticsTable('assetAllocationChart',['Asset','Current value','Portfolio share'],alloc.data.labels.map((name,i)=>[name,formatCurrency(alloc.data.datasets[0].data[i]),analyticPercent(alloc.data.datasets[0].data[i],total)]),total>0?`Total investment and retirement assets: ${formatCurrency(total)}. Percentages show each category's share; Stallion is counted once.`:'No asset values recorded yet.');
      const surplusYear=Number(document.getElementById('surplusTrendFinancialYear').value||currentFinancialYearStartYear());
      const allSorted=[...state.monthlyBalances].sort((a,b)=>a.month.localeCompare(b.month));
      const isCurrentSurplusFY=surplusYear===currentFinancialYearStartYear();
      const sorted=allSorted.filter(b=>financialYearStartYearForMonthKey(b.month)===surplusYear&&(!isCurrentSurplusFY||b.month<=currentMonthKey()));
      const monthlyTotals=buildMonthlyTotalsIndex();
      const valueByMonth=new Map(allSorted.map(b=>{const q=monthTotalsFromIndex(monthlyTotals,b.month);return [b.month,b.startBalance+q.income-q.expenses-q.stallion];}));
      const trendRows=sorted.map(b=>{const prevKey=previousMonthKey(b.month);const value=valueByMonth.get(b.month);const prevValue=valueByMonth.get(prevKey);const consecutive=prevValue!==undefined;return [b.month,formatCurrency(value),consecutive?formatCurrency(value-prevValue):'N/A',consecutive&&prevValue>0?analyticPercent(value-prevValue,prevValue):'N/A'];});
      analyticsTable('surplusTrendChart',['Month','Monthly surplus balance','Change vs prior month','% change'],trendRows,`${financialYearLabel(surplusYear)}. Starting balance + income − expenses − Stallion. Retirement contributions are tracked separately. Changes are shown only when a previous calendar month is recorded; percentage change requires a positive prior balance. ${isCurrentSurplusFY?'Only recorded months through the current month are shown; the current month may be provisional.':'Recorded months for this financial year are shown.'} This is not monthly savings.`);
      const visibleDebts=profileRows(state.debts),principal=visibleDebts.reduce((a,d)=>a+loanTotalPrincipal(d),0),owed=visibleDebts.reduce((a,d)=>a+d.remaining,0),paid=principal-owed;
      chartInstances.debtProgressChart.options.plugins.analyticLabels={display:false};
      for(const [id,value] of [['analyticsDebtPaid',formatCurrency(paid)],['analyticsDebtRemaining',formatCurrency(owed)],['analyticsDebtPaidPercent',analyticPercent(paid,principal)],['analyticsDebtRemainingPercent',analyticPercent(owed,principal)]]){const node=document.getElementById(id);if(node)node.textContent=value;}

      analyticsTable('debtProgressChart',['Debt status','Amount','% of original principal'],[['Repaid',formatCurrency(paid),analyticPercent(paid,principal)],['Outstanding',formatCurrency(owed),analyticPercent(owed,principal)]],principal>0?`${analyticPercent(paid,principal)} of total borrowed repaid; ${formatCurrency(owed)} remains outstanding.`:'No loan principal recorded.');
      const ret=nps+ppf+pf;analyticsTable('retirementFundsChart',['Fund','Current value','Retirement share'],[['NPS',formatCurrency(nps),analyticPercent(nps,ret)],['PPF',formatCurrency(ppf),analyticPercent(ppf,ret)],['PF',formatCurrency(pf),analyticPercent(pf,ret)]],`Retirement assets: ${formatCurrency(ret)} (${analyticPercent(ret,total)} of total tracked assets).`);
      const selectedInvestments=profileRows(state.investments), investmentMembers=new Map(selectedInvestments.map(row=>[row.id,row.member||'Unassigned']));
      const rowsByMember=new Map();const addContribution=(member,kind,amount)=>{if(!rowsByMember.has(member))rowsByMember.set(member,{member,n:0,p:0,f:0,st:0,other:0});rowsByMember.get(member)[kind]+=Number(amount)||0;};
      for(const row of profileRows(state.retirementContributions||[]).filter(inPeriod)){const kind={nps:'n',ppf:'p',pf:'f'}[row.investmentType];if(kind)addContribution(row.member||'Unassigned',kind,(Number(row.amount)||0)+(Number(row.epsAmount)||0));}
      for(const row of (state.stallionContributions||[]).filter(inPeriod))if(investmentMembers.has(row.stallionId))addContribution(investmentMembers.get(row.stallionId),'st',row.amount);
      for(const row of (state.investmentContributions||[]).filter(inPeriod))if(investmentMembers.has(row.investmentId))addContribution(investmentMembers.get(row.investmentId),'other',row.amount);
      const memberRows=[...rowsByMember.values()].map(row=>({...row,total:row.n+row.p+row.f+row.st+row.other}));
      const contributionTotal=memberRows.reduce((a,x)=>a+x.total,0);const family=chartInstances.familyContributionChart;
      family.data={labels:memberRows.map(x=>x.member),datasets:[{label:'NPS',data:memberRows.map(x=>x.n),backgroundColor:palette.brand},{label:'PPF',data:memberRows.map(x=>x.p),backgroundColor:palette.blue},{label:'PF',data:memberRows.map(x=>x.f),backgroundColor:palette.violet},{label:'Stallion',data:memberRows.map(x=>x.st),backgroundColor:palette.amber},{label:'Investments',data:memberRows.map(x=>x.other),backgroundColor:palette.cyan}]};family.options.scales.x={stacked:true};family.options.scales.y.stacked=true;
      analyticsTable('familyContributionChart',['Member','FY recorded contributions','Share of contributions'],memberRows.map(x=>[x.member,formatCurrency(x.total),analyticPercent(x.total,contributionTotal)]),`Recorded contributions for ${financialYearLabel(year)} total ${formatCurrency(contributionTotal)}. PF includes recorded employee and employer amounts and EPS where recorded.`);

      const returns=investmentReturnItems();const returnChart=chartInstances.investmentReturnsChart;if(returnChart)returnChart.options.plugins.analyticLabels={display:false};
      analyticsTable('investmentReturnsChart',['Investment','Invested','Current value','Gain / loss','Absolute return'],returns.map(x=>[x.name,formatCurrency(x.invested),formatCurrency(x.current),formatCurrency(x.current-x.invested),analyticPercent(x.current-x.invested,x.invested)]),'Gain = current value − invested amount. Includes NPS, PPF, PF and Stallion. Absolute return = gain ÷ invested amount; it is not annualised and does not account for contribution timing.');
      Object.entries(chartInstances).forEach(([id,chart])=>{
        const dark=document.documentElement.getAttribute('data-theme')==='dark';
        const labelColor=dark?'#cbd5e1':'#475569',gridColor=dark?'rgba(148,163,184,.18)':'rgba(100,116,139,.16)';
        const options=chart.config.options;
        options.color=labelColor;
        options.layout={...(options.layout||{}),padding:{top:25,bottom:15}};
        options.plugins=options.plugins||{};
        options.plugins.legend=options.plugins.legend||{};
        options.plugins.legend.labels={...(options.plugins.legend.labels||{}),color:labelColor,usePointStyle:true,pointStyle:'circle',padding:18};
        options.scales=options.scales||{};
        const scales=options.scales;
        if(scales)Object.values(scales).forEach(scale=>{scale.ticks={...(scale.ticks||{}),color:labelColor};scale.grid={...(scale.grid||{}),color:gridColor};scale.border={...(scale.border||{}),color:gridColor};});
        if(chart.config.type==='bar')chart.data.datasets.forEach(dataset=>{dataset.borderRadius=dataset.borderRadius||6;dataset.borderSkipped=false;});
        options.plugins.tooltip={...(options.plugins.tooltip||{}),callbacks:{...(options.plugins.tooltip?.callbacks||{}),label:ctx=>{
          const v=Number(ctx.raw);let base;
          if(id==='surplusTrendChart'){const row=trendRows[ctx.dataIndex];return formatCurrency(v)+(row&&row[2]!=='N/A'?' • prior month change: '+row[2]+' ('+row[3]+')':'');}
          if(id==='incomeExpenseChart')base=t.income;
          else if(['assetAllocationChart','retirementFundsChart'].includes(id))base=ctx.dataset.data.reduce((a,b)=>a+b,0);
          else if(id==='debtProgressChart')base=principal;
          else if(id==='familyContributionChart')base=contributionTotal;
          else if(id==='investmentReturnsChart')base=returnChart?.$returnItems?.[ctx.dataIndex]?.invested||0;
          return `${ctx.dataset.label||ctx.label}: ${formatCurrency(v)}${base!==undefined?' ('+analyticPercent(v,base)+(id==='investmentReturnsChart'?' of invested capital':id==='incomeExpenseChart'?' of income':'')+')':''}`;
        }}};
        chart.update('none');
      });
    }

    function destroyChart(chartId) {
      if (chartInstances[chartId]) {
        chartInstances[chartId].destroy();
        delete chartInstances[chartId];
      }
    }

    function renderIncomeExpenseChart() {
      try {
        destroyChart('incomeExpenseChart');
        
        const monthlyIncome = profileRows(state.income)
          .filter(i => inMonth(i.date, currentMonthKey()))
          .reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
        
        const monthlyExpenses = state.expenses
          .filter(e => inMonth(e.date, currentMonthKey()))
          .reduce((sum, e) => sum + Number(e.amount), 0);

        const canvasEl = document.getElementById('incomeExpenseChart');
        if (!canvasEl) {
          console.warn(' incomeExpenseChart canvas not found');
          return;
        }

        const ctx = canvasEl.getContext('2d');
        if (!ctx) {
          console.warn(' incomeExpenseChart context not available');
          return;
        }

        const income = monthlyIncome;
        const expenses = monthlyExpenses;

        chartInstances['incomeExpenseChart'] = new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: ['Income', 'Expenses'],
            datasets: [{
              data: [income, expenses],
              backgroundColor: [analyticsPalette().green, analyticsPalette().rose],
              borderColor: [analyticsPalette().green, analyticsPalette().rose],
              borderWidth: 3,
              hoverOffset: 7
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
              legend: { position: 'bottom' },
              tooltip: {
                callbacks: {
                  label: (ctx) => {
                    const label = ctx.label || '';
                    return label + ': ₹' + Math.round(ctx.parsed).toLocaleString('en-IN');
                  }
                }
              }
            }
          }
        });
        console.log(' Income/Expense: Income ₹' + Math.round(income) + ', Expenses ₹' + Math.round(expenses));
      } catch (e) {
        console.error(' renderIncomeExpenseChart:', e.message);
      }
    }

    function renderAssetAllocationChart() {
      try {
        destroyChart('assetAllocationChart');
        
        const npsTotal = profileRows(state.nps).reduce((sum, n) => sum + (Number(n.current) || 0), 0);
        const ppfTotal = profileRows(state.ppf).reduce((sum, p) => sum + (Number(p.current) || 0), 0);
        const pfTotal = profileRows(state.pf).reduce((sum, p) => sum + (Number(p.current) || 0), 0);
        const viewInvestments=profileRows(state.investments);
        const investTotal = viewInvestments.filter(i => i.type !== 'Stallion PMS').reduce((sum, i) => sum + (Number(i.current) || 0), 0);
        const visiblePmsIds=new Set(viewInvestments.filter(row=>row.type==='Stallion PMS').map(row=>row.id));
        const stallionTotal = state.stallionPms.filter(s=>visiblePmsIds.has(s.id)).reduce((sum, s) => sum + (Number(s.invested) || 0) + (Number(s.profit) || 0), 0);

        const canvasEl = document.getElementById('assetAllocationChart');
        if (!canvasEl) {
          console.warn(' assetAllocationChart canvas not found');
          return;
        }

        const ctx = canvasEl.getContext('2d');
        if (!ctx) return;
        const darkTheme=document.documentElement.getAttribute('data-theme')==='dark';
        const allocationColors=darkTheme
          ? ['#ff8073','#ffd166','#28b7b3','#d3dc79','#ac98e8']
          : ['#f46f63','#f8bf50','#10999d','#c5ce68','#8878c8'];

        const allocationTotal=npsTotal+ppfTotal+pfTotal+investTotal+stallionTotal;
        chartInstances['assetAllocationChart'] = new Chart(ctx, {
          plugins:[{id:'emptyAllocationRing',afterDraw(chart){const a=chart.chartArea,c=chart.ctx,x=(a.left+a.right)/2,y=(a.top+a.bottom)/2,r=Math.max(16,Math.min(a.right-a.left,a.bottom-a.top)*.34);c.save();if(allocationTotal<=0){c.strokeStyle=darkTheme?'rgba(255,255,255,.08)':'rgba(15,23,42,.10)';c.lineWidth=Math.max(12,r*.25);c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.stroke();}c.fillStyle=themeColor('text');c.font='600 14px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(analyticCompact(allocationTotal),x,y-6);c.font='10px sans-serif';c.fillStyle=themeColor('text-light');c.fillText('Total assets',x,y+12);c.restore();}}],
          type: 'doughnut',
          data: {
            labels: ['NPS', 'PPF', 'PF', 'Investments', 'Stallion PMS'],
            datasets: [{
              data: [
                npsTotal,
                ppfTotal,
                pfTotal,
                investTotal,
                stallionTotal
              ],
              backgroundColor: allocationColors,
              borderColor: themeColor('card-bg'),
              borderWidth: 3,
              hoverOffset: 7
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            cutout:'62%',
            plugins: {
              analyticLabels:{display:false},
              legend: { position: 'right',display:true,labels:{generateLabels(chart){const items=Chart.overrides.doughnut.plugins.legend.labels.generateLabels(chart),values=chart.data.datasets[0].data,total=values.reduce((a,b)=>a+(Number(b)||0),0);return items.map((item,i)=>({...item,text:item.text+'  '+(total>0?analyticPercent(Number(values[i])||0,total):'0.0%')}));}} },
              tooltip: {
                callbacks: {
                  label: (ctx) => '₹' + Math.round(ctx.parsed).toLocaleString('en-IN')
                }
              }
            }
          }
        });
        console.log(' Asset Allocation - NPS: ₹' + Math.round(npsTotal) + ', PPF: ₹' + Math.round(ppfTotal) + ', PF: ₹' + Math.round(pfTotal));
      } catch (e) {
        console.error(' renderAssetAllocationChart:', e.message);
      }
    }

    function renderSurplusTrendChart() {
      try {
        destroyChart('surplusTrendChart');
        const selectedYear=populateHistoryFinancialYear('surplusTrendFinancialYear',state.monthlyBalances.map(row=>row.month),analyticsSelectedYear());
        const isCurrentTrendYear=selectedYear===currentFinancialYearStartYear();
        const sortedBalances = [...state.monthlyBalances].filter(b=>financialYearStartYearForMonthKey(b.month)===selectedYear&&(!isCurrentTrendYear||b.month<=currentMonthKey())).sort((a, b) => new Date(a.month) - new Date(b.month));
      
      const labels = sortedBalances.map(b => calendarDate(b.month + '-01').toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }));
      const surpluses = sortedBalances.map(b => {
        const [year, month] = b.month.split('-');
        const monthNum = parseInt(month) - 1;
        const monthlyIncome = state.income.filter(i => inMonth(i.date, b.month)).reduce((sum, i) => sum + i.amount, 0);
        const monthlyExpenses = state.expenses.filter(e => inMonth(e.date, b.month)).reduce((sum, e) => sum + e.amount, 0);
        const stallionPMS = state.stallionContributions.filter(c => inMonth(c.date, b.month)).reduce((sum, c) => sum + (c.amount || 0), 0);
        return b.startBalance + monthlyIncome - monthlyExpenses - stallionPMS;
      });

      const ctx = document.getElementById('surplusTrendChart')?.getContext('2d');
      if (!ctx) return;

      const darkTheme=htmlElement.getAttribute('data-theme')==='dark';
      const lineColor=darkTheme?'#58c7c2':'#168b8c';
      chartInstances['surplusTrendChart'] = new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels.length > 0 ? labels : ['No Data'],
          datasets: [{
            label: 'Monthly surplus balance',
            data: surpluses.length > 0 ? surpluses : [0],
            borderColor: lineColor,
            backgroundColor: context=>analyticsTrendGradient(context,lineColor,0.18),
            borderWidth: 2.8,
            cubicInterpolationMode: 'monotone',
            tension: 0.28,
            pointRadius: context=>context.dataIndex===surpluses.length-1?5:3.5,
            pointHoverRadius: 7,
            pointBackgroundColor: lineColor,
            pointBorderColor: themeColor('card-bg'),
            pointBorderWidth: 2.5,
            fill: true,
            spanGaps: false
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          interaction:{mode:'index',intersect:false},
          plugins: {
            legend:{display:false},
            tooltip:{displayColors:false,backgroundColor:darkTheme?'#0f172a':'#17313a',titleColor:'#f8fafc',bodyColor:'#f8fafc',padding:11,callbacks:{label:context=>'Monthly surplus balance: '+formatCurrency(context.parsed.y)}}
          },
          scales: {
            x:{grid:{display:false},ticks:{color:themeColor('text-light'),maxRotation:0,autoSkip:false,font:{size:10},padding:8},border:{display:false}},
            y:{beginAtZero:false,ticks:{color:themeColor('text-light'),maxTicksLimit:6,callback:value=>analyticCompact(value),font:{size:10},padding:8},grid:{color:darkTheme?'rgba(203,213,225,.12)':'rgba(100,116,139,.13)',borderDash:[3,5],drawTicks:false},border:{display:false}}
          }
        }
      });
        console.log(' Surplus Trend chart rendered with ' + sortedBalances.length + ' months');
      } catch (e) {
        console.error(' renderSurplusTrendChart error:', e);
      }
    }

    function renderStallionProfitTrendChart() {
      try {
        destroyChart('stallionProfitTrendChart');
        const selectedYear=populateHistoryFinancialYear('stallionProfitTrendFinancialYear',(state.stallionProfitHistory||[]).map(row=>row.date.slice(0,7)),analyticsSelectedYear());
        const visiblePmsIds=new Set(profileRows(state.investments.filter(row=>row.type==='Stallion PMS')).map(row=>row.id));
        const history = [...(state.stallionProfitHistory || [])].filter(row=>visiblePmsIds.has(row.stallionId)&&financialYearStartYearForMonthKey(row.date.slice(0,7))===selectedYear).sort((a,b)=>a.date.localeCompare(b.date));
        const dates = [...new Set(history.map(row=>row.date))].sort();
        const portfolios = [...new Set(history.map(row=>row.stallionId))].map(id=>state.stallionPms.find(item=>item.id===id&&visiblePmsIds.has(item.id))).filter(Boolean);
        const darkTheme=htmlElement.getAttribute('data-theme')==='dark';
        const colors=darkTheme?['#e89a6e','#58c7c2','#8eaaf7','#b69ae7','#9dc5af','#e89497','#e9c47a']:['#cf7540','#168b8c','#547dd5','#8964cf','#6b9f91','#c96c68','#d3a158'];
        const labels=dates.map(date=>calendarDate(date).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'2-digit'}));
        const datasets=portfolios.map((portfolio,index)=>{
          const data=dates.map(date=>history.find(row=>row.stallionId===portfolio.id&&row.date===date)?.profit ?? null);
          let lastRecordedIndex=-1;data.forEach((value,i)=>{if(value!==null&&Number.isFinite(Number(value)))lastRecordedIndex=i;});
          const color=colors[index%colors.length];
          return {
            label:`${portfolio.member} · ${portfolio.name}`,
            data,
            borderColor:color,
            backgroundColor:context=>portfolios.length===1?analyticsTrendGradient(context,color,0.16):analyticsFill(color,0.08),
            fill:portfolios.length===1,
            borderWidth:2.8,
            tension:0,
            spanGaps:true,
            pointRadius:context=>context.dataIndex===lastRecordedIndex?5:3.5,
            pointHoverRadius:7,
            pointBackgroundColor:color,
            pointBorderColor:themeColor('card-bg'),
            pointBorderWidth:2.5
          };
        });
        const ctx=document.getElementById('stallionProfitTrendChart')?.getContext('2d');
        if(ctx) chartInstances.stallionProfitTrendChart=new Chart(ctx,{
          type:'line',
          data:{labels:labels.length?labels:['No recorded profit entries'],datasets:datasets.length?datasets:[{label:'Profit / Loss',data:[0],borderColor:themeColor('primary'),pointRadius:0}]},
          options:{responsive:true,maintainAspectRatio:true,interaction:{mode:'index',intersect:false},plugins:{legend:{display:portfolios.length>1,position:'bottom',labels:{usePointStyle:true,pointStyle:'line',boxWidth:14,padding:16,color:themeColor('text-light'),font:{size:10}}},tooltip:{displayColors:false,backgroundColor:darkTheme?'#0f172a':'#17313a',titleColor:'#f8fafc',bodyColor:'#f8fafc',padding:11,callbacks:{label:context=>`${context.dataset.label}: ${formatCurrency(context.parsed.y)}`}}},scales:{x:{grid:{display:false},ticks:{color:themeColor('text-light'),maxRotation:0,font:{size:10},padding:8},border:{display:false}},y:{beginAtZero:true,ticks:{color:themeColor('text-light'),maxTicksLimit:6,callback:value=>analyticCompact(value),font:{size:10},padding:8},grid:{color:darkTheme?'rgba(203,213,225,.12)':'rgba(100,116,139,.13)',borderDash:[3,5],drawTicks:false},border:{display:false}}}}
        });
        const rows=[...history].reverse().map(row=>{const portfolio=state.stallionPms.find(item=>item.id===row.stallionId);return [calendarDate(row.date).toLocaleDateString('en-IN'),portfolio?.member||'Unknown',portfolio?.name||'Unknown',formatCurrency(row.profit)];});
        const latestDate=dates.at(-1);
        const takeaway=history.length?`${financialYearLabel(selectedYear)} · ${history.length} dated profit/loss snapshot${history.length===1?'':'s'} recorded across ${portfolios.length} Stallion PMS portfolio${portfolios.length===1?'':'s'}. Markers show recorded values; lines connect each portfolio's snapshots without adding intermediate records.`:`No Stallion PMS profit snapshots have been recorded for ${financialYearLabel(selectedYear)}. Use Update PMS Gain/Loss and save an as-of date to begin the trend.`;
        analyticsTable('stallionProfitTrendChart',['Date','Member','Portfolio','Profit / Loss'],rows,takeaway);
      } catch(error) { console.error(' renderStallionProfitTrendChart error:',error); }
    }

    function renderDebtProgressChart() {
      try {
      destroyChart('debtProgressChart');
      const viewDebts=profileRows(state.debts);
      const totalDebt = viewDebts.reduce((sum, d) => sum + loanTotalPrincipal(d), 0);
      const remainingDebt = viewDebts.reduce((sum, d) => sum + d.remaining, 0);
      const paidDebt = totalDebt - remainingDebt;

      const ctx = document.getElementById('debtProgressChart')?.getContext('2d');
      if (!ctx) return;

      chartInstances['debtProgressChart'] = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['Debt Status'],
          datasets: [
            { label: 'Paid', data: [paidDebt], backgroundColor: document.documentElement.getAttribute('data-theme')==='dark'?'#5b9b83':'#78B59B', borderRadius: 7, borderSkipped: false },
            { label: 'Remaining', data: [remainingDebt], backgroundColor: document.documentElement.getAttribute('data-theme')==='dark'?'#bd7781':'#D9848E', borderRadius: 7, borderSkipped: false }
          ]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: true,
          plugins: { legend: { display:false },analyticLabels:{display:false} },
          scales: { x: { stacked: true, ticks: { callback: (v) => '₹' + (v/100000).toFixed(0) + 'L' } }, y: { stacked: true } }
        }
      });
        console.log(' Debt Progress chart: Paid ₹' + paidDebt + ', Remaining ₹' + remainingDebt);
      } catch (e) {
        console.error(' renderDebtProgressChart error:', e);
      }
    }

    function renderRetirementFundsChart() {
      try {
        destroyChart('retirementFundsChart');
      const npsTotal = profileRows(state.nps).reduce((sum, nps) => sum + nps.current, 0);
      const ppfTotal = profileRows(state.ppf).reduce((sum, ppf) => sum + ppf.current, 0);
      const pfTotal = profileRows(state.pf).reduce((sum, pf) => sum + pf.current, 0);

      const ctx = document.getElementById('retirementFundsChart')?.getContext('2d');
      if (!ctx) return;

      chartInstances['retirementFundsChart'] = new Chart(ctx, {
        type: 'doughnut',
        plugins:[{id:'emptyRetirementRing',afterDraw(chart){if(npsTotal+ppfTotal+pfTotal>0)return;const a=chart.chartArea,c=chart.ctx,x=(a.left+a.right)/2,y=(a.top+a.bottom)/2,r=Math.max(12,Math.min(a.right-a.left,a.bottom-a.top)*.34);c.save();c.strokeStyle='rgba(148,163,184,.2)';c.lineWidth=Math.max(10,r*.25);c.beginPath();c.arc(x,y,r,0,2*Math.PI);c.stroke();c.fillStyle=themeColor('text');c.font='500 14px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('₹0 Total',x,y);c.restore();}}],
        data: {
          labels: ['NPS', 'PPF', 'PF'],
          datasets: [{
            data: [npsTotal, ppfTotal, pfTotal],
            backgroundColor: analyticsPalette().series.slice(0,3),
            borderColor: themeColor('card-bg'),
            borderWidth: 3,
            hoverOffset: 7
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          aspectRatio: 2.05,
          layout: { padding: { top: 8, right: 10, bottom: 8, left: 10 } },
          plugins: {
            legend: { position: 'right', labels: { padding: 16, boxWidth: 10, boxHeight: 10 } },
            tooltip: { callbacks: { label: (context) => `₹${Math.round(context.parsed).toLocaleString('en-IN')}` } }
          }
        }
      });
        console.log(' Retirement Funds chart: NPS ₹' + npsTotal + ', PPF ₹' + ppfTotal + ', PF ₹' + pfTotal);
      } catch (e) {
        console.error(' renderRetirementFundsChart error:', e);
      }
    }

    function renderFamilyContributionChart() {
      try {
        destroyChart('familyContributionChart');
      const visibleNps=profileRows(state.nps),visiblePpf=profileRows(state.ppf),visiblePf=profileRows(state.pf),visiblePms=profileRows(state.investments.filter(x=>x.type==='Stallion PMS'));
      const members=isCombinedFamilyProfile()?[...new Set([...visibleNps,...visiblePpf,...visiblePf,...visiblePms].map(row=>row.member||'Unassigned'))]:[activeFamilyProfile];
      const memberRows=members.map(member=>{
        const n=visibleNps.filter(row=>(row.member||'Unassigned')===member).reduce((sum,row)=>sum+retirementMonthlyAmount(row,'nps'),0);
        const p=visiblePpf.filter(row=>(row.member||'Unassigned')===member).reduce((sum,row)=>sum+retirementMonthlyAmount(row,'ppf'),0);
        const f=visiblePf.filter(row=>(row.member||'Unassigned')===member).reduce((sum,row)=>sum+retirementMonthlyAmount(row,'pf')+(row.autoMonthlyContribution===false?0:Number(row.epsMonthly)||0),0);
        const ids=visiblePms.filter(row=>row.type==='Stallion PMS'&&(row.member||'Unassigned')===member).map(row=>row.id);
        const st=state.stallionContributions.filter(row=>ids.includes(row.stallionId)&&inMonth(row.date,currentMonthKey())).reduce((sum,row)=>sum+(Number(row.amount)||0),0);
        return {member,n,p,f,st};
      });

      const ctx = document.getElementById('familyContributionChart')?.getContext('2d');
      if (!ctx) return;
      const palette=analyticsPalette();

      chartInstances['familyContributionChart'] = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: memberRows.map(row=>row.member),
          datasets: [
            { label: 'NPS', data: memberRows.map(row=>row.n), backgroundColor: palette.brand, borderRadius: 6, borderSkipped: false },
            { label: 'PPF', data: memberRows.map(row=>row.p), backgroundColor: palette.blue, borderRadius: 6, borderSkipped: false },
            { label: 'PF + EPS', data: memberRows.map(row=>row.f), backgroundColor: palette.violet, borderRadius: 6, borderSkipped: false },
            { label: 'Stallion PMS', data: memberRows.map(row=>row.st), backgroundColor: palette.amber, borderRadius: 6, borderSkipped: false }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: { legend: { position: 'top' } },
          scales: { x:{stacked:true}, y: { stacked:true, beginAtZero:true, ticks: { callback: (v) => '₹' + (v/1000).toFixed(0) + 'K' } } }
        }
      });
        console.log(' Family Contribution chart rendered');
      } catch (e) {
        console.error(' renderFamilyContributionChart error:', e);
      }
    }

    function investmentReturnItems() {
      return [...profileRows(state.investments).map(x=>({...x,returnGroup:'investment'})),...profileRows(state.nps).map(x=>({...x,returnGroup:'nps',name:'NPS - '+(x.member||'')+' - '+(x.account||x.scheme||'')})),...profileRows(state.ppf).map(x=>({...x,returnGroup:'ppf',name:'PPF - '+(x.member||'')+' - '+(x.account||'')})),...profileRows(state.pf).map(x=>({...x,returnGroup:'pf',name:'PF - '+(x.member||'')+' - '+(x.account||'')}))].filter(x=>x.invested>0);
    }
    function renderInvestmentReturnsChart() {
      try {
        destroyChart('investmentReturnsChart');
      const accountItems = investmentReturnItems().map(inv => ({
        name: inv.name, group: inv.returnGroup,
        invested: Number(inv.invested)||0,
        current: Number(inv.current)||0,
        gain: (Number(inv.current)||0) - (Number(inv.invested)||0)
      })).filter(inv => inv.invested > 0);
      const chartItems=[...accountItems].sort((a,b)=>b.current-a.current).slice(0,5);
      const labels = chartItems.map(inv => inv.name);
      const invested = chartItems.map(inv => inv.invested);
      const gains = chartItems.map(inv => inv.gain);
      const darkTheme=document.documentElement.getAttribute('data-theme')==='dark';
      const positiveReturnColor=darkTheme?'#58c7c2':'#168b8c';
      const negativeReturnColor=darkTheme?'#e89497':'#c96c68';
      const investedColor=darkTheme?'#8eaaf7':'#547dd5';

      const ctx = document.getElementById('investmentReturnsChart')?.getContext('2d');
      if (!ctx) return;
      const returnsChartInner=document.getElementById('investmentReturnsChartInner');
      if(returnsChartInner)returnsChartInner.style.setProperty('--investment-return-count',String(Math.max(labels.length,1)));
      const hint=document.querySelector('.investment-returns-swipe-hint');if(hint){hint.textContent=accountItems.length>5?`Showing top 5 of ${accountItems.length} holdings. View Details shows all.`:'Invested and gain / loss by holding';hint.removeAttribute('aria-hidden');}

      const scroll=document.getElementById('investmentReturnsChartScroll');let empty=document.getElementById('investmentReturnsEmpty');
      if(!empty){empty=document.createElement('div');empty.id='investmentReturnsEmpty';empty.className='retirement-empty-state';empty.innerHTML='<strong>No investments to compare yet</strong><span>Add your first investment to see Invested vs. Returns.</span>';scroll.after(empty);}
      const noValues=!chartItems.length||!chartItems.some(r=>r.invested!==0||r.gain!==0);scroll.hidden=noValues;empty.hidden=!noValues;if(hint)hint.hidden=noValues;if(noValues)return;
      chartInstances['investmentReturnsChart'] = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: labels.length > 0 ? labels : ['No Investments'],
          datasets: [
            { label: 'Invested', data: invested.length > 0 ? invested : [0], backgroundColor: investedColor, borderRadius: 6, borderSkipped: false },
            { label: 'Returns', data: gains.length > 0 ? gains : [0], backgroundColor: gains.length?gains.map(value=>value>=0?positiveReturnColor:negativeReturnColor):[positiveReturnColor], borderRadius: 6, borderSkipped: false }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis:'y',
          plugins: { legend: { position: 'top' },analyticLabels:{display:false} },
          scales: { x: { beginAtZero:true,ticks:{maxTicksLimit:4,callback:v=>analyticCompact(v)} },y:{ticks:{autoSkip:false,callback:function(v){const label=String(this.getLabelForValue(v));return label.length>20?label.slice(0,19)+'…':label;}}} }
        }
      });
        chartInstances.investmentReturnsChart.$returnItems=chartItems;
        console.log(' Investment Returns chart: ' + chartItems.length + ' chart categories from ' + accountItems.length + ' account rows');
      } catch (e) {
        console.error(' renderInvestmentReturnsChart error:', e);
      }
    }

    function updateFinancialSummary() {
      try {
      const year=analyticsSelectedYear(),inPeriod=row=>typeof row.date==='string'&&monthKeyInFinancialYear(row.date.slice(0,7),year)&&(year!==currentFinancialYearStartYear()||row.date.slice(0,7)<=currentMonthKey());
      const monthlyIncome=profileRows(state.income).filter(inPeriod).reduce((sum,row)=>sum+(Number(row.amount)||0),0);
      const monthlyExpenses=state.expenses.filter(inPeriod).reduce((sum,row)=>sum+(Number(row.amount)||0),0);
      const householdIncome=state.income.filter(inPeriod).reduce((sum,row)=>sum+(Number(row.amount)||0),0);
      const stallionPMS=state.stallionContributions.filter(inPeriod).reduce((sum,row)=>sum+(Number(row.amount)||0),0);
      const surplus=householdIncome-monthlyExpenses-stallionPMS;

      const viewNps=profileRows(state.nps),viewPpf=profileRows(state.ppf),viewPf=profileRows(state.pf),viewInvestments=profileRows(state.investments);
      const npsTotal = viewNps.reduce((sum, nps) => sum + nps.current, 0);
      const ppfTotal = viewPpf.reduce((sum, ppf) => sum + ppf.current, 0);
      const pfTotal = viewPf.reduce((sum, pf) => sum + pf.current, 0);
      const investTotal = viewInvestments.reduce((sum, inv) => sum + inv.current, 0);
      const visiblePmsIds=new Set(viewInvestments.filter(row=>row.type==='Stallion PMS').map(row=>row.id));
      const stallionTotal = (state.stallionPms||[]).filter(item=>visiblePmsIds.has(item.id)).reduce((sum,item)=>sum+(Number(item.invested)||0)+(Number(item.profit)||0),0);
      const totalAssets = npsTotal + ppfTotal + pfTotal + investTotal;

      const totalDebts = profileRows(state.debts).reduce((sum, d) => sum + d.remaining, 0);
      const netWorth = totalAssets - totalDebts;

      const investmentGains = viewInvestments.reduce((sum, inv) => sum + (inv.current - inv.invested), 0) + viewPpf.reduce((sum,x)=>sum+(x.current-x.invested),0) + viewPf.reduce((sum,x)=>sum+(x.current-(x.invested??x.current)),0);
      const npsGains = viewNps.reduce((sum, nps) => sum + (nps.current - nps.invested), 0);
      const totalReturns = investmentGains + npsGains;

      // Update financial summary with null checks
      const summary = {
        summaryIncome: document.getElementById('summaryIncome'),
        summaryExpenses: document.getElementById('summaryExpenses'),
        summarySurplus: document.getElementById('summarySurplus'),
        summaryAssets: document.getElementById('summaryAssets'),
        summaryDebts: document.getElementById('summaryDebts'),
        summaryNetWorth: document.getElementById('summaryNetWorth'),
        summaryReturns: document.getElementById('summaryReturns'),
        summaryRetirement: document.getElementById('summaryRetirement')
      };

      const contributionSummary=document.getElementById('summaryContributions');if(contributionSummary)contributionSummary.textContent=formatCurrency(financialYearAverages(year===currentFinancialYearStartYear()?new Date():new Date(year+1,2,31)).contributionTotal);
      if (summary.summaryIncome) summary.summaryIncome.textContent = formatCurrency(monthlyIncome);
      if (summary.summaryExpenses) summary.summaryExpenses.textContent = formatCurrency(monthlyExpenses);
      if (summary.summarySurplus) summary.summarySurplus.textContent = formatCurrency(surplus);
      if (summary.summaryAssets) summary.summaryAssets.textContent = formatCurrency(totalAssets);
      if (summary.summaryDebts) summary.summaryDebts.textContent = formatCurrency(totalDebts);
      if (summary.summaryNetWorth) summary.summaryNetWorth.textContent = formatCurrency(netWorth);
      const position=document.getElementById('analyticsNetworthAssets');if(position)position.style.width=(totalAssets+totalDebts>0?Math.max(0,Math.min(100,totalAssets/(totalAssets+totalDebts)*100)):0)+'%';
      if (summary.summaryReturns) summary.summaryReturns.textContent = formatCurrency(totalReturns);
      if (summary.summaryRetirement) summary.summaryRetirement.textContent = formatCurrency(npsTotal + ppfTotal + pfTotal);
      console.log(' Financial Summary updated');
      } catch (e) {
        console.error(' updateFinancialSummary error:', e);
      }
    }

    function renderCompletePortfolio() {
      const body=document.getElementById('completePortfolioBody');
      if(!body)return;
      const expandedCategory=body.dataset.expandedCategory||'';
      const entries=[
        ...profileRows(state.nps||[]).map(x=>({category:'NPS',member:x.member,label:[x.account,x.scheme].filter(Boolean).join(' · ')||'NPS account',invested:x.invested,current:x.current})),
        ...profileRows(state.ppf||[]).map(x=>({category:'PPF',member:x.member,label:x.account||'PPF account',invested:x.invested,current:x.current})),
        ...profileRows(state.pf||[]).map(x=>({category:'PF',member:x.member,label:x.account||'PF account',invested:x.invested??x.current,current:x.current})),
        ...profileRows(state.investments||[]).map(x=>({category:x.type||'Other',member:x.member,label:x.name||x.type||'Investment',invested:x.invested,current:x.current}))
      ].map(row=>({...row,invested:Number(row.invested)||0,current:Number(row.current)||0}));
      const compact=value=>Math.abs(value)>=100000?`₹${(Math.round(Math.abs(value)/1000)/100).toFixed(2)}L`:formatCurrency(value);
      const groups=new Map();
      entries.forEach(entry=>{
        const category=String(entry.category||'Other');
        if(!groups.has(category))groups.set(category,{category,holdings:[],invested:0,current:0});
        const group=groups.get(category);group.holdings.push(entry);group.invested+=entry.invested;group.current+=entry.current;
      });
      const rows=[...groups.values()].map(group=>({...group,gain:group.current-group.invested,return:group.invested?((group.current-group.invested)/group.invested)*100:0}));
      const sort=document.getElementById('completePortfolioSort');
      if(sort)sort.onchange=()=>renderCompletePortfolio();
      const sortBy=sort?.value||'current';
      rows.sort((a,b)=>sortBy==='category'?a.category.localeCompare(b.category):sortBy==='invested'?b.invested-a.invested||a.category.localeCompare(b.category):sortBy==='gain'?b.gain-a.gain||a.category.localeCompare(b.category):sortBy==='return'?b.return-a.return||a.category.localeCompare(b.category):b.current-a.current||a.category.localeCompare(b.category));
      const totalInvested=rows.reduce((sum,row)=>sum+row.invested,0),totalCurrent=rows.reduce((sum,row)=>sum+row.current,0),totalGain=totalCurrent-totalInvested,totalReturn=totalInvested?totalGain/totalInvested*100:0;
      const currentTotal=document.getElementById('completePortfolioCurrentTotal'),investedTotal=document.getElementById('completePortfolioInvestedTotal'),gainTotal=document.getElementById('completePortfolioGainTotal'),returnTotal=document.getElementById('completePortfolioReturnTotal');
      if(currentTotal)currentTotal.textContent=compact(totalCurrent);
      if(investedTotal)investedTotal.textContent=compact(totalInvested);
      if(gainTotal){gainTotal.textContent=`${totalGain>=0?'+':'−'}${compact(Math.abs(totalGain))}`;gainTotal.classList.toggle('is-loss',totalGain<0);}
      if(returnTotal){returnTotal.textContent=`${totalReturn>=0?'+':''}${totalReturn.toFixed(1)}%`;returnTotal.classList.toggle('is-loss',totalReturn<0);}
      const remainingButton=document.getElementById('openRemainingInvestments');
      if(remainingButton){remainingButton.hidden=rows.length<=5;remainingButton.onclick=()=>openRemainingPortfolio();}
      document.getElementById('remainingPortfolioDialog')?.close();
      if(!rows.length){body.innerHTML='<div class="text-muted">No investments added yet.</div>';body.dataset.expandedCategory='';return;}
      const visibleRows=rows.slice(0,5);
      const portfolioCount=document.getElementById('completePortfolioCount');
      if(portfolioCount)portfolioCount.textContent='';
      if(remainingButton)remainingButton.textContent=`View remaining ${rows.length-5} investments ›`;
      function paintPortfolio(target,visibleRows,prefix){
      const maxValue=Math.max(...visibleRows.map(row=>Math.max(row.current,row.invested)),1);
      const colors=['#3985a1','#ec9c52','#7566c2','#43a88c','#e06f70','#7889a7','#a16c91','#3f9b8e'];
      target.innerHTML=visibleRows.map((row,index)=>{
        const isExpanded=expandedCategory===row.category;
        const investedWidth=Math.min(100,Math.max(0,row.invested/maxValue*100));
        const currentWidth=Math.min(100,Math.max(0,row.current/maxValue*100));
        const changeLeft=Math.min(investedWidth,currentWidth),changeWidth=Math.abs(currentWidth-investedWidth);
        const changeClass=row.gain>0?'is-gain':row.gain<0?'is-loss':'is-neutral';
        const detailId=`${prefix}Detail${index}`;
        const holdingRows=row.holdings.map(holding=>{
          const gain=holding.current-holding.invested;
          return `<tr><td>${analyticEscape(holding.member||'—')}</td><td>${analyticEscape(holding.label||'Holding')}</td><td class="text-right">${formatCurrency(holding.invested)}</td><td class="text-right">${formatCurrency(holding.current)}</td><td class="text-right ${gain>=0?'positive':'negative'}">${gain>=0?'+':''}${formatCurrency(gain)}</td></tr>`;
        }).join('');
        return `<div class="portfolio-category-group"><button type="button" class="portfolio-category-row" data-portfolio-category="${analyticEscape(row.category)}" aria-expanded="${isExpanded}" aria-controls="${detailId}"><span class="portfolio-category-label"><i class="portfolio-category-dot" style="background:${colors[index%colors.length]}"></i>${analyticEscape(row.category)}</span><span class="portfolio-value-bar" title="Invested ${formatCurrency(row.invested)} · Current ${formatCurrency(row.current)} · Gain ${formatCurrency(row.gain)}"><span class="portfolio-bar-invested" style="width:${investedWidth}%"></span><span class="portfolio-bar-change ${changeClass}" style="left:${changeLeft}%;width:${changeWidth}%"></span></span><span class="portfolio-current-value">${compact(row.current)}</span><span class="portfolio-gain-value ${changeClass}">${row.gain>0?'+':row.gain<0?'−':''}${compact(Math.abs(row.gain))} · ${row.return>0?'+':''}${row.return.toFixed(1)}%${row.gain===0?' · No growth':''}</span><span class="portfolio-row-chevron" aria-hidden="true">›</span></button><div class="portfolio-holdings-details" id="${detailId}"${isExpanded?'':' hidden'}><div class="portfolio-holdings-title">${row.holdings.length} ${row.holdings.length===1?'holding':'holdings'}</div><div class="table-wrapper"><table class="portfolio-holdings-table"><thead><tr><th>Member</th><th>Holding</th><th class="text-right">Invested</th><th class="text-right">Current value</th><th class="text-right">Gain / loss</th></tr></thead><tbody>${holdingRows}</tbody></table></div></div></div>`;
      }).join('');
      target.querySelectorAll('[data-portfolio-category]').forEach(button=>button.addEventListener('click',()=>{
        const expanded=button.getAttribute('aria-expanded')!=='true';
        target.querySelectorAll('[data-portfolio-category]').forEach(other=>{
          const open=other===button&&expanded;other.setAttribute('aria-expanded',String(open));
          document.getElementById(other.getAttribute('aria-controls')).hidden=!open;
        });
        if(target===body)body.dataset.expandedCategory=expanded?button.dataset.portfolioCategory:'';
      }));
      }
      paintPortfolio(body,visibleRows,'completePortfolio');
      function openRemainingPortfolio(){
        let dialog=document.getElementById('remainingPortfolioDialog');
        if(!dialog){
          dialog=document.createElement('dialog');dialog.id='remainingPortfolioDialog';dialog.className='remaining-portfolio-dialog';
          dialog.setAttribute('aria-labelledby','remainingPortfolioTitle');
          dialog.innerHTML='<div class="remaining-portfolio-heading"><h2 id="remainingPortfolioTitle">Remaining investments</h2><button type="button" class="btn-secondary">Close</button></div><p>Categories outside the top five, in your selected sort order.</p><div class="portfolio-category-list"></div>';
          dialog.querySelector('button').onclick=()=>dialog.close();document.body.append(dialog);
        }
        paintPortfolio(dialog.querySelector('.portfolio-category-list'),rows.slice(5),'remainingPortfolio');dialog.showModal();
      }
    }


    // GROWTH PROJECTION
    let growthProjectionChartInstance = null;
    let growthProjectionHoverCleanup = null;
    let expandedGrowthAssumptionAsset = null;
    const GROWTH_PLANNED_CHANGES_KEY='__planned_changes__';
    function projectionMonthIndex(monthKey) {
      const [year,month]=monthKey.split('-').map(Number);
      return year*12+month-1;
    }
    function projectionMonthKey(index) {
      const year=Math.floor(index/12),month=index%12+1;
      return `${year}-${String(month).padStart(2,'0')}`;
    }
    function projectionWeightedRate(rows,rateField='rate') {
      const valid=rows.filter(row=>Number.isFinite(Number(row[rateField]))&&Number(row[rateField])>=0);
      if(!valid.length)return 0;
      const weight=valid.reduce((sum,row)=>sum+(Number(row.current)||0),0);
      return weight>0?valid.reduce((sum,row)=>sum+(Number(row.current)||0)*Number(row[rateField]),0)/weight:valid.reduce((sum,row)=>sum+Number(row[rateField]),0)/valid.length;
    }
    function growthAssumptionGroup(asset) {
      if(asset?.kind==='eps')return 'no-return';
      if(asset?.kind==='investment')return investmentGrowthType(asset.name);
      if(asset?.kind==='pf'||asset?.kind==='ppf')return 'fixed';
      return 'market';
    }
    function growthProjectionAssets() {
      const assets=[];
      const add=(name,current,monthly,rates={stress:0,base:0,optimistic:0},kind='investment',invested=current)=>{
        const existing=assets.find(item=>item.name===name);
        if(existing){existing.current+=Number(current)||0;existing.invested+=Number(invested)||0;existing.monthly+=Number(monthly)||0;return;}
        assets.push({name,current:Number(current)||0,invested:Number(invested)||0,monthly:Number(monthly)||0,defaults:rates,kind});
      };
      const viewPf=profileRows(state.pf),viewPpf=profileRows(state.ppf),viewNps=profileRows(state.nps),viewInvestments=profileRows(state.investments);
      if(viewPf.length)add('PF',viewPf.reduce((sum,row)=>sum+(Number(row.current)||0),0),viewPf.reduce((sum,row)=>sum+retirementMonthlyAmount(row,'pf'),0),{stress:projectionWeightedRate(viewPf),base:projectionWeightedRate(viewPf),optimistic:projectionWeightedRate(viewPf)},'pf',viewPf.reduce((sum,row)=>sum+(Number(row.invested??row.current)||0),0));
      if(viewPf.some(row=>Number(row.epsCurrent)>0||Number(row.epsMonthly)>0))add('EPS',viewPf.reduce((sum,row)=>sum+(Number(row.epsCurrent)||0),0),viewPf.reduce((sum,row)=>sum+(row.autoMonthlyContribution===false?0:Number(row.epsMonthly)||0),0),{stress:0,base:0,optimistic:0},'eps');
      if(viewPpf.length)add('PPF',viewPpf.reduce((sum,row)=>sum+(Number(row.current)||0),0),viewPpf.reduce((sum,row)=>sum+retirementMonthlyAmount(row,'ppf'),0),{stress:projectionWeightedRate(viewPpf),base:projectionWeightedRate(viewPpf),optimistic:projectionWeightedRate(viewPpf)},'ppf',viewPpf.reduce((sum,row)=>sum+(Number(row.invested??row.current)||0),0));
      if(viewNps.length)add('NPS',viewNps.reduce((sum,row)=>sum+(Number(row.current)||0),0),viewNps.reduce((sum,row)=>sum+retirementMonthlyAmount(row,'nps'),0),{stress:7,base:7.5,optimistic:8},'nps',viewNps.reduce((sum,row)=>sum+(Number(row.invested??row.current)||0),0));
      const otherGroups=new Map();
      viewInvestments.filter(row=>row.type!=='Stallion PMS').forEach(row=>{
        const name=String(row.type||'Other').trim()||'Other';
        const profile=customInvestmentProfile(name),growthType=investmentGrowthType(name),invested=Number(row.invested??row.current)||0,current=growthType==='no-return'?invested:(Number(row.current)||0);
        const group=otherGroups.get(name)||{rows:[],current:0,invested:0,monthly:0};group.rows.push({...row,current,rate:Number.isFinite(Number(row.rate))?Number(row.rate):row.rate});group.current+=current;group.invested+=invested;group.monthly+=investmentMonthlyAmount(row);otherGroups.set(name,group);
      });
      for(const [name,group] of otherGroups){
        const rates=projectionWeightedRate(group.rows);
        add(name,group.current,group.monthly,{stress:rates,base:rates,optimistic:rates},'investment',group.invested);
      }
      const stallionRows=viewInvestments.filter(row=>row.type==='Stallion PMS');
      if(stallionRows.length)add('Stallion PMS',stallionRows.reduce((sum,row)=>sum+(Number(row.current)||0),0),stallionRows.reduce((sum,row)=>sum+investmentMonthlyAmount(row),0),{stress:8,base:11,optimistic:15},'stallion',stallionRows.reduce((sum,row)=>sum+(Number(row.invested??row.current)||0),0));
      for(const row of state.projectionAdjustments||[])if(!assets.some(item=>item.name===row.category))add(row.category,0,0,{stress:0,base:0,optimistic:0});
      return assets.sort((a,b)=>{
        const order=['PF','PPF','NPS','Stallion PMS'];
        const ai=order.includes(a.name)?order.indexOf(a.name):99,bi=order.includes(b.name)?order.indexOf(b.name):99;
        return ai-bi||a.name.localeCompare(b.name);
      }).map(asset=>{
        const saved=state.projectionSettings?.returns?.[asset.name]||{};
        const group=growthAssumptionGroup(asset),savedRates={stress:saved.stress??asset.defaults.stress,base:saved.base??asset.defaults.base,optimistic:saved.optimistic??asset.defaults.optimistic};
        const sourceMonthly=Number(asset.monthly)||0;
        const projectedMonthly=sourceMonthly>0?sourceMonthly:(group==='market'?(Number(state.projectionSettings?.monthlyContributions?.[asset.name])||0):0);
        let returns=savedRates;
        if(group==='fixed'){const rate=Number(saved.base??asset.defaults.base)||0;returns={stress:rate,base:rate,optimistic:rate};}
        if(group==='no-return')returns={stress:0,base:0,optimistic:0};
        return {...asset,assumptionGroup:group,sourceMonthly,monthly:projectedMonthly,stepUpPercent:(group==='market'||(group==='fixed'&&sourceMonthly>0))?(Number(state.projectionSettings?.annualStepUpPercentByAsset?.[asset.name])||0):0,returns};
      }).filter(asset=>asset.current>0||asset.invested>0||Number(asset.monthly)>0||(asset.kind==='pf'&&viewPf.some(row=>Number(row.epsCurrent)>0||Number(row.epsMonthly)>0))||(state.projectionAdjustments||[]).some(row=>row.category===asset.name));
    }
    function renderGrowthProjectionAssumptions(assets) {
      const root=document.getElementById('growthProjectionAssumptionTiles');
      const activeControl=document.activeElement,focusState=root.contains(activeControl)&&activeControl.matches?.('.growth-assumption-slider,.growth-projection-input')?{asset:activeControl.dataset.asset,field:activeControl.dataset.field,type:activeControl.type}:null;
      const fmt=value=>{const rate=Number(value);return Number.isFinite(rate)?rate.toFixed(2).replace(/\.?0+$/,'')||'0':'0';};
      if(expandedGrowthAssumptionAsset!==GROWTH_PLANNED_CHANGES_KEY&&!assets.some(asset=>asset.name===expandedGrowthAssumptionAsset))expandedGrowthAssumptionAsset=null;
      const input=(asset,field,label,value,min,max,step,suffix='')=>`<div class="growth-assumption-field"><label>${label}</label><div class="growth-assumption-input-suffix"><input class="growth-projection-input" aria-label="${analyticEscape(asset.name)} ${label.toLowerCase()}" ${field==='monthly'?'title="Projection only; does not change Investment details."':''} type="number" min="${min}" max="${max}" step="${step}" inputmode="decimal" data-asset="${analyticEscape(asset.name)}" data-field="${field}" value="${Number(value)||0}">${suffix?`<span>${suffix}</span>`:''}</div></div>`;
      const groups=[{id:'market',title:'Market investments',caption:'Stress · Base · Optimistic',accent:'market'},{id:'fixed',title:'Fixed returns',caption:'One fixed interest rate or ROI',accent:'fixed'},{id:'no-return',title:'No-return investments',caption:'Balance carried forward with no growth',accent:'no-return'}];
      const assetTiles=assets.filter(asset=>asset.kind!=='eps').map((asset,index)=>{
        const name=analyticEscape(asset.name),group=asset.assumptionGroup||growthAssumptionGroup(asset),expanded=asset.name===expandedGrowthAssumptionAsset;
        const hasStepUp=group==='market'||(group==='fixed'&&asset.sourceMonthly>0);
        const monthlySummary=asset.monthly>0?`<span>Monthly <strong>${formatCurrency(asset.monthly)}</strong></span>${hasStepUp?`<span>Step-up <strong>${fmt(asset.stepUpPercent)}%</strong></span>`:''}`:'';
        const scenarios=group==='market'?['stress','base','optimistic']:group==='fixed'?['fixedRate']:[];
        const returnSummary=group==='no-return'?'<span class="growth-assumption-return growth-assumption-return-no-growth"><strong>No growth assumed</strong></span>':scenarios.map(field=>{
          const value=field==='fixedRate'?asset.returns.base:asset.returns[field],label=field==='fixedRate'?'Fixed interest':field[0].toUpperCase()+field.slice(1);
          const position=Math.max(4,Math.min(96,((Number(value)+20)/50)*100));
          return `<span class="growth-assumption-return growth-assumption-return-${field==='fixedRate'?'fixed':field}${group==='market'?' growth-assumption-return-market':''}"${group==='market'?` style="--scenario-position:${position}%"`:''}><span>${label}</span><strong>${fmt(value)}%</strong>${group==='market'?'<span class="growth-assumption-track" aria-hidden="true"><i></i></span>':''}</span>`;
        }).join('');
        const rateEditor=scenarios.map(field=>{
          const value=Number(field==='fixedRate'?asset.returns.base:asset.returns[field])||0,pms=asset.name==='Stallion PMS'&&field==='optimistic';
          const min=pms?8:Math.min(-20,Math.floor(value/10)*10),max=pms?24:Math.max(30,Math.ceil(value/10)*10),label=field==='fixedRate'?'ROI':field[0].toUpperCase()+field.slice(1),manualId=`growth-${index}-${field}-manual`;
          return `<section class="growth-assumption-scenario-row growth-rate-control growth-rate-control-${field}"><label for="${manualId}">${label}</label><div class="growth-assumption-manual"><div class="growth-assumption-input-suffix"><input id="${manualId}" class="growth-projection-input" type="number" min="-100" max="100" step="0.05" inputmode="decimal" data-asset="${name}" data-field="${field}" value="${fmt(value)}" aria-label="${name} ${label.toLowerCase()} percentage"><span>%</span></div></div><div class="growth-assumption-range"><input class="growth-assumption-slider" type="range" min="${min}" max="${max}" step="0.05" value="${Math.min(max,Math.max(min,value))}" data-asset="${name}" data-field="${field}" aria-label="${name} ${label.toLowerCase()} slider"><div class="growth-assumption-slider-scale"><span>${min}%</span><span>${max}%</span></div></div></section>`;
        }).join('');
        const monthlyField=asset.sourceMonthly>0?`<div class="growth-assumption-field"><label>Monthly contribution</label><input type="text" value="${formatCurrency(asset.sourceMonthly)}" readonly aria-label="${name} monthly contribution synced from Investments" title="Managed in Investments"></div>`:group==='market'?input(asset,'monthly','Monthly contribution',asset.monthly,0,1000000000000,100):'';
        const eps=asset.kind==='pf'?assets.find(row=>row.kind==='eps'):null;
        const secondaryFields=`${eps?`<div class="growth-assumption-field"><label>EPS balance · no interest</label><strong>${formatCurrency(eps.current)}</strong><small>Monthly EPS ${formatCurrency(eps.monthly)} · managed in PF account</small></div>`:''}${monthlyField}${hasStepUp?input(asset,'stepUp','Annual step-up',asset.stepUpPercent,0,100,0.05,'%'):''}`;
        const editor=`<div class="growth-assumption-details">${scenarios.length?`<p class="growth-assumption-slider-hint">Drag slider or type a value in the % box.</p><div class="growth-rate-controls${group==='fixed'?' is-fixed':''}">${rateEditor}</div>`:'<div class="growth-assumption-no-return-note">No investment growth; enabled monthly contributions are added.</div>'}<div class="growth-assumption-secondary-fields">${secondaryFields}</div></div>`;
        return {group,name:asset.name,current:asset.current,monthlySummary,editor,html:`<article class="growth-assumption-tile" data-growth-assumption-tile="${name}"><button type="button" class="growth-assumption-toggle" data-toggle-growth-assumption="${name}" aria-expanded="${expanded}" aria-controls="growthAssumptionDialog"><span class="growth-assumption-topline"><span class="growth-assumption-name">${name}</span><strong class="growth-assumption-value">${formatCurrency(asset.current)}</strong></span><span class="growth-assumption-subline">${monthlySummary}</span><span class="growth-assumption-returns${group==='market'?'':' growth-assumption-returns-single'}">${returnSummary}</span><span class="growth-assumption-chevron" aria-hidden="true">⌄</span></button></article>`};
      });
      const selectedGroup=root.dataset.activeAssumptionGroup||'',desktopGroups=typeof matchMedia==='function'&&matchMedia('(min-width:1100px)').matches;
      const groupChoices=desktopGroups?'':'<div class="growth-assumption-choices" role="group" aria-label="Investment assumption groups">'+groups.map(group=>{const count=assetTiles.filter(item=>item.group===group.id).length,label={market:'Market linked',fixed:'Fixed returns','no-return':'No return'}[group.id];return `<button type="button" data-assumption-group="${group.id}" aria-expanded="${selectedGroup===group.id}" aria-controls="growthAssumptionGroup-${group.id}" ${count?'':'disabled'}><strong>${label}</strong><small>${count} ${count===1?'type':'types'}</small></button>`;}).join('')+'</div><p class="growth-assumption-choice-hint"'+(selectedGroup?' hidden':'')+'>Tap a group to show its investments.</p>';
      const groupedMarkup=groups.map(group=>{const items=assetTiles.filter(item=>item.group===group.id);return `<section id="growthAssumptionGroup-${group.id}" data-assumption-group-panel="${group.id}" ${desktopGroups||selectedGroup===group.id?'':'hidden'} class="growth-assumption-group growth-assumption-group-${group.accent}"><header class="growth-assumption-group-heading"><div><h3>${desktopGroups?{'market':'Market linked','fixed':'Fixed returns','no-return':'No return'}[group.id]:group.title}</h3><p>${group.caption}</p></div><span class="growth-assumption-group-count">${items.length} ${items.length===1?'type':'types'}</span></header><div class="growth-assumption-group-grid">${items.map(item=>item.html).join('')}</div></section>`;}).join('');
      const nextMonthIndex=projectionMonthIndex(currentMonthKey())+1,upcoming=(state.projectionAdjustments||[]).filter(row=>validCalendarDate(row.date)&&projectionMonthIndex(row.date.slice(0,7))>=nextMonthIndex),plannedAdds=upcoming.filter(row=>row.type==='add').reduce((sum,row)=>sum+row.amount,0),plannedWithdrawals=upcoming.filter(row=>row.type==='withdraw').reduce((sum,row)=>sum+row.amount,0),plannedExpanded=expandedGrowthAssumptionAsset===GROWTH_PLANNED_CHANGES_KEY;
      const plannedContent=`<div class="growth-planned-modal-content" data-growth-assumption-tile="${GROWTH_PLANNED_CHANGES_KEY}"><div class="growth-adjustment-form"><div class="form-group"><label for="growthAdjustmentDate">Date</label><input type="date" id="growthAdjustmentDate"></div><div class="form-group"><label for="growthAdjustmentAsset">Investment</label><select id="growthAdjustmentAsset"></select></div><div class="form-group"><label for="growthAdjustmentType">Type</label><select id="growthAdjustmentType"><option value="add">Addition</option><option value="withdraw">Withdrawal</option></select></div><div class="form-group"><label for="growthAdjustmentAmount">Amount (₹)</label><input type="number" id="growthAdjustmentAmount" min="0.01" step="0.01" placeholder="50000"></div><div class="form-group"><label for="growthAdjustmentNotes">Description (optional)</label><input type="text" id="growthAdjustmentNotes" maxlength="120" placeholder="e.g., planned lump sum"></div></div><button type="button" class="btn-primary" id="addGrowthAdjustmentBtn">+ Add planned change</button><div class="table-wrapper"><table><thead><tr><th>Date</th><th>Investment</th><th>Type</th><th class="text-right">Amount</th><th>Description</th><th>Actions</th></tr></thead><tbody id="growthAdjustmentBody"></tbody></table></div></div>`;
      const plannedTile=`<article class="growth-assumption-tile growth-planned-change-tile" data-growth-assumption-tile="${GROWTH_PLANNED_CHANGES_KEY}"><button type="button" class="growth-assumption-toggle" data-toggle-growth-assumption="${GROWTH_PLANNED_CHANGES_KEY}" aria-expanded="${plannedExpanded}" aria-controls="growthAssumptionDialog"><span class="growth-planned-summary"><span><strong>Planned one-time changes</strong><small>${upcoming.length} planned</small></span><span class="growth-planned-amounts"><span class="growth-planned-additions">Additions <strong>${formatCurrency(plannedAdds)}</strong></span><span class="growth-planned-withdrawals">Withdrawals <strong>${formatCurrency(plannedWithdrawals)}</strong></span></span></span><span class="growth-assumption-chevron" aria-hidden="true">⌄</span></button>${plannedExpanded?'':`<div hidden>${plannedContent}</div>`}</article>`;
      const expandedAsset=assetTiles.find(item=>item.name===expandedGrowthAssumptionAsset),open=Boolean(expandedAsset||plannedExpanded),title=plannedExpanded?'Planned one-time changes':expandedAsset?`${expandedAsset.name} assumptions`:'';
      const content=plannedExpanded?plannedContent:expandedAsset?`<article class="growth-assumption-tile growth-assumption-expanded-panel is-expanded" data-growth-assumption-tile="${analyticEscape(expandedAsset.name)}"><div class="growth-assumption-expanded-header"><div class="growth-assumption-expanded-heading"><strong>Current value</strong><span>${expandedAsset.monthlySummary}</span></div><strong class="growth-assumption-value">${formatCurrency(expandedAsset.current)}</strong></div>${expandedAsset.editor}</article>`:'';
      const assumptionDialog=`<div id="growthAssumptionDialog" role="dialog" aria-modal="true" aria-labelledby="growthAssumptionDialogTitle"${open?'':' hidden'}>${open?`<section class="growth-assumption-modal-shell"><header class="growth-assumption-modal-header"><h2 id="growthAssumptionDialogTitle">${analyticEscape(title)}</h2><button type="button" data-collapse-growth-assumption aria-label="Close assumptions"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header><div class="growth-assumption-modal-body">${content}</div></section>`:''}</div>`;
      root.innerHTML=`${groupChoices}${groupedMarkup}${plannedTile}${assumptionDialog}`;
      root.querySelectorAll('[data-assumption-group]').forEach(button=>button.addEventListener('click',event=>{
        event.preventDefault();event.stopPropagation();
        const selected=root.dataset.activeAssumptionGroup===button.dataset.assumptionGroup?'':button.dataset.assumptionGroup;
        root.dataset.activeAssumptionGroup=selected;
        root.querySelectorAll('[data-assumption-group]').forEach(option=>option.setAttribute('aria-expanded',String(option.dataset.assumptionGroup===selected)));
        root.querySelectorAll('[data-assumption-group-panel]').forEach(panel=>panel.hidden=panel.dataset.assumptionGroupPanel!==selected);
        root.querySelector('.growth-assumption-choice-hint').hidden=Boolean(selected);
      }));
      syncInvestmentOverlayBodyLock();
      const writeReturn=(asset,field,value)=>{
        state.projectionSettings=state.projectionSettings||{years:5,includeMonthlyContributions:true,monthlyContributions:{},returns:{}};
        state.projectionSettings.returns=state.projectionSettings.returns||{};state.projectionSettings.returns[asset]=state.projectionSettings.returns[asset]||{};
        if(field==='fixedRate')Object.assign(state.projectionSettings.returns[asset],{stress:value,base:value,optimistic:value});else state.projectionSettings.returns[asset][field]=value;
      };
      const formatRate=value=>{const rate=Number(value);return Number.isFinite(rate)?(rate===0?'0':rate.toFixed(2).replace(/\.?0+$/,'')):'0';};
      root.querySelectorAll('.growth-assumption-slider').forEach(slider=>{
        slider.addEventListener('input',event=>{
          event.stopPropagation();const control=event.currentTarget,asset=control.dataset.asset,field=control.dataset.field,value=Number(control.value);if(!asset||!['stress','base','optimistic','fixedRate'].includes(field)||!Number.isFinite(value))return;
          const row=control.closest('.growth-assumption-scenario-row'),manual=row?.querySelector('.growth-projection-input');if(manual)manual.value=formatRate(value);
          writeReturn(asset,field,value);const summary=row?.closest('[data-growth-assumption-tile]')?.querySelector(`${field==='fixedRate'?'.growth-assumption-return-fixed':`.growth-assumption-return-${field}`} strong`);if(summary)summary.textContent=`${formatRate(value)}%`;
        });
        slider.addEventListener('change',event=>{event.stopPropagation();saveData();renderGrowthProjection();});
      });
      root.querySelectorAll('.growth-assumption-manual .growth-projection-input').forEach(input=>{
        input.addEventListener('input',event=>{
          event.stopPropagation();const control=event.currentTarget,raw=control.value.trim(),asset=control.dataset.asset,field=control.dataset.field,value=Number(raw);if(raw===''||!asset||!['stress','base','optimistic','fixedRate'].includes(field)||!Number.isFinite(value)||value<-100||value>100)return;
          const row=control.closest('.growth-assumption-scenario-row'),slider=row?.querySelector('.growth-assumption-slider');if(slider)slider.value=String(Math.min(Number(slider.max),Math.max(Number(slider.min),value)));
          writeReturn(asset,field,value);const summary=row?.closest('[data-growth-assumption-tile]')?.querySelector(`${field==='fixedRate'?'.growth-assumption-return-fixed':`.growth-assumption-return-${field}`} strong`);if(summary)summary.textContent=`${formatRate(value)}%`;
        });
        input.addEventListener('change',event=>{
          event.stopPropagation();const control=event.currentTarget,value=Number(control.value),asset=control.dataset.asset,field=control.dataset.field;
          if(!asset||!['stress','base','optimistic','fixedRate'].includes(field)||!Number.isFinite(value)||value<-100||value>100){alert(field==='fixedRate'?'Enter a valid fixed interest rate or ROI between -100% and 100%.':'Enter a valid return assumption between -100% and 100%.');renderGrowthProjection();return;}
          writeReturn(asset,field,value);saveData();renderGrowthProjection();
        });
      });
      root.querySelectorAll('[data-toggle-growth-assumption]').forEach(button=>button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();toggleGrowthAssumptionAsset(button.dataset.toggleGrowthAssumption);}));
      root.querySelectorAll('[data-collapse-growth-assumption]').forEach(button=>button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();collapseGrowthAssumptionAsset();}));
      if(focusState)requestAnimationFrame(()=>{const next=[...root.querySelectorAll('.growth-assumption-slider,.growth-projection-input')].find(control=>control.dataset.asset===focusState.asset&&control.dataset.field===focusState.field&&control.type===focusState.type);next?.focus({preventScroll:true});});
    }
    function toggleGrowthAssumptionAsset(assetName) {
      const previousAdjustmentAsset=document.getElementById('growthAdjustmentAsset')?.value;
      expandedGrowthAssumptionAsset=expandedGrowthAssumptionAsset===assetName?null:assetName;
      const assets=growthProjectionAssets();
      renderGrowthProjectionAssumptions(assets);renderGrowthAdjustmentRows(assets);
      if(expandedGrowthAssumptionAsset)requestAnimationFrame(()=>document.querySelector('#growthAssumptionDialog [data-collapse-growth-assumption]')?.focus());
      const select=document.getElementById('growthAdjustmentAsset');if(previousAdjustmentAsset&&assets.some(asset=>asset.name===previousAdjustmentAsset))select.value=previousAdjustmentAsset;
      if(!expandedGrowthAssumptionAsset&&assetName!==GROWTH_PLANNED_CHANGES_KEY)requestAnimationFrame(()=>document.querySelector(`[data-toggle-growth-assumption="${CSS.escape(assetName)}"]`)?.focus());
    }
    function collapseGrowthAssumptionAsset() {
      if(!expandedGrowthAssumptionAsset)return;
      const closedAsset=expandedGrowthAssumptionAsset;
      const previousAdjustmentAsset=document.getElementById('growthAdjustmentAsset')?.value;
      expandedGrowthAssumptionAsset=null;
      const assets=growthProjectionAssets();
      renderGrowthProjectionAssumptions(assets);renderGrowthAdjustmentRows(assets);
      const select=document.getElementById('growthAdjustmentAsset');if(previousAdjustmentAsset&&assets.some(asset=>asset.name===previousAdjustmentAsset))select.value=previousAdjustmentAsset;
      if(closedAsset!==GROWTH_PLANNED_CHANGES_KEY)requestAnimationFrame(()=>document.querySelector(`[data-toggle-growth-assumption="${CSS.escape(closedAsset)}"]`)?.focus());
    }
    function renderGrowthContributionExclusions(assets,includeMonthlyContributions) {
      const wrap=document.getElementById('growthContributionExclusionsWrap'),list=document.getElementById('growthContributionExclusions');
      const monthlyAssets=assets.filter(asset=>asset.kind!=='eps'&&(Number(asset.monthly)>0||(asset.kind==='pf'&&assets.some(row=>row.kind==='eps'&&row.monthly>0))));
      wrap.hidden=false;
      const amountFor=asset=>(Number(asset.monthly)||0)+(asset.kind==='pf'?(assets.find(row=>row.kind==='eps')?.monthly||0):0);
      const excluded=state.projectionSettings?.excludedMonthlyContributions||[];
      const activeCount=monthlyAssets.filter(asset=>!excluded.includes(asset.name)).length;
      const monthlyTotal=monthlyAssets.filter(asset=>!excluded.includes(asset.name)).reduce((sum,asset)=>sum+amountFor(asset),0);
      const summary=document.getElementById('growthContributionSummary');
      const summaryRow=summary.closest('.growth-contribution-summary-row');
      if(summaryRow)summaryRow.hidden=!includeMonthlyContributions;
      summary.textContent=includeMonthlyContributions?formatCurrency(monthlyTotal)+'/month · '+activeCount+' of '+monthlyAssets.length+' included':'Monthly contributions excluded';
      document.getElementById('growthContributionHeading').textContent=includeMonthlyContributions?summary.textContent:'Contributions are off. Your selections are remembered.';
      document.getElementById('manageGrowthContributions').disabled=!includeMonthlyContributions||!monthlyAssets.length;
      list.innerHTML=monthlyAssets.map(asset=>{const included=!excluded.includes(asset.name);return `<label class="growth-exclusion-item${included?'':' is-excluded'}"><span class="growth-exclusion-name"><strong>${analyticEscape(asset.name)}</strong><small>${formatCurrency((Number(asset.monthly)||0)+(asset.kind==='pf'?(assets.find(row=>row.kind==='eps')?.monthly||0):0))} per month${asset.kind==='pf'&&assets.some(row=>row.kind==='eps')?' · PF + EPS':''}</small></span><span class="growth-exclusion-control"><span>${included?'Included':'Excluded'}</span><span class="growth-switch growth-switch-small"><input type="checkbox" class="growth-monthly-exclude-toggle" data-asset="${analyticEscape(asset.name)}" aria-label="Include ${analyticEscape(asset.name)} monthly contribution" ${included?'checked':''}><span class="growth-switch-track"></span></span></span></label>`;}).join('')||'<p class="text-muted">No monthly contributions available.</p>';
    }
    function renderGrowthAdjustmentRows(assets) {
      const select=document.getElementById('growthAdjustmentAsset');
      if(!select)return;
      const previous=select.value;
      const options=assets.map(asset=>asset.name);
      if(!options.includes('Other'))options.push('Other');
      select.innerHTML=options.map(name=>`<option value="${analyticEscape(name)}">${analyticEscape(name)}</option>`).join('');
      if(assets.some(asset=>asset.name===previous))select.value=previous;
      const startIndex=projectionMonthIndex(projectionMonthKey(projectionMonthIndex(currentMonthKey())+1));
      document.getElementById('growthAdjustmentDate').min=`${projectionMonthKey(startIndex)}-01`;
      if(!document.getElementById('growthAdjustmentDate').value)document.getElementById('growthAdjustmentDate').value=`${projectionMonthKey(startIndex)}-01`;
      const body=document.getElementById('growthAdjustmentBody');
      const rows=[...(state.projectionAdjustments||[])].sort((a,b)=>a.date.localeCompare(b.date));
      body.innerHTML=rows.map(row=>`<tr><td>${calendarDate(row.date).toLocaleDateString('en-IN')}</td><td>${analyticEscape(row.category)}</td><td>${row.type==='add'?'Addition':'Withdrawal'}</td><td class="text-right">${formatCurrency(row.amount)}</td><td>${analyticEscape(row.notes||'—')}</td><td><button type="button" class="btn-small" data-edit-growth-adjustment="${analyticEscape(row.id)}">Edit</button> <button type="button" class="btn-small btn-danger" data-delete-growth-adjustment="${analyticEscape(row.id)}">Delete</button></td></tr>`).join('')||'<tr><td colspan="6" class="text-muted">No planned one-time changes.</td></tr>';
    }
    function addGrowthAdjustmentFromTile() {
      const date=document.getElementById('growthAdjustmentDate').value,category=document.getElementById('growthAdjustmentAsset').value,type=document.getElementById('growthAdjustmentType').value,amount=Number(document.getElementById('growthAdjustmentAmount').value),notes=document.getElementById('growthAdjustmentNotes').value.trim();
      const first=projectionMonthIndex(projectionMonthKey(projectionMonthIndex(currentMonthKey())+1)),index=date&&/^\d{4}-\d{2}-\d{2}$/.test(date)?projectionMonthIndex(date.slice(0,7)):-1;
      if(!validCalendarDate(date)||index<first){alert('Choose a valid date from next month onward.');return;}
      if(!category||!['add','withdraw'].includes(type)||!Number.isFinite(amount)||amount<=0){alert('Choose an investment and enter a valid amount.');return;}
      state.projectionAdjustments.push({id:generateId(),date,category,type,amount,notes});
      document.getElementById('growthAdjustmentAmount').value='';document.getElementById('growthAdjustmentNotes').value='';
      saveData();renderGrowthProjection();
    }
    function handleGrowthAdjustmentRowAction(event) {
      const remove=event.target.closest('[data-delete-growth-adjustment]'),edit=event.target.closest('[data-edit-growth-adjustment]');
      if(remove){const id=remove.dataset.deleteGrowthAdjustment;if(confirm('Delete this planned change?')){state.projectionAdjustments=state.projectionAdjustments.filter(row=>row.id!==id);saveData();renderGrowthProjection();}return true;}
      if(edit){const row=state.projectionAdjustments.find(item=>item.id===edit.dataset.editGrowthAdjustment);if(row)editPlannedAdjustment(row);return true;}
      return false;
    }
    function runGrowthProjection(assets,years,scenario) {
      const balances=new Map(assets.map(asset=>[asset.name,asset.current])),pendingAnnualInterest=new Map(assets.map(asset=>[asset.name,0])),rows=[],start=projectionMonthIndex(projectionMonthKey(projectionMonthIndex(currentMonthKey())+1));
      const startMonth=projectionMonthKey(start),startFinancialYear=Number(startMonth.slice(0,4))-(Number(startMonth.slice(5,7))<4?1:0);
      let currentYear=null,yearRow=null;
      const includeMonthly=state.projectionSettings?.includeMonthlyContributions!==false;
      const excludedMonthly=new Set(state.projectionSettings?.excludedMonthlyContributions||[]);
      if(excludedMonthly.has('PF'))excludedMonthly.add('EPS');
      const assetInputs=new Map(assets.map(asset=>{
        const rate=asset.kind==='eps'?0:Number(asset.returns?.[scenario])||0;
        const step=asset.kind==='eps'?0:Math.min(100,Math.max(0,Number(asset.stepUpPercent??state.projectionSettings?.annualStepUpPercentByAsset?.[asset.name])||0));
        return [asset.name,{rate,monthlyFactor:Math.pow(1+rate/100,1/12),monthly:includeMonthly&&!excludedMonthly.has(asset.name)?(Number(asset.monthly)||0):0,stepFactor:1+step/100}];
      }));
      const adjustmentsByMonth=new Map();
      for(const row of state.projectionAdjustments||[]){
        const month=row.date.slice(0,7);let categories=adjustmentsByMonth.get(month);
        if(!categories){categories=new Map();adjustmentsByMonth.set(month,categories);}
        let totals=categories.get(row.category);if(!totals){totals={additions:0,withdrawals:0};categories.set(row.category,totals);}
        if(row.type==='add')totals.additions+=row.amount;else if(row.type==='withdraw')totals.withdrawals+=row.amount;
      }
      for(let offset=0;offset<years*12;offset++){
        const monthIndex=start+offset,month=projectionMonthKey(monthIndex),fyStart=Number(month.slice(0,4))-(Number(month.slice(5,7))<4?1:0);
        if(fyStart!==currentYear){const fyStep=Math.max(0,fyStart-startFinancialYear);for(const input of assetInputs.values())input.yearMonthly=input.monthly*Math.pow(input.stepFactor,fyStep);currentYear=fyStart;yearRow={fyStart,opening:[...balances.values()].reduce((sum,value)=>sum+value,0),contributions:0,additions:0,withdrawals:0,growth:0,closing:0};rows.push(yearRow);}
        const monthlyAdjustments=adjustmentsByMonth.get(month);
        let monthlyGrowth=0;
        for(const asset of assets){
          if(asset.kind==='gratuity'){
            const nextValue=totalGratuityEstimate(projectionMonthEndDate(month));
            monthlyGrowth+=nextValue-(balances.get(asset.name)||0);
            balances.set(asset.name,nextValue);
            continue;
          }
          const inputs=assetInputs.get(asset.name),monthly=inputs.yearMonthly;
          const flows=monthlyAdjustments?.get(asset.name);
          const additions=flows?.additions||0,withdrawals=flows?.withdrawals||0;
          const preReturn=balances.get(asset.name)+monthly+additions-withdrawals;
          if(preReturn < -0.005)throw new Error(`${asset.name} withdrawal in ${month} exceeds its projected available balance in the ${scenario} scenario.`);
          const {rate,monthlyFactor}=inputs;
          let afterReturn;
          if(asset.kind==='pf'||asset.kind==='ppf'){
            // Accumulate interest on each month's opening-of-month contributions and
            // planned flows, but do not compound or add it to the account balance
            // until the March financial-year close.
            pendingAnnualInterest.set(asset.name,pendingAnnualInterest.get(asset.name)+Math.max(0,preReturn)*Math.max(0,rate)/1200);
            const isFinancialYearEnd=month.slice(5,7)==='03';
            const interestCredit=isFinancialYearEnd?pendingAnnualInterest.get(asset.name):0;
            afterReturn=Math.max(0,preReturn)+interestCredit;
            if(isFinancialYearEnd)pendingAnnualInterest.set(asset.name,0);
            monthlyGrowth+=interestCredit;
          }else{
            afterReturn=Math.max(0,preReturn)*monthlyFactor;
            monthlyGrowth+=afterReturn-preReturn;
          }
          balances.set(asset.name,afterReturn);
          yearRow.contributions+=monthly;yearRow.additions+=additions;yearRow.withdrawals+=withdrawals;
        }
        yearRow.growth+=monthlyGrowth;
        yearRow.closing=[...balances.values()].reduce((sum,value)=>sum+value,0);
      }
      return {rows,ending:rows.at(-1)?.closing||0,totalContributions:rows.reduce((sum,row)=>sum+row.contributions,0),totalAdditions:rows.reduce((sum,row)=>sum+row.additions,0),totalWithdrawals:rows.reduce((sum,row)=>sum+row.withdrawals,0),totalGrowth:rows.reduce((sum,row)=>sum+row.growth,0)};
    }
    function projectionMonthEndDate(month){const [year,monthNumber]=month.split('-').map(Number);return `${year}-${String(monthNumber).padStart(2,'0')}-${String(new Date(year,monthNumber,0).getDate()).padStart(2,'0')}`;}
    function growthProjectionLineAtCursor(chart,cursor) {
      const area=chart.chartArea;if(!area||cursor.x<area.left||cursor.x>area.right||cursor.y<area.top||cursor.y>area.bottom)return null;
      let nearest=null;
      const bezier=(p0,p1,p2,p3,t)=>{const u=1-t;return u*u*u*p0+3*u*u*t*p1+3*u*t*t*p2+t*t*t*p3;};
      for(let datasetIndex=0;datasetIndex<chart.data.datasets.length;datasetIndex++){
        const meta=chart.getDatasetMeta(datasetIndex);if(meta.hidden)continue;
        const points=meta.data||[];
        for(let index=0;index<points.length-1;index++){
          const readPoint=element=>element.getProps?element.getProps(['x','y','skip','controlPointPreviousX','controlPointPreviousY','controlPointNextX','controlPointNextY','cp1x','cp1y','cp2x','cp2y'],true):element;
          const a=readPoint(points[index]),b=readPoint(points[index+1]);
          if(a.skip||b.skip||!Number.isFinite(a.x)||!Number.isFinite(a.y)||!Number.isFinite(b.x)||!Number.isFinite(b.y)||b.x<=a.x)continue;
          const c1x=Number.isFinite(a.controlPointNextX)?a.controlPointNextX:(Number.isFinite(a.cp2x)?a.cp2x:a.x+(b.x-a.x)/3);
          const c1y=Number.isFinite(a.controlPointNextY)?a.controlPointNextY:(Number.isFinite(a.cp2y)?a.cp2y:a.y+(b.y-a.y)/3);
          const c2x=Number.isFinite(b.controlPointPreviousX)?b.controlPointPreviousX:(Number.isFinite(b.cp1x)?b.cp1x:b.x-(b.x-a.x)/3);
          const c2y=Number.isFinite(b.controlPointPreviousY)?b.controlPointPreviousY:(Number.isFinite(b.cp1y)?b.cp1y:b.y-(b.y-a.y)/3);
          let best={distance:Infinity,t:0,x:a.x,y:a.y};
          const pointAt=t=>({x:bezier(a.x,c1x,c2x,b.x,t),y:bezier(a.y,c1y,c2y,b.y,t)});
          for(let sample=0;sample<=32;sample++){
            const t=sample/32,p=pointAt(t),distance=(p.x-cursor.x)**2+(p.y-cursor.y)**2;
            if(distance<best.distance)best={...p,distance,t};
          }
          let low=Math.max(0,best.t-1/32),high=Math.min(1,best.t+1/32);
          for(let iteration=0;iteration<10;iteration++){
            const left=low+(high-low)/3,right=high-(high-low)/3,lp=pointAt(left),rp=pointAt(right);
            const ld=(lp.x-cursor.x)**2+(lp.y-cursor.y)**2,rd=(rp.x-cursor.x)**2+(rp.y-cursor.y)**2;
            if(ld<rd)high=right;else low=left;
          }
          const t=(low+high)/2,p=pointAt(t),distance=(p.x-cursor.x)**2+(p.y-cursor.y)**2;
          if(distance<best.distance)best={...p,distance,t};
          if(!nearest||best.distance<nearest.distance){
            const ratio=Math.max(0,Math.min(1,(best.x-a.x)/(b.x-a.x)));
            nearest={distance:best.distance,x:best.x,y:best.y,datasetIndex,segmentIndex:index,ratio,value:chart.scales.y.getValueForPixel(best.y)};
          }
        }
      }
      return nearest&&nearest.distance<=20**2?nearest:null;
    }
    function bindGrowthProjectionCursorTooltip(chart) {
      if(growthProjectionHoverCleanup)growthProjectionHoverCleanup();
      const canvas=chart.canvas,wrap=document.getElementById('growthProjectionChartWrap'),tip=document.getElementById('growthProjectionCursorTooltip');
      if(!canvas||!wrap||!tip)return;
      const hide=()=>{tip.style.display='none';};
      const move=event=>{
        const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return hide();
        const scaleX=chart.width/rect.width,scaleY=chart.height/rect.height;
        const cursor={x:(event.clientX-rect.left)*scaleX,y:(event.clientY-rect.top)*scaleY};
        const found=growthProjectionLineAtCursor(chart,cursor);if(!found)return hide();
        const labels=chart.data.labels,from=labels[found.segmentIndex]||'',to=labels[found.segmentIndex+1]||'';
        const pct=Math.round(found.ratio*100),scenario=chart.data.datasets[found.datasetIndex].label;
        tip.innerHTML=`<strong>${analyticEscape(scenario)}</strong><span>${analyticEscape(from)} → ${analyticEscape(to)} · ${pct}% between years</span><b>${formatProjectionLakh(found.value)}</b>`;
        tip.style.display='block';
        const wrapRect=wrap.getBoundingClientRect(),left=event.clientX-wrapRect.left+14,top=event.clientY-wrapRect.top+14;
        tip.style.left=`${Math.max(6,Math.min(left,wrap.clientWidth-tip.offsetWidth-6))}px`;
        tip.style.top=`${Math.max(6,Math.min(top,wrap.clientHeight-tip.offsetHeight-6))}px`;
      };
      canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerleave',hide);
      growthProjectionHoverCleanup=()=>{canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerleave',hide);hide();};
    }
    function growthProjectionInputSnapshot(assets,current,gratuity,includeGratuity,result){
      const excluded=new Set(state.projectionSettings?.excludedMonthlyContributions||[]);
      if(excluded.has('PF'))excluded.add('EPS');
      const breakdown=new Map();
      if(state.projectionSettings?.includeMonthlyContributions!==false){
        for(const asset of assets){
          if(excluded.has(asset.name))continue;
          const amount=Number(asset.monthly)||0;if(amount<=0)continue;
          const label=['pf','eps'].includes(asset.kind)?'PF + EPS':asset.kind==='nps'?'NPS':asset.kind==='ppf'?'PPF':'Investments';
          breakdown.set(label,(breakdown.get(label)||0)+amount);
        }
      }
      return {current,monthly:[...breakdown.values()].reduce((sum,value)=>sum+value,0),breakdown:[...breakdown],contributions:result.totalContributions,gratuity:includeGratuity?gratuity:0};
    }
    function renderGrowthProjectionInputs(assets,current,gratuity,includeGratuity,result,years){
      const target=document.getElementById('growthProjectionInputs');if(!target)return;
      const data=growthProjectionInputSnapshot(assets,current,gratuity,includeGratuity,result);
      const row=(label,value)=>`<div class="projection-input-row"><dt>${analyticEscape(label)}</dt><dd>${formatCurrency(value)}</dd></div>`;
      const details=data.breakdown.map(([label,value])=>analyticEscape(label)+' '+formatCurrency(value)).join(' · ');
      target.innerHTML='<h3>Your projection inputs</h3><dl>'+row('Starting portfolio',data.current)+(includeGratuity?'<p class="projection-input-help">Includes gratuity shown below.</p>':'')+row('Monthly contributions',data.monthly)+(details?'<p class="projection-input-help">'+details+'</p>':'')+row('Contributions over '+years+' '+(years===1?'year':'years'),data.contributions)+'<p class="projection-input-help">Uses your selected contributions and annual increases.</p>'+row(includeGratuity?'Gratuity included':'Gratuity excluded',data.gratuity)+'</dl><p class="projection-input-note">Changing these settings affects projections only.</p>';
    }
    function renderGrowthProjection(options={}) {
      const yearsSelect=document.getElementById('growthProjectionYears');if(!yearsSelect)return;
      const years=Number(state.projectionSettings?.years)||5;yearsSelect.value=String(years);document.getElementById('growthProjectionYearsValue').textContent=`${years} ${years===1?'year':'years'}`;
      const pmsAsset=growthProjectionAssets().find(asset=>asset.name==='Stallion PMS');
      const pmsControl=document.getElementById('pmsOptimisticControl'),pmsSlider=document.getElementById('pmsOptimisticReturn');
      if(pmsControl&&pmsSlider){
        const rawRate=Number(pmsAsset?.returns.optimistic??15),currentRate=Number.isFinite(rawRate)?rawRate:15,minRate=8,maxRate=24;
        pmsControl.hidden=!pmsAsset;
        pmsSlider.min=String(minRate);pmsSlider.max=String(maxRate);pmsSlider.value=String(Math.min(maxRate,Math.max(minRate,currentRate)));
        document.getElementById('pmsOptimisticReturnValue').value=currentRate.toFixed(2).replace(/\.?0+$/,'');
        document.getElementById('pmsOptimisticMin').textContent=`${minRate}%`;document.getElementById('pmsOptimisticMax').textContent=`${maxRate}%`;
      }
      const includeMonthlyContributions=state.projectionSettings?.includeMonthlyContributions!==false;
      document.getElementById('growthIncludeMonthlyContributions').checked=includeMonthlyContributions;
      const assets=growthProjectionAssets();
      if(!options.preserveAssumptions)renderGrowthProjectionAssumptions(assets);
      renderGrowthContributionExclusions(assets,includeMonthlyContributions);renderGrowthAdjustmentRows(assets);
      const summary=document.getElementById('growthProjectionSummary'),body=document.getElementById('growthProjectionResultsBody');
      const visibleGratuity=profileRows(state.gratuityAccounts||[]),gratuityPresent=visibleGratuity.length>0,gratuityCurrent=visibleGratuity.reduce((sum,account)=>sum+estimateGratuity(account,localDateKey()).amount,0);
      const includeGratuityBalance=gratuityPresent&&state.projectionSettings?.includeGratuityBalance!==false;
      const gratuityToggle=document.getElementById('growthIncludeGratuityBalance'),gratuityToggleWrap=document.getElementById('growthGratuityBalanceWrap');
      if(gratuityToggle)gratuityToggle.checked=includeGratuityBalance;
      if(gratuityToggleWrap)gratuityToggleWrap.hidden=!gratuityPresent;
      const projectionAssets=includeGratuityBalance?[...assets,{name:'__GRATUITY_BENEFIT_INTERNAL__',current:gratuityCurrent,invested:gratuityCurrent,monthly:0,sourceMonthly:0,defaults:{stress:0,base:0,optimistic:0},returns:{stress:0,base:0,optimistic:0},kind:'gratuity'}]:assets;
      const investmentCurrent=assets.reduce((sum,asset)=>sum+asset.current,0),current=projectionAssets.reduce((sum,asset)=>sum+asset.current,0);
      const inputSummary=document.getElementById('growthProjectionInputs');if(inputSummary)inputSummary.textContent='';
      let projections,investmentProjections;
      try{
        projections=Object.fromEntries(['stress','base','optimistic'].map(scenario=>[scenario,runGrowthProjection(projectionAssets,years,scenario)]));
        investmentProjections=includeGratuityBalance?Object.fromEntries(['stress','base','optimistic'].map(scenario=>[scenario,runGrowthProjection(assets,years,scenario)])):projections;
      }
      catch(error){summary.innerHTML=`<div class="panel"><strong>Projection needs attention</strong><p>${analyticEscape(error.message)}</p></div>`;body.innerHTML='<tr><td colspan="11" class="text-muted">Adjust the planned withdrawal before viewing projected values.</td></tr>';document.getElementById('growthProjectionTakeaway').textContent='';if(growthProjectionHoverCleanup){growthProjectionHoverCleanup();growthProjectionHoverCleanup=null;}if(growthProjectionChartInstance){growthProjectionChartInstance.destroy();growthProjectionChartInstance=null;}return;}
      renderGrowthProjectionInputs(assets,current,gratuityCurrent,includeGratuityBalance,projections.base,years);
      const style=getComputedStyle(document.documentElement);
      const colors=Object.fromEntries(['stress','base','optimistic'].map(s=>[s,style.getPropertyValue('--projection-'+s).trim()||({stress:'#e89497',base:'#38bdf8',optimistic:'#34d399'})[s]]));
      const labels={stress:'Stress',base:'Base',optimistic:'Optimistic'};
      summary.setAttribute('role','group');summary.setAttribute('aria-label',years+' year scenario comparison');
      const selectedScenario=['stress','base','optimistic'].includes(summary.dataset.scenario)?summary.dataset.scenario:'base';
      summary.innerHTML='<h3 class="growth-scenario-heading">'+years+'-year scenario comparison</h3>'+['stress','base','optimistic'].map(scenario=>`<button type="button" data-projection-scenario="${scenario}" class="stat-card growth-projection-stat-card growth-projection-stat-card-${scenario}" aria-pressed="${scenario===selectedScenario}"><span class="stat-label">${labels[scenario]}</span><strong class="stat-value">${formatProjectionLakh(projections[scenario].ending)}</strong></button>`).join('');

      const chartWrap=document.getElementById('growthProjectionChartWrap');
      if(chartWrap)chartWrap.after(summary);
      summary.insertAdjacentHTML('beforeend','<p class="growth-scenario-help">Tap a scenario for exact values and its yearly breakdown.</p><div id="growthScenarioDetails" class="growth-scenario-details" role="status" aria-live="polite"></div>');
      function showScenarioDetails(scenario){
        const result=projections[scenario],details=document.getElementById('growthScenarioDetails');
        const metrics=[['Projected value',result.ending],['Monthly contributions',result.totalContributions],['Projected growth',result.totalGrowth],...(result.totalAdditions?[['Planned additions',result.totalAdditions]]:[]),...(result.totalWithdrawals?[['Withdrawals',result.totalWithdrawals]]:[])];
        details.innerHTML='<strong>'+labels[scenario]+' · '+years+'-year projection</strong><dl>'+metrics.map(([label,value])=>'<div><dt>'+label+'</dt><dd>'+formatCurrency(value)+'</dd></div>').join('')+'</dl>';
        summary.querySelectorAll('[data-projection-scenario]').forEach(button=>button.dataset.preview=String(button.dataset.projectionScenario===scenario));
        if(growthProjectionChartInstance){
          growthProjectionChartInstance.data.datasets.forEach((dataset,index)=>{const active=['stress','base','optimistic'][index]===scenario;dataset.borderWidth=active?4:2;dataset.pointRadius=active?4:2;});
          growthProjectionChartInstance.update('none');
        }
      }
      const baseRows=projections.base.rows;

      const todayLabel=`Today · ${new Date().toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}`;
      const labelsForChart=[todayLabel,...baseRows.map(row=>financialYearLabel(row.fyStart))];
      const chartData={labels:labelsForChart,datasets:['stress','base','optimistic'].map(scenario=>({label:labels[scenario],data:[Math.round(current),...projections[scenario].rows.map(row=>Math.round(row.closing))],borderColor:colors[scenario],backgroundColor:context=>{const a=context.chart.chartArea;if(!a||scenario==='stress')return 'transparent';const g=context.chart.ctx.createLinearGradient(0,a.top,0,a.bottom);g.addColorStop(0,scenario==='base'?'rgba(56,189,248,.24)':'rgba(52,211,153,.20)');g.addColorStop(1,'rgba(0,0,0,0)');return g;},borderDash:scenario==='stress'?[6,5]:[],borderWidth:scenario==='base'?3:2.5,pointRadius:3,pointHoverRadius:7,pointHitRadius:18,tension:.35,fill:scenario==='stress'?false:'origin'}))};
      if(typeof Chart==='undefined')requestChartLibrary(()=>renderGrowthProjection({preserveAssumptions:true}));
      if(typeof Chart!=='undefined'){
        if(growthProjectionChartInstance)growthProjectionChartInstance.destroy();
        growthProjectionChartInstance=new Chart(document.getElementById('growthProjectionChart'),{type:'line',data:chartData,options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'nearest',intersect:false,axis:'xy'},plugins:{legend:{position:'top',labels:{color:style.getPropertyValue('--text-light').trim()||'#9ca3af',usePointStyle:true,pointStyle:'line',padding:20,font:{size:12}}},analyticLabels:{display:false},tooltip:{enabled:false}},scales:{x:{title:{display:false},ticks:{color:style.getPropertyValue('--text-light').trim()||'#9ca3af',maxRotation:0,autoSkip:true,maxTicksLimit:4,callback:(value,index)=>index===0?'Today':labelsForChart[value]},grid:{color:'rgba(94,234,212,.10)',borderDash:[3,6],drawBorder:false}},y:{beginAtZero:true,suggestedMax:Math.max(100000,...chartData.datasets.flatMap(d=>d.data)),title:{display:false},ticks:{color:style.getPropertyValue('--text-light').trim()||'#9ca3af',maxTicksLimit:5,callback:value=>formatProjectionLakh(value)},grid:{color:'rgba(94,234,212,.10)',borderDash:[5,6],drawBorder:false}}}}});
        bindGrowthProjectionCursorTooltip(growthProjectionChartInstance);
      }
      function renderScenarioBreakdown(scenario){
      showScenarioDetails(scenario);
      summary.dataset.scenario=scenario;summary.querySelectorAll('[data-projection-scenario]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.projectionScenario===scenario)));
      const takeaway=document.getElementById('growthProjectionTakeaway'),base=projections[scenario];
      const table=document.getElementById('growthProjectionResultsTable');
      table.querySelector('thead').innerHTML=`<tr><th>Financial year</th><th class="text-right">Opening value</th><th class="text-right">Contributions &amp; changes</th><th class="text-right">${labels[scenario]} growth</th><th class="text-right">${labels[scenario]} closing value</th><th class="text-right">Growth / opening</th></tr>`;
      const amountCell=(value,description='')=>{const n=Number(value)||0,compact=`${n<0?'−':''}₹${(Math.abs(n)/100000).toFixed(2)}L`,exact=analyticEscape(description||formatCurrency(n));return `<td class="text-right" title="${exact}" aria-label="${exact}">${compact}</td>`;};
      body.innerHTML=base.rows.map(row=>{const net=row.contributions+row.additions-row.withdrawals,detail=`Net ${formatCurrency(net)}; contributions ${formatCurrency(row.contributions)}, additions ${formatCurrency(row.additions)}, withdrawals ${formatCurrency(row.withdrawals)}`,ratio=row.opening>0?`${(row.growth/row.opening*100).toFixed(1)}%`:'—';return `<tr><td>${financialYearLabel(row.fyStart)}</td>${amountCell(row.opening)}${amountCell(net,detail)}${amountCell(row.growth)}${amountCell(row.closing)}<td class="text-right" title="Growth divided by opening value; not an annualised investment return">${ratio}</td></tr>`;}).join('');
      const flowItems=[
        {label:'Starting value',value:investmentCurrent,operator:''},
        ...(includeGratuityBalance?[{label:'Gratuity balance',value:gratuityCurrent,operator:'+'}]:[]),
        {label:'Monthly contributions',value:base.totalContributions,operator:'+'},
        ...(base.totalAdditions>0?[{label:'Planned additions',value:base.totalAdditions,operator:'+'}]:[]),
        ...(base.totalWithdrawals>0?[{label:'Withdrawals',value:base.totalWithdrawals,operator:'−'}]:[]),
        {label:'Investment growth',value:investmentProjections[scenario].totalGrowth,operator:'+'},
        ...(includeGratuityBalance?[{label:'Gratuity growth',value:base.totalGrowth-investmentProjections[scenario].totalGrowth,operator:'+'}]:[])
      ];
      const gratuityBreakdownNote=gratuityPresent?(includeGratuityBalance?' Gratuity is estimated separately and is not included in Investment Portfolio balances; its balance and growth are included only in this projection.':' Gratuity balance and projected gratuity growth are excluded from this projection. Gratuity remains separate from Investment Portfolio balances.'):'';
      const breakdownParts=[`starting value ${formatCurrency(investmentCurrent)}`,...(includeGratuityBalance?[`gratuity balance ${formatCurrency(gratuityCurrent)}`]:[]),`monthly contributions ${formatCurrency(base.totalContributions)}`,`planned additions ${formatCurrency(base.totalAdditions)}`,`withdrawals ${formatCurrency(base.totalWithdrawals)}`,`investment growth ${formatCurrency(investmentProjections[scenario].totalGrowth)}`,...(includeGratuityBalance?[`gratuity growth ${formatCurrency(base.totalGrowth-investmentProjections[scenario].totalGrowth)}`]:[])];
      const breakdownLabel=`${labels[scenario]} projection: ${breakdownParts.join(', ')}, projected value ${formatCurrency(base.ending)}.`;
      takeaway.setAttribute('aria-label',breakdownLabel);
      takeaway.innerHTML=flowItems.map(item=>`<span class="growth-takeaway-item" data-operator="${item.operator||''}"><span class="growth-takeaway-label">${item.label}</span><span class="growth-takeaway-value">${formatProjectionLakh(item.value)}</span></span>`).join('')+`<span class="growth-takeaway-item is-projected" data-operator="="><span class="growth-takeaway-label">Projected value</span><span class="growth-takeaway-value">${formatProjectionLakh(base.ending)}</span></span><span class="growth-takeaway-note">Breakdown uses ${labels[scenario]} scenario values.${gratuityBreakdownNote}</span>`;
      }
      summary.querySelectorAll('[data-projection-scenario]').forEach(button=>{
        button.setAttribute('aria-controls','growthScenarioDetails growthProjectionResultsTable');
        button.onclick=()=>renderScenarioBreakdown(button.dataset.projectionScenario);
        button.onpointerenter=event=>{if(event.pointerType==='mouse')showScenarioDetails(button.dataset.projectionScenario);};
        button.onfocus=()=>showScenarioDetails(button.dataset.projectionScenario);
      });
      summary.onpointerleave=()=>showScenarioDetails(summary.dataset.scenario||selectedScenario);
      summary.onfocusout=event=>{if(!summary.contains(event.relatedTarget))showScenarioDetails(summary.dataset.scenario||selectedScenario);};
      renderScenarioBreakdown(selectedScenario);
    }
    const contributionDialog=document.getElementById('growthContributionDialog');
    document.getElementById('manageGrowthContributions').addEventListener('click',()=>{contributionDialog.showModal();contributionDialog.querySelector('[data-close-contribution-dialog]').focus();});
    contributionDialog.querySelectorAll('[data-close-contribution-dialog]').forEach(button=>button.addEventListener('click',()=>contributionDialog.close()));
    contributionDialog.addEventListener('close',()=>document.getElementById('manageGrowthContributions').focus({preventScroll:true}));
    document.getElementById('growthContributionExclusions').addEventListener('change',event=>{
      const toggle=event.target.closest('.growth-monthly-exclude-toggle');if(!toggle)return;
      const asset=toggle.dataset.asset;if(!asset)return;
      state.projectionSettings=state.projectionSettings||{years:5,includeMonthlyContributions:true,excludedMonthlyContributions:[],monthlyContributions:{},returns:{}};
      state.projectionSettings.excludedMonthlyContributions=state.projectionSettings.excludedMonthlyContributions||[];
      state.projectionSettings.excludedMonthlyContributions=toggle.checked?state.projectionSettings.excludedMonthlyContributions.filter(name=>name!==asset):[...new Set([...state.projectionSettings.excludedMonthlyContributions,asset])];
      saveData();renderGrowthProjection();
      contributionDialog.querySelector('.growth-monthly-exclude-toggle[data-asset="'+CSS.escape(asset)+'"]')?.focus({preventScroll:true});
    });
    const growthAssumptionTiles=document.getElementById('growthProjectionAssumptionTiles');
    matchMedia('(min-width:1100px)').addEventListener('change',()=>renderGrowthProjection({preserveAssumptions:true}));
    growthAssumptionTiles.addEventListener('click',event=>{
      if(event.target.closest('#addGrowthAdjustmentBtn')){addGrowthAdjustmentFromTile();return;}
      if(handleGrowthAdjustmentRowAction(event))return;
      if(!event.target.closest('[data-growth-assumption-tile]'))collapseGrowthAssumptionAsset();
    });
    document.addEventListener('click',event=>{
      if(!expandedGrowthAssumptionAsset||event.target.closest('#growthProjectionAssumptionTiles,#recordEditorDialog,.investment-edit-modal'))return;
      collapseGrowthAssumptionAsset();
    });
    growthAssumptionTiles.addEventListener('change',event=>{
      const slider=event.target.closest('.growth-assumption-slider');
      if(slider){saveData();renderGrowthProjection();return;}
      const input=event.target.closest('.growth-projection-input');if(!input)return;
      const asset=input.dataset.asset,field=input.dataset.field,raw=input.value.trim();
      const value=Number(raw);
      if(field==='monthly'){
        const sourceAsset=growthProjectionAssets().find(item=>item.name===asset);
        if(!asset||!sourceAsset||sourceAsset.sourceMonthly>0||!Number.isFinite(value)||value<0||value>1000000000000){alert('Enter a valid projection-only monthly contribution.');renderGrowthProjection();return;}
        state.projectionSettings=state.projectionSettings||{years:5,includeMonthlyContributions:true,excludedMonthlyContributions:[],monthlyContributions:{},returns:{}};
        state.projectionSettings.monthlyContributions=state.projectionSettings.monthlyContributions||{};
        state.projectionSettings.monthlyContributions[asset]=value;
        saveData();renderGrowthProjection();return;
      }
      if(field==='stepUp'){
        if(!asset||!Number.isFinite(value)||value<0||value>100){alert('Enter an annual step-up from 0% to 100%.');renderGrowthProjection();return;}
        state.projectionSettings=state.projectionSettings||{years:5,includeMonthlyContributions:true,annualStepUpPercentByAsset:{},monthlyContributions:{},returns:{}};
        state.projectionSettings.annualStepUpPercentByAsset=state.projectionSettings.annualStepUpPercentByAsset||{};
        state.projectionSettings.annualStepUpPercentByAsset[asset]=value;
        saveData();renderGrowthProjection();return;
      }
      if(field==='fixedRate'){
        if(!asset||!Number.isFinite(value)||value<-100||value>100){alert('Enter a valid fixed interest rate or ROI between -100% and 100%.');renderGrowthProjection();return;}
        state.projectionSettings=state.projectionSettings||{years:5,includeMonthlyContributions:true,monthlyContributions:{},returns:{}};
        state.projectionSettings.returns=state.projectionSettings.returns||{};state.projectionSettings.returns[asset]={...(state.projectionSettings.returns[asset]||{}),stress:value,base:value,optimistic:value};
        saveData();renderGrowthProjection();return;
      }
      if(!asset||!Number.isFinite(value)||value<-100||value>100){alert('Enter a valid return assumption between -100% and 100%.');renderGrowthProjection();return;}
      state.projectionSettings=state.projectionSettings||{years:5,includeMonthlyContributions:true,monthlyContributions:{},returns:{}};
      state.projectionSettings.returns[asset]=state.projectionSettings.returns[asset]||{};state.projectionSettings.returns[asset][field]=value;
      saveData();renderGrowthProjection();
    });
    document.getElementById('pmsOptimisticReturn').addEventListener('input',event=>{
      const slider=event.currentTarget,value=Number(slider.value);if(!Number.isFinite(value))return;
      state.projectionSettings=state.projectionSettings||{years:5,includeMonthlyContributions:true,monthlyContributions:{},returns:{}};
      state.projectionSettings.returns=state.projectionSettings.returns||{};state.projectionSettings.returns['Stallion PMS']=state.projectionSettings.returns['Stallion PMS']||{};state.projectionSettings.returns['Stallion PMS'].optimistic=value;
      document.getElementById('pmsOptimisticReturnValue').value=value.toFixed(2).replace(/\.?0+$/,'');
      const tile=document.querySelector('[data-growth-assumption-tile="Stallion PMS"]');
      const summary=tile?.querySelector('.growth-assumption-return-optimistic strong');if(summary)summary.textContent=`${value.toFixed(2)}%`;
      const assumptionSlider=tile?.querySelector('.growth-assumption-slider[data-field="optimistic"]');if(assumptionSlider)assumptionSlider.value=String(value);
      const manual=[...(tile?.querySelectorAll('.growth-projection-input')||[])].find(input=>input.dataset.field==='optimistic');if(manual)manual.value=String(value.toFixed(2).replace(/\.?0+$/,''));
      const output=tile?.querySelector('.growth-assumption-scenario-row-optimistic [data-slider-value]');if(output)output.textContent=`${value.toFixed(2).replace(/\.?0+$/,'')}%`;
      renderGrowthProjection({preserveAssumptions:true});
    });
    document.getElementById('pmsOptimisticReturn').addEventListener('change',()=>{saveData();renderGrowthProjection();});
    document.getElementById('pmsOptimisticReturnValue').addEventListener('change',event=>{
      const value=Number(event.currentTarget.value);
      if(!Number.isFinite(value)||value<-100||value>100){alert('Enter a custom return from -100% to 100%.');renderGrowthProjection();return;}
      state.projectionSettings=state.projectionSettings||{years:5,includeMonthlyContributions:true,monthlyContributions:{},returns:{}};state.projectionSettings.returns=state.projectionSettings.returns||{};state.projectionSettings.returns['Stallion PMS']=state.projectionSettings.returns['Stallion PMS']||{};state.projectionSettings.returns['Stallion PMS'].optimistic=value;saveData();renderGrowthProjection({preserveAssumptions:true});
      const summary=document.querySelector('[data-growth-assumption-tile="Stallion PMS"] .growth-assumption-return-optimistic strong');if(summary)summary.textContent=`${value}%`;
    });
    document.getElementById('growthProjectionYears').addEventListener('input',event=>{const value=Number(event.target.value);document.getElementById('growthProjectionYearsValue').textContent=`${value} ${value===1?'year':'years'}`;});
    document.getElementById('growthProjectionYears').addEventListener('change',event=>{state.projectionSettings.years=Number(event.target.value);saveData();renderGrowthProjection();});
    document.getElementById('growthIncludeMonthlyContributions').addEventListener('change',event=>{state.projectionSettings=state.projectionSettings||{years:5,monthlyContributions:{},returns:{}};state.projectionSettings.includeMonthlyContributions=event.target.checked;saveData();renderGrowthProjection();});
    document.getElementById('growthIncludeGratuityBalance').addEventListener('change',event=>{state.projectionSettings=state.projectionSettings||{years:5,monthlyContributions:{},returns:{}};state.projectionSettings.includeGratuityBalance=event.target.checked;saveData();renderGrowthProjection();});

    // EXPORT/IMPORT
    function backupIdentity(){return {exportedAt:new Date().toISOString(),appVersion:window.PFT_APP_INFO.version,ownerUid:window.financeCloud.ownerUid,ownerEmail:window.financeCloud.ownerEmail||window.financeCloud.email,exportedBy:window.financeCloud.email};}
    function makeDeviceRecoveryBackup(){return {...state,backupFormat:'finance-tracker',backupVersion:1,backupKind:'device-recovery',reviewMetadata:window.financeReviews?{format:1,values:window.financeReviews.export()}:null,backupMetadata:backupIdentity()};}
    async function buildTrackerBackup(){
      await saveQueue;
      const revision=storageRevision,data=validateBackup(JSON.parse(JSON.stringify(state))),auditLog=await readChangeLog(Infinity,0);
      if(!window.financeReviews)throw Error('Shared reviews are still opening. Try again in a moment.');
      const reviewMetadata=await window.financeReviews.backup(),stored=await readStoredFinance();
      if(storageRevision!==revision||(stored?.revision||0)!==revision||pendingSaves)throw Error('Records changed while preparing the backup. Try exporting again.');
      return {...data,backupFormat:'finance-tracker',backupVersion:1,backupKind:'complete',auditLog,reviewMetadata,backupMetadata:backupIdentity()};
    }
    document.getElementById('exportBtn').addEventListener('click', async () => {
      try{
        const exportData=await buildTrackerBackup(),blob=new Blob([JSON.stringify(exportData,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
        a.href=url;a.download=`family-wealth-${localDateKey()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);recordBackupExport();
      }catch(error){showImportStatus('Backup could not be exported: '+error.message,true);}
    });

    document.getElementById('openImportBtn').addEventListener('click', () => {
      document.getElementById('importBtn').click();
    });

    function showImportStatus(message, error = false) {
      const el = document.getElementById('importStatus');
      el.textContent = message; el.style.display = 'block';
      el.style.borderColor = error ? 'var(--danger)' : 'var(--primary)';
    }
    let allViewsRefreshPending = false;
    let allViewsRefreshInProgress = false;
    const startupPendingPages=new Set();
    let startupRenderReady=false;
    function renderStartupPage(page){
      if(!startupRenderReady||!startupPendingPages.has(page))return;
      if(page==='dashboard')updateDashboard();
      else if(page==='income-expenses'){renderIncome();renderExpenses();renderBalanceHistory();}
      else if(page==='investments'){renderInvestments();renderNps();renderPpf();renderPf();renderStallionContributions();}
      else if(page==='debts')renderDebts();
      else if(page==='settings'){renderCustomValuesPanel();renderRecordTools();renderBackupCare();renderRecovery();}
      startupPendingPages.delete(page);
    }
    function warmStartupPages(){
      // Hidden pages stay dirty and render on first navigation instead of competing with input.
    }
    function refreshVisiblePageViews() {
      if(!startupRenderReady)return;
      for(const page of ['dashboard','income-expenses','investments','debts','settings'])startupPendingPages.add(page);
      populateCustomValueSelects();recurringUI?.render();
      if(!isCombinedFamilyProfile()&&!profileMemberNames().includes(activeFamilyProfile)){activeFamilyProfile='__combined__';try{trackerStorage.setItem(FAMILY_PROFILE_STORAGE_KEY,activeFamilyProfile);}catch(error){}}
      renderFamilyProfileMenu();syncFamilyProfileButtons();populateStallionDropdowns();populateLoanDropdown();
      const page=document.querySelector('.nav-tab.active')?.dataset.tab||'dashboard';
      renderStartupPage(page);
      if(page==='analytics')updateDashboard();
      else if(page==='growth-projection')renderGrowthProjection();
      else if(page==='reports'){populateReportFinancialYears();if(document.getElementById('reportStartDate')?.value)renderRangeReport();}
    }
    function refreshAllPageViews() {
      startupPendingPages.clear();
      populateCustomValueSelects();recurringUI?.render();
      if(!isCombinedFamilyProfile()&&!profileMemberNames().includes(activeFamilyProfile)){activeFamilyProfile='__combined__';try{trackerStorage.setItem(FAMILY_PROFILE_STORAGE_KEY,activeFamilyProfile);}catch(error){}}
      renderFamilyProfileMenu();syncFamilyProfileButtons();
      renderCustomValuesPanel(); renderRecordTools();
      populateReportFinancialYears();
      renderDebts(); renderIncome(); renderExpenses(); renderInvestments();
      renderNps(); renderPpf(); renderPf(); renderStallionContributions();
      populateStallionDropdowns(); populateLoanDropdown(); renderBalanceHistory(); updateDashboard();
      if(document.getElementById('growth-projection')?.classList.contains('active'))renderGrowthProjection();
    }
    function scheduleAllViewsRefresh() {
      if(allViewsRefreshPending||allViewsRefreshInProgress)return;
      allViewsRefreshPending=true;
      const refresh=()=>{
        allViewsRefreshPending=false;
        if(allViewsRefreshInProgress)return;
        allViewsRefreshInProgress=true;
        try{refreshVisiblePageViews();}
        catch(error){console.error('Background page refresh failed:',error);}
        finally{allViewsRefreshInProgress=false;}
      };
      if(typeof window.requestIdleCallback==='function')window.requestIdleCallback(refresh,{timeout:750});
      else window.setTimeout(refresh,0);
    }
    function refreshImportedData() {
      syncStallionPmsFromInvestments();
      refreshAllPageViews();
    }
    function openDashboardAfterImport() {
      closeSettingsTile();
      document.querySelector('.nav-tab[data-tab="dashboard"]').click();
      window.scrollTo({top:0,behavior:'instant'});
    }
    document.getElementById('importBtn').addEventListener('change', async (e) => {
      const file = e.target.files[0]; if (!file) return;
      if(dataOperationBusy)return;dataOperationBusy=true;document.querySelector('.container').inert=true;
      showImportStatus('Reading backup…');
      await saveQueue;
      const original=JSON.parse(JSON.stringify(state)),originalDirty=persistenceDirty,originalLoadFailed=storageLoadFailed;let imported=false;
      try {
        const text = await file.text();
        const parsed=JSON.parse(text.replace(/^\uFEFF/, ''));
        if(parsed.backupFormat!=='finance-tracker'||parsed.backupVersion!==1||parsed.schemaVersion!==2||!['complete','device-recovery'].includes(parsed.backupKind)||!Object.hasOwn(parsed,'reviewMetadata')||(parsed.backupKind==='complete'&&parsed.reviewMetadata===null))throw Error('Use a current complete backup exported from this app.');
        const data=validateBackup(parsed);
        if(!window.financeReviews)throw Error('Shared review backup support is still opening. Try again.');
        const reviews=parsed.backupKind==='device-recovery'&&parsed.reviewMetadata===null?null:window.financeReviews.parseBackup(parsed.reviewMetadata);
        if(typeof window.previewTrackerImport!=='function')throw new Error('Backup preview is unavailable. Reconnect and reload this version');
        if(!await window.previewTrackerImport(data,file.name,parsed.backupMetadata,reviews)){showImportStatus('Import cancelled. Current records were kept.');return;}
        const reviewRestore=reviews===null?false:await window.financeReviews.prepareRestore(reviews);
        state = data;
        
        try { refreshImportedData(); } catch (error) { state = original; refreshImportedData(); throw error; }
        storageLoadFailed = false;
        const persisted = await saveData('Imported backup',parsed.auditLog||null,reviewRestore);
        if(!persisted){state=original;lastAccepted=JSON.parse(JSON.stringify(original));persistenceDirty=originalDirty;storageLoadFailed=originalLoadFailed;refreshImportedData();syncStatus();throw new Error('Import was not saved');}
        imported=true;
        await renderRecovery();
        showImportStatus(`Loaded ${file.name}: ${state.income.length} income records, ${state.expenses.length} expenses, ${state.investments.length} investments, ${state.debts.length} debts and ${state.monthlyBalances.length} monthly balances.${reviewRestore?' Shared reviews restored on this device; records and reviews will publish together when sync completes.':''}${persisted ? ' Saved successfully.' : ' Loaded for this session, but browser storage is unavailable. Export a backup before closing.'}`);
        openDashboardAfterImport();
      } catch (error) {
        showImportStatus(imported?'Backup records were saved, but the page could not finish updating: '+error.message+'. Reload to view the saved records.':'Backup was not loaded: '+error.message+'. Existing records were kept.',true);
      } finally { window.financeReviews?.cancelRestore();e.target.value = '';dataOperationBusy=false;document.querySelector('.container').inert=false; }
    });

    function updateClearControls(){
      const button=document.getElementById('clearBtn'),owner=document.getElementById('clearTrackerOwner'),phrase=document.getElementById('clearTrackerPhrase');if(!button||!phrase)return;
      const own=window.financeCloud?.canManage===true&&window.financeCloud?.role==='owner';
      if(owner)owner.textContent=window.financeCloud?.ownerEmail||window.financeCloud?.email||'the signed-in owner';
      button.disabled=!own||!navigator.onLine||phrase.value!=='DELETE DASHBOARD'||dataOperationBusy;
      document.getElementById('clearBackupBtn').disabled=!own||dataOperationBusy;
    }
    document.getElementById('clearTrackerPhrase').addEventListener('input',updateClearControls);
    document.getElementById('clearTrackerSection').addEventListener('toggle',updateClearControls);
    window.addEventListener('online',updateClearControls);window.addEventListener('offline',updateClearControls);
    document.getElementById('clearBackupBtn').addEventListener('click',()=>document.getElementById('exportBtn').click());
    document.getElementById('clearBtn').addEventListener('click', async () => {
      const status=document.getElementById('clearTrackerStatus'),phrase=document.getElementById('clearTrackerPhrase');
      if(dataOperationBusy)return;
      if(window.financeCloud?.canManage!==true||window.financeCloud?.role!=='owner'){status.textContent='Only the tracker owner can clear data.';return;}
      if(!navigator.onLine){status.textContent='Connect to the internet before clearing data. Nothing has been cleared.';return;}
      if(phrase.value!=='DELETE DASHBOARD'){status.textContent='Type DELETE DASHBOARD to confirm.';return;}
      dataOperationBusy=true;updateClearControls();phrase.disabled=true;
      const dialog=document.getElementById('settingsTileDialog');dialog.dataset.deleting='true';document.getElementById('settingsTileClose').disabled=true;
      let cloudCleared=false,clearOwnsSync=false;
      document.getElementById('settingsTileContent').inert=true;
      try{
        await saveQueue;
        await withFinanceWriteLock(async()=>{
        if(syncBusy||syncRecord?.pending||persistenceDirty)throw new Error('Wait for all changes to finish syncing, then try again. Nothing has been cleared.');
        const latestLocal=await readStoredFinance();
        if((latestLocal?.revision||0)!==storageRevision)throw new Error('Records changed in another tracker window. Reload and review them before clearing. Nothing has been cleared.');
        if(await readPendingCloudSync())throw new Error('Another tracker window has changes waiting to sync. Nothing has been cleared.');
        if(!navigator.onLine)throw new Error('Connect to the internet before clearing data. Nothing has been cleared.');
        status.textContent='Clearing cloud records… Keep this page open.';
        syncBusy=true;clearOwnsSync=true;
        const empty=createEmptyState();empty.lastUpdate=new Date().toLocaleString();
        const envelope={data:validateBackup(empty),recovery:null,mutationId:crypto.randomUUID()};
        window.financeCloud.resume(syncRecord?.baseRevision||window.financeCloud.revision());
        const revision=await window.financeCloud.save(envelope,{clearHistory:true});
        cloudCleared=true;
        state=envelope.data;syncRecord={baseRevision:revision,pending:false,lastCloudUpdated:window.financeCloud.updatedAt?.()||new Date().toISOString(),envelope};
        cloudRecovery=null;cloudCommittedState=JSON.parse(JSON.stringify(state));lastAccepted=JSON.parse(JSON.stringify(state));
        await commitFinance(state,'Clear all data',null,true);
        persistenceDirty=false;storageLoadFailed=false;phrase.value='';
        refreshImportedData();await renderRecovery();syncStatus();document.getElementById('lastUpdate').textContent=state.lastUpdate;
        status.textContent='Local and cloud tracker data cleared. Your login and family access are unchanged.';
        });
      }catch(error){
        status.textContent=cloudCleared?'Cloud data was cleared, but this device could not finish updating. Reload to load the empty cloud tracker.':error.message;
        if(cloudCleared){storageLoadFailed=true;window.financeCloud.lock(new Error(status.textContent));}
      }finally{
        if(clearOwnsSync)syncBusy=false;dataOperationBusy=false;document.getElementById('settingsTileContent').inert=false;phrase.disabled=false;delete dialog.dataset.deleting;document.getElementById('settingsTileClose').disabled=false;updateClearControls();
      }
    });

    // Load Test Data


    // Function to populate loan dropdown
    function populateLoanDropdown() {
      const loanSelect = document.getElementById('expenseLoan');
      const previous=loanSelect.value;
      loanSelect.innerHTML = '<option value="">-- Select Debt --</option>';
      state.debts.forEach(debt => {
        loanSelect.innerHTML += `<option value="${debt.id}">${analyticEscape(debt.type)} - Remaining: ${formatCurrency(debt.remaining)}</option>`;
      });
      if(Array.from(loanSelect.options).some(option=>option.value===previous))loanSelect.value=previous;
    }

    function setupInvestmentEntryPanels() {
      const placements=[['pfAddPanel','retirementAccountPanels'],['npsAddPanel','retirementAccountPanels'],['ppfAddPanel','retirementAccountPanels'],['otherInvestmentAddPanel','investmentListPanel'],['stallionProfitAddPanel','investmentListPanel']];
      placements.forEach(([entryId,targetId])=>{const entry=document.getElementById(entryId),target=document.getElementById(targetId);if(entry&&target)target.appendChild(entry);});
      document.querySelectorAll('[data-open-entry]').forEach(button=>button.addEventListener('click',()=>toggleInvestmentEntry(button.dataset.openEntry,button)));
      document.addEventListener('click',event=>{
        // Investment details use a modal, so category cards do not reorder or collapse the page.
        if(!event.target.closest('.retirement-account-card')&&!event.target.closest('#retirementAccountPanels > .investment-add-section')&&!event.target.closest('.investment-edit-modal'))document.querySelectorAll('#retirementAccountPanels .retirement-account-details[open]').forEach(details=>{details.open=false;details.closest('.retirement-account-card')?.classList.remove('is-expanded');});
      });
      document.getElementById('retirementAccountPanels')?.addEventListener('click',event=>{
        const gratuityAdd=event.target.closest('[data-add-gratuity]');
        if(gratuityAdd){openGratuityModal();return;}
        const button=event.target.closest('[data-open-entry="ppfAddPanel"]');
        if(button){toggleInvestmentEntry('ppfAddPanel',button);return;}
        const card=event.target.closest('.retirement-account-card');
        if(!card||event.target.closest('button,a,input,select,textarea,.table-wrapper'))return;
        const summary=event.target.closest('summary.retirement-account-summary');
        if(summary)event.preventDefault();
        renderRetirementCategoryDialog(card.dataset.retirementType,true);
      });
      document.getElementById('retirementAccountPanels')?.addEventListener('keydown',event=>{
        const summary=event.target.closest('summary.retirement-account-summary');
        if(summary&&(event.key==='Enter'||event.key===' ')){event.preventDefault();const card=summary.closest('.retirement-account-card');if(card)renderRetirementCategoryDialog(card.dataset.retirementType,true);}
      });
      setupRetirementAccountDetails();
      document.querySelectorAll('[data-close-entry]').forEach(button=>button.addEventListener('click',()=>closeInvestmentEntry(button.dataset.closeEntry)));
      const retirementAddButton=document.getElementById('retirementAddBtn'),retirementAddMenu=document.getElementById('retirementAddMenu');
      retirementAddButton?.addEventListener('click',event=>{event.stopPropagation();const opening=retirementAddMenu.hidden;retirementAddMenu.hidden=!opening;retirementAddButton.setAttribute('aria-expanded',String(opening));});
      retirementAddMenu?.addEventListener('click',event=>{const choice=event.target.closest('[data-retirement-add]');if(!choice)return;retirementAddMenu.hidden=true;retirementAddButton?.setAttribute('aria-expanded','false');const type=choice.dataset.retirementAdd;if(type==='gratuity'){openGratuityModal();return;}const panelId={pf:'pfAddPanel',ppf:'ppfAddPanel',nps:'npsAddPanel'}[type];if(panelId)toggleInvestmentEntry(panelId,null);});
      document.addEventListener('click',event=>{if(!event.target.closest('.retirement-add-menu-wrap')){if(retirementAddMenu)retirementAddMenu.hidden=true;retirementAddButton?.setAttribute('aria-expanded','false');}});
      retirementAddMenu?.addEventListener('keydown',event=>{if(event.key==='Escape'){retirementAddMenu.hidden=true;retirementAddButton?.setAttribute('aria-expanded','false');retirementAddButton?.focus();}});
      document.getElementById('saveGratuityAccount')?.addEventListener('click',saveGratuityAccount);
      document.querySelectorAll('[data-close-gratuity]').forEach(button=>button.addEventListener('click',closeGratuityModal));
      const investmentAddButton=document.getElementById('openGeneralInvestmentBtn'),investmentAddMenu=document.getElementById('investmentAddMenu');
      document.body.appendChild(investmentAddMenu);
      function placeInvestmentAddMenu(){
        const buttonRect=investmentAddButton.getBoundingClientRect(),menuRect=investmentAddMenu.getBoundingClientRect();
        const left=Math.max(8,Math.min(buttonRect.right-menuRect.width,window.innerWidth-menuRect.width-8));
        let top=buttonRect.bottom+8;
        if(top+menuRect.height>window.innerHeight-8&&buttonRect.top-menuRect.height-8>=8)top=buttonRect.top-menuRect.height-8;
        investmentAddMenu.style.left=`${left}px`;investmentAddMenu.style.top=`${Math.max(8,top)}px`;
      }
      function closeInvestmentAddMenu(){if(investmentAddMenu){investmentAddMenu.hidden=true;investmentAddButton?.setAttribute('aria-expanded','false');}}
      function refreshInvestmentAddMenu(){
        const select=document.getElementById('investType'),retirementTypes=new Set(['PF','PPF','NPS','GRATUITY']);
        investmentAddMenu.replaceChildren();
        Array.from(select.options).filter(option=>option.value.trim()&&!option.value.startsWith('--')&&!retirementTypes.has(option.value.trim().toLocaleUpperCase())).forEach(option=>{
          const item=document.createElement('button');item.type='button';item.role='menuitem';item.dataset.investmentAddType=option.value;item.textContent=option.textContent;investmentAddMenu.appendChild(item);
        });
      }
      investmentAddButton?.addEventListener('click',event=>{event.stopPropagation();const opening=investmentAddMenu.hidden;if(opening){refreshInvestmentAddMenu();investmentAddMenu.hidden=false;placeInvestmentAddMenu();}else investmentAddMenu.hidden=true;investmentAddButton.setAttribute('aria-expanded',String(opening));});
      investmentAddMenu?.addEventListener('click',event=>{
        const choice=event.target.closest('[data-investment-add-type]');if(!choice)return;
        const select=document.getElementById('investType'),type=choice.dataset.investmentAddType;
        const selectedOption=Array.from(select.options).find(option=>option.value.trim().toLocaleLowerCase()===String(type).trim().toLocaleLowerCase());
        if(!selectedOption){alert(`Investment type “${type}” is no longer available. Refresh the page and try again.`);return;}
        investmentAddMenu.hidden=true;investmentAddButton?.setAttribute('aria-expanded','false');
        const panel=document.getElementById('otherInvestmentAddPanel'),list=document.getElementById('investmentListPanel');
        closeInvestmentEntry('otherInvestmentAddPanel');
        // The shared form can be nested in a category tile after using that
        // tile's Add action. Move it back to the portfolio before opening it
        // from the main Add Investment menu, so it cannot remain inside a
        // collapsed or unrelated category.
        if(panel&&list)list.appendChild(panel);
        select.disabled=false;select.value=selectedOption.value;
        syncCustomFixedInvestmentCurrent(true);
        document.getElementById('investAutomaticMonthly').checked=investmentGrowthType(selectedOption.value)==='market'&&!customInvestmentProfile(selectedOption.value);
        document.getElementById('investmentCategoryTitle').textContent=`Add ${selectedOption.value}`;
        updateInvestmentRateField();
        document.querySelectorAll('.investment-add-section.is-open').forEach(open=>open.classList.remove('is-open'));
        openEntryFormModal('otherInvestmentAddPanel',investmentAddButton);
        updateRetirementTilesVisibility();
      });
      document.addEventListener('click',event=>{if(!event.target.closest('.investment-add-menu-wrap')&&!event.target.closest('#investmentAddMenu'))closeInvestmentAddMenu();});
      // Layout shifts and scrolling within the menu must not dismiss a choice.
      let investmentMenuFrame=null;
      document.addEventListener('scroll',event=>{
        if(investmentAddMenu.hidden||investmentAddMenu.contains(event.target)||investmentMenuFrame!==null)return;
        investmentMenuFrame=requestAnimationFrame(()=>{
          investmentMenuFrame=null;if(investmentAddMenu.hidden)return;
          const anchor=investmentAddButton.getBoundingClientRect();
          if(!anchor.width||!anchor.height||anchor.bottom<=0||anchor.top>=window.innerHeight)closeInvestmentAddMenu();
          else placeInvestmentAddMenu();
        });
      },true);
      window.addEventListener('resize',()=>{if(!investmentAddMenu.hidden)placeInvestmentAddMenu();});
      investmentAddMenu?.addEventListener('keydown',event=>{if(event.key==='Escape'){closeInvestmentAddMenu();investmentAddButton?.focus();}});
      document.getElementById('openStallionContributionBtn')?.addEventListener('click',buttonEvent=>{
        const history=document.getElementById('stallionContributionListPanel');
        if(history&&!history.hidden)toggleStallionHistory();
        closeInvestmentEntry('stallionContributionAddPanel');
        toggleInvestmentEntry('stallionContributionAddPanel',buttonEvent.currentTarget);
      });
      document.getElementById('toggleStallionHistoryBtn')?.addEventListener('click',toggleStallionHistory);
      document.getElementById('saveInvestmentContribution')?.addEventListener('click',saveInvestmentContribution);
      document.getElementById('investmentContributionFilter')?.addEventListener('change',()=>{const id=document.getElementById('investmentContributionModal')?.dataset.investmentId;if(id)renderInvestmentContributionHistory(id);});
      document.querySelectorAll('[data-close-investment-contribution]').forEach(button=>button.addEventListener('click',closeInvestmentContributionModal));
      const categoryDialog=document.getElementById('investmentCategoryDialog');
      categoryDialog?.querySelectorAll('[data-close-investment-category-dialog]').forEach(button=>button.addEventListener('click',closeInvestmentCategoryDialog));
      categoryDialog?.addEventListener('click',event=>{if(event.target===categoryDialog)closeInvestmentCategoryDialog();});
      const retirementDialog=document.getElementById('retirementCategoryDialog');
      retirementDialog?.querySelectorAll('[data-close-retirement-category-dialog]').forEach(button=>button.addEventListener('click',closeRetirementCategoryDialog));
      retirementDialog?.addEventListener('click',event=>{if(event.target===retirementDialog)closeRetirementCategoryDialog();});
      document.getElementById('investmentCategoryPanels')?.addEventListener('keydown',event=>{
        const card=event.target.closest('.investment-category-card');
        if(card&&(event.key==='Enter'||event.key===' ')&&!event.target.closest('button,a,input,select,textarea')){event.preventDefault();renderInvestmentCategoryDialog(card.dataset.investmentType,true);}
      });
      document.getElementById('investmentCategoryPanels')?.addEventListener('click',event=>{
        const card=event.target.closest('.investment-category-card');
        const button=event.target.closest('[data-add-investment-category]');
        const entryButton=event.target.closest('[data-open-entry]');
        if(button)openAddInvestmentForCategory(button.dataset.addInvestmentCategory,button);
        else if(entryButton)toggleInvestmentEntry(entryButton.dataset.openEntry,entryButton);
        else if(card&&!event.target.closest('button,a,input,select,textarea,.table-wrapper')){
          event.preventDefault();
          renderInvestmentCategoryDialog(card.dataset.investmentType,true);
        }
      });
    }
    function setupRetirementAccountDetails() {
      document.querySelectorAll('#retirementAccountPanels .retirement-account-details').forEach(details=>{details.open=false;});
    }
    function openAddInvestmentForCategory(category,trigger) {
      const typeSelect=document.getElementById('investType'),panel=document.getElementById('otherInvestmentAddPanel');
      if(!typeSelect||!panel)return;
      closeInvestmentEntry('otherInvestmentAddPanel');
      if(![...typeSelect.options].some(option=>option.value===category)){alert(`Add “${category}” as a custom investment type in Settings first.`);return;}
      typeSelect.value=category;typeSelect.disabled=true;syncCustomFixedInvestmentCurrent(true);document.getElementById('investAutomaticMonthly').checked=investmentGrowthType(category)==='market'&&!customInvestmentProfile(category);
      document.getElementById('investmentCategoryTitle').textContent=`Add ${category}`;
      updateInvestmentRateField();
      const card=trigger.closest('.investment-category-card');
      if(card)card.appendChild(panel);
      else if(category==='Stallion PMS')document.getElementById('stallionPmsTileBody').appendChild(panel);
      else document.getElementById('investmentListPanel').appendChild(panel);
      toggleInvestmentEntry('otherInvestmentAddPanel',trigger);
    }
    function toggleInvestmentEntry(id,trigger) {
      if(document.getElementById('entryFormModal').dataset.panelId===id&&!document.getElementById('entryFormModal').hidden)closeEntryFormModal();
      else openEntryFormModal(id,trigger);
    }
    function closeInvestmentEntry(id) {
      const modal=document.getElementById('entryFormModal');
      if(modal.dataset.panelId===id)closeEntryFormModal();
      const panel=document.getElementById(id);if(panel)panel.classList.remove('is-open');
      if(id==='otherInvestmentAddPanel'){document.getElementById('investType').disabled=false;document.getElementById('openGeneralInvestmentBtn')?.setAttribute('aria-expanded','false');}
      document.querySelectorAll(`[data-open-entry="${id}"]`).forEach(button=>button.setAttribute('aria-expanded','false'));
      updateRetirementTilesVisibility();
    }
    function closeAllInvestmentEntries() { closeEntryFormModal();document.querySelectorAll('.investment-add-section').forEach(panel=>panel.classList.remove('is-open'));document.querySelectorAll('[data-open-entry]').forEach(button=>button.setAttribute('aria-expanded','false'));updateRetirementTilesVisibility(); }

    function investmentRecordForEdit(kind,id) {
      if(kind==='nps')return state.nps.find(x=>x.id===id);
      if(kind==='ppf')return state.ppf.find(x=>x.id===id);
      if(kind==='pf')return state.pf.find(x=>x.id===id);
      if(kind==='investment')return state.investments.find(x=>x.id===id);
      if(kind==='stallionContribution')return state.stallionContributions.find(x=>x.id===id);
      return null;
    }
    function investmentEditDefinition(kind) {
      const members=Array.from(document.getElementById('investMember').options,option=>option.value).filter(value=>value&&!value.startsWith('--'));
      if(kind==='nps')return {title:'Edit NPS account',fields:[['member','Family member','select',members],['account','Account number','text'],['scheme','Scheme type','select',['Active Choice Pension Fund','Auto Choice Pension Fund','Aggressive Tier I','Aggressive Tier II','Other']],['invested','Invested amount (₹)','number',0],['current','Current value (₹)','number',0],['autoMonthlyContribution','Include automatic monthly contribution','checkbox'],['monthly','Monthly contribution (₹)','number',0],['date','Start date','date']]};
      if(kind==='ppf')return {title:'Edit PPF account',fields:[['member','Family member','select',members],['account','Account number','text'],['invested','Invested amount (₹)','number',0],['current','Current balance (₹)','number',0],['autoMonthlyContribution','Include automatic monthly contribution','checkbox'],['monthly','Monthly contribution (₹)','number',0],['rate','Interest rate (% p.a.)','number',0],['date','Opening date','date']]};
      if(kind==='pf')return {title:'Edit PF account',fields:[['member','Family member','select',members],['account','Account number / UAN','text'],['autoMonthlyContribution','Include automatic monthly contribution','checkbox'],['employee','Employee contribution per month (₹)','number',0],['employer','Employer total per month (₹)','number',0],['epsMonthly','Employer portion to EPS per month (₹)','number',0],['epsCurrent','Current EPS balance (₹)','number',0],['invested','Invested amount (₹)','number',0],['current','Current balance (₹)','number',0],['rate','Interest rate (% p.a.)','number',0],['date','Last updated','date']]};
      if(kind==='investment'){
        const types=[...new Set(['Mutual Funds','Bonds','Fixed Deposits','Stallion PMS',...(state.customValues?.investmentTypes||[])])];
        return {title:'Edit investment',fields:[['member','Family member','select',members],['type','Investment type','select',types],['name','Investment name','text'],['invested','Invested amount (₹)','number',0],['current','Current value (₹)','number',0],['autoMonthlyContribution','Include automatic monthly contribution','checkbox'],['monthly','Monthly contribution (₹)','number',0],['monthlyContributionDate','First monthly contribution date','date'],['date','Purchase date','date'],['rate','Interest Rate (% p.a.)','number',0],['notes','Notes','text']]};
      }
      if(kind==='stallionContribution')return {title:'Edit PMS contribution',fields:[['stallionId','Portfolio','stallionSelect'],['amount','Contribution amount (₹)','number',0.01],['date','Contribution date','date']]};
      return null;
    }
    function openInvestmentEditModal(kind,id) {
      const record=investmentRecordForEdit(kind,id),definition=record&&investmentEditDefinition(kind);if(!record||!definition)return;
      const modal=document.getElementById('investmentEditModal'),fields=document.getElementById('investmentEditFields');
      modal.dataset.kind=kind;modal.dataset.recordId=id;document.getElementById('investmentEditTitle').textContent=definition.title;fields.replaceChildren();
      definition.fields.forEach(([key,label,type,options])=>{
        const group=document.createElement('div');group.className='form-group';group.dataset.editGroup=key;if(key==='rate'&&kind==='investment')group.hidden=!investmentUsesInterestRate(record.type);const caption=document.createElement('label');caption.textContent=label;group.appendChild(caption);
        const input=document.createElement(type==='select'||type==='stallionSelect'?'select':'input');
        if(input.tagName==='SELECT'){
          const choices=type==='stallionSelect'?state.investments.filter(x=>x.type==='Stallion PMS').map(x=>({value:x.id,label:`${x.member} — ${x.name}`})):(options||[]).map(x=>({value:x,label:x}));
          if(record[key]&&!choices.some(x=>x.value===record[key]))choices.unshift({value:record[key],label:record[key]});
          choices.forEach(choice=>{const option=document.createElement('option');option.value=choice.value;option.textContent=choice.label;input.appendChild(option);});
        } else { input.type=type;if(type==='number'){input.min=options??0;input.step='0.01';} }
        input.dataset.editKey=key;if(type==='checkbox'){const retirementAuto=key==='autoMonthlyContribution'&&['pf','ppf','nps'].includes(kind);input.checked=retirementAuto?(record.autoMonthlyContribution===true||(record.autoMonthlyContribution===undefined&&retirementMonthlyAmount(record,kind)>0)):record[key]===true||(record[key]===undefined&&key==='autoMonthlyContribution'&&investmentGrowthType(record.type)==='market'&&Number(record.monthly)>0);}else input.value=record[key]??(key==='monthlyContributionDate'?(record.monthlyContributionNextDate&&record.monthlyContributionNextDate>localDateKey()?record.monthlyContributionNextDate:addMonthsClamped(localDateKey(),1)): '');input.id=`investmentEdit_${key}`;if(type!=='checkbox')caption.htmlFor=input.id;group.appendChild(input);fields.appendChild(group);
        if(key==='type')input.addEventListener('change',()=>updateInvestmentEditVisibility(fields,input.value));
        if(key==='autoMonthlyContribution')input.addEventListener('change',()=>['pf','ppf','nps'].includes(kind)?updateRetirementEditMonthlyVisibility(fields,kind):updateInvestmentEditVisibility(fields,fields.querySelector('[data-edit-key="type"]').value));
      });
      if(kind==='investment')updateInvestmentEditVisibility(fields,record.type);
      else if(['pf','ppf','nps'].includes(kind))updateRetirementEditMonthlyVisibility(fields,kind);
      modal.hidden=false;syncInvestmentOverlayBodyLock();modal.querySelector('button')?.focus({preventScroll:true});
    }
    function updateInvestmentEditVisibility(fields,type){
      const growthType=investmentGrowthType(type),groupFor=key=>fields.querySelector(`[data-edit-group="${key}"]`),rate=groupFor('rate'),current=groupFor('current'),monthly=groupFor('monthly'),monthlyDate=groupFor('monthlyContributionDate'),automatic=groupFor('autoMonthlyContribution');
      if(rate)rate.hidden=!investmentUsesInterestRate(type);if(current)current.hidden=growthType==='no-return';
      if(monthly)monthly.hidden=!fields.querySelector('[data-edit-key="autoMonthlyContribution"]')?.checked;
      if(monthlyDate)monthlyDate.hidden=!fields.querySelector('[data-edit-key="autoMonthlyContribution"]')?.checked;
      if(automatic)automatic.hidden=false;
    }
    function updateRetirementEditMonthlyVisibility(fields,kind){
      const enabled=Boolean(fields.querySelector('[data-edit-key="autoMonthlyContribution"]')?.checked);
      const keys=kind==='pf'?['employee','employer','epsMonthly']:['monthly'];
      for(const key of keys){const group=fields.querySelector(`[data-edit-group="${key}"]`);if(group)group.hidden=!enabled;}
    }
    function closeInvestmentEditModal() { const modal=document.getElementById('investmentEditModal');modal.hidden=true;delete modal.dataset.kind;delete modal.dataset.recordId;syncInvestmentOverlayBodyLock(); }
    function applyStallionContributionAdjustment(id,difference) {
      if(!difference)return;
      const pms=state.stallionPms.find(x=>x.id===id),investment=state.investments.find(x=>x.id===id&&x.type==='Stallion PMS');
      if(pms)pms.invested+=difference;
      if(investment){investment.invested+=difference;investment.current=investment.invested+(pms?.profit||0);}
    }
    function saveInvestmentEditModal() {
      const modal=document.getElementById('investmentEditModal'),kind=modal.dataset.kind,id=modal.dataset.recordId,record=investmentRecordForEdit(kind,id);if(!record)return;
      const values={};
      for(const input of modal.querySelectorAll('[data-edit-key]')){
        if(input.dataset.editKey==='rate'&&input.parentElement.hidden)continue;
        if(['current','monthly','employee','employer','epsMonthly','monthlyContributionDate','autoMonthlyContribution'].includes(input.dataset.editKey)&&input.parentElement.hidden)continue;
        const key=input.dataset.editKey;let value=input.value;
        if(kind==='investment'&&key==='rate'&&investmentUsesInterestRate(modal.querySelector('[data-edit-key="type"]')?.value)&&value.trim()===''){alert('Enter an annual interest rate.');input.focus();return;}
        if(input.type==='checkbox'){values[key]=input.checked;continue;}
        if(input.type==='number'){value=Number(value);if(!Number.isFinite(value)||value<Number(input.min||0)){alert(`Enter a valid ${input.previousElementSibling?.textContent||key}.`);input.focus();return;}}
        else if(input.type==='date'&&!validCalendarDate(value)){alert('Enter a valid date.');input.focus();return;}
        else if(input.tagName==='SELECT'&&!value){alert('Select a valid option.');input.focus();return;}
        else if(input.type==='text'&&['account','name'].includes(key)&&!value.trim()){alert(key==='name'?'Enter an investment name.':'Enter an account number.');input.focus();return;}
        values[key]=value;
      }
      if(kind==='stallionContribution'){
        const oldId=record.stallionId,newId=values.stallionId;
        if(record.automatic===true&&state.stallionContributions.some(row=>row.id!==record.id&&row.stallionId===newId&&row.automatic===true&&row.date===values.date)){alert('An automatic contribution already exists for this portfolio and date.');return;}
        const targetPortfolio=state.investments.find(row=>row.id===newId&&row.type==='Stallion PMS');
        if(!targetPortfolio||values.date<targetPortfolio.date){alert('The contribution date must be on or after the selected portfolio opening date.');return;}
        if(oldId===newId){if(!validStallionContributionChange(oldId,values.amount-record.amount))return;applyStallionContributionAdjustment(oldId,values.amount-record.amount);}
        else {if(!validStallionContributionChange(oldId,-record.amount)||!validStallionContributionChange(newId,values.amount))return;applyStallionContributionAdjustment(oldId,-record.amount);applyStallionContributionAdjustment(newId,values.amount);}
        record.stallionId=newId;record.amount=values.amount;record.date=values.date;document.getElementById('stallionContributionFinancialYear').dataset.preferredYear=String(financialYearStartYearForMonthKey(values.date.slice(0,7)));
      } else if(kind==='investment'){
        const nextProfile=customInvestmentProfile(values.type),nextGrowth=investmentGrowthType(values.type);
        if((state.customValues?.investmentTypes||[]).includes(values.type)&&!nextProfile){alert('Choose a growth calculation when adding this investment type.');return;}
        if(nextGrowth==='no-return'&&values.current===undefined)values.current=values.invested;
        let nextContributionDate=record.monthlyContributionNextDate;
        if(!values.autoMonthlyContribution){values.monthly=0;values.monthlyContributionDate='';nextContributionDate='';}
        else {if(!Number.isFinite(values.monthly)||values.monthly<=0){alert('Enter a monthly contribution greater than zero.');return;}const sameExistingSchedule=record.autoMonthlyContribution===true&&values.monthlyContributionDate===record.monthlyContributionDate;if(!validCalendarDate(values.monthlyContributionDate)||(!sameExistingSchedule&&values.monthlyContributionDate<localDateKey())||values.monthlyContributionDate<values.date){alert('Choose a valid first monthly contribution date today or later than the portfolio opening date.');return;}if(values.monthlyContributionDate!==record.monthlyContributionDate||record.autoMonthlyContribution!==true)nextContributionDate=values.monthlyContributionDate;}
        const wasStallion=record.type==='Stallion PMS',willBeStallion=values.type==='Stallion PMS';
        if(wasStallion&&!willBeStallion&&(state.stallionContributions.some(x=>x.stallionId===id)||state.stallionProfitHistory.some(x=>x.stallionId===id))){alert('This portfolio has contribution or profit history. Keep its type as Stallion PMS so those records remain linked.');return;}
        const hasInvestmentContributions=(state.investmentContributions||[]).some(row=>row.investmentId===id);
        if(hasInvestmentContributions&&values.type==='Stallion PMS'){alert('This holding has contribution history. Keep it outside Stallion PMS so those records remain linked.');return;}
        const datedContributions=wasStallion?state.stallionContributions.filter(r=>r.stallionId===id):(state.investmentContributions||[]).filter(r=>r.investmentId===id);
        if(datedContributions.some(r=>r.date<values.date)||datedContributions.reduce((sum,r)=>sum+r.amount,0)>values.invested+0.01){alert('The start date and invested amount must include all recorded contributions.');return;}
        values.monthlyContributionNextDate=nextContributionDate;
        if(!investmentUsesInterestRate(values.type))delete record.rate;
        if(values.current!==record.current)values.valuationDate=localDateKey();
        Object.assign(record,values);
        if(willBeStallion){let pms=state.stallionPms.find(x=>x.id===id);if(!pms){pms={id,member:record.member,name:record.name,invested:record.invested,profit:record.current-record.invested,createdDate:record.date};state.stallionPms.push(pms);}else Object.assign(pms,{member:record.member,name:record.name,invested:record.invested,profit:record.current-record.invested,createdDate:record.date});}
        else if(wasStallion)state.stallionPms=state.stallionPms.filter(x=>x.id!==id);
      } else {
        if(['pf','ppf','nps'].includes(kind)){
          if(kind==='pf'&&Number(values.epsMonthly??record.epsMonthly??0)>Number(values.employer??record.employer)){alert('EPS portion cannot exceed employer total.');return;}
          if(values.autoMonthlyContribution){const monthly=retirementMonthlyAmount({...record,...values},kind)+(kind==='pf'?Number(values.epsMonthly??record.epsMonthly??0):0);if(monthly<=0){alert('Enter a monthly contribution greater than zero or turn off automatic monthly contributions.');return;}}
          const entries=state.retirementContributions.filter(r=>r.investmentType===kind&&r.accountId===id);
          if(entries.some(r=>r.date<values.date)||entries.reduce((sum,r)=>sum+r.amount,0)>values.invested+0.01){alert('The start date and invested amount must include all recorded contributions.');return;}
          entries.forEach(r=>{r.member=values.member;r.accountName=values.account||values.scheme||kind.toUpperCase();});
        }
        if(kind==='pf'){if(Number(values.epsMonthly??record.epsMonthly??0)>Number(values.employer??record.employer)){alert('EPS portion cannot exceed employer total.');return;}recordPfEpsBalanceUpdate(record,Number(values.epsCurrent??record.epsCurrent??0));}
        if(kind==='nps'&&values.current!==record.current)values.valuationDate=localDateKey();
        Object.assign(record,values);
      }
      const finish=()=>{closeInvestmentEditModal();renderInvestments();renderNps();renderPpf();renderPf();renderStallionContributions();populateStallionDropdowns();updateDashboard();},saving=saveData();
      if(typeof window!=='undefined'&&window.financeWorkbench?.isReviewEditing('stallion'))return window.financeWorkbench.saveAndReturn(saving,finish);
      finish();
    }
    document.querySelectorAll('[data-close-edit]').forEach(button=>button.addEventListener('click',closeInvestmentEditModal));
    document.getElementById('saveInvestmentEdit').addEventListener('click',saveInvestmentEditModal);
    document.querySelectorAll('[data-close-account-update]').forEach(button=>button.addEventListener('click',closeAccountUpdateModal));
    document.getElementById('saveAccountUpdate').addEventListener('click',saveAccountUpdateModal);
    document.getElementById('accountUpdateNpsAccount').addEventListener('change',event=>{
      const account=state.nps.find(item=>item.id===event.target.value);if(!account)return;
      document.getElementById('accountUpdateModal').dataset.recordId=account.id;
      document.getElementById('accountUpdateValue').value=Number(account.current)||0;
    });
    document.querySelectorAll('[data-close-retirement-history]').forEach(button=>button.addEventListener('click',closeRetirementContributionHistory));
    document.querySelectorAll('[data-close-debt-emi-history]').forEach(button=>button.addEventListener('click',closeDebtEmiHistory));
    document.getElementById('retirementHistoryType').addEventListener('change',renderRetirementContributionHistory);
    document.getElementById('retirementContributionHistoryFinancialYear').addEventListener('change',renderRetirementContributionHistory);
    document.addEventListener('keydown',event=>{if(event.key==='Escape'){if(document.getElementById('recordEditorDialog').open)return;if(!document.getElementById('gratuityEditModal').hidden)closeGratuityModal();else if(!document.getElementById('investmentEditModal').hidden)closeInvestmentEditModal();else if(!document.getElementById('accountUpdateModal').hidden)closeAccountUpdateModal();else if(!document.getElementById('retirementContributionHistoryModal').hidden)closeRetirementContributionHistory();else if(!document.getElementById('debtEmiHistoryModal').hidden)closeDebtEmiHistory();else if(!document.getElementById('investmentContributionModal').hidden)closeInvestmentContributionModal();else if(document.getElementById('growthAssumptionDialog')&&!document.getElementById('growthAssumptionDialog').hidden)collapseGrowthAssumptionAsset();else if(!document.getElementById('investmentCategoryDialog').hidden)closeInvestmentCategoryDialog();else if(!document.getElementById('retirementCategoryDialog').hidden)closeRetirementCategoryDialog();}});

    document.addEventListener('click',event=>{
      const body=document.getElementById('completePortfolioBody');
      if(!body?.dataset.expandedCategory) return;
      if(event.target.closest('#completePortfolioBody')) return;
      body.dataset.expandedCategory='';
      renderCompletePortfolio();
    },true);

    const debtSummaryTiles=document.getElementById('debtSummaryTiles');
    function collapseDebtSummaryTiles() {
      debtSummaryTiles.querySelectorAll('[data-debt-summary-toggle]').forEach(button=>{
        button.setAttribute('aria-expanded','false');
        const details=document.getElementById(button.getAttribute('aria-controls'));
        if(details) details.hidden=true;
      });
    }
    debtSummaryTiles.addEventListener('click',event=>{
      const button=event.target.closest('[data-debt-summary-toggle]');
      if(!button) return;
      const opening=button.getAttribute('aria-expanded')!=='true';
      collapseDebtSummaryTiles();
      if(opening) {
        button.setAttribute('aria-expanded','true');
        const details=document.getElementById(button.getAttribute('aria-controls'));
        if(details) details.hidden=false;
      }
    });
    document.addEventListener('click',event=>{
      if(!debtSummaryTiles.querySelector('[data-debt-summary-toggle][aria-expanded="true"]')) return;
      if(event.target.closest('#debtSummaryTiles')) return;
      collapseDebtSummaryTiles();
    },true);
    document.getElementById('toggleBalanceHistory').addEventListener('click',event=>{
      const button=event.currentTarget,content=document.getElementById('balanceHistoryContent');
      const opening=button.getAttribute('aria-expanded')!=='true';
      button.setAttribute('aria-expanded',String(opening));
      content.hidden=!opening;
      button.textContent=opening?'Hide History':'View History';
    });


    for(const kind of ['income','expense'])document.getElementById(`${kind}HistorySearch`).addEventListener('input',()=>{transactionHistoryPages[kind]=1;kind==='income'?renderIncome():renderExpenses();});
    // Initialize
    console.log(' INITIALIZING APP...');
    document.getElementById('reportStartDate').value = currentMonthKey() + '-01';
    document.getElementById('reportEndDate').value = localDateKey();
    document.getElementById('stallionProfitDate').value = localDateKey();
    document.getElementById('incomeHistoryMonth').addEventListener('change',()=>{transactionHistoryPages.income=1;renderIncome();});
    document.getElementById('expenseHistoryMonth').addEventListener('change',()=>{transactionHistoryPages.expense=1;renderExpenses();});
    document.getElementById('incomeHistoryFinancialYear').addEventListener('change',()=>{transactionHistoryPages.income=1;renderIncome();});
    document.getElementById('expenseHistoryFinancialYear').addEventListener('change',()=>{transactionHistoryPages.expense=1;renderExpenses();});
    document.getElementById('incomeHistoryPagination').addEventListener('click',event=>changeTransactionHistoryPage('income',event));
    document.getElementById('expenseHistoryPagination').addEventListener('click',event=>changeTransactionHistoryPage('expense',event));
    document.getElementById('balanceHistoryFinancialYear').addEventListener('change', renderBalanceHistory);
    document.getElementById('stallionContributionFinancialYear').addEventListener('change', renderStallionContributions);
    document.getElementById('surplusTrendFinancialYear').addEventListener('change', renderCharts);
    document.getElementById('stallionProfitTrendFinancialYear').addEventListener('change', renderCharts);
    document.getElementById('generateRangeReport').addEventListener('click',()=>renderRangeReport(true));
    document.querySelector('.report-quick-range')?.addEventListener('click',event=>{const button=event.target.closest('[data-report-preset]');if(button)applyReportDatePreset(button.dataset.reportPreset);});
    document.getElementById('rangeReportActiveFilters').addEventListener('click',event=>{
      if(event.target.closest('[data-range-filter-clear-all]')){clearAllRangeReportColumnFilters();return;}
      const chip=event.target.closest('[data-range-filter-clear-key]');if(!chip)return;
      const group=rangeReportGroups[chip.dataset.rangeFilterClearKey];if(!group)return;
      delete group.columnFilters[chip.dataset.rangeFilterClearColumn];rangeReportPages[group.key]=1;renderRangeReport();
    });
    document.getElementById('rangeReportResults').addEventListener('click',event=>{
      if(event.target.closest('[data-range-clear-all]')){clearAllRangeReportColumnFilters();return;}
      const filterButton=event.target.closest('[data-range-report-column-filter]');
      if(filterButton){openRangeReportColumnFilter(filterButton);return;}
      const button=event.target.closest('[data-range-report-page]');if(!button||button.disabled)return;
      const section=button.closest('[data-range-report-section]'),table=section?.querySelector('table[data-range-report-key]');if(!table)return;
      const key=table.dataset.rangeReportKey,current=Number(rangeReportPages[key])||1,total=Math.max(1,Math.ceil(rangeReportFilteredRows(rangeReportGroups[key]||{rows:[],columnFilters:{}}).length/RANGE_REPORT_PAGE_SIZE));
      const requested=button.dataset.rangeReportPage==='prev'?current-1:button.dataset.rangeReportPage==='next'?current+1:Number(button.dataset.rangeReportPage);
      rangeReportPages[key]=Math.min(Math.max(requested,1),total);applyRangeReportPagination(table);
    });
    const rangeFilterPopover=document.getElementById('rangeReportColumnFilterPopover');
    rangeFilterPopover.addEventListener('click',event=>{
      if(event.target.closest('[data-range-filter-close]'))closeRangeReportColumnFilter();
      else if(event.target.closest('[data-range-filter-select-all],[data-range-filter-select-none]')){
        const active=rangeReportOpenFilter;if(!active)return;
        const select=!!event.target.closest('[data-range-filter-select-all]');
        active.matches.forEach(option=>select?active.selected.add(option.key):active.selected.delete(option.key));
        renderRangeReportFilterOptions();
      }
      else if(event.target.closest('[data-range-filter-prev],[data-range-filter-next]')){
        if(!rangeReportOpenFilter)return;
        rangeReportOpenFilter.page+=event.target.closest('[data-range-filter-next]')?1:-1;
        renderRangeReportFilterOptions();
      }
      else if(event.target.closest('[data-range-filter-clear]'))applyRangeReportColumnFilter(true);
      else if(event.target.closest('[data-range-filter-apply]'))applyRangeReportColumnFilter(false);
    });
    rangeFilterPopover.addEventListener('input',event=>{
      if(event.target.matches('[data-range-filter-search]')){
        renderRangeReportFilterOptions(true);
      }
    });
    rangeFilterPopover.addEventListener('change',event=>{
      if(!event.target.matches('[data-range-filter-option]')||!rangeReportOpenFilter)return;
      const selected=rangeReportOpenFilter.selected;
      if(event.target.checked)selected.add(event.target.value);else selected.delete(event.target.value);
      rangeFilterPopover.querySelector('[data-range-filter-count]').textContent=`${selected.size} selected`;
    });
    document.addEventListener('click',event=>{
      if(!event.target.closest('#rangeReportColumnFilterPopover')&&!event.target.closest('[data-range-report-column-filter]'))closeRangeReportColumnFilter();
    });
    document.addEventListener('keydown',event=>{if(event.key==='Escape')closeRangeReportColumnFilter();});
    window.addEventListener('resize',closeRangeReportColumnFilter);
    window.addEventListener('scroll',event=>{if(event.target instanceof Node&&rangeFilterPopover.contains(event.target))return;closeRangeReportColumnFilter();},true);
    document.getElementById('exportRangeReport').addEventListener('click', exportRangeReport);
    document.getElementById('printRangeReport').addEventListener('click',()=>{const report=renderRangeReport();if(!report)return;renderRangeReportPrintView(report);requestAnimationFrame(()=>window.print());});
    document.getElementById('reportFinancialYear').addEventListener('change',()=>{clearReportPresetSelection();applyReportFinancialYear();});
    ['reportStartDate','reportEndDate'].forEach(id => document.getElementById(id).addEventListener('change',()=>{document.getElementById('reportFinancialYear').value='';clearReportPresetSelection();renderRangeReport(true);}));
    document.getElementById('reportType').addEventListener('change',()=>renderRangeReport(true));
    const DASHBOARD_LAYOUT_KEY='familyWealthDashboardLayout';
    const advancedStructureState={income:false,analytics:false,debts:false,growth:false};
    function setAdvancedPageStructure() {
      const incomeGrid=document.querySelector('#income-expenses .transaction-grid');
      if(incomeGrid&&!advancedStructureState.income){
        const panels=[...incomeGrid.querySelectorAll(':scope > .transaction-panel')];
        if(panels.length===2){
          const entries=document.createElement('div');entries.className='advanced-cashflow-entry-row';
          const histories=document.createElement('div');histories.className='advanced-cashflow-history-row';
          panels.forEach(panel=>{
            const children=[...panel.children];
            const type=panel.classList.contains('transaction-panel-expense')?'expense':'income';
            const entry=document.createElement('section');entry.className=`panel transaction-panel transaction-panel-${type} advanced-cashflow-entry-card`;
            const history=document.createElement('section');history.className=`panel transaction-panel transaction-panel-${type} advanced-cashflow-ledger-card`;
            children.filter(node=>!node.classList.contains('history-section')).forEach(node=>entry.appendChild(node));
            const historyNode=children.find(node=>node.classList.contains('history-section'));
            if(historyNode)history.appendChild(historyNode);
            entries.appendChild(entry);histories.appendChild(history);
          });
          incomeGrid.replaceChildren(entries,histories);
          advancedStructureState.income=true;
        }
      }

      const debtsPage=document.getElementById('debts');
      if(debtsPage&&!advancedStructureState.debts){
        const existingWorkspace=debtsPage.querySelector(':scope > .advanced-debt-workspace');
        if(existingWorkspace){advancedStructureState.debts=true;}
        else{
          const entry=debtsPage.querySelector(':scope > .debt-entry-panel'),list=debtsPage.querySelector(':scope > .debt-list-panel');
          if(entry&&list){const workspace=document.createElement('div');workspace.className='advanced-debt-workspace';workspace.append(entry,list);debtsPage.appendChild(workspace);advancedStructureState.debts=true;}
        }
      }

      const growthPage=document.getElementById('growth-projection');
      if(growthPage&&!advancedStructureState.growth){
        const original=[...growthPage.children],controls=growthPage.querySelector('#growthProjectionControls'),assumptions=growthPage.querySelector('.growth-assumptions-panel'),chart=growthPage.querySelector('.growth-projection-chart-panel'),summary=growthPage.querySelector('#growthProjectionSummary');
        if(controls&&assumptions&&chart){
          const workspace=document.createElement('section');workspace.className='advanced-growth-workspace';workspace.setAttribute('aria-label','Growth projection simulator');
          const rail=document.createElement('div');rail.className='advanced-growth-rail';rail.append(controls);const takeaway=chart.querySelector('.growth-projection-takeaway');const comparison=document.createElement('section');comparison.className='panel growth-scenario-panel';if(summary)comparison.append(summary);if(takeaway)comparison.append(takeaway);workspace.append(rail,chart);
          growthPage.replaceChildren(...original.filter(node=>node!==controls&&node!==assumptions&&node!==chart&&node!==summary));
          const intro=original.find(node=>node.classList.contains('growth-page-intro'));if(intro){intro.after(workspace);}else{growthPage.prepend(workspace);}
          workspace.after(assumptions);assumptions.after(comparison);
          advancedStructureState.growth=true;
        }
      }

      const analytics=document.getElementById('analytics');
      const analyticsGrid=analytics?.querySelector('.analytics-grid');
      if(analyticsGrid&&!advancedStructureState.analytics){
        const cards=[...analyticsGrid.children];
        const summary=cards.find(card=>card.classList.contains('analytics-summary-card'));
        const averages=cards.find(card=>card.classList.contains('analytics-average-card'));
        if(summary&&averages){
          const overview=document.createElement('section');overview.className='advanced-analytics-overview';overview.setAttribute('aria-label','Financial overview');
          overview.append(summary,averages);analytics.insertBefore(overview,analyticsGrid);
          const charts=cards.filter(card=>card!==summary&&card!==averages);analyticsGrid.replaceChildren(...charts);
          advancedStructureState.analytics=true;
        }
      }
    }
    function applyAdvancedLayout() {
      setAdvancedPageStructure();
      document.body.classList.add('advanced-layout');
      try{trackerStorage.setItem(DASHBOARD_LAYOUT_KEY,'advanced');}catch(error){/* Layout still applies for this session. */}
    }
    applyAdvancedLayout();
    const activeNavTab=document.querySelector('.nav-tab.active');
    if(activeNavTab&&document.getElementById('layoutPageTitle'))document.getElementById('layoutPageTitle').textContent=activeNavTab.textContent.trim().replace(/\s+/g,' ');
    initTheme();
    console.log(' Theme initialized');
    setupInvestmentEntryPanels();
    setupModernModals();
    setupSettingsTiles();setupFamilyDetailTiles();
    setupInlineCustomValues();
    
    document.querySelector('.container').inert=true;

    // A read-only walkthrough shown after new-account setup, and replayable from App info.
    function setupAppTour(isNewUser=false){
      const key='pft:guide-tour:v1';
      if(window.PFTTour){window.PFTTour.maybeStart(isNewUser);return;}
      const steps=[
        {page:'dashboard',title:'Your finances at a glance',text:'Home brings together your assets, debts, income and expenses. Use the family profile selector to switch between an individual and the combined view.',tip:'The tour only explains the app. It does not add or change financial records.'},
        {page:'income-expenses',title:'Record money in and out',text:'Switch between Income and Expenses, choose a month, and add an entry. Tap an existing transaction to review or edit it when you have edit access.',tip:'Monthly balances record your opening bank balance. Every amount in balance history has its own label.'},
        {page:'income-expenses',title:'Manage recurring commitments',text:'Recurring items can record regular income, expenses and loan EMIs. Review earlier missed months before adding them, and pause a rule when it is no longer needed.',tip:'The app records entries; it does not send money or make bank payments.'},
        {page:'investments',title:'Track your investments',text:'Add investment and retirement accounts, then tap a tile for holdings, returns and history. The actions inside each holding let you review contributions or update its value.',tip:'A contribution adds money invested. Update value or gain/loss when the market value changes.'},
        {page:'debts',title:'Review loans and repayments',text:'Open a loan to see its outstanding balance, payment history and terms. Record EMIs or part payments, and review the preview before changing the rate, EMI or borrowing more.',tip:'Estimates help you plan. Use your bank statement to confirm repayment amounts and interest splits.'},
        {page:'analytics',title:'Understand your reports',text:'Reports includes Analytics, Growth Projection and Date range reports. Choose the financial year for analytics or a date range for detailed records and exports.',tip:'Your selected family profile and report filters affect the records shown.'},
        {page:'growth-projection',title:'Explore possible growth',text:'Set a time horizon and tap an investment to adjust assumptions. Stress, Base and Optimistic scenarios compare possible results. Tap a scenario below the graph for exact values and its yearly breakdown.',tip:'Projection settings are planning assumptions, not guaranteed returns or changes to your recorded investments.'},
        {page:'settings',title:'Personalize and share access',text:'Appearance changes your page style and colors. Family access manages member names and invitations. Account settings manage your signed-in profile.',tip:'A family member name does not grant login access. Invitations and roles control access; viewers cannot edit records.'},
        {page:'settings',title:'Keep a backup and find help',text:'Use Data & backup to export your records. Importing a backup replaces records, so keep an export first. App & updates shows your installed version and available updates.',tip:'You can replay this tour or download the full guide from App info at any time.'}
      ];
      const dialog=document.createElement('dialog');dialog.id='appGuideTour';dialog.setAttribute('aria-labelledby','appGuideTourTitle');dialog.setAttribute('aria-describedby','appGuideTourText');
      dialog.innerHTML='<header><span id="appGuideTourProgress"></span><button type="button" data-tour-skip aria-label="Skip app tour">Skip</button></header><h2 id="appGuideTourTitle" tabindex="-1"></h2><p id="appGuideTourText"></p><p id="appGuideTourTip"></p><footer><button type="button" data-tour-back>Back</button><button type="button" class="btn-primary" data-tour-next>Next</button></footer>';
      document.body.append(dialog);
      let index=0,returnPage='dashboard',returnScroll=0,returnFocus=null;
      const shouldOffer=newUser=>{if(!newUser)return false;try{return !trackerStorage.getItem(key);}catch(_){return false;}};
      function remember(status){try{trackerStorage.setItem(key,status);}catch(_){}}
      function render(){
        const step=steps[index];
        document.querySelector('.nav-tab[data-tab="'+step.page+'"]')?.click();
        document.getElementById('appGuideTourProgress').textContent='App tour · '+(index+1)+' of '+steps.length;
        document.getElementById('appGuideTourTitle').textContent=step.title;
        document.getElementById('appGuideTourText').textContent=step.text;
        document.getElementById('appGuideTourTip').textContent=step.tip;
        dialog.querySelector('[data-tour-back]').disabled=index===0;
        dialog.querySelector('[data-tour-next]').textContent=index===steps.length-1?'Finish':'Next';
        document.getElementById('appGuideTourTitle').focus({preventScroll:true});
      }
      function finish(status){
        remember(status);dialog.close();document.body.classList.remove('app-guide-open');
        document.querySelector('.nav-tab[data-tab="'+returnPage+'"]')?.click();
        window.scrollTo({top:returnScroll,behavior:'instant'});
        if(returnFocus?.isConnected&&!returnFocus.closest('#settingsPanelParking'))returnFocus.focus({preventScroll:true});
      }
      function start(){
        if(dialog.open)return;
        if([...document.querySelectorAll('dialog[open]:not(#settingsTileDialog),[aria-modal="true"]:not(dialog)')].some(node=>node.getClientRects().length&&getComputedStyle(node).visibility!=='hidden'))return;
        returnPage=document.querySelector('.nav-tab.active')?.dataset.tab||'dashboard';returnScroll=window.scrollY;returnFocus=document.activeElement;
        window.closeSettingsTile?.();index=0;remember('started');document.body.classList.add('app-guide-open');dialog.showModal();render();
      }
      dialog.querySelector('[data-tour-skip]').onclick=()=>finish('skipped');
      dialog.querySelector('[data-tour-back]').onclick=()=>{if(index>0){index--;render();}};
      dialog.querySelector('[data-tour-next]').onclick=()=>{if(index===steps.length-1)finish('completed');else{index++;render();}};
      dialog.addEventListener('cancel',event=>{event.preventDefault();finish('skipped');});
      const replay=document.createElement('button');replay.type='button';replay.id='replayAppTour';replay.className='btn-secondary';replay.textContent='Take a tour';replay.onclick=start;
      document.getElementById('downloadAppInfoPdf')?.before(replay);
      window.PFTTour={start,shouldOffer,maybeStart(newUser){if(shouldOffer(newUser))start();}};
      window.PFTTour.maybeStart(isNewUser);
    }

    const trackerStartup=(async()=>{
    await loadData();
    if(storageLoadFailed)return;
    populateCustomValueSelects();initializeFamilyProfile();populateReportFinancialYears();
    populateStallionDropdowns();populateLoanDropdown();
    startupRenderReady=true;
    for(const page of ['dashboard','income-expenses','investments','debts','settings'])startupPendingPages.add(page);
    let initialPage='dashboard';try{const saved=trackerStorage.getItem('activePage');if(document.querySelector('.nav-tab[data-tab="'+CSS.escape(saved||'')+'"]'))initialPage=saved;}catch(_){}
    renderStartupPage(initialPage);

    // Set default month for balance tracker
    const today = new Date();
    const currentMonth = String(today.getMonth() + 1).padStart(2, '0');
    const currentYear = today.getFullYear();
    document.getElementById('balanceMonth').value = `${currentYear}-${currentMonth}`;



    })().then(async()=>{if(!storageLoadFailed){let savedPage;try{savedPage=trackerStorage.getItem('activePage');}catch(_){}const savedTab=[...document.querySelectorAll('.nav-tab')].find(tab=>tab.dataset.tab===savedPage);savedTab?.click();window.dispatchEvent(new Event('pft:before-reveal'));window.PFTPerformance?.mark('layout-ready');document.querySelector('.container').inert=false;window.financeCloud.showApp();window.PFTPerformance?.mark('visible');window.dispatchEvent(new Event('pft:visible'));void verifyStartupRevision();const newTourUser=firstNameSetupNeeded(state,profileMemberNames())&&(!window.financeCloud?.role||window.financeCloud.role==='owner');await setupFirstName();setupAppTour(newTourUser);applyFamilyRoleControls();startRecurringItems();warmStartupPages();}}).catch(error=>{storageLoadFailed=true;window.financeCloud?.lock(error);});
    if(window.PFTResolveTrackerReady)trackerStartup.then(window.PFTResolveTrackerReady);else window.trackerReady=trackerStartup;

    const tableSortChoices = {};
    try { Object.assign(tableSortChoices, JSON.parse(trackerStorage.getItem('familyWealthTableSort') || '{}')); } catch (error) { /* Defaults if storage unavailable. */ }
    if(tableSortChoices.incomeBody)transactionHistorySorts.income=tableSortChoices.incomeBody;
    if(tableSortChoices.expenseBody)transactionHistorySorts.expense=tableSortChoices.expenseBody;
    if(transactionHistorySorts.income)renderIncome();
    if(transactionHistorySorts.expense)renderExpenses();
    function tableSortKey(table) {
      const body=table.tBodies[0];
      return body?.id || (table.closest('.investment-category-card') ? 'category-'+table.closest('.investment-category-card').dataset.investmentType : '') || table.parentElement.id || ('table-'+Array.from(document.querySelectorAll('table')).indexOf(table));
    }
    function tableCellSortValue(cell, heading) {
      if(!cell)return {missing:true,value:''};
      const raw=cell.dataset.sortValue;
      const text=(cell.querySelector('strong')?.textContent || cell.textContent).trim();
      if(raw!==undefined)return {missing:false,value:Number.isFinite(Number(raw))&&raw.trim()!==''?Number(raw):raw};
      if(!text||/^(pending|n\/a|enter emi|emi does not|invalid loan)/i.test(text))return {missing:true,value:text};
      if(/^\d{4}-\d{2}(?:-\d{2})?$/.test(text))return {missing:false,value:text};
      const slash=text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if(slash)return {missing:false,value:`${slash[3]}-${slash[2].padStart(2,'0')}-${slash[1].padStart(2,'0')}`};
      // Match the first numeric value only; ignore secondary descriptions/progress text.
      if(/₹|%/.test(text)||/^[-+−]?\d[\d,]*(?:\.\d+)?(?:\s|$)/.test(text)) {
        const match=text.replace(/−/g,'-').match(/[-+]?\s*₹?\s*[-+]?\d[\d,]*(?:\.\d+)?/);
        if(match){const value=Number(match[0].replace(/[₹,\s]/g,''));if(Number.isFinite(value))return {missing:false,value};}
      }
      return {missing:false,value:text.toLocaleLowerCase()};
    }
    function sortTableRows(table, choice) {
      const body=table.tBodies[0];if(!body||!choice)return;
      const all=Array.from(body.rows);
      const pinned=all.filter(row=>row.cells.length<2||row.cells[0].colSpan>1||/^(?:total|total portfolio|grand total)$/i.test(row.cells[0].textContent.trim()));
      const rows=all.filter(row=>!pinned.includes(row));
      const heading=table.tHead?.rows[0]?.cells[choice.column]?.dataset.sortLabel||'';
      const decorated=rows.map((row,index)=>({row,index,key:tableCellSortValue(row.cells[choice.column],heading)}));
      decorated.sort((a,b)=>{
        if(a.key.missing!==b.key.missing)return a.key.missing?1:-1;
        let cmp=typeof a.key.value==='number'&&typeof b.key.value==='number'?a.key.value-b.key.value:String(a.key.value).localeCompare(String(b.key.value),'en',{numeric:true,sensitivity:'base'});
        return (choice.direction==='desc'?-cmp:cmp)||a.index-b.index;
      });
      const desired=[...decorated.map(x=>x.row),...pinned];
      if(desired.some((row,i)=>row!==all[i]))desired.forEach(row=>body.appendChild(row));
      if(['debtEmiHistoryBody','retirementContributionHistoryBody','stallionModalHistoryBody'].includes(body.id))paginateHistoryTable(body.id);
    }
    function initialiseTableSorting() {
      document.querySelectorAll('.form-group').forEach(group => {
        const label = group.querySelector('label');
        const input = group.querySelector('input,select,textarea');
        if (label && input?.id) label.htmlFor = input.id;
      });
      document.querySelectorAll('.table-wrapper').forEach(wrapper => {
        wrapper.tabIndex = 0;
        wrapper.setAttribute('role', 'region');
        wrapper.setAttribute('aria-label', (wrapper.closest('.panel')?.querySelector('h2,h3')?.textContent || 'Data table') + '; scroll horizontally to see all columns');
      });
      document.querySelectorAll('table').forEach(table=>{
        if(table.closest('#rangeReportPrintView'))return;
        if(!table.tHead&&table.tBodies[0]?.rows[0]?.cells.length===2){
          const head=table.createTHead();const row=head.insertRow();
          for(const label of ['Metric','Value']){const th=document.createElement('th');th.textContent=label;row.appendChild(th);}
        }
        const headers=Array.from(table.tHead?.rows[0]?.cells||[]);if(!headers.length)return;
        const key=tableSortKey(table);
        if(!tableSortChoices[key]&&['balanceHistoryBody','houseExpenseBody'].includes(key))tableSortChoices[key]={column:0,direction:'desc'};
        if(key==='balanceHistoryBody'&&tableSortChoices[key]?.column===0)tableSortChoices[key].direction='desc';
        const choice=tableSortChoices[key];
        headers.forEach((th,column)=>{
          const label=th.dataset.sortLabel||th.textContent.trim();th.dataset.sortLabel=label;
          if(label==='Actions')return;
          if(!th.querySelector('.table-sort-button')){
            th.textContent='';const button=document.createElement('button');button.type='button';button.className='table-sort-button';
            const name=document.createElement('span');name.textContent=label;const arrow=document.createElement('span');arrow.className='sort-arrow';arrow.setAttribute('aria-hidden','true');
            button.append(name,arrow);
            if(table.dataset.rangeReportKey){
              const tools=document.createElement('span');tools.className='range-report-header-tools';tools.appendChild(button);
              const filter=document.createElement('button');filter.type='button';filter.className='range-report-column-filter-button';filter.dataset.rangeReportColumnFilter='true';filter.dataset.rangeReportColumn=String(column);filter.setAttribute('aria-haspopup','dialog');filter.setAttribute('aria-expanded','false');filter.setAttribute('aria-label',`Filter ${label} values`);filter.innerHTML='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 2.5h13L9.5 8v4.1l-3 1.4V8L1.5 2.5z"/></svg>';tools.appendChild(filter);th.appendChild(tools);
            }else th.appendChild(button);
            button.addEventListener('click',()=>{
              const old=tableSortChoices[key];const direction=key==='balanceHistoryBody'&&column===0?'desc':old?.column===column&&old.direction==='asc'?'desc':'asc';
              tableSortChoices[key]={column,direction};
              try{trackerStorage.setItem('familyWealthTableSort',JSON.stringify(tableSortChoices));}catch(error){/* Works for session. */}
              if(table.dataset.rangeReportKey)sortRangeReportRows(table,tableSortChoices[key]);
              else if(['pfBody','ppfBody','npsBody','debtsBody'].includes(key)){const kind=key.replace('Body','');accountPages[kind]=0;({pf:renderPf,ppf:renderPpf,nps:renderNps,debts:renderDebts})[kind]();}
              else if(key==='incomeBody'||key==='expenseBody'){
                const kind=key==='incomeBody'?'income':'expense';transactionHistorySorts[kind]=tableSortChoices[key];transactionHistoryPages[kind]=1;
                kind==='income'?renderIncome():renderExpenses();
              }
              initialiseTableSorting();
            });
          }
          const active=choice?.column===column;
          const sort=active?(choice.direction==='asc'?'ascending':'descending'):'none';
          if(th.getAttribute('aria-sort')!==sort)th.setAttribute('aria-sort',sort);
          const arrow=th.querySelector('.sort-arrow');const symbol=active?(choice.direction==='asc'?'▲':'▼'):'↕';
          if(arrow.textContent!==symbol)arrow.textContent=symbol;
          const sortButton=th.querySelector('.table-sort-button');if(sortButton)sortButton.setAttribute('aria-label',`Sort ${label}; ${active?sort:'unsorted'}`);
          const filterButton=th.querySelector('[data-range-report-column-filter]');
          if(filterButton){filterButton.dataset.rangeReportColumn=String(column);const filtered=Object.prototype.hasOwnProperty.call(rangeReportGroups[key]?.columnFilters||{},label);filterButton.classList.toggle('is-active',filtered);filterButton.setAttribute('aria-pressed',String(filtered));}
        });
        if(!table.dataset.rangeReportKey&&!['pfBody','ppfBody','npsBody','debtsBody'].includes(key))sortTableRows(table,choice);
      });
    }
    initialiseTableSorting();
    if(typeof MutationObserver!=='undefined'){
      let sortingQueued=false;
      new MutationObserver(records=>{
        if(!records.some(record=>record.target.closest?.('table')||[...record.addedNodes].some(node=>node.nodeType===1&&(node.matches?.('table')||node.querySelector?.('table')))))return;
        if(sortingQueued)return;sortingQueued=true;
        queueMicrotask(()=>{sortingQueued=false;initialiseTableSorting();});
      }).observe(document.querySelector('.container'),{childList:true,subtree:true});
    }

    // Auto-save on changes
    
  