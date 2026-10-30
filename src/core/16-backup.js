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
      let cloudCleared=false,clearOwnsSync=false,clearCompleted=false;
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
        try{trackerStorage.setItem('activePage','dashboard');}catch(_){}
        clearCompleted=true;
        status.textContent='Dashboard deleted. Signing you out…';
        });
      }catch(error){
        status.textContent=cloudCleared?'Cloud data was cleared, but this device could not finish updating. Reload to load the empty cloud tracker.':error.message;
        if(cloudCleared){storageLoadFailed=true;window.financeCloud.lock(new Error(status.textContent));}
      }finally{
        if(clearOwnsSync)syncBusy=false;dataOperationBusy=false;document.getElementById('settingsTileContent').inert=false;phrase.disabled=false;delete dialog.dataset.deleting;document.getElementById('settingsTileClose').disabled=false;updateClearControls();
      }
      if(clearCompleted){
        try{await window.financeCloud.logout();}
        catch(error){status.textContent='Dashboard deleted, but sign-out did not finish. Use Sign out in Settings. '+error.message;}
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


