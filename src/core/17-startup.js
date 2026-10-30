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
        {page:'dashboard',target:'#dashboard .dashboard-page-intro',title:'Your finances at a glance',text:'Home brings together your assets, debts, income and expenses. Use the family profile selector to switch between an individual and the combined view.',tip:'The tour only explains the app. It does not add or change financial records.'},
        {page:'income-expenses',target:'#income-expenses .transaction-intro',title:'Record money in and out',text:'Switch between Income and Expenses, choose a month, and add an entry. Tap an existing transaction to review or edit it when you have edit access.',tip:'Monthly balances record your opening bank balance. Every amount in balance history has its own label.'},
        {page:'income-expenses',target:'#cashRecurringShortcut,#openRecurringBtn',title:'Manage recurring commitments',text:'Recurring items can record regular income, expenses and loan EMIs. Review earlier missed months before adding them, and pause a rule when it is no longer needed.',tip:'The app records entries; it does not send money or make bank payments.'},
        {page:'investments',target:'#investments .investment-page-intro',title:'Track your investments',text:'Add investment and retirement accounts, then tap a tile for holdings, returns and history. The actions inside each holding let you review contributions or update its value.',tip:'A contribution adds money invested. Update value or gain/loss when the market value changes.'},
        {page:'debts',target:'#openAddLoanBtn',title:'Review loans and repayments',text:'Open a loan to see its outstanding balance, payment history and terms. Record EMIs or part payments, and review the preview before changing the rate, EMI or borrowing more.',tip:'Estimates help you plan. Use your bank statement to confirm repayment amounts and interest splits.'},
        {page:'analytics',target:'#analyticsFinancialYear',title:'Understand your reports',text:'Reports includes Analytics, Growth Projection and Date range reports. Choose the financial year for analytics or a date range for detailed records and exports.',tip:'Your selected family profile and report filters affect the records shown.'},
        {page:'growth-projection',target:'#growthProjectionYears',title:'Explore possible growth',text:'Set a time horizon and tap an investment to adjust assumptions. Stress, Base and Optimistic scenarios compare possible results. Tap a scenario below the graph for exact values and its yearly breakdown.',tip:'Projection settings are planning assumptions, not guaranteed returns or changes to your recorded investments.'},
        {page:'settings',target:'#settings .settings-intro',title:'Personalize and share access',text:'Appearance changes your page style and colors. Family access manages member names and invitations. Account settings manage your signed-in profile.',tip:'A family member name does not grant login access. Invitations and roles control access; viewers cannot edit records.'},
        {page:'settings',target:'#settingsInfoPanel',title:'Keep a backup and find help',text:'Use Data & backup to export your records. Importing a backup replaces records, so keep an export first. App & updates shows your installed version and available updates.',tip:'You can replay this tour or download the full guide from App info at any time.'}
      ];
      const dialog=document.createElement('dialog');dialog.id='appGuideTour';dialog.setAttribute('aria-labelledby','appGuideTourTitle');dialog.setAttribute('aria-describedby','appGuideTourText');dialog.setAttribute('aria-modal','false');
      dialog.innerHTML='<header><span id="appGuideTourProgress"></span><button type="button" data-tour-skip aria-label="Skip app tour">Skip</button></header><h2 id="appGuideTourTitle" tabindex="-1"></h2><p id="appGuideTourText"></p><p id="appGuideTourTip"></p><p class="app-guide-instruction">Try the highlighted area, then choose Next. Close any panel you open to continue.</p><footer><button type="button" data-tour-back>Back</button><button type="button" class="btn-primary" data-tour-next>Next</button></footer>';
      document.body.append(dialog);
      let index=0,returnPage='dashboard',returnScroll=0,returnFocus=null,highlighted=null,highlightFrame=0;
      const shouldOffer=newUser=>{const setup=readGettingStartedPreference();if(!newUser||setup?.eligible&&!setup.dismissed)return false;try{return !trackerStorage.getItem(key);}catch(_){return false;}};
      function remember(status){try{trackerStorage.setItem(key,status);}catch(_){}}
      function render(){
        const step=steps[index];
        document.querySelector('.nav-tab[data-tab="'+step.page+'"]')?.click();
        document.getElementById('appGuideTourProgress').textContent='App tour · '+(index+1)+' of '+steps.length;
        document.getElementById('appGuideTourTitle').textContent=step.title;
        document.getElementById('appGuideTourText').textContent=step.text;
        document.getElementById('appGuideTourTip').textContent=step.tip;
        highlighted?.classList.remove('app-tour-target');cancelAnimationFrame(highlightFrame);
        highlightFrame=requestAnimationFrame(()=>{
          if(!dialog.open)return;
          highlighted=[...document.querySelectorAll(step.target)].find(node=>node.getClientRects().length)||document.querySelector('#'+step.page+' .settings-intro, #'+step.page+' .page-intro, #'+step.page+' h1');
          highlighted?.classList.add('app-tour-target');highlighted?.scrollIntoView({block:'center',behavior:'instant'});
        });
        dialog.querySelector('[data-tour-back]').disabled=index===0;
        dialog.querySelector('[data-tour-next]').textContent=index===steps.length-1?'Finish':'Next';
        document.getElementById('appGuideTourTitle').focus({preventScroll:true});
      }
      function finish(status){
        remember(status);cancelAnimationFrame(highlightFrame);dialog.close();highlighted?.classList.remove('app-tour-target');highlighted=null;document.body.classList.remove('app-guide-open');
        document.querySelector('.nav-tab[data-tab="'+returnPage+'"]')?.click();
        window.scrollTo({top:returnScroll,behavior:'instant'});
        if(returnFocus?.isConnected&&!returnFocus.closest('#settingsPanelParking'))returnFocus.focus({preventScroll:true});
      }
      function start(){
        if(dialog.open)return;
        if([...document.querySelectorAll('dialog[open]:not(#settingsTileDialog),[aria-modal="true"]:not(dialog)')].some(node=>node.getClientRects().length&&getComputedStyle(node).visibility!=='hidden'))return;
        returnPage=document.querySelector('.nav-tab.active')?.dataset.tab||'dashboard';returnScroll=window.scrollY;returnFocus=document.activeElement;
        window.closeSettingsTile?.();index=0;remember('started');document.body.classList.add('app-guide-open');dialog.show();render();
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



    })().then(async()=>{if(!storageLoadFailed){let savedPage;try{savedPage=trackerStorage.getItem('activePage');}catch(_){}const savedTab=[...document.querySelectorAll('.nav-tab')].find(tab=>tab.dataset.tab===savedPage);savedTab?.click();window.dispatchEvent(new Event('pft:before-reveal'));window.PFTPerformance?.mark('layout-ready');document.querySelector('.container').inert=false;window.financeCloud.showApp();window.PFTPerformance?.mark('visible');window.dispatchEvent(new Event('pft:visible'));void verifyStartupRevision();const newTourUser=firstNameSetupNeeded(state,profileMemberNames())&&(!window.financeCloud?.role||window.financeCloud.role==='owner');setupAppTour(newTourUser||readGettingStartedPreference()?.wizardComplete===true);applyFamilyRoleControls();startRecurringItems();warmStartupPages();}}).catch(error=>{storageLoadFailed=true;window.financeCloud?.lock(error);});
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
    
  
