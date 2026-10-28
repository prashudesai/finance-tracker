    // INVESTMENTS
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
      if(tableSource){const clone=tableSource.cloneNode(true);clone.classList.add('investment-category-dialog-table');table.appendChild(clone);labelInvestmentDialogCells(table);}
      else table.textContent='No holdings available.';
      dialog.dataset.investmentType=type;
      if(show&&dialog.hidden){dialog.hidden=false;document.body.style.overflow='hidden';dialog.querySelector('[data-close-investment-category-dialog]')?.focus();}
    }
    // Preserve the original account table and its actions while presenting rows as cards on phones.
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
    function refreshInvestmentCategoryDialog() {
      const dialog=document.getElementById('investmentCategoryDialog');
      if(dialog&&!dialog.hidden&&dialog.dataset.investmentType)renderInvestmentCategoryDialog(dialog.dataset.investmentType,false);
    }
    function closeInvestmentCategoryDialog() {
      const dialog=document.getElementById('investmentCategoryDialog');
      if(dialog&&!dialog.hidden){dialog.hidden=true;delete dialog.dataset.investmentType;syncInvestmentOverlayBodyLock();}
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
      if(tableSource){const clone=tableSource.cloneNode(true);clone.classList.add('investment-category-dialog-table');clone.querySelectorAll('[id]').forEach(element=>element.removeAttribute('id'));table.appendChild(clone);labelInvestmentDialogCells(table);}
      else table.textContent='No account details available.';
      const pagerSource=card.querySelector(`#accountPager-${type}`);
      if(pagerSource){const pager=pagerSource.cloneNode(true);pager.removeAttribute('id');pager.onclick=event=>{const button=event.target.closest('[data-direction]');if(!button)return;accountPages[type]=Math.max(0,(accountPages[type]||0)+Number(button.dataset.direction));({pf:renderPf,ppf:renderPpf,nps:renderNps}[type]||(()=>{}))();};table.appendChild(pager);}
      const actions=document.getElementById('retirementCategoryDialogActions');actions.replaceChildren();
      const sourceActions=card.querySelector('.retirement-account-actions');
      if(sourceActions){const clone=sourceActions.cloneNode(true);clone.querySelectorAll('[id]').forEach(element=>element.removeAttribute('id'));actions.appendChild(clone);}
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
            <td class="investment-row-actions"><div class="investment-row-action-group"><button type="button" class="investment-icon-action" title="View History" data-short-action="History" aria-label="View contribution history" onclick="openInvestmentContributionModal('${inv.id}')"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg></button><button type="button" class="investment-icon-action" title="Add Contribution" data-short-action="Add" aria-label="Add contribution" onclick="openManualInvestmentContribution('${inv.id}')"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 8v8M8 12h8"></path></svg></button><button type="button" class="investment-icon-action" title="Edit" data-short-action="Edit" aria-label="Edit holding" onclick="editInvestment('${inv.id}')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 16.5-.8 4.3 4.3-.8L19 8.5 15.5 5 4 16.5Z"></path><path d="m13.5 7 3.5 3.5"></path></svg></button><button type="button" class="investment-icon-action is-danger" title="Delete" data-short-action="Delete" aria-label="Delete holding" onclick="deleteInvestment('${inv.id}')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3"></path></svg></button></div></td>
          </tr>`;
        }).join('');
        const extraHeaders=`${hasReturnMetrics?'<th class="text-right" title="(Current value − total invested) ÷ total invested">Absolute Return</th><th class="text-right" title="Annualized return from the holding start date; contribution dates are not weighted">CAGR</th><th class="text-right" title="Annualized return using initial investment, dated contributions and current value">XIRR</th>':''}${hasRate?'<th class="text-right" title="Annual interest rate entered for this holding">Interest Rate</th>':''}`;
        const emptySpan=6+(hasMonthlyContribution?1:0)+(hasReturnMetrics?3:0)+(hasRate?1:0);
        return `<section class="panel investment-category-card" data-category-index="${defaultCategoryOrder.indexOf(category)}" data-investment-type="${analyticEscape(category)}">
          <div class="panel-header"><div><h3>${analyticEscape(category)}</h3><div class="investment-category-summary">${items.length} ${items.length===1?'holding':'holdings'}</div></div></div>
          <div class="investment-category-summary-grid" role="button" tabindex="0" aria-haspopup="dialog" aria-label="View ${analyticEscape(category)} holdings">
            <span class="investment-summary-value"><span>Current value</span><strong>${formatCurrency(currentTotal)}</strong></span>
            <span class="investment-summary-metric" data-category-summary-metric="${tileMetric.key}"${tileMetric.title?` title="${analyticEscape(tileMetric.title)}"`:''}><span>${tileMetric.label}</span><strong>${analyticEscape(tileMetric.value)}</strong></span>
            <span class="investment-summary-chevron" aria-hidden="true">›</span>
            <span class="investment-summary-detail"><span>Invested</span><strong>${formatCurrency(investedTotal)}</strong></span>
            <span class="investment-summary-detail"><span>Gain / loss</span><strong class="${gainTotal>=0?'positive':'negative'}">${gainTotal>=0?'+':''}${formatCurrency(gainTotal)}</strong></span>
            ${hasMonthlyContribution?`<span class="investment-summary-detail"><span>Monthly</span><strong>${formatCurrency(monthlyTotal)}</strong></span>`:''}
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
      stallionBody.innerHTML=hasStallion?`<div class="table-wrapper"><table class="stallion-pms-holdings ${showStallionMonthly?'has-monthly':'no-monthly'}"><thead><tr><th>Member</th><th>Name</th><th class="text-right">Invested</th><th class="text-right">Current Value</th>${showStallionMonthly?'<th class="text-right">Monthly</th>':''}<th class="text-right">Gain/Loss</th><th class="text-right" title="(Current value − total invested) ÷ total invested">Absolute Return</th><th class="text-right" title="Annualized absolute return from the portfolio start date; monthly contribution dates are not weighted">CAGR</th><th class="text-right" title="Annualized return based on initial investment, dated PMS contributions and current value as of today">XIRR</th><th>Actions</th></tr></thead><tbody>${stallionItems.map(inv=>{const gain=Number(inv.current||0)-Number(inv.invested||0),absoluteReturn=stallionAbsoluteReturn(inv),cagr=stallionCagr(inv,valuationDate),xirr=stallionXirr(inv,valuationDate,stallionContributionsById.get(inv.id)||[]);return `<tr><td data-label="Member"><strong>${analyticEscape(inv.member||'—')}</strong></td><td data-label="Name">${analyticEscape(inv.name)}</td><td class="text-right" data-label="Invested">${formatCurrency(inv.invested)}</td><td class="text-right" data-label="Current Value">${formatCurrency(inv.current)}</td>${showStallionMonthly?`<td class="text-right" data-label="Monthly Contribution">${formatCurrency(investmentMonthlyAmount(inv))}</td>`:''}<td class="text-right ${gain>=0?'positive':'negative'}" data-label="Gain / Loss">${gain>=0?'+':''}${formatCurrency(gain)}</td><td class="text-right" data-label="Absolute Return">${absoluteReturn===null?'N/A':(absoluteReturn*100).toFixed(2)+'%'}</td><td class="text-right" data-label="CAGR">${cagr===null?'N/A':(cagr*100).toFixed(2)+'%'}</td><td class="text-right" data-label="XIRR">${xirr===null?'N/A':(xirr*100).toFixed(2)+'%'}</td><td class="investment-row-actions" data-label="Actions"><button class="btn-small" onclick="openStallionHistory('${inv.id}')">View History</button> <button class="btn-small" onclick="editInvestment('${inv.id}')">Edit</button> <button class="btn-small btn-danger" onclick="deleteInvestment('${inv.id}')">Delete</button></td></tr>`;}).join('')}</tbody></table></div>`:'';
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


