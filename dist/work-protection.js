// Device-only form drafts. Never included in financial totals or cloud snapshots.
export function installWorkProtection(){
 const selector='input[id],select[id],textarea[id]', key='workDrafts:v1';
 const excluded=/password|file|hidden|button|submit|range/;
 const eligible=e=>e.matches?.(selector)&&!excluded.test(e.type)&&!e.disabled&&!e.readOnly&&!e.closest('#cloudGate,#firstNameSetup,#settings,#growth-projection')&&!/filter|sort|history|financialyear|monthselect|report/i.test(e.id);
 const values=new Map();let timer=null;
 const read=e=>({value:e.value,checked:e.checked,type:e.type});
  const persist=()=>{try{trackerStorage.setItem(key,JSON.stringify({at:Date.now(),values:Object.fromEntries(values)}));}catch(_){status('Draft recovery is unavailable on this device.');}};
 let saved;try{saved=JSON.parse(trackerStorage.getItem(key)||'null');}catch(_){}
 const notice=document.createElement('div');notice.hidden=true;notice.className='info-box';notice.style.margin='12px 0';notice.setAttribute('role','status');
 const label=document.createElement('span');notice.append(label);
 const host=document.querySelector('.container');host.prepend(notice);
 function status(text){label.textContent=text;notice.hidden=!text;}
 function action(text,fn){const b=document.createElement('button');b.type='button';b.className='btn-small';b.textContent=text;b.onclick=fn;notice.append(b);return b;}
 const restore=action('Restore draft',()=>{
   for(const [id,data]of Object.entries(saved?.values||{})){const e=document.getElementById(id);if(!e||!eligible(e)||e.type!==data.type)continue;if(e.tagName==='SELECT'&&![...e.options].some(o=>o.value===data.value))continue;e.value=data.value;if(e.type==='checkbox'||e.type==='radio')e.checked=data.checked;values.set(id,data);}
   restore.hidden=true;status('Draft restored on this device. Review and save it, then discard the recovered draft.');persist();
 });
 const discard=action('Discard draft',()=>{clearTimeout(timer);values.clear();saved=null;restore.hidden=true;try{trackerStorage.removeItem(key);status('');}catch(_){status('Could not discard the stored draft.');}});
 if(saved?.values&&Date.now()-saved.at<7*86400000&&Object.keys(saved.values).length)status('An unfinished draft is available on this device.');else{saved=null;restore.hidden=true;notice.hidden=true;}
 const edit=e=>{if(!eligible(e.target)||!e.isTrusted)return;if(saved?.values&&!values.size)for(const [id,data]of Object.entries(saved.values))values.set(id,data);saved=null;values.set(e.target.id,read(e.target));clearTimeout(timer);timer=setTimeout(persist,250);};
 document.addEventListener('input',edit);document.addEventListener('change',edit);
 const flush=()=>{clearTimeout(timer);if(values.size)persist();};window.addEventListener('pagehide',flush);document.addEventListener('visibilitychange',()=>{if(document.hidden)flush();});
 const oldReset=window.financeBridge.reset;
 window.financeBridge.reset=function(){flush();clearTimeout(timer);document.removeEventListener('input',edit);document.removeEventListener('change',edit);window.removeEventListener('pagehide',flush);notice.remove();return oldReset.apply(this,arguments);};
 window.financeDrafts={pending:()=>values.size>0||Boolean(saved?.values&&Object.keys(saved.values).length),flush};
}
