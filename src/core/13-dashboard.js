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
          const left=48,right=625,top=18,bottom=165,height=bottom-top,width=right-left,maxValue=Math.max(1,...periods.flatMap(row=>[row.income,row.expenses]))*1.12;
          const xAt=index=>periods.length===1?left+width/2:left+width*index/(periods.length-1),yAt=value=>bottom-height*value/maxValue;
          const lineFor=key=>periods.map((row,index)=>`${index?'L':'M'}${xAt(index).toFixed(1)},${yAt(row[key]).toFixed(1)}`).join(' ');
          const incomePath=lineFor('income'),expensePath=lineFor('expenses');
          const grid=[0,.5,1].map(fraction=>{const y=bottom-height*fraction,value=maxValue*fraction;return `<line class="cash-grid" x1="${left}" y1="${y.toFixed(1)}" x2="${right}" y2="${y.toFixed(1)}"/><text class="cash-axis" x="${left-7}" y="${(y+3).toFixed(1)}" text-anchor="end">${analyticCompact(value)}</text>`;}).join('');
          const labels=periods.map((row,index)=>`<text class="cash-axis" x="${xAt(index).toFixed(1)}" y="188" text-anchor="middle">${analyticEscape(row.label)}</text>`).join('');
          const incomePoints=periods.map((row,index)=>`<circle class="cash-point-income" cx="${xAt(index).toFixed(1)}" cy="${yAt(row.income).toFixed(1)}" r="3.2"><title>${analyticEscape(row.label)} income: ${formatCurrency(row.income)}</title></circle>`).join('');
          const expensePoints=periods.map((row,index)=>`<circle class="cash-point-expense" cx="${xAt(index).toFixed(1)}" cy="${yAt(row.expenses).toFixed(1)}" r="3"><title>${analyticEscape(row.label)} expenses: ${formatCurrency(row.expenses)}</title></circle>`).join('');
          const area=`${incomePath} L${xAt(periods.length-1).toFixed(1)},${bottom} L${xAt(0).toFixed(1)},${bottom} Z`;
          cashSvg.innerHTML=`<g aria-hidden="true">${grid}${labels}</g><path class="cash-income-area" d="${area}"/><path class="cash-income" d="${incomePath}"/><path class="cash-expense" d="${expensePath}"/>${incomePoints}${expensePoints}<g class="cash-hover-layer" visibility="hidden" pointer-events="none"><line class="cash-hover-guide" x1="0" y1="${top}" x2="0" y2="${bottom}"/><circle class="cash-hover-income" cx="0" cy="0" r="4.5"/><circle class="cash-hover-expense" cx="0" cy="0" r="4.5"/><rect class="cash-hover-box" x="0" y="0" width="190" height="48" rx="7"/><text class="cash-hover-title" x="9" y="13"></text><text class="cash-hover-label" x="9" y="28">Income</text><text class="cash-hover-value cash-hover-income-value" x="48" y="28"></text><text class="cash-hover-label" x="9" y="40">Expenses</text><text class="cash-hover-value cash-hover-expense-value" x="56" y="40"></text></g>`;
          const hoverLayer=cashSvg.querySelector('.cash-hover-layer');
          const hideCashTooltip=()=>{if(hoverLayer)hoverLayer.setAttribute('visibility','hidden');};
          cashSvg.onpointermove=event=>{
            if(!hoverLayer||!periods.length)return;
            const matrix=cashSvg.getScreenCTM();if(!matrix)return;
            const point=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());
            if(point.x<left||point.x>right||point.y<top||point.y>bottom){hideCashTooltip();return;}
            const index=periods.length===1?0:Math.max(0,Math.min(periods.length-1,Math.round((point.x-left)/width*(periods.length-1))));
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
          menu.style.left=Math.max(12,Math.min(rect.right-menu.getBoundingClientRect().width,window.innerWidth-menu.getBoundingClientRect().width-12))+'px';
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
            menu.querySelector('[aria-selected="true"]')?.scrollIntoView({block:'nearest'});
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
      for(const [id,value] of [['lastMonthHouseExpense',calculated?house:null],['lastMonthFullExpense',full]]){const node=document.getElementById(id);node.textContent=value===null?'Pending':formatCurrency(value);node.style.color=value!==null&&value<0?'var(--danger)':'var(--primary)';}
    }
    window.addEventListener('resize',renderDashboardExpenseSnapshot,{passive:true});
