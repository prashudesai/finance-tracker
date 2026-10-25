export function installExperience(){
 const nav='[data-tab],[data-style-page]';
 const page=()=>document.querySelector('.nav-tab.active')?.dataset.tab||'dashboard';
 const key=()=> 'pageContext:'+page()+':'+(typeof activeFamilyProfile==='string'?activeFamilyProfile:'all');
 let scrollTimer;
 const save=()=>{try{trackerStorage.setItem(key(),JSON.stringify({scroll:Math.max(0,window.scrollY)}));}catch(_) {}};
 const onScroll=()=>{clearTimeout(scrollTimer);scrollTimer=setTimeout(save,200);};
 const onClick=e=>{if(!e.target.closest(nav))return;const old=page();save();requestAnimationFrame(()=>{if(old===page())return;try{const saved=JSON.parse(trackerStorage.getItem(key())||'null');if(saved)window.scrollTo({top:Math.max(0,Math.min(saved.scroll||0,document.documentElement.scrollHeight-innerHeight)),behavior:'instant'});}catch(_) {}});};
 window.addEventListener('scroll',onScroll,{passive:true});document.addEventListener('click',onClick,true);
 const ids=['incomeHistoryFinancialYear','incomeHistoryMonth','expenseHistoryFinancialYear','expenseHistoryMonth','balanceHistoryFinancialYear','stallionContributionFinancialYear'];
 for(const id of ids){const e=document.getElementById(id);if(!e)continue;try{const value=trackerStorage.getItem('filter:'+id);if(value!==null&&[...e.options].some(o=>o.value===value)){e.value=value;e.dispatchEvent(new Event('change',{bubbles:true}));}}catch(_){}e.addEventListener('change',()=>{try{trackerStorage.setItem('filter:'+id,e.value);}catch(_) {}});}
 const reset=window.financeBridge.reset;window.financeBridge.reset=function(){clearTimeout(scrollTimer);window.removeEventListener('scroll',onScroll);document.removeEventListener('click',onClick,true);return reset.apply(this,arguments);};
}
