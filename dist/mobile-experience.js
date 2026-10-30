// Touch-only enhancements; desktop controls and stored financial records are untouched.
export function installMobileExperience(){
 if(window.financeMobileExperience)return;
 const mobile=matchMedia('(max-width:700px)'),main=document.getElementById('trackerMain');
 const indicator=document.createElement('div');indicator.id='mobilePullRefresh';indicator.hidden=true;indicator.setAttribute('role','status');indicator.setAttribute('aria-live','polite');document.body.append(indicator);
 let gesture=null,busy=false,timer=0,scanTimer=0,disposed=false;
 const ignore='button,a,input,select,textarea,summary,[contenteditable],dialog,[role=dialog],[role=listbox],[role=menu],.modal,.table-wrapper,svg,canvas';
 function blocked(target){
  if(!mobile.matches||!main||main.inert||!window.financeCloud||document.body.classList.contains('cloud-pending')||scrollY>1||[...document.querySelectorAll('dialog[open],.investment-edit-modal:not([hidden]),[aria-modal=true]')].some(e=>e.getClientRects().length>0))return true;
  if(!(target instanceof Element)||!main.contains(target)||target.closest(ignore))return true;
  for(let n=target;n&&n!==main;n=n.parentElement){const css=getComputedStyle(n);if(/auto|scroll/.test(css.overflowY)&&n.scrollHeight>n.clientHeight+1)return true;}
  return false;
 }
 const hide=()=>{indicator.hidden=true;indicator.removeAttribute('data-ready');};
 function status(text){clearTimeout(timer);indicator.textContent=text;indicator.hidden=false;timer=setTimeout(hide,3500);}
 async function refresh(){
  if(busy)return;busy=true;
  try{
   if(window.financeDrafts?.pending()){status('Finish or save your entry before refreshing.');return;}
   if(!navigator.onLine){status('Connect to the internet to refresh.');return;}
   indicator.textContent='Refreshing…';indicator.hidden=false;
   await window.financeBridge?.refreshRemote();
   hide();
  }catch(error){status(error?.message||'Refresh failed. Please try again.');}
  finally{busy=false;}
 }
 function start(event){gesture=null;if(busy||event.touches.length!==1||blocked(event.target))return;const t=event.touches[0];gesture={x:t.clientX,y:t.clientY,pull:0};}
 function move(event){
  if(!gesture)return;if(event.touches.length!==1||!mobile.matches||scrollY>1){gesture=null;hide();return;}
  const t=event.touches[0],dx=t.clientX-gesture.x,dy=t.clientY-gesture.y;
  if(dy<0||Math.abs(dx)>Math.max(16,dy*.65)){gesture=null;hide();return;}
  if(dy<12)return;
  if(event.cancelable)event.preventDefault(); // Avoid a second native browser refresh.
  gesture.pull=Math.min(140,dy);indicator.hidden=false;indicator.textContent=dy>=90?'Release to refresh':'Pull to refresh';indicator.dataset.ready=String(dy>=90);
 }
 function end(){const ready=gesture?.pull>=90;gesture=null;if(ready)void refresh();else if(!busy)hide();}
 const cancel=()=>{gesture=null;if(!busy)hide();};
 document.addEventListener('touchstart',start,{passive:true});document.addEventListener('touchmove',move,{passive:false});document.addEventListener('touchend',end,{passive:true});document.addEventListener('touchcancel',cancel,{passive:true});
 // Only explanatory paragraphs become help disclosures. Actionable warnings stay visible.
 const helps=new Map();
 function scan(){
  if(disposed)return;
  if(!mobile.matches){for(const [p,d]of helps){if(d.isConnected)d.replaceWith(p);}helps.clear();return;}
  for(const [p,d]of helps)if(!d.isConnected)helps.delete(p);
  for(const p of document.querySelectorAll('.finance-insight-note,.loan-change-help,.panel>p,.info-box>p')){
   if(p.closest('.mobile-info-help,[role=alert],#cloudGate,#firstNameSetup')||p.textContent.trim().length<180||p.querySelector('button,a,input,select')||/warning|error|delete|cannot|must |do not|don’t/i.test(p.className+' '+p.textContent))continue;
   const d=document.createElement('details');d.className='mobile-info-help';const summary=document.createElement('summary');
   summary.innerHTML='<span class="mobile-info-icon" aria-hidden="true">i</span><span>How this works</span>';
   if(p.closest('#cashBalanceBreakdown'))summary.lastElementChild.textContent='About this calculation';
   p.before(d);d.append(summary,p);helps.set(p,d);
  }
 }
 const schedule=()=>{clearTimeout(scanTimer);scanTimer=setTimeout(scan,60);};
 const observer=new MutationObserver(schedule);observer.observe(main,{childList:true,subtree:true});
 const adapt=()=>{cancel();scan();};mobile.addEventListener('change',adapt);scan();
 const reset=window.financeBridge.reset;window.financeBridge.reset=function(){disposed=true;observer.disconnect();clearTimeout(timer);clearTimeout(scanTimer);mobile.removeEventListener('change',adapt);document.removeEventListener('touchstart',start);document.removeEventListener('touchmove',move);document.removeEventListener('touchend',end);document.removeEventListener('touchcancel',cancel);indicator.remove();for(const [p,d]of helps)if(d.isConnected)d.replaceWith(p);delete window.financeMobileExperience;return reset.apply(this,arguments);};
 window.financeMobileExperience={};
}
