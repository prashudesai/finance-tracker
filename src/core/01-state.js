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

