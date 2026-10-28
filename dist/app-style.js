// Layout preferences only: both styles reuse the same tracker forms, records and handlers.
(() => {
  'use strict';
  const root=document.documentElement;
  const key='displayStyle';
  const pages=[['dashboard','Dashboard','Home','<path d="m3 10 9-7 9 7v11H3zM9 21v-8h6v8"/>'],['income-expenses','Income & Expense','Cash flow','<path d="M7 3v17m-4-4 4 4 4-4M17 21V4m-4 4 4-4 4 4"/>'],['investments','Investment','Investments','<path d="M3 20V10h4v10m3 0V5h4v15m3 0V2h4v18"/>'],['debts','Debts','Debts','<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M6 15h4"/>'],['analytics','Analytics & Reports','Reports','<path d="M3 21h18M5 17l5-6 4 2 6-9"/>'],['settings','Settings','Settings','<path d="M4 3v6m0 4v8M12 3v10m0 4v4M20 3v2m0 4v12M1 9h6M9 17h6M17 5h6"/>']];
  const analyticsPages=new Set(['analytics','reports','growth-projection']);
  let controls,nav;
  function activePage(){return document.querySelector('.nav-tab.active')?.dataset.tab||'dashboard';}
  function updateSelection(){
    const active=activePage(),group=analyticsPages.has(active)?'analytics':active;
    nav?.querySelectorAll('[data-style-page]').forEach(button=>{
      const selected=button.dataset.stylePage===group;button.classList.toggle('active',selected);
      if(selected)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
    });
    document.querySelectorAll('[data-style-report-page]').forEach(button=>{
      const selected=button.dataset.styleReportPage===active;button.classList.toggle('active',selected);button.setAttribute('aria-pressed',String(selected));
    });
  }
  function openPage(page){document.querySelector('.nav-tab[data-tab="'+page+'"]')?.click();updateSelection();}
  function applyStyle(value,persist=true){
    const style=['modern','emerald-flow','obsidian-black'].includes(value)?value:'modern';
    if(style==='obsidian-black')window.PFTBlackTheme?.select();else window.PFTBlackTheme?.leave();
    const layoutStyle='modern';
    if(typeof closeEntryFormModal==='function'&&!document.getElementById('entryFormModal')?.hidden)closeEntryFormModal();
    root.dataset.appStyle=layoutStyle;
    root.dataset.layoutStyle=style==='obsidian-black'?'modern':style;root.dataset.appearanceChoice=style;window.PFTPaint?.remember();
    if(persist){try{window.trackerStorage.setItem(key,style);}catch(_){/* The layout still applies to this session. */}}
    controls?.querySelectorAll('[data-app-style-choice]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.appStyleChoice===style)));
    const labels={modern:'Style 1 · Modern','emerald-flow':'Style 2 · Emerald Flow','obsidian-black':'Style 3 · Obsidian Black'};
    const status=document.getElementById('appStyleStatus');if(status)status.textContent=labels[style]+' selected. This preference is saved for this account on this device.';
    const familyMenu=document.getElementById('familyProfileMenu');if(familyMenu)familyMenu.hidden=true;window.syncFamilyProfileButtons?.();
    window.setMobileNavHidden?.(false);
    requestAnimationFrame(()=>{window.dispatchEvent(new Event('resize'));if(window.Chart?.instances)Object.values(window.Chart.instances).forEach(chart=>chart.resize?.());});
    updateSelection();
  }
  function install(){
    if(document.getElementById('appStyleChoices'))return;
    const header=document.querySelector('.container > header');
    const brand=document.createElement('div');brand.className='pft-style-brand';brand.innerHTML='<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="20" cy="20" r="14"/><path d="m8 29 9-11 7 4 10-16M26 6h8v8"/><path d="M15 26h10"/></svg><span>My finances</span>';
    header.children[0].after(brand);
    nav=document.createElement('nav');nav.className='pft-style-navigation';nav.setAttribute('aria-label','Main tracker pages');
    for(const [id,label,short,path] of pages){
      const b=document.createElement('button');b.type='button';b.dataset.stylePage=id;b.setAttribute('aria-label',label===short?label:short+' · '+label);b.title=label;
      b.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true">'+path+'</svg><span class="pft-desktop-label"></span><span class="pft-mobile-label"></span>';
      b.querySelector('.pft-desktop-label').textContent=label;b.querySelector('.pft-mobile-label').textContent=short;
      b.addEventListener('click',()=>openPage(id));nav.append(b);
    }
    header.insertBefore(nav,header.querySelector('.header-controls'));
    const hero=document.createElement('section');hero.className='pft-style-hero';hero.setAttribute('aria-labelledby','pftStyleHeroTitle');
    hero.innerHTML='<div><h1 id="pftStyleHeroTitle">My finances</h1><p class="pft-style-hero-subtitle">All your money in one place</p><p>Track your income, expenses, investments and debts<br>for a clearer financial picture.</p></div><div class="pft-style-art" aria-hidden="true"><i></i><i></i><i></i><span>BUILDING YOUR TOMORROW</span></div>';
    const dashboard=document.getElementById('dashboard'),quick=document.getElementById('trackerQuickAdd');dashboard.prepend(hero);if(quick){
      const toolbar=document.createElement('div');toolbar.className='pft-dashboard-toolbar';
      const caption=document.createElement('div');caption.className='pft-dashboard-caption';
      caption.innerHTML='<p>Your family. Your future.</p><h1>Your financial life,<br><span>beautifully in sync.</span></h1>';
      hero.after(toolbar);toolbar.append(caption,quick);
    }
    for(const id of analyticsPages){
      const section=document.getElementById(id);if(!section)continue;
      const tabs=document.createElement('nav');tabs.className='pft-style-report-tabs';tabs.setAttribute('aria-label','Analytics and reports sections');
      for(const [page,label] of [['analytics','Analytics'],['growth-projection','Growth Projection'],['reports','Date range reports']]){
        const b=document.createElement('button');b.type='button';b.dataset.styleReportPage=page;b.textContent=label;b.addEventListener('click',()=>openPage(page));tabs.append(b);
      }
      const intro=section.querySelector(':scope > header,:scope > .growth-page-intro');if(intro)intro.after(tabs);else section.prepend(tabs);
    }
    const dashboardSlots={monthlyExpenses:'debts',monthlyIncome:'income',surplusBalance:'balance',monthlyContrib:'savings',lastMonthHouseExpense:'expense',fyAvgIncome:'average'};
    for(const [id,slot] of Object.entries(dashboardSlots))document.getElementById(id)?.closest('.dashboard-stat,.dashboard-wide-card')?.setAttribute('data-layout-slot',slot);
    const panel=document.getElementById('settingsAppearancePanel')||document.querySelector('.settings-appearance-panel');
    controls=document.createElement('section');controls.id='appStyleChoices';controls.className='pft-style-choices';controls.setAttribute('aria-labelledby','appStyleChoicesTitle');
    controls.innerHTML='<h3 id="appStyleChoicesTitle">Page style</h3><p>Choose the page design and navigation you prefer. All styles use the same tracker records.</p><div class="pft-style-choice-grid"><button type="button" data-app-style-choice="modern" aria-pressed="false"><span class="pft-style-swatch modern" aria-hidden="true"><i></i><i></i><i></i></span><strong>Style 1 · Modern <small>Default</small></strong><span>Teal & mint, top navigation and compact mobile pages.</span></button><button type="button" data-app-style-choice="emerald-flow" aria-pressed="false"><span class="pft-style-swatch emerald-flow" aria-hidden="true"><i></i><i></i><i></i></span><strong>Style 2 · Emerald Flow</strong><span>New page workspaces, interactive graphs, and emerald lighting.</span></button><button type="button" data-app-style-choice="obsidian-black" aria-pressed="false"><span class="pft-style-swatch obsidian-black" aria-hidden="true"><i></i><i></i><i></i></span><strong>Style 3 · Obsidian Black</strong><span>Black surfaces with mint accents and the modern layout.</span></button></div><p id="appStyleStatus" role="status"></p>';
    controls.querySelectorAll('[data-app-style-choice]').forEach(b=>b.addEventListener('click',()=>applyStyle(b.dataset.appStyleChoice)));
    panel?.prepend(controls);
    const oldNav=document.querySelector('.nav-tabs');if(oldNav)new MutationObserver(updateSelection).observe(oldNav,{attributes:true,subtree:true,attributeFilter:['class']});
    let saved;try{saved=window.trackerStorage.getItem(key);}catch(_){}
    const legacyBlack=root.dataset.colorTheme==='obsidian-black'&&saved!=='obsidian-black';
    applyStyle(legacyBlack?'obsidian-black':saved,saved==='classic'||legacyBlack);
    window.PFT_STYLE={apply:applyStyle,get current(){return root.dataset.appearanceChoice||root.dataset.layoutStyle||root.dataset.appStyle;}};
  }
  window.addEventListener('pft:before-reveal',install);
  Promise.resolve(window.trackerReady).then(()=>{if(window.financeCloud)install();}).catch(()=>{});
})();

// Emerald Flow owns its page composition. Existing controls are moved, never cloned.
(() => {
 'use strict';
 const root=document.documentElement, moves=[], spaces=[], charts=new WeakMap();
 let enabled=false, frame=0,adaptCashLayout=()=>{};
 const $=(s,p=document)=>p.querySelector(s);
 const $$=(s,p=document)=>[...p.querySelectorAll(s)];
 const el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls;if(text)n.textContent=text;return n;};
 const space=(page,cls)=>{const n=el('section','flow-workspace '+cls);n.hidden=true;$(page).append(n);spaces.push(n);return n;};
 const slot=(parent,cls)=>{const n=el('div',cls);parent.append(n);return n;};
 const capture=(selector,dest)=>{const node=$(selector);if(!node)return;const anchor=document.createComment('flow-original:'+selector);(node.closest('.cash-tools')||node).before(anchor);moves.push({node,anchor,dest});};
 function captureAll(selector,dest){$$(selector).sort((a,b)=>Number(b.classList.contains('advanced-cashflow-entry-card'))-Number(a.classList.contains('advanced-cashflow-entry-card'))).forEach(node=>{const anchor=document.createComment('flow-original-panel');node.before(anchor);moves.push({node,anchor,dest});});}
 function tabs(parent,labels){const bar=el('div','flow-tabs');bar.setAttribute('role','tablist');parent.append(bar);const panes=labels.map((label,i)=>{const pane=slot(parent,'flow-pane');pane.id='flow-pane-'+spaces.length+'-'+i;pane.setAttribute('role','tabpanel');const button=el('button','',label);button.type='button';button.setAttribute('role','tab');button.setAttribute('aria-controls',pane.id);bar.append(button);return{pane,button};});function show(index){panes.forEach(({pane,button},i)=>{pane.hidden=i!==index;button.setAttribute('aria-selected',String(i===index));button.tabIndex=i===index?0:-1;});requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')));}panes.forEach(({button},i)=>{button.onclick=()=>show(i);button.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?panes.length-1:(i+(e.key==='ArrowRight'?1:panes.length-1))%panes.length;show(next);panes[next].button.focus();}};});show(0);return{panes,show};}
 function action(parent,label,fn,primary=false){const b=el('button',primary?'btn-primary':'btn-secondary',label);b.type='button';b.onclick=fn;parent.append(b);return b;}
 function open(page){$('.nav-tab[data-tab="'+page+'"]')?.click();}
 function build(){
  const home=space('#dashboard','flow-home');
  const title=slot(home,'flow-heading');const copy=slot(title,'');copy.append(el('p','flow-eyebrow','ALL YOUR MONEY IN ONE PLACE'),el('h1','','My finances'));const actions=slot(title,'flow-actions');
  action(actions,'+ Add income',()=>{open('income-expenses');window.financeCashFlow?.open('income');},true);action(actions,'Add expense',()=>{open('income-expenses');window.financeCashFlow?.open('expense');});
  const summary=slot(home,'flow-summary');const wealth=slot(summary,'flow-wealth');capture('#dashboard .dashboard-net-worth',wealth);const stats=slot(summary,'flow-stat-grid');for(const id of ['monthlyIncome','surplusBalance','monthlyContrib','monthlyExpenses']){const n=document.getElementById(id)?.closest('.dashboard-stat');if(n){const a=document.createComment('flow-stat');n.before(a);moves.push({node:n,anchor:a,dest:stats});}}
  const insights=slot(home,'flow-insights');const chart=slot(insights,'flow-chart panel');const ch=slot(chart,'flow-chart-heading');const chartCopy=slot(ch,'');chartCopy.append(el('p','flow-eyebrow','CASH FLOW'),el('h2','','Income & spending'));const fy=el('span','flow-period');fy.id='flowPeriod';ch.append(fy);const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.id='flowCashChart';svg.setAttribute('viewBox','0 0 800 300');svg.setAttribute('role','img');chart.append(svg);const tooltip=el('p','flow-chart-tooltip','Select a month to inspect income and expenses.');tooltip.setAttribute('role','status');chart.append(tooltip);svg.addEventListener('click',showChartAmount);svg.addEventListener('focusin',showChartAmount);svg.addEventListener('pointerover',showChartAmount);const legend=slot(chart,'flow-chart-legend');legend.innerHTML='<span><i></i>Income</span><span><i class="expense"></i>Expenses</span><span class="flow-chart-hint">Hover or tap a bar for the amount</span>';const empty=el('p','flow-empty');empty.id='flowCashEmpty';chart.append(empty);
  const allocation=slot(insights,'flow-allocation panel');allocation.append(el('p','flow-eyebrow','PORTFOLIO MIX'),el('h2','','Where your money is invested'));const bars=slot(allocation,'flow-allocation-bars');bars.id='flowAllocationBars';
  const body=slot(home,'flow-home-body');const portfolio=slot(body,'flow-main');capture('#dashboard .dashboard-portfolio-panel',portfolio);const rail=slot(body,'flow-rail');capture('#dashboard .debt-summary-panel',rail);capture('#dashboard [data-layout-slot="expense"]',rail);capture('#dashboard [data-layout-slot="average"]',rail);
  const cashMoveStart=moves.length;
  const cash=space('#income-expenses','flow-cash');const cashRail=slot(cash,'flow-rail');capture('#income-expenses .transaction-overview',cashRail);capture('#income-expenses .recurring-launch',cashRail);const ledger=slot(cash,'flow-main panel');ledger.append(el('p','flow-eyebrow','RECORDS & ACTIVITY'),el('h2','','Cash flow workspace'));const cashTabs=tabs(ledger,['Income','Expenses']);captureAll('#income-expenses .transaction-panel-income',cashTabs.panes[0].pane);captureAll('#income-expenses .transaction-panel-expense',cashTabs.panes[1].pane);const surplus=slot(cash,'flow-full');capture('#income-expenses .transaction-surplus',surplus);
  const cashMoves=moves.slice(cashMoveStart);let cashDesktop=null;
  function adaptCash(){const desktop=enabled&&!matchMedia('(max-width:700px)').matches;cashDesktop=desktop;if(desktop){for(const m of cashMoves)m.dest.append(m.node);cash.hidden=false;}else{for(const m of [...cashMoves].reverse())if(m.anchor.parentNode)m.anchor.after(m.node);cash.hidden=true;const tools=$('#income-expenses .cash-tools');if(matchMedia('(max-width:700px)').matches&&tools)tools.append($('#income-expenses .transaction-surplus'));}}
  window.addEventListener('pft:desktop-cash-kind',e=>{if(cashDesktop)cashTabs.show(e.detail==='income'?0:1);});
  matchMedia('(max-width:700px)').addEventListener('change',adaptCash);adaptCashLayout=adaptCash;
  const invest=space('#investments','flow-investments');const investSummary=slot(invest,'flow-full');capture('#investments .investment-overview-grid',investSummary);const investMain=slot(invest,'flow-full panel');investMain.append(el('p','flow-eyebrow','YOUR HOLDINGS'),el('h2','','Investment workspace'));const it=tabs(investMain,['Portfolio','Retirement','Stallion PMS']);capture('#investmentListPanel',it.panes[0].pane);capture('#investments .retirement-accounts-section',it.panes[1].pane);capture('#stallionPmsPanel',it.panes[2].pane);const pmsEmpty=el('p','flow-empty','No Stallion PMS holding recorded. Add one from the Portfolio tab to get started.');pmsEmpty.id='flowPmsEmpty';it.panes[2].pane.append(pmsEmpty);
  const investmentMedia=matchMedia('(max-width:700px)');
  function adaptInvestmentTabs(){
   const mobile=enabled&&investmentMedia.matches;
   const portfolio=it.panes[0],stallion=it.panes[2];
   portfolio.button.textContent=mobile?'Investments':'Portfolio';
   stallion.button.style.display=mobile?'none':'';
   stallion.button.setAttribute('aria-hidden',String(mobile));
   if(!enabled)return;
   const target=mobile?portfolio.pane:stallion.pane;
   const pms=document.getElementById('stallionPmsPanel');
   if(pms&&pms.parentNode!==target)target.append(pms);
   if(pmsEmpty.parentNode!==target)target.append(pmsEmpty);
   if(mobile&&stallion.button.getAttribute('aria-selected')==='true')it.show(0);
  }
  investmentMedia.addEventListener('change',adaptInvestmentTabs);
  const debt=space('#debts','flow-debts');const debtRail=slot(debt,'flow-rail');capture('#debts .debt-page-overview',debtRail);const debtMain=slot(debt,'flow-main');capture('#loanAddPanel',debtMain);capture('#debts .debt-list-panel',debtMain);
  const analytics=space('#analytics','flow-analytics');const analyticsBody=slot(analytics,'flow-full');capture('#analytics .advanced-analytics-overview',analyticsBody);capture('#analytics .analytics-grid',analyticsBody);
  const growth=space('#growth-projection','flow-growth');const gr=slot(growth,'flow-full');capture('#growthProjectionControls',gr);capture('#growth-projection .growth-projection-chart-panel',gr);capture('#growth-projection .growth-assumptions-panel',gr);capture('#growthContributionExclusionsWrap',gr);capture('#growth-projection .growth-scenario-panel',gr);capture('#growth-projection .growth-breakdown-panel',gr);
  const reports=space('#reports','flow-reports');const reportRail=slot(reports,'flow-rail panel');reportRail.append(el('p','flow-eyebrow','BUILD YOUR REPORT'),el('h2','','Period & filters'));capture('#reports .report-quick-range',reportRail);capture('#reports .report-builder-content > .form-grid',reportRail);capture('#reports .report-action-bar',reportRail);capture('#reports .report-calculation-note',reportRail);const reportMain=slot(reports,'flow-main panel');reportMain.append(el('p','flow-eyebrow','RESULTS'),el('h2','','Recorded activity'));for(const id of ['rangeReportStatus','rangeReportActiveFilters','rangeReportSummary','rangeReportResults','rangeReportColumnFilterPopover'])capture('#'+id,reportMain);
  const settings=space('#settings','flow-settings');const sc=slot(settings,'flow-main panel');sc.append(el('p','flow-eyebrow','MAKE IT YOURS'),el('h2','','Settings & preferences'));capture('#settingsQuickTiles',sc);const sr=slot(settings,'flow-rail');capture('#settings .cloud-account-panel',sr);
  new MutationObserver(()=>{if(enabled){styleCharts(true);schedule();}}).observe($('.nav-tabs'),{attributes:true,subtree:true,attributeFilter:['class']});
  const originalChart=$('#advancedDashboardCashflowChart');if(originalChart)new MutationObserver(schedule).observe(originalChart,{childList:true,subtree:true});const allocationLegend=$('#advancedDashboardAllocationLegend');if(allocationLegend)new MutationObserver(schedule).observe(allocationLegend,{childList:true,subtree:true});
  const debtBody=$('#debtsBody');if(debtBody)new MutationObserver(()=>{if(enabled)labelDebtCards();}).observe(debtBody,{childList:true,subtree:true});
 }
 function showChartAmount(event){const group=event.target.closest('[data-flow-month]');if(!group)return;const svg=group.ownerSVGElement;const m=svg.__flowMonths?.[Number(group.dataset.flowMonth)];if(!m)return;const money=n=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n);svg.parentNode.querySelector('.flow-chart-tooltip').textContent=m.label+' · Income '+money(m.income)+' · Expenses '+money(m.expense);}
 function labelDebtCards(){const table=$('#debtsBody')?.closest('table');if(!table)return;const heads=$$('thead th',table).map(h=>h.textContent.trim());$$('#debtsBody tr').forEach(tr=>$$('td',tr).forEach((td,i)=>{if(td.getAttribute('data-flow-label')!==heads[i])td.setAttribute('data-flow-label',heads[i]||'');}));}
 function schedule(){if(!enabled||frame)return;frame=requestAnimationFrame(()=>{frame=0;draw();});}
 function draw(){
  if(!enabled)return;
  try{
   const now=new Date(),year=now.getMonth()>=3?now.getFullYear():now.getFullYear()-1;
   const months=[];for(let i=0;i<12;i++){const date=new Date(year,3+i,1);if(date>now)break;months.push({key:date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0'),label:date.toLocaleDateString('en-IN',{month:'short'}),income:0,expense:0});}
   const source=typeof state!=='undefined'?state:null;const rows=typeof profileRows==='function'?profileRows(source?.income||[]):source?.income||[];
   for(const row of rows){const m=months.find(m=>m.key===row.date?.slice(0,7));if(m)m.income+=Number(row.amount)||0;}for(const row of source?.expenses||[]){const m=months.find(m=>m.key===row.date?.slice(0,7));if(m)m.expense+=Number(row.amount)||0;}
   const money=n=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n);const compact=n=>new Intl.NumberFormat('en-IN',{notation:'compact',maximumFractionDigits:1}).format(n);
   $('#flowPeriod').textContent='FY '+year+'–'+String(year+1).slice(-2);const max=Math.max(1,...months.flatMap(m=>[m.income,m.expense]))*1.15,left=64,top=20,bottom=250,w=710,h=230,step=w/Math.max(1,months.length),bw=Math.min(25,step*.28);
   const grid=[0,.25,.5,.75,1].map(f=>{const y=bottom-h*f;return '<line x1="'+left+'" x2="780" y1="'+y+'" y2="'+y+'" class="flow-grid"/><text x="54" y="'+(y+4)+'" text-anchor="end" class="flow-axis">₹'+compact(max*f)+'</text>';}).join('');
   const bars=months.map((m,i)=>{const x=left+step*i+step/2;return '<g tabindex="0" data-flow-month="'+i+'"><title>'+m.label+' — Income '+money(m.income)+', expenses '+money(m.expense)+'</title><rect x="'+(x-step/2+2)+'" y="20" width="'+(step-4)+'" height="260" fill="transparent" pointer-events="all"/><rect x="'+(x-bw-2)+'" y="'+(bottom-h*m.income/max)+'" width="'+bw+'" height="'+(h*m.income/max)+'" rx="5" class="flow-income-bar"/><rect x="'+(x+2)+'" y="'+(bottom-h*m.expense/max)+'" width="'+bw+'" height="'+(h*m.expense/max)+'" rx="5" class="flow-expense-bar"/><text x="'+x+'" y="276" text-anchor="middle" class="flow-axis">'+m.label+'</text></g>';}).join('');const svg=$('#flowCashChart');svg.__flowMonths=months;svg.innerHTML=grid+bars;svg.parentNode.querySelector('.flow-chart-tooltip').textContent='Select a month to inspect income and expenses.';svg.setAttribute('aria-label','Monthly income and expenses for FY '+year+'. '+months.map(m=>m.label+': income '+money(m.income)+', expenses '+money(m.expense)).join('; '));$('#flowCashEmpty').textContent=months.some(m=>m.income||m.expense)?'':'Add income or expense records to see your monthly comparison.';
   const mix=$('#flowAllocationBars');mix.replaceChildren();const sourceLegend=$$('#advancedDashboardAllocationLegend .advanced-dashboard-allocation-item');if(!sourceLegend.length)mix.append(el('p','flow-empty','Your investment mix will appear after you add a holding.'));for(const row of sourceLegend){const item=el('div','flow-mix-item');const line=slot(item,'flow-mix-label');line.append(el('span','',$('span',row).textContent),el('strong','',$('strong',row).textContent));const track=slot(item,'flow-mix-track');const fill=slot(track,'');const pct=parseFloat(($('strong',row).textContent.match(/([\d.]+)%/)||[])[1])||0;fill.style.width=Math.max(0,Math.min(100,pct))+'%';fill.style.background=getComputedStyle(row).getPropertyValue('--allocation-color')||'var(--primary)';mix.append(item);}
   labelDebtCards();if($('#flowPmsEmpty'))$('#flowPmsEmpty').hidden=!$('#stallionPmsPanel').hidden;
  }catch(error){console.error('Emerald Flow chart update failed',error);}
 }
 function styleCharts(active){if(!window.Chart?.instances)return;for(const chart of Object.values(window.Chart.instances)){if(!charts.has(chart))charts.set(chart,{type:chart.config.type,cutout:chart.options.cutout,animation:chart.options.animation,legend:chart.options.plugins?.legend?.position,datasets:chart.data.datasets.map(d=>({borderRadius:d.borderRadius,barPercentage:d.barPercentage,categoryPercentage:d.categoryPercentage}))});const previous=charts.get(chart);chart.config.type=active&&previous.type==='pie'?'doughnut':previous.type;if(previous.type==='pie')chart.options.cutout=active?'68%':previous.cutout;chart.options.animation=active?false:previous.animation;chart.data.datasets.forEach((d,i)=>{const old=previous.datasets[i];if(chart.config.type==='bar'){d.borderRadius=active?7:old?.borderRadius;d.barPercentage=active?0.72:old?.barPercentage;d.categoryPercentage=active?0.72:old?.categoryPercentage;}});if(chart.options.plugins?.legend)chart.options.plugins.legend.position=active?'bottom':previous.legend;chart.update('none');}}
 function apply(){const next=root.dataset.layoutStyle==='emerald-flow';if(next===enabled)return;if(typeof closeEntryFormModal==='function'&&!$('#entryFormModal')?.hidden)closeEntryFormModal();enabled=next;if(next){for(const m of moves)m.dest.append(m.node);spaces.forEach(s=>s.hidden=false);draw();}else{for(const m of [...moves].reverse())if(m.anchor.parentNode)m.anchor.after(m.node);spaces.forEach(s=>s.hidden=true);}adaptCashLayout();adaptInvestmentTabs();styleCharts(next);requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')));}
 let built=false;function prepare(){if(built||!window.financeCloud)return;built=true;build();new MutationObserver(apply).observe(root,{attributes:true,attributeFilter:['data-layout-style']});apply();}
 window.addEventListener('pft:before-reveal',prepare);Promise.resolve(window.trackerReady).then(prepare);
})();
