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
      const selectedGroup=root.dataset.activeAssumptionGroup||'';
      const groupChoices='<div class="growth-assumption-choices" role="group" aria-label="Investment assumption groups">'+groups.map(group=>{const count=assetTiles.filter(item=>item.group===group.id).length,label={market:'Market linked',fixed:'Fixed returns','no-return':'No return'}[group.id];return `<button type="button" data-assumption-group="${group.id}" aria-expanded="${selectedGroup===group.id}" aria-controls="growthAssumptionGroup-${group.id}" ${count?'':'disabled'}><strong>${label}</strong><small>${count} ${count===1?'type':'types'}</small></button>`;}).join('')+'</div><p class="growth-assumption-choice-hint"'+(selectedGroup?' hidden':'')+'>Tap a group to show its investments.</p>';
      const groupedMarkup=groups.map(group=>{const items=assetTiles.filter(item=>item.group===group.id);return `<section id="growthAssumptionGroup-${group.id}" data-assumption-group-panel="${group.id}" ${selectedGroup===group.id?'':'hidden'} class="growth-assumption-group growth-assumption-group-${group.accent}"><header class="growth-assumption-group-heading"><div><h3>${group.title}</h3><p>${group.caption}</p></div><span class="growth-assumption-group-count">${items.length} ${items.length===1?'type':'types'}</span></header><div class="growth-assumption-group-grid">${items.map(item=>item.html).join('')}</div></section>`;}).join('');
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
      const select=document.getElementById('growthAdjustmentAsset'),previous=select.value;
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
      let projections,investmentProjections;
      try{
        projections=Object.fromEntries(['stress','base','optimistic'].map(scenario=>[scenario,runGrowthProjection(projectionAssets,years,scenario)]));
        investmentProjections=includeGratuityBalance?Object.fromEntries(['stress','base','optimistic'].map(scenario=>[scenario,runGrowthProjection(assets,years,scenario)])):projections;
      }
      catch(error){summary.innerHTML=`<div class="panel"><strong>Projection needs attention</strong><p>${analyticEscape(error.message)}</p></div>`;body.innerHTML='<tr><td colspan="11" class="text-muted">Adjust the planned withdrawal before viewing projected values.</td></tr>';document.getElementById('growthProjectionTakeaway').textContent='';if(growthProjectionHoverCleanup){growthProjectionHoverCleanup();growthProjectionHoverCleanup=null;}if(growthProjectionChartInstance){growthProjectionChartInstance.destroy();growthProjectionChartInstance=null;}return;}
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

