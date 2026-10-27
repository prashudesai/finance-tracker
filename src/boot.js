// Public asset URLs and anonymous timing only; no tracker data is stored here.
window.PFT_ASSETS=/*APP_ASSETS*/{};
(() => {
 window.financeCloudReady=new Promise(resolve=>{window.financeCloudResolve=resolve;});
 window.trackerReady=new Promise(resolve=>{window.PFTResolveTrackerReady=resolve;});
 const times={boot:performance.now()},loads=new Map();
 window.PFTPerformance={mark(name){times[name]=performance.now();try{performance.mark('pft:'+name);}catch(_){}},snapshot(){return {...times};}};
 window.PFTPaint={remember(){try{const r=document.documentElement;localStorage.setItem('pft:lastAppearance',JSON.stringify({theme:r.dataset.theme,style:r.dataset.layoutStyle,color:r.dataset.colorTheme}));}catch(_){} }};
 try{const saved=JSON.parse(localStorage.getItem('pft:lastAppearance')||'null'),r=document.documentElement;if(saved){if(['dark','light'].includes(saved.theme))r.dataset.theme=saved.theme;if(['modern','classic','emerald-flow'].includes(saved.style)){r.dataset.layoutStyle=saved.style==='classic'?'modern':saved.style;r.dataset.appStyle='modern';}}}catch(_){}
 window.PFTLoadScript=function(kind){
  if(kind==='chart'&&window.Chart||kind==='pdf'&&window.jspdf?.jsPDF)return Promise.resolve();
  if(loads.has(kind))return loads.get(kind);
  const url=window.PFT_ASSETS[kind];if(!url)return Promise.reject(new Error('Unknown optional app asset: '+kind));
  const operation=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=url;script.async=true;script.onload=()=>{if(kind==='chart'&&!window.Chart||kind==='pdf'&&!window.jspdf?.jsPDF){loads.delete(kind);script.remove();reject(new Error('Optional app asset did not initialise.'));return;}window.PFTPerformance.mark(kind+'-ready');resolve();};script.onerror=()=>{loads.delete(kind);script.remove();reject(new Error('Could not load '+kind+'. Reconnect or finish installing the offline app, then retry.'));};document.head.append(script);});loads.set(kind,operation);return operation;
 };
})();
