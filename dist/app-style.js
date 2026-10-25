// Layout preferences only: both styles reuse the same tracker forms, records and handlers.
(() => {
  'use strict';
  const root=document.documentElement;
  const key='displayStyle';
  const pages=[['dashboard','Dashboard','Home','<path d="m3 10 9-7 9 7v11H3zM9 21v-8h6v8"/>'],['income-expenses','Income & Expense','Cash flow','<path d="M7 3v17m-4-4 4 4 4-4M17 21V4m-4 4 4-4 4 4"/>'],['investments','Investment','Investments','<path d="M3 20V10h4v10m3 0V5h4v15m3 0V2h4v18"/>'],['debts','Debts','Debts','<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M6 15h4"/>'],['analytics','Analytics & Reports','Reports','<path d="M3 21h18M5 17l5-6 4 2 6-9"/>'],['settings','Settings','Settings','<circle cx="12" cy="12" r="4"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/>']];
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
    const style=['classic','modern','emerald-flow'].includes(value)?value:'modern';
    const layoutStyle=style==='classic'?'classic':'modern';
    root.dataset.appStyle=layoutStyle;
    root.dataset.layoutStyle=style;
    if(persist){try{window.trackerStorage.setItem(key,style);}catch(_){/* The layout still applies to this session. */}}
    controls?.querySelectorAll('[data-app-style-choice]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.appStyleChoice===style)));
    const labels={modern:'Style 1 · Modern',classic:'Style 2 · Classic','emerald-flow':'Style 3 · Emerald Flow'};
    const status=document.getElementById('appStyleStatus');if(status)status.textContent=labels[style]+' selected. This preference is saved for this account on this device.';
    const familyMenu=document.getElementById('familyProfileMenu');if(familyMenu)familyMenu.hidden=true;window.syncFamilyProfileButtons?.();
    window.setMobileNavHidden?.(false);
    requestAnimationFrame(()=>{window.dispatchEvent(new Event('resize'));if(window.Chart?.instances)Object.values(window.Chart.instances).forEach(chart=>chart.resize?.());});
    updateSelection();
  }
  function install(){
    if(document.getElementById('appStyleChoices'))return;
    const header=document.querySelector('.container > header');
    const brand=document.createElement('div');brand.className='pft-style-brand';brand.innerHTML='<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="20" cy="20" r="14"/><path d="m8 29 9-11 7 4 10-16M26 6h8v8"/><path d="M15 26h10"/></svg><span>Personal Finance<br>Tracker</span>';
    header.children[0].after(brand);
    nav=document.createElement('nav');nav.className='pft-style-navigation';nav.setAttribute('aria-label','Main tracker pages');
    for(const [id,label,short,path] of pages){
      const b=document.createElement('button');b.type='button';b.dataset.stylePage=id;b.setAttribute('aria-label',label);b.title=label;
      b.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true">'+path+'</svg><span class="pft-desktop-label"></span><span class="pft-mobile-label"></span>';
      b.querySelector('.pft-desktop-label').textContent=label;b.querySelector('.pft-mobile-label').textContent=short;
      b.addEventListener('click',()=>openPage(id));nav.append(b);
    }
    header.insertBefore(nav,header.querySelector('.header-controls'));
    const hero=document.createElement('section');hero.className='pft-style-hero';hero.setAttribute('aria-labelledby','pftStyleHeroTitle');
    hero.innerHTML='<div><p class="pft-style-eyebrow">YOUR FAMILY. YOUR FUTURE.</p><h1 id="pftStyleHeroTitle">Your financial life,<br><span>beautifully in sync.</span></h1><p>A clearer picture of everything you earn, own and owe.<br>One shared space for your family’s next chapter.</p><span class="pft-style-privacy">◈ &nbsp; Private family tracker</span></div><div class="pft-style-art" aria-hidden="true"><i></i><i></i><i></i><span>BUILDING YOUR TOMORROW</span></div>';
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
    const panel=document.getElementById('settingsAppearancePanel')||document.querySelector('.settings-appearance-panel');
    controls=document.createElement('section');controls.id='appStyleChoices';controls.className='pft-style-choices';controls.setAttribute('aria-labelledby','appStyleChoicesTitle');
    controls.innerHTML='<h3 id="appStyleChoicesTitle">Page style</h3><p>Choose the page design and navigation you prefer. All styles use the same tracker records.</p><div class="pft-style-choice-grid"><button type="button" data-app-style-choice="modern" aria-pressed="false"><span class="pft-style-swatch modern" aria-hidden="true"><i></i><i></i><i></i></span><strong>Style 1 · Modern <small>Default</small></strong><span>Teal & mint, top navigation and compact mobile pages.</span></button><button type="button" data-app-style-choice="classic" aria-pressed="false"><span class="pft-style-swatch classic" aria-hidden="true"><i></i><i></i><i></i></span><strong>Style 2 · Classic</strong><span>The earlier design with its familiar sidebar and page layouts.</span></button><button type="button" data-app-style-choice="emerald-flow" aria-pressed="false"><span class="pft-style-swatch emerald-flow" aria-hidden="true"><i></i><i></i><i></i></span><strong>Style 3 · Emerald Flow</strong><span>Fresh light layout, cash-flow overview and portfolio-first dashboard.</span></button></div><p id="appStyleStatus" role="status"></p>';
    controls.querySelectorAll('[data-app-style-choice]').forEach(b=>b.addEventListener('click',()=>applyStyle(b.dataset.appStyleChoice)));
    panel?.prepend(controls);
    const oldNav=document.querySelector('.nav-tabs');if(oldNav)new MutationObserver(updateSelection).observe(oldNav,{attributes:true,subtree:true,attributeFilter:['class']});
    let saved;try{saved=window.trackerStorage.getItem(key);}catch(_){}
    applyStyle(saved,false);
    window.PFT_STYLE={apply:applyStyle,get current(){return root.dataset.appStyle;}};
  }
  Promise.resolve(window.trackerReady).then(()=>{if(window.financeCloud)install();}).catch(()=>{});
})();
