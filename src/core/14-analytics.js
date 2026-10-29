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
      if(!rows.length){body.innerHTML='<div class="text-muted">No investments added yet.</div>';body.dataset.expandedCategory='';return;}
      const maxValue=Math.max(...rows.map(row=>Math.max(row.current,row.invested)),1);
      const colors=['#3985a1','#ec9c52','#7566c2','#43a88c','#e06f70','#7889a7','#a16c91','#3f9b8e'];
      body.innerHTML=rows.map((row,index)=>{
        const isExpanded=expandedCategory===row.category;
        const investedWidth=Math.min(100,Math.max(0,row.invested/maxValue*100));
        const currentWidth=Math.min(100,Math.max(0,row.current/maxValue*100));
        const changeLeft=Math.min(investedWidth,currentWidth),changeWidth=Math.abs(currentWidth-investedWidth);
        const changeClass=row.gain>0?'is-gain':row.gain<0?'is-loss':'is-neutral';
        const detailId=`completePortfolioDetail${index}`;
        const holdingRows=row.holdings.map(holding=>{
          const gain=holding.current-holding.invested;
          return `<tr><td>${analyticEscape(holding.member||'—')}</td><td>${analyticEscape(holding.label||'Holding')}</td><td class="text-right">${formatCurrency(holding.invested)}</td><td class="text-right">${formatCurrency(holding.current)}</td><td class="text-right ${gain>=0?'positive':'negative'}">${gain>=0?'+':''}${formatCurrency(gain)}</td></tr>`;
        }).join('');
        return `<div class="portfolio-category-group"><button type="button" class="portfolio-category-row" data-portfolio-category="${analyticEscape(row.category)}" aria-expanded="${isExpanded}" aria-controls="${detailId}"><span class="portfolio-category-label"><i class="portfolio-category-dot" style="background:${colors[index%colors.length]}"></i>${analyticEscape(row.category)}</span><span class="portfolio-value-bar" title="Invested ${formatCurrency(row.invested)} · Current ${formatCurrency(row.current)} · Gain ${formatCurrency(row.gain)}"><span class="portfolio-bar-invested" style="width:${investedWidth}%"></span><span class="portfolio-bar-change ${changeClass}" style="left:${changeLeft}%;width:${changeWidth}%"></span></span><span class="portfolio-current-value">${compact(row.current)}</span><span class="portfolio-gain-value ${changeClass}">${row.gain>=0?'+':'−'}${compact(Math.abs(row.gain))} · ${row.return>=0?'+':''}${row.return.toFixed(1)}%</span><span class="portfolio-row-chevron" aria-hidden="true">›</span></button><div class="portfolio-holdings-details" id="${detailId}"${isExpanded?'':' hidden'}><div class="portfolio-holdings-title">${row.holdings.length} ${row.holdings.length===1?'holding':'holdings'}</div><div class="table-wrapper"><table class="portfolio-holdings-table"><thead><tr><th>Member</th><th>Holding</th><th class="text-right">Invested</th><th class="text-right">Current value</th><th class="text-right">Gain / loss</th></tr></thead><tbody>${holdingRows}</tbody></table></div></div></div>`;
      }).join('');
      body.dataset.expandedCategory=expandedCategory;
      body.querySelectorAll('[data-portfolio-category]').forEach(button=>button.addEventListener('click',()=>{
        body.dataset.expandedCategory=button.getAttribute('aria-expanded')==='true'?'':button.dataset.portfolioCategory;
        renderCompletePortfolio();
      }));
    }

