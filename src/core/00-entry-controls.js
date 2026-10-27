

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
      portfolio.current=portfolio.invested+latest.profit;if(pms)pms.profit=latest.profit;
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

