const {selectControl}=require('./browser-fixtures.cjs');
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../dist'),db=new Map(),results=[];let rejectClearPublish=false;
const appStub=`export const initializeApp=c=>c;`;
const authStub=`const a={currentUser:JSON.parse(sessionStorage.getItem('mockGoogle')||'null')},callbacks=[];window.__testAuth=a;export const getAuth=()=>a;export const initializeAuth=()=>a;export const indexedDBLocalPersistence={},browserLocalPersistence={},browserSessionPersistence={},browserPopupRedirectResolver={};export class GoogleAuthProvider{setCustomParameters(){}}export function onAuthStateChanged(_,cb){callbacks.push(cb);queueMicrotask(()=>cb(a.currentUser));}export async function signInWithPopup(){const q=new URLSearchParams(location.search);a.currentUser={uid:q.get('user'),email:q.get('email'),emailVerified:true,displayName:q.get('name')||'',photoURL:q.get('photo')||''};sessionStorage.setItem('mockGoogle',JSON.stringify(a.currentUser));for(const cb of callbacks)cb(a.currentUser);}export async function reauthenticateWithPopup(){return {user:a.currentUser};}export async function signOut(){a.currentUser=null;sessionStorage.removeItem('mockGoogle');for(const cb of callbacks)cb(null);}`;
const firestoreStub=`export const serverTimestamp=()=>new Date().toISOString();export const getFirestore=()=>({});export const doc=(_, ...parts)=>parts.join('/');export const collection=(_,path)=>path;export const where=(field,op,value)=>({field,op,value});export const query=(path,...filters)=>({path,filters});async function call(action,body){const r=await fetch('/__test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...body})});if(!r.ok)throw Error(await r.text());return r.json();}const wrap=(data,path)=>({id:path?.split('/').at(-1),exists:()=>data!==null,data:()=>data});export async function getDocFromServer(path){return wrap(await call('get',{path}),path);}export async function getDocsFromServer(query){const rows=await call('query',{query});return{docs:rows.map(r=>wrap(r.data,r.path))};}export async function setDoc(path,data){return call('writes',{writes:[{path,data}]});}export async function deleteDoc(path){return call('writes',{writes:[{path,remove:true}]});}export function onSnapshot(path,...args){const next=typeof args[0]==='function'?args[0]:args[1],error=typeof args[0]==='function'?args[1]:args[2];let stopped=false;const read=()=>getDocFromServer(path).then(s=>{if(!stopped)next(s)}).catch(e=>{if(navigator.onLine)error(e)});read();const timer=setInterval(read,150);return()=>{stopped=true;clearInterval(timer)};}export function writeBatch(){const writes=[];return{set:(path,data)=>writes.push({path,data}),delete:path=>writes.push({path,remove:true}),commit:()=>call('writes',{writes})};}export async function runTransaction(_,fn){const writes=[];const value=await fn({get:getDocFromServer,set:(path,data)=>writes.push({path,data}),update:(path,data)=>writes.push({path,data,merge:true})});await call('writes',{writes});return value;}`;
const server=http.createServer(async(req,res)=>{try{
 if(req.url==='/__test'){let body='';for await(const b of req)body+=b;const q=JSON.parse(body);let result=null;
  if(q.action==='get')result=db.get(q.path)||null;
  if(q.action==='query')result=[...db].filter(([p,d])=>p.startsWith(q.query.path+'/')&&q.query.filters.every(f=>d[f.field]===f.value)).map(([path,data])=>({path,data}));
  if(q.action==='writes'&&rejectClearPublish&&q.writes.some(w=>w.path==='users/owner/tracker/current')){res.statusCode=503;res.end('Cloud unavailable');return;}
  if(q.action==='writes'){for(const w of q.writes)w.remove?db.delete(w.path):db.set(w.path,w.merge?{...db.get(w.path),...w.data}:w.data);result=true;}
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));return;
 }
 const assetURL=require('./browser-fixtures.cjs').logicalURL(root,req.url);
 if(['/vendor/firebase-app.js','/vendor/firebase-auth.js','/vendor/firebase-firestore.js'].includes(assetURL)){res.setHeader('Content-Type','application/javascript');res.end(assetURL.endsWith('firebase-app.js')?appStub:assetURL.endsWith('firebase-auth.js')?authStub:firestoreStub);return;}
 const file=path.join(root,req.url.split('?')[0]==='/'?'index.html':req.url.split('?')[0]);if(!file.startsWith(root))throw Error('Bad path');res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'application/octet-stream');res.end(fs.readFileSync(file));
}catch(e){res.statusCode=500;res.end(e.message)}});


(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});

 const errors=[];const page=await browser.newPage({viewport:{width:390,height:844}});page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://example.test/google.jpg',route=>route.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL+6QAAAABJRU5ErkJggg==','base64')}));await page.goto(url+'/?user=insights&email=insights@example.test&name=Tester&photo=https%3A%2F%2Fexample.test%2Fgoogle.jpg');await page.locator('#cloudLogin').click();await page.waitForFunction(()=>window.financeCloud&&document.getElementById('cloudGate').hidden);if(await page.locator('#firstNameSetup').isVisible())await page.locator('#firstNameContinue').click();await page.evaluate(()=>window.trackerReady);assert.equal(await page.locator('#appGuideTour').isVisible(),true,'New-account tour opens after name setup');await page.locator('#appGuideTour [data-tour-skip]').click();await page.waitForFunction(()=>Boolean(window.financeInsights));
 async function check(name,fn){await fn();console.log('PASS '+name);results.push(name);}
 await page.evaluate(()=>{document.querySelector('.nav-tab[data-tab="income-expenses"]').click();window.__originalDate=localDateKey;localDateKey=()=>currentMonthKey()+'-31';const month=currentMonthKey(),member=state.customValues.familyMembers[0];state.monthlyBalances=[{id:'b',month,startBalance:1000}];state.income=[{id:'income',member,date:month+'-01',source:'Salary',amount:10000}];state.expenses=[{id:'expense',date:month+'-02',category:'Other',amount:2000}];state.investments=[{id:'pms',member,type:'Stallion PMS',name:'Test PMS',date:'2025-01-01',invested:5000,current:6000,monthly:0,autoMonthlyContribution:false}];state.stallionPms=[{id:'pms',member,name:'Test PMS',createdDate:'2025-01-01',invested:5000,profit:1000}];state.stallionContributions=[{id:'automatic',stallionId:'pms',date:month+'-01',amount:500,automatic:true}];renderIncome();renderExpenses();renderInvestments();updateDashboard();});
 await check('Cash-flow date defaults, title accent and popover chevrons are visible',async()=>{const today=await page.evaluate(()=>window.__originalDate());assert.equal(await page.locator('#incomeDate').inputValue(),today);assert.equal(await page.locator('#expenseDate').inputValue(),today);await page.evaluate(()=>PFT_STYLE.apply('modern'));await page.waitForFunction(()=>['incomeSource','expenseCategory','isAnnual'].every(id=>document.getElementById(id+'PopoverTrigger')));const fields=await page.locator('#incomeSourcePopoverTrigger,#expenseCategoryPopoverTrigger,#isAnnualPopoverTrigger').evaluateAll(es=>es.map(e=>({height:parseFloat(getComputedStyle(e).minHeight),chevron:Boolean(e.querySelector('svg path'))})));assert(fields.every(f=>f.height>=44&&f.chevron),JSON.stringify(fields));const geometry=await page.locator('#income-expenses .transaction-intro').evaluate(e=>({container:getComputedStyle(e),title:getComputedStyle(e.querySelector('h1')),eyebrow:getComputedStyle(e.querySelector('.transaction-eyebrow'))}));assert.equal(geometry.container.borderLeftWidth,'0px');assert(parseFloat(geometry.title.borderLeftWidth)>=3);assert(parseFloat(geometry.title.paddingLeft)>=14);const calendar=await page.locator('#incomeDate').evaluate(e=>({image:getComputedStyle(e).backgroundImage,opacity:getComputedStyle(e,'::-webkit-calendar-picker-indicator').opacity}));assert(calendar.image.includes('data:image/svg+xml'),JSON.stringify(calendar));});
 await check('Google photo appears in the header without changing the family selector',async()=>{await page.waitForFunction(()=>document.querySelector('.family-profile-mobile-trigger img')?.src==='https://example.test/google.jpg');assert.equal(await page.locator('.family-profile-mobile-trigger img').getAttribute('alt'),'');assert.match(await page.locator('.family-profile-mobile-trigger').getAttribute('aria-label'),/Profile/);assert.equal(await page.locator('.pft-style-brand span').textContent(),'My finances');});
 await check('Classic is removed and saved Classic choices fall back to Modern',async()=>{assert.equal(await page.locator('[data-app-style-choice="classic"]').count(),0);await page.evaluate(()=>PFT_STYLE.apply('classic'));assert.equal(await page.evaluate(()=>PFT_STYLE.current),'modern');assert.equal(await page.evaluate(()=>window.trackerStorage.getItem('displayStyle')),'modern');});
 await check('Retired appearance choices are absent and saved palettes fall back safely',async()=>{
   assert.equal(await page.locator('[data-app-style-choice="emerald-flow"]').count(),0);
   assert.equal(await page.locator('#themeOptions [data-theme-key="ocean-blue"]').count(),0);
   assert.equal(await page.locator('#themeOptions [data-theme-key="midnight-aurora"]').count(),0);
   assert.equal(await page.locator('#themeOptions [data-theme-key="warm-amber"]').count(),0);
   const previous=await page.evaluate(()=>document.documentElement.dataset.colorTheme);
   await page.evaluate(()=>applyColorTheme('ocean-blue'));
   assert.equal(await page.evaluate(()=>document.documentElement.dataset.colorTheme),'navy-emerald');
   await page.evaluate(previous=>applyColorTheme(previous),previous);
   const migrated=await page.evaluate(()=>{
     const originalStyle=trackerStorage.getItem('displayStyle');
     const originalColor=trackerStorage.getItem('familyWealthColorTheme');
     const cases=[['emerald-flow','classic-teal'],['modern','ocean-blue'],['obsidian-black','midnight-aurora'],['modern','warm-amber']];
     const results=[];
     for(const [style,color] of cases){
       trackerStorage.setItem('displayStyle',style);
       trackerStorage.setItem('familyWealthColorTheme',color);
       initTheme();
       PFT_STYLE.apply(trackerStorage.getItem('displayStyle'),false);
       results.push({style:trackerStorage.getItem('displayStyle'),color:trackerStorage.getItem('familyWealthColorTheme'),current:PFT_STYLE.current});
     }
     trackerStorage.setItem('displayStyle',originalStyle||'modern');
     trackerStorage.setItem('familyWealthColorTheme',originalColor||'navy-emerald');
     initTheme();
     PFT_STYLE.apply(originalStyle||'modern',false);
     return results;
   });
   assert(migrated.every(row=>row.style==='modern'&&row.current==='modern'&&row.color==='navy-emerald'),JSON.stringify(migrated));
 });
 await check('Dashboard header and Projection Settings are balanced on desktop',async()=>{
  await page.setViewportSize({width:1440,height:900});
  await page.evaluate(()=>{PFT_STYLE.apply('modern',false);document.querySelector('.nav-tab[data-tab="dashboard"]').click();updateDashboard();});
  assert.equal(await page.locator('#dashboard .dashboard-page-icon').isVisible(),false);
  assert.equal(await page.locator('#dashboardPagePeriod').isVisible(),false);
  for(const selector of ['#dashboard>.dashboard-page-intro','#debts>.debt-page-intro','#settings>.settings-intro']){
   const style=await page.locator(selector).evaluate(node=>{const s=getComputedStyle(node);return {background:s.backgroundImage,border:s.borderTopWidth,shadow:s.boxShadow};});
   assert.deepEqual(style,{background:'none',border:'0px',shadow:'none'});
  }
  assert.equal(await page.locator('#dashboardPagePeriod').textContent(),await page.evaluate(()=>new Date().toLocaleDateString('en-IN',{month:'long',year:'numeric'})));
  await page.evaluate(()=>document.querySelector('.nav-tab[data-tab="growth-projection"]').click());
  for(const width of [701,800,1024,1440]){
   await page.setViewportSize({width,height:900});
   const sizes=await page.locator('.advanced-growth-workspace').evaluate(grid=>{
    const settings=grid.querySelector('.advanced-growth-rail').getBoundingClientRect(),chart=grid.querySelector(':scope>.growth-projection-chart-panel').getBoundingClientRect();
    return {width:grid.getBoundingClientRect().width,gap:parseFloat(getComputedStyle(grid).columnGap),settings:settings.toJSON(),chart:chart.toJSON()};
   });
   assert(await page.locator('#growthProjectionInputs').isVisible());
   const available=sizes.width-sizes.gap;
   assert(Math.abs(sizes.settings.width/available-.3)<.01,JSON.stringify({width,sizes}));
   assert(Math.abs(sizes.chart.width/available-.7)<.01,JSON.stringify({width,sizes}));
   assert(Math.abs(sizes.settings.top-sizes.chart.top)<2,JSON.stringify({width,sizes}));
   assert(sizes.settings.right<=sizes.chart.left,JSON.stringify({width,sizes}));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }
  for(const width of [320,390,700]){
   await page.setViewportSize({width,height:844});
   const mobile=await page.locator('.advanced-growth-workspace').evaluate(grid=>{
    const rail=grid.querySelector('.advanced-growth-rail').getBoundingClientRect(),chart=grid.querySelector(':scope>.growth-projection-chart-panel').getBoundingClientRect();
    return {columns:getComputedStyle(grid).gridTemplateColumns,rail:rail.toJSON(),chart:chart.toJSON()};
   });
   assert.equal(mobile.columns.trim().split(/\s+/).length,1,JSON.stringify({width,mobile}));
   assert.equal(await page.locator('#growthProjectionInputs').isVisible(),false);
   assert(mobile.chart.top>=mobile.rail.bottom-1,JSON.stringify({width,mobile}));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }
  await page.evaluate(()=>document.querySelector('.nav-tab[data-tab="income-expenses"]').click());
 });
 await check('Mobile chart shows five real calendar months across the financial-year boundary',async()=>{
  const before=await page.evaluate(()=>JSON.stringify(state));
  await page.setViewportSize({width:390,height:844});
  const result=await page.evaluate(()=>{
   const RealDate=Date;const savedIncome=state.income,savedExpenses=state.expenses;
   try{window.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[2026,3,15,12]));}};
    state.income=[{id:'cross-fy',member:state.customValues.familyMembers[0],date:'2025-12-02',amount:12345}];state.expenses=[];
    document.querySelector('.nav-tab[data-tab="dashboard"]').click();renderAdvancedDashboardInsights();
    const svg=document.getElementById('advancedDashboardCashflowChart');return{months:[...svg.querySelectorAll('.cash-month-bars')].map(e=>e.getAttribute('aria-label')),period:document.getElementById('advancedDashboardCashflowPeriod').textContent,viewBox:svg.getAttribute('viewBox')};
   }finally{window.Date=RealDate;state.income=savedIncome;state.expenses=savedExpenses;}
  });
  assert.equal(result.months.length,5);assert.match(result.months[0],/Dec.*12,345/);assert.match(result.months[4],/Apr/);assert.match(result.period,/Dec 2025.*Apr 2026/);assert.equal(result.viewBox,'0 0 390 260');
  for(const width of [320,390,700,701,1440]){
   await page.setViewportSize({width,height:844});await page.evaluate(()=>renderAdvancedDashboardInsights());
   if(width<=700){assert.equal(await page.locator('#advancedDashboardCashflowChart .cash-month-bars').count(),5);const b=await page.locator('#advancedDashboardCashflowChart').boundingBox();assert(b.height>=220);}
   else assert.equal(await page.locator('#advancedDashboardCashflowChart').getAttribute('viewBox'),'0 0 640 205');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }
  assert.equal(await page.evaluate(()=>JSON.stringify(state)),before);
 });
 await check('Mobile title, Analytics accent and expandable calculation help fit without desktop changes',async()=>{
  for(const width of [320,390,700]){
   await page.setViewportSize({width,height:844});await page.evaluate(()=>document.querySelector('.nav-tab[data-tab="analytics"]').click());
   assert.equal(await page.locator('#analytics .analytics-intro-copy h1').evaluate(e=>getComputedStyle(e).borderInlineStartWidth),'4px');
   assert.equal(await page.locator('.pft-style-brand').evaluate(e=>getComputedStyle(e).fontSize),'15px');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }
  await page.evaluate(()=>document.querySelector('.nav-tab[data-tab="income-expenses"]').click());
  await page.locator('#cashBalanceBreakdown').evaluate(e=>e.open=true);
  const help=page.locator('#cashBalanceBreakdown .mobile-info-help');await help.waitFor();
  assert.equal(await help.locator('p').isVisible(),false);await help.locator('summary').click();assert(await help.locator('p').isVisible());
  await page.setViewportSize({width:1440,height:900});await page.waitForFunction(()=>!document.querySelector('#cashBalanceBreakdown .mobile-info-help'));
  assert(await page.locator('#cashBalanceBreakdown .finance-insight-note').last().isVisible());
  assert.equal(await page.locator('.pft-style-brand').evaluate(e=>getComputedStyle(e).fontSize),'13px');
 });
 await check('Mobile form dropdowns use top-layer glass menus and restore native desktop controls',async()=>{
  const before=await page.evaluate(()=>JSON.stringify(state));await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>financeCashFlow.open('expense'));
  const trigger=page.locator('#expenseCategoryPopoverTrigger');await trigger.waitFor();await trigger.click();
  const panel=page.locator('#'+await trigger.getAttribute('aria-controls'));assert(await panel.evaluate(e=>e.matches(':popover-open')));
  const b=await panel.boundingBox();assert(b.x>=0&&b.y>=0&&b.x+b.width<=390&&b.y+b.height<=844);
  assert.match(await panel.evaluate(e=>getComputedStyle(e).backdropFilter),/blur/);
  await panel.getByRole('option',{name:'Other',exact:true}).click();assert.equal(await page.locator('#expenseCategory').inputValue(),'Other');
  await page.locator('#cashEntryDialog .cash-entry-heading button').click();
  await page.setViewportSize({width:1440,height:900});await page.waitForFunction(()=>!document.getElementById('expenseCategoryPopoverTrigger'));
  assert.equal(await page.locator('#expenseCategory').evaluate(e=>e.classList.contains('pft-native-filter')),false);
  assert.equal(await page.evaluate(()=>JSON.stringify(state)),before);
 });
 await check('Pull refresh requires top-of-page vertical intent and protects drafts, offline and desktop',async()=>{
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{document.querySelector('.nav-tab[data-tab="dashboard"]').click();window.scrollTo(0,0);});
  await page.waitForFunction(()=>scrollY===0&&Boolean(window.financeMobileExperience));
  const results=await page.evaluate(async()=>{
   const oldRefresh=financeBridge.refreshRemote,oldDrafts=window.financeDrafts;let count=0;financeBridge.refreshRemote=async()=>{count++;};window.financeDrafts={pending:()=>false};
   window.__pullTest=(dx=0,dy=110,cancel=false,multi=false)=>{const target=document.querySelector('#dashboard .dashboard-page-intro');const touch=(x,y)=>new Touch({identifier:1,clientX:x,clientY:y,target});target.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,touches:[touch(120,160)]}));target.dispatchEvent(new TouchEvent('touchmove',{bubbles:true,cancelable:true,touches:multi?[touch(120+dx,160+dy),touch(180,190)]:[touch(120+dx,160+dy)]}));target.dispatchEvent(new TouchEvent(cancel?'touchcancel':'touchend',{bubbles:true,changedTouches:[touch(120+dx,160+dy)]}));};
   __pullTest(100,20);__pullTest(0,30);__pullTest(0,110,true);__pullTest(0,110,false,true);await Promise.resolve();const ignored=count;
   window.scrollTo(0,100);__pullTest();const scrolled=count;window.scrollTo(0,0);
   window.financeDrafts={pending:()=>true};__pullTest();await Promise.resolve();const draft=count,draftMessage=document.getElementById('mobilePullRefresh').textContent;
   window.financeDrafts={pending:()=>false};__pullTest();await Promise.resolve();await Promise.resolve();const refreshed=count;
   window.__pullRestore=()=>{financeBridge.refreshRemote=oldRefresh;window.financeDrafts=oldDrafts;delete window.__pullTest;delete window.__pullRestore;};
   return{ignored,scrolled,draft,draftMessage,refreshed};
  });assert.equal(results.ignored,0);assert.equal(results.scrolled,0);assert.equal(results.draft,0);assert.match(results.draftMessage,/save your entry/);assert.equal(results.refreshed,1);
  await page.context().setOffline(true);await page.evaluate(()=>__pullTest());assert.match(await page.locator('#mobilePullRefresh').textContent(),/Connect to the internet/);await page.context().setOffline(false);
  await page.setViewportSize({width:1440,height:900});await page.evaluate(()=>{__pullTest();__pullRestore();});assert.equal(await page.locator('#mobilePullRefresh').isVisible(),false);
  await page.setViewportSize({width:390,height:844});
 });
 await check('Dashboard bar chart and page headers preserve financial records at all widths',async()=>{
  const before=await page.evaluate(()=>JSON.stringify(state));
  for(const width of [390,700,701,1024,1440]){
   await page.setViewportSize({width,height:900});
   await page.evaluate(()=>{PFT_STYLE.apply('modern',false);document.querySelector('.nav-tab[data-tab="dashboard"]').click();renderAdvancedDashboardInsights();});
   const chart=page.locator('#advancedDashboardCashflowChart');
   assert.equal(await chart.locator('.cash-month-bars').count()>0,true);if(width<=700)assert.equal(await chart.locator('.cash-month-bars').count(),5);
   assert.equal(await chart.locator('path.cash-income').count(),0);
   for(const id of ['debts','settings']){
    await page.evaluate(id=>document.querySelector('.nav-tab[data-tab="'+id+'"]').click(),id);
    assert.equal(await page.locator('#'+id+' .pending-desktop-page-icon').isVisible(),false);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   }
  }
  assert.equal(await page.evaluate(()=>JSON.stringify(state)),before);
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>document.querySelector('.nav-tab[data-tab="income-expenses"]').click());
 });
 await check('Desktop income and expense editor uses one aligned action footer',async()=>{
   await page.setViewportSize({width:1440,height:900});
   for(const kind of ['income','expense']){
     // Isolate layout from the history month, pagination, and previous fixtures.
     const before=await page.evaluate(()=>JSON.stringify(state));
     await page.evaluate(kind=>{
       PFT_STYLE.apply('modern',false);
       document.querySelector('.nav-tab[data-tab="income-expenses"]').click();
       const row={id:'desktop-editor-layout-fixture',date:currentMonthKey()+'-02',amount:350,notes:'Layout test'};
       if(kind==='income'){
         state.income.push({...row,member:state.customValues.familyMembers[0],source:'Salary'});
         void editIncome(row.id);
       }else{
         state.expenses.push({...row,category:'Other'});
         void editExpense(row.id);
       }
     },kind);
     const dialog=page.locator('#recordEditorDialog');
     await dialog.waitFor({state:'visible'});
     const boxes=await dialog.locator('.record-editor-actions button').evaluateAll(buttons=>buttons.map(b=>{
       const r=b.getBoundingClientRect();return {text:b.textContent.trim(),x:r.x,y:r.y,right:r.right,width:r.width,height:r.height};
     }));
     assert.deepEqual(boxes.map(b=>b.text),['Delete','Cancel','Save changes']);
     assert(boxes.every(b=>Math.abs(b.y-boxes[0].y)<2&&b.width>0&&b.height>=44),JSON.stringify({kind,boxes}));
     assert(boxes[0].right<=boxes[1].x&&boxes[1].right<=boxes[2].x,JSON.stringify({kind,boxes}));
     await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
     await dialog.waitFor({state:'hidden'});
     await page.evaluate(kind=>{
       const rows=kind==='income'?state.income:state.expenses;
       rows.splice(rows.findIndex(row=>row.id==='desktop-editor-layout-fixture'),1);
     },kind);
     assert.equal(await page.evaluate(()=>JSON.stringify(state)),before,'Cancel preserves all financial records');
   }
   await page.setViewportSize({width:390,height:844});
 });
 await check('Three-arch hero graphic fades into the dashboard without a rectangular seam',async()=>{await page.setViewportSize({width:1440,height:900});await page.evaluate(()=>{PFT_STYLE.apply('modern');document.querySelector('.nav-tab[data-tab="dashboard"]').click();});const mask=await page.locator('.pft-style-art').evaluate(e=>getComputedStyle(e).maskImage);assert.match(mask,/linear-gradient/i);assert.equal(await page.locator('.pft-style-art i').count(),3);const hero=await page.locator('.pft-style-hero').evaluate(e=>{const s=getComputedStyle(e);return{radius:s.borderRadius,border:s.borderTopWidth,shadow:s.boxShadow,artBackground:getComputedStyle(e.querySelector('.pft-style-art')).backgroundImage};});assert.equal(hero.radius,'28px');assert.equal(hero.border,'1px');assert(hero.shadow!=='none');assert.match(hero.artBackground,/linear-gradient/i);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.setViewportSize({width:390,height:844});await page.evaluate(()=>document.querySelector('.nav-tab[data-tab="income-expenses"]').click());});
 await check('Black is an Appearance style and restores the previous palette when leaving',async()=>{const before=await page.evaluate(()=>JSON.stringify(state));assert.equal(await page.locator('#themeOptions [data-theme-key="obsidian-black"]').count(),0);assert.equal(await page.locator('[data-app-style-choice="obsidian-black"]').count(),1);await page.evaluate(()=>{PFT_STYLE.apply('modern');document.querySelector('[data-theme-key="classic-teal"]').click();PFT_STYLE.apply('obsidian-black');});assert.deepEqual(await page.evaluate(()=>({style:PFT_STYLE.current,layout:document.documentElement.dataset.layoutStyle,color:document.documentElement.dataset.colorTheme,mode:document.documentElement.dataset.theme,saved:trackerStorage.getItem('displayStyle'),selected:document.querySelector('[data-app-style-choice="obsidian-black"]').getAttribute('aria-pressed')})),{style:'obsidian-black',layout:'modern',color:'obsidian-black',mode:'dark',saved:'obsidian-black',selected:'true'});await page.evaluate(()=>{initTheme();PFT_STYLE.apply(trackerStorage.getItem('displayStyle'),false);});assert.equal(await page.evaluate(()=>document.documentElement.dataset.colorTheme),'obsidian-black');await page.evaluate(()=>PFT_STYLE.apply('emerald-flow'));assert.equal(await page.evaluate(()=>document.documentElement.dataset.colorTheme),'classic-teal');await page.evaluate(()=>{PFT_STYLE.apply('obsidian-black');document.querySelector('[data-theme-key="navy-emerald"]').click();});assert.equal(await page.evaluate(()=>PFT_STYLE.current),'modern');assert.equal(await page.evaluate(()=>document.documentElement.dataset.colorTheme),'navy-emerald');assert.equal(await page.evaluate(()=>JSON.stringify(state)),before);});
 await check('Desktop hero stays hidden on mobile and net worth fits',async()=>{await page.evaluate(()=>{PFT_STYLE.apply('modern');document.querySelector('.nav-tab[data-tab="dashboard"]').click();});for(const width of [320,390,700]){await page.setViewportSize({width,height:844});assert.equal(await page.locator('.pft-style-hero').isVisible(),false);const tile=page.locator('#dashboard .dashboard-net-worth');assert(await tile.isVisible());const fit=await tile.evaluate(e=>({scroll:e.scrollWidth,width:e.clientWidth}));assert(fit.scroll<=fit.width+1,JSON.stringify({width,fit}));}await page.setViewportSize({width:1024,height:900});assert.equal(await page.locator('.pft-style-hero').isVisible(),true);await page.setViewportSize({width:390,height:844});await page.evaluate(()=>document.querySelector('.nav-tab[data-tab="income-expenses"]').click());});
 await check('Mobile record details do not overlap and open the editor',async()=>{for(const style of ['modern','emerald-flow'])for(const width of [320,390,700])for(const kind of ['income','expense']){await page.setViewportSize({width,height:844});await page.evaluate(({style,kind})=>{PFT_STYLE.apply(style);financeCashFlow.select(kind);},{style,kind});const row=page.locator('#'+kind+'Body tr[data-cash-record]').first();const labels=kind==='income'?['Source','Member','Date']:['Category','Date'];const boxes=[];for(const label of labels){const box=await row.locator('[data-label="'+label+'"]').boundingBox();assert(box);boxes.push(box);}for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];assert(Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)<=1||Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)<=1,JSON.stringify({style,width,kind,boxes}));}assert.equal(await row.locator('.cash-record-menu').count(),0);await row.click();const editor=page.locator('#recordEditorDialog');await editor.waitFor({state:'visible'});assert(await editor.getByRole('button',{name:'Delete transaction'}).isVisible());await page.keyboard.press('Escape');await editor.waitFor({state:'hidden'});}await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{PFT_STYLE.apply('modern');financeCashFlow.select('expense');});});
 await check('Mobile delete cancellation preserves the record',async()=>{for(const kind of ['income','expense']){await page.evaluate(kind=>financeCashFlow.select(kind),kind);const before=await page.evaluate(()=>JSON.stringify({income:state.income,expenses:state.expenses}));const row=page.locator('#'+kind+'Body tr[data-cash-record]').first();await row.click();const editor=page.locator('#recordEditorDialog');await editor.waitFor({state:'visible'});assert.match(await page.locator('#recordEditorTitle').textContent(),new RegExp('Edit '+kind,'i'));page.once('dialog',dialog=>dialog.dismiss());await editor.getByRole('button',{name:'Delete transaction'}).click();assert.equal(await page.evaluate(()=>JSON.stringify({income:state.income,expenses:state.expenses})),before);}await page.evaluate(()=>financeCashFlow.select('expense'));});

 await check('Release mobile Debt, EMI and editor layouts use aligned compact rows',async()=>{
  const before=await page.evaluate(()=>JSON.stringify(state));
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>{
   const date=currentMonthKey()+'-15';
   state.debts=[{id:'release-loan',type:'Home Loan',notes:'Apartment loan',date:'2025-01-01',principal:1850000,remaining:1584716,rate:8.65,emi:23500,interestPaid:298716}];
   state.expenses.push({id:'release-emi',date,category:'EMI Payment',amount:23500,loanId:'release-loan',principalPaid:11990,interestPaid:11510,repaymentType:'emi'});
   PFT_STYLE.apply('emerald-flow');renderDebts();renderExpenses();financeCashFlow.select('expense');
   document.querySelector('.nav-tab[data-tab="income-expenses"]').click();
  });
  const emi=page.locator('#expenseBody tr[data-cash-record="release-emi"]');
  assert(await emi.isVisible());
  const metric=await emi.locator('[data-label="Amount"]').boundingBox();
  const label=await emi.locator('[data-label="Category"]').boundingBox();
  const pieces=await emi.locator('.emi-breakdown>div').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().toJSON()));
  assert(metric&&label&&metric.x>=label.x+label.width-2,JSON.stringify({metric,label}));
  assert.equal(pieces.length,2);assert(pieces[1].y>=pieces[0].y+pieces[0].height-1,JSON.stringify(pieces));
  await emi.click();
  const editor=page.locator('#recordEditorDialog');
  assert(await editor.isVisible());
  const title=await editor.locator('#recordEditorTitle').boundingBox(),close=await editor.locator('#closeRecordEditor').boundingBox();
  const actions=await editor.locator('.record-editor-actions button').evaluateAll(es=>es.map(e=>({name:e.getAttribute('aria-label')||e.textContent.trim(),box:e.getBoundingClientRect().toJSON()})));
  assert(title&&close&&close.x>=title.x+title.width-1&&Math.abs(close.y-title.y)<20,JSON.stringify({title,close}));
  assert.equal(actions.length,3);assert(actions.every(x=>Math.abs(x.box.y-actions[0].box.y)<2),JSON.stringify(actions));
  await page.keyboard.press('Escape');
  await page.evaluate(()=>document.querySelector('.nav-tab[data-tab="debts"]').click());
  const loan=page.locator('#debtsBody tr[data-loan-id="release-loan"]');
  const box=await loan.boundingBox();
  const name=await loan.locator('td').nth(0).boundingBox();
  const status=await loan.locator('td').nth(6).boundingBox();
  const balance=await loan.locator('td').nth(4).boundingBox();
  const action=await loan.locator('td').nth(7).boundingBox();
  assert(box&&name&&status&&balance&&action,JSON.stringify({box,name,status,balance,action}));
  assert(status.x>name.x&&balance.y>=name.y+name.height-2&&action.y>balance.y,JSON.stringify({box,name,status,balance,action}));
  assert(box.height<360,JSON.stringify({height:box.height}));
  for(const style of ['modern','emerald-flow'])for(const width of [320,390,430,700]){
   await page.setViewportSize({width,height:844});
   await page.evaluate(style=>{PFT_STYLE.apply(style);renderDebts();},style);
   const geometry=await loan.evaluate(row=>{
    const box=e=>e.getBoundingClientRect().toJSON(),cells=[...row.children];
    return {row:box(row),cells:cells.map(box),align:cells.map(e=>getComputedStyle(e).textAlign),
     buttons:[...cells[7].querySelectorAll('button')].map(box)};
   });
   const c=geometry.cells;
   assert(geometry.row.height<380,JSON.stringify({style,width,geometry}));
   assert(c[4].y>=c[0].bottom-1&&c[4].bottom<=c[1].y+1,JSON.stringify({style,width,geometry}));
   assert(Math.abs(c[1].y-c[2].y)<1&&Math.abs(c[3].y-c[5].y)<1,JSON.stringify({style,width,geometry}));
   for(const i of [1,2,3,4,5])assert.equal(geometry.align[i],'left');
   for(const b of geometry.buttons)assert(b.width>=44&&b.height>=44&&Math.abs(b.y-geometry.buttons[0].y)<1);
   const header=await page.locator('.debt-list-panel>.panel-header').boundingBox();
   const heading=await page.locator('.debt-list-panel h2').boundingBox();
   const add=await page.locator('#openAddLoanBtn').boundingBox();
   assert(header.height<110&&add.height>=44&&heading.x+heading.width<=add.x+1,JSON.stringify({style,width,header,heading,add}));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }
  await page.evaluate(original=>{Object.assign(state,JSON.parse(original));renderDebts();renderExpenses();PFT_STYLE.apply('modern');document.querySelector('.nav-tab[data-tab="income-expenses"]').click();},before);
  assert.equal(await page.evaluate(()=>JSON.stringify(state)),before);
 });
 await check('Loan details group figures, align actions and scroll below a stable close header',async()=>{
  const original=await page.evaluate(()=>JSON.stringify(state));
  try{
   await page.evaluate(()=>{
    state.debts=[{id:'details-loan',type:'Home Loan',member:'Family',notes:'Apartment loan',date:'2025-01-01',principal:1850000,remaining:1584716,rate:8.65,emi:23500,interestPaid:298716,loanChanges:[{id:'details-change',type:'emi',date:'2026-01-01',emi:23500,notes:'Bank-confirmed payment'}]}];
    document.querySelector('.nav-tab[data-tab="debts"]').click();renderDebts();
   });
   const modal=page.locator('#loanDetailsModal');
   for(const style of ['modern','emerald-flow'])for(const width of [320,390,430,700,1440]){
    await page.setViewportSize({width,height:844});
    await page.evaluate(style=>{PFT_STYLE.apply(style);renderDebts();},style);
    await page.locator('#debtsBody tr[data-loan-id="details-loan"]').click();
    assert(await modal.isVisible());
    assert.equal(await modal.locator('.loan-details-metrics>div').count(),6);
    assert.match(await modal.locator('.loan-details-balance dd').textContent(),/15,84,716/);
    assert.match(await modal.locator('.loan-details-notes dd').textContent(),/Apartment loan/);
    const geometry=await modal.evaluate(e=>{
     const box=node=>node.getBoundingClientRect().toJSON(),shell=e.querySelector('.investment-edit-dialog'),heading=e.querySelector('.loan-details-heading'),content=e.querySelector('#loanDetailsContent'),metrics=e.querySelector('.loan-details-metrics');
     return {shell:box(shell),heading:box(heading),title:box(heading.querySelector('h3')),close:box(heading.querySelector('button')),content:box(content),metrics:[...metrics.children].map(box),overflow:content.scrollWidth>content.clientWidth+1,buttons:[...e.querySelectorAll('.loan-details-actions button')].map(box)};
    });
    assert(geometry.shell.x>=0&&geometry.shell.right<=width+1&&geometry.shell.bottom<=844,JSON.stringify({style,width,geometry}));
    assert(!geometry.overflow&&geometry.close.width>=44&&geometry.close.height>=44);
    assert(geometry.title.right<=geometry.close.x&&Math.abs(geometry.title.y+geometry.title.height/2-geometry.close.y-geometry.close.height/2)<2);
    assert.equal(geometry.buttons.length,6);
    for(let i=0;i<6;i+=2){const a=geometry.buttons[i],b=geometry.buttons[i+1];assert(a.right<=b.x-7&&Math.abs(a.y-b.y)<1&&a.height>=44&&b.height>=44,JSON.stringify({style,width,a,b}));}
    for(let i=0;i<6;i+=2)assert(Math.abs(geometry.metrics[i].y-geometry.metrics[i+1].y)<1);
    await modal.locator('#loanDetailsContent').evaluate(e=>e.scrollTop=e.scrollHeight);
    const after=await modal.locator('.loan-details-heading').boundingBox();
    assert(Math.abs(after.y-geometry.heading.y)<1);
    assert.equal(await modal.locator('.loan-details-history-entry button').count(),2);
    await modal.getByRole('button',{name:'Close loan details',exact:true}).click();
    assert.equal(await modal.isVisible(),false);
   }
   await page.setViewportSize({width:390,height:844});
   await page.locator('#debtsBody tr[data-loan-id="details-loan"]').click();
   await modal.getByRole('button',{name:'Payment history',exact:true}).click();
   const history=page.locator('#debtEmiHistoryModal');
   assert(await history.isVisible());
   const close=history.getByRole('button',{name:'Close payment history',exact:true});
   assert(await close.evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}));
   await close.click();assert(await modal.isVisible());
   await modal.getByRole('button',{name:'Revise EMI',exact:true}).click();
   assert(await page.locator('#recordEditorDialog').isVisible());
   await page.locator('#cancelRecordEditor').click();
   await modal.getByRole('button',{name:'Close loan details',exact:true}).click();
  }finally{
   await page.evaluate(original=>{closeLoanDetails();closeDebtEmiHistory();Object.assign(state,JSON.parse(original));renderDebts();PFT_STYLE.apply('modern');document.querySelector('.nav-tab[data-tab="income-expenses"]').click();},original);
   await page.setViewportSize({width:390,height:844});
  }
 });
 await check('Review Month and Valuation Freshness show readable native calendar values',async()=>{
  const previous=await page.evaluate(()=>JSON.stringify(state));
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>{PFT_STYLE.apply('emerald-flow');document.querySelector('.nav-tab[data-tab="income-expenses"]').click();financeWorkbench.monthly(currentMonthKey());});
  const dialog=page.locator('#financeWorkbenchDialog');
  const month=dialog.locator('input[type="month"]');
  assert(await month.isVisible());
  const display=dialog.locator('.valuation-date-control .valuation-date-display').first();
  assert(await display.isVisible());assert.match(await display.textContent(),/2026/);
  await month.fill('2026-09');
  assert.match(await display.textContent(),/September 2026/);
  await dialog.getByRole('button',{name:'Close',exact:true}).click();
  await page.evaluate(()=>financeWorkbench.valuations('pf'));
  if(await dialog.locator('input[type="date"]').count()){
   const date=dialog.locator('input[type="date"]').first();
   const output=dialog.locator('.valuation-date-display').first();
   assert(await output.isVisible());assert((await output.textContent()).length>5);
   await date.fill('2026-10-20');
   assert.match(await output.textContent(),/Oct 2026/);
  }
  await dialog.getByRole('button',{name:'Close',exact:true}).click();
  assert.equal(await page.evaluate(()=>JSON.stringify(state)),previous);
 });
 await check('Record action icons stay legible across populated pages and mobile styles',async()=>{await page.evaluate(()=>{window.__savedDebt=state.debts;state.debts=[{id:'action-audit-debt',type:'Personal Loan',member:state.customValues.familyMembers[0],principal:120000,remaining:100000,rate:10,emi:5000,date:'2025-04-01',emiDueDay:5,interestPaid:0}];renderDebts();});for(const style of ['modern','emerald-flow'])for(const width of [320,390,700]){await page.setViewportSize({width,height:844});await page.evaluate(style=>PFT_STYLE.apply(style),style);for(const tab of ['dashboard','income-expenses','investments','debts','growth-projection','analytics','reports','settings']){await page.evaluate(tab=>document.querySelector('.nav-tab[data-tab="'+tab+'"]').click(),tab);await page.waitForTimeout(80);const issues=await page.evaluate(()=>[...document.querySelectorAll('.tab-content.active button[data-action-icon],.tab-content.active button.investment-icon-action')].filter(e=>e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect(),svg=e.querySelector('svg'),s=svg?.getBoundingClientRect();return {label:e.getAttribute('aria-label'),width:r.width,height:r.height,icon:s?Math.min(s.width,s.height):0,after:getComputedStyle(e,'::after').content};}).filter(x=>x.width<25||x.height<25||x.icon<12||!['none','normal'].includes(x.after)));assert.deepEqual(issues,[],JSON.stringify({style,width,tab,issues}));}}await page.evaluate(()=>{state.debts=window.__savedDebt;renderDebts();PFT_STYLE.apply('modern');document.querySelector('.nav-tab[data-tab="income-expenses"]').click();financeCashFlow.select('expense');});await page.setViewportSize({width:390,height:844});});
 await check('Portfolio remaining view excludes the current top five and follows sorting',async()=>{
  const saved=await page.evaluate(()=>JSON.stringify(state));
  await page.evaluate(()=>{const member=state.customValues.familyMembers[0];state.pf=[];state.ppf=[];state.nps=[];state.investments=Array.from({length:10},(_,i)=>({id:'remaining-'+i,member,type:'Category '+i,name:'Holding '+i,date:'2026-01-01',invested:1000,current:(i+1)*1000}));document.querySelector('.nav-tab[data-tab="dashboard"]').click();renderCompletePortfolio();});
  for(const sort of ['current','category']){
   await selectControl(page,'#completePortfolioSort',sort);
   const top=await page.locator('#completePortfolioBody [data-portfolio-category]').evaluateAll(es=>es.map(e=>e.dataset.portfolioCategory));
   assert.equal(top.length,5);assert.equal(await page.locator('#openRemainingInvestments').textContent(),'View remaining 5 investments ›');
   await page.locator('#openRemainingInvestments').click();
   const remainder=page.locator('#remainingPortfolioDialog [data-portfolio-category]');
   const other=await remainder.evaluateAll(es=>es.map(e=>e.dataset.portfolioCategory));
   assert.equal(other.length,5);assert(!other.some(category=>top.includes(category)));assert.equal(new Set([...top,...other]).size,10);
   await remainder.first().click();assert.equal(await remainder.first().getAttribute('aria-expanded'),'true');
   await page.keyboard.press('Escape');assert.equal(await page.locator('#remainingPortfolioDialog').isVisible(),false);
  }
  await page.evaluate(()=>{state.investments=state.investments.slice(0,3);renderCompletePortfolio();});
  assert.equal(await page.locator('#openRemainingInvestments').isVisible(),false);
  await page.evaluate(saved=>{Object.assign(state,JSON.parse(saved));renderCompletePortfolio();},saved);
 });
 await check('Small mobile Add record stays clickable while browsing and at the page bottom',async()=>{
  const before=await page.evaluate(()=>JSON.stringify(state));
  for(const style of ['modern','emerald-flow'])for(const width of [320,390,700]){
   await page.setViewportSize({width,height:844});
   await page.evaluate(style=>{PFT_STYLE.apply(style);document.querySelector('.nav-tab[data-tab="dashboard"]').click();document.activeElement?.blur();window.scrollTo(0,0);window.dispatchEvent(new Event('scroll'));},style);
   const add=page.locator('#trackerQuickAdd');
   const alreadyAtBottom=await page.locator('#openRecordSearch').evaluate(e=>e.classList.contains('at-page-bottom'));
   if(!alreadyAtBottom){
    await add.waitFor({state:'visible'});
    const box=await add.boundingBox(),nav=await page.locator('.pft-style-navigation').boundingBox();
    assert.equal(box.width,44);assert.equal(box.height,44);assert(box.y+box.height<=nav.y+1);
    assert(nav.y-(box.y+box.height)<5,'Add touch area must sit directly above the dock');
    const visual=await add.evaluate(e=>({inset:getComputedStyle(e,'::before').top,symbol:getComputedStyle(e.querySelector('.quick-add-symbol')).fontSize,right:innerWidth-e.getBoundingClientRect().right}));
    assert.equal(visual.inset,'5.5px','The visible circle must be 33px inside the 44px touch area');
    assert.equal(visual.symbol,'19.5px');assert(visual.right<=5);
    assert.equal(await add.evaluate(e=>e.style.bottom),'','The button must not acquire a moving inline bottom position');
    const dockStyles=await page.evaluate(()=>({pad:getComputedStyle(document.body).paddingBottom,border:getComputedStyle(document.querySelector('.pft-style-navigation')).borderTopWidth}));
    assert.equal(dockStyles.pad,'0px','Bottom sync must not add a second page reserve');
    assert.equal(dockStyles.border,'0px','The mobile dock must not show a colored top strip');
    assert.equal(await add.getAttribute('aria-label'),'Add record');
    assert.equal(await page.locator('.pft-dashboard-caption').isVisible(),false);
    await add.click();
    assert(await page.locator('#quickAddDialog').isVisible());
    assert.equal(await page.locator('#quickAddDialog').getByRole('button',{name:'Income',exact:true}).count(),1);
    await page.locator('#quickAddDialog').getByRole('button',{name:/^Close/}).click();
    await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo(0,document.documentElement.scrollHeight);});
    await page.locator('#openRecordSearch').waitFor({state:'visible'});
   }
   assert(await add.isVisible(),'Add record must stay available at the page bottom');
   await add.click();
   assert(await page.locator('#quickAddDialog').isVisible());
   await page.locator('#quickAddDialog').getByRole('button',{name:/^Close/}).click();
   await page.evaluate(()=>document.querySelector('.nav-tab[data-tab="income-expenses"]').click());
   assert.equal(await add.isVisible(),false);
  }
  assert.equal(await page.evaluate(()=>JSON.stringify(state)),before);
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>{PFT_STYLE.apply('modern');financeCashFlow.select('expense');});
 });
 await check('Consolidated Dashboard cards form one desktop row and a mobile 2x2 without duplicate averages',async()=>{
  await page.evaluate(()=>{PFT_STYLE.apply('modern');document.querySelector('.nav-tab[data-tab="dashboard"]').click();updateDashboard();});
  const before=await page.evaluate(()=>JSON.stringify(state));
  for(const width of [1440,1024,800,701,700,390,360,320]){
   await page.setViewportSize({width,height:900});
   const overview=page.locator('#dashboardMonthlyOverview');assert(await overview.isVisible());
   assert.equal(await page.locator('#dashboardLegacyAverages').isVisible(),false);
   const boxes=await overview.locator('.dashboard-stat').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return {key:node.dataset.summaryKey,x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,scroll:node.scrollWidth,client:node.clientWidth};}));
   assert.deepEqual(boxes.map(row=>row.key),['income','expenses','savings','balance']);
   const cols=width>700?4:2;
   for(let i=0;i<boxes.length;i++){assert(boxes[i].scroll<=boxes[i].client+1,JSON.stringify({width,boxes}));assert(Math.abs(boxes[i].width-boxes[0].width)<2,JSON.stringify({width,boxes}));if(i%cols)assert(boxes[i].x>=boxes[i-1].right-1&&Math.abs(boxes[i].y-boxes[i-1].y)<2,JSON.stringify({width,boxes}));else if(i)assert(boxes[i].y>=boxes[i-cols].bottom-1,JSON.stringify({width,boxes}));}
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   for(const id of ['dashboardIncomeAverage','dashboardExpenseAverage','dashboardSavingsAverage'])assert.match(await page.locator('#'+id).textContent(),/Avg .* · FY \d{2}–\d{2}/);
   const expected=await page.evaluate(()=>{const data=PFT_DASHBOARD_INSIGHTS;return {income:formatCurrency(profileRows(state.income).filter(row=>inMonth(row.date,currentMonthKey())).reduce((sum,row)=>sum+row.amount,0)),expenses:formatCurrency(data.monthlyExpenses),balance:formatCurrency(data.surplusBalance),opening:data.hasOpening?'Opening '+formatCurrency(data.opening):'Opening not set'};});
   assert.equal(await page.locator('#monthlyIncome').textContent(),expected.income);assert.equal(await page.locator('#monthlyExpenses').textContent(),expected.expenses);assert.equal(await page.locator('#surplusBalance').textContent(),expected.balance);assert.equal(await page.locator('#dashboardOpeningBalance').textContent(),expected.opening);
  }
  assert.equal(await page.evaluate(()=>JSON.stringify(state)),before);
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>document.querySelector('.nav-tab[data-tab="income-expenses"]').click());
 });
 await check('Monthly Expenses replaces duplicate debt tile and follows recorded month totals',async()=>{const before=await page.evaluate(()=>JSON.stringify(state));for(const style of ['modern','emerald-flow']){await page.evaluate(style=>{PFT_STYLE.apply(style);document.querySelector('.nav-tab[data-tab="dashboard"]').click();updateDashboard();},style);assert.equal(await page.locator('#monthlyExpenses').textContent(),'₹2,000');assert.equal(await page.locator('#totalDebts').count(),0);assert.equal(await page.locator('#monthlyExpenses').evaluate(e=>e.closest('.dashboard-stat').querySelector('.dashboard-kicker').textContent),'Monthly Expenses');assert.equal(await page.evaluate(()=>PFT_DASHBOARD_INSIGHTS.netWorth===PFT_DASHBOARD_INSIGHTS.totalAssets-PFT_DASHBOARD_INSIGHTS.totalDebts),true);}await page.evaluate(()=>{state.expenses.push({id:'past',date:addMonthsClamped(currentMonthKey()+'-01',-1,1),category:'Other',amount:999});updateDashboard();});assert.equal(await page.locator('#monthlyExpenses').textContent(),'₹2,000');await page.evaluate(()=>{state.expenses=state.expenses.filter(r=>r.id!=='past');PFT_STYLE.apply('modern');document.querySelector('.nav-tab[data-tab="income-expenses"]').click();updateDashboard();});assert.equal(await page.evaluate(()=>JSON.stringify(state)),before);});
 await check('Desktop Income and Expense forms align buttons and use the full Expense Notes row',async()=>{for(const width of [1024,1440]){await page.setViewportSize({width,height:900});await page.evaluate(()=>{PFT_STYLE.apply('modern');document.querySelector('.nav-tab[data-tab="income-expenses"]').click();});await page.waitForFunction(()=>Boolean(document.querySelector('.advanced-cashflow-entry-card.transaction-panel-income #addIncomeBtn') && document.querySelector('.advanced-cashflow-entry-card.transaction-panel-expense #addExpenseBtn')));await page.mouse.move(0,0);await page.waitForTimeout(350);// Avoid a hovered card's subtle lift while comparing baseline alignment before asserting subpixel button alignment.
    await page.waitForFunction(()=>{const income=document.querySelector('.advanced-cashflow-entry-card.transaction-panel-income'),expense=document.querySelector('.advanced-cashflow-entry-card.transaction-panel-expense');if(!income||!expense)return false;const a=income.querySelector('#addIncomeBtn'),b=expense.querySelector('#addExpenseBtn');return a&&b&&Math.abs(a.getBoundingClientRect().bottom-b.getBoundingClientRect().bottom)<=1;},null,{timeout:5000});const geometry=await page.evaluate(()=>{const income=document.querySelector('.advanced-cashflow-entry-card.transaction-panel-income'),expense=document.querySelector('.advanced-cashflow-entry-card.transaction-panel-expense'),i=income.getBoundingClientRect(),e=expense.getBoundingClientRect(),ib=income.querySelector('#addIncomeBtn').getBoundingClientRect(),eb=expense.querySelector('#addExpenseBtn').getBoundingClientRect(),notes=expense.querySelector('.expense-notes-field').getBoundingClientRect(),grid=expense.querySelector('.form-grid'),form=grid.getBoundingClientRect(),style=getComputedStyle(grid),contentWidth=grid.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight);return{income:i.toJSON(),expense:e.toJSON(),incomeButton:ib.toJSON(),expenseButton:eb.toJSON(),notes:notes.toJSON(),form:form.toJSON(),contentWidth};});assert(Math.abs(geometry.income.height-geometry.expense.height)<=1&&Math.abs(geometry.incomeButton.bottom-geometry.expenseButton.bottom)<=1,JSON.stringify({width,geometry}));assert(Math.abs(geometry.notes.width-geometry.contentWidth)<=2,JSON.stringify({width,geometry}));const buttonStyles=await page.evaluate(()=>Object.fromEntries(['addIncomeBtn','addExpenseBtn'].map(id=>{const e=document.getElementById(id),s=getComputedStyle(e);return[id,{background:s.backgroundColor,padding:s.padding,minHeight:s.minHeight}]})));assert.equal(buttonStyles.addIncomeBtn.background,'rgb(94, 234, 212)');assert.equal(buttonStyles.addExpenseBtn.background,'rgb(233, 147, 97)');assert.equal(buttonStyles.addIncomeBtn.padding,'8px 20px');assert.equal(buttonStyles.addExpenseBtn.padding,'8px 20px');const selects=await page.locator('#incomeSource,#expenseCategory,#isAnnual').evaluateAll(es=>es.map(e=>({className:e.className,appearance:getComputedStyle(e).appearance,image:getComputedStyle(e).backgroundImage,padding:getComputedStyle(e).paddingRight,trigger:document.getElementById(e.id+'PopoverTrigger')?.outerHTML})));assert(selects.every(s=>s.appearance==='none'&&s.image.includes('linear-gradient')&&parseFloat(s.padding)>=32),JSON.stringify({width,selects}));}await page.setViewportSize({width:390,height:844});});
 await check('Desktop Net Worth card aligns with the bottom of the 2x2 summary grid',async()=>{for(const width of [800,1024,1440]){await page.setViewportSize({width,height:900});await page.evaluate(()=>{PFT_STYLE.apply('emerald-flow');document.querySelector('.nav-tab[data-tab="dashboard"]').click();});await page.waitForFunction(()=>Boolean(document.querySelector('.flow-summary')));const geometry=await page.evaluate(()=>{const card=document.querySelector('.flow-wealth .dashboard-net-worth').getBoundingClientRect(),grid=document.querySelector('.flow-stat-grid').getBoundingClientRect(),tiles=[...document.querySelectorAll('.flow-stat-grid .dashboard-stat')].map(e=>e.getBoundingClientRect());return{card:card.toJSON(),grid:grid.toJSON(),tiles:tiles.map(r=>r.toJSON())};});assert.equal(geometry.tiles.length,4);assert(Math.abs(geometry.card.top-geometry.grid.top)<=1&&Math.abs(geometry.card.bottom-geometry.grid.bottom)<=1,JSON.stringify({width,geometry}));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{PFT_STYLE.apply('modern');document.querySelector('.nav-tab[data-tab="income-expenses"]').click();});});
 await check('Monthly Expense Snapshot stays visible on desktop while pending',async()=>{const balances=await page.evaluate(()=>JSON.stringify(state.monthlyBalances));for(const style of ['modern','emerald-flow']){await page.setViewportSize({width:1440,height:900});await page.evaluate(style=>{PFT_STYLE.apply(style);document.querySelector('.nav-tab[data-tab="dashboard"]').click();state.monthlyBalances=[];updateDashboard();},style);assert.equal(await page.locator('#dashboardExpenseSnapshot').isVisible(),true);assert.equal(await page.locator('#lastMonthHouseExpense').textContent(),'Pending');assert.equal(await page.locator('#lastMonthFullExpense').textContent(),'Pending');await page.setViewportSize({width:390,height:844});await page.evaluate(()=>renderDashboardExpenseSnapshot());assert.equal(await page.locator('#dashboardExpenseSnapshot').isVisible(),false);await page.setViewportSize({width:1440,height:900});await page.evaluate(()=>{const previous=addMonthsClamped(currentMonthKey()+'-01',-1,1).slice(0,7);state.monthlyBalances=[{id:'prev',month:previous,startBalance:1000,houseExpense:0},{id:'current',month:currentMonthKey(),startBalance:1000}];updateDashboard();});assert.equal(await page.locator('#dashboardExpenseSnapshot').getAttribute('hidden'),null);assert.equal(await page.locator('#lastMonthHouseExpense').textContent(),'₹0');}await page.evaluate(balances=>{state.monthlyBalances=JSON.parse(balances);PFT_STYLE.apply('modern');document.querySelector('.nav-tab[data-tab="income-expenses"]').click();updateDashboard();},balances);await page.setViewportSize({width:390,height:844});});
 await check('Snapshot month dropdown switches calculated months without changing records',async()=>{const original=await page.evaluate(()=>JSON.stringify(state.monthlyBalances));await page.evaluate(()=>{const now=currentMonthKey(),prev=addMonthsClamped(now+'-01',-1,1).slice(0,7),older=addMonthsClamped(now+'-01',-2,1).slice(0,7);state.monthlyBalances=[{id:'old',month:older,startBalance:1000},{id:'prev',month:prev,startBalance:700},{id:'now',month:now,startBalance:500}];document.querySelector('.nav-tab[data-tab="dashboard"]').click();updateDashboard();});const before=await page.evaluate(()=>JSON.stringify(state));const older=await page.evaluate(()=>addMonthsClamped(currentMonthKey()+'-01',-2,1).slice(0,7));assert.equal(await page.locator('#dashboardExpenseMonth').isVisible(),false);assert(await page.locator('#dashboardExpenseMonthTrigger').isVisible());await page.locator('#dashboardExpenseMonthTrigger').click();const monthPlacement=await page.evaluate(()=>{const trigger=document.getElementById('dashboardExpenseMonthTrigger').getBoundingClientRect(),menu=document.getElementById('dashboardExpenseMonthMenu'),box=menu.getBoundingClientRect();return{parent:menu.parentElement===document.body,trigger:trigger.toJSON(),box:box.toJSON(),screenWidth:innerWidth};});assert(monthPlacement.parent,JSON.stringify(monthPlacement));assert(monthPlacement.box.left>=10&&monthPlacement.box.right<=monthPlacement.screenWidth-10,JSON.stringify(monthPlacement));assert(Math.abs(monthPlacement.box.top-monthPlacement.trigger.bottom-7)<12||Math.abs(monthPlacement.trigger.top-monthPlacement.box.bottom-7)<12,JSON.stringify(monthPlacement));await page.locator('#dashboardExpenseMonthMenu .dashboard-month-option[data-month="'+older+'"]').click();assert.equal(await page.locator('#lastMonthHouseExpense').textContent(),'₹300');assert.equal(await page.locator('#lastMonthFullExpense').textContent(),'₹300');assert.equal(await page.evaluate(()=>JSON.stringify(state)),before);await page.evaluate(original=>{state.monthlyBalances=JSON.parse(original);delete document.getElementById('dashboardExpenseMonth').dataset.selectedMonth;document.querySelector('.nav-tab[data-tab="income-expenses"]').click();updateDashboard();},original);});
 await check('Compact Recurring action shares commitments header and opens independently',async()=>{await page.evaluate(()=>document.querySelector('.nav-tab[data-tab="income-expenses"]').click());for(const style of ['modern','emerald-flow'])for(const width of [320,390,700,1440]){await page.setViewportSize({width,height:844});await page.evaluate(style=>{PFT_STYLE.apply(style);financeInsights.refresh();document.getElementById('cashCommitments').open=false;},style);const button=page.locator('#cashRecurringShortcut');assert(await button.isVisible());assert.equal(await page.locator('.recurring-launch').isVisible(),false);const b=await button.boundingBox();assert(b.width<110&&b.height>=44);await button.click();assert(await page.locator('#recurringDialog').isVisible());assert.equal(await page.locator('#cashCommitments').evaluate(e=>e.open),false);await page.locator('#closeRecurringBtn').click();await page.locator('#cashCommitments summary').click();assert.equal(await page.locator('#cashCommitments').evaluate(e=>e.open),true);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{PFT_STYLE.apply('modern');document.getElementById('cashCommitments').open=false;});});
 await check('Mobile segmented control is 44px and expenses align with the balance bar',async()=>{for(const width of [320,390,700]){await page.setViewportSize({width,height:844});await page.evaluate(()=>{document.querySelector('.nav-tab[data-tab="income-expenses"]').click();financeCashFlow.select('expense');});const track=await page.locator('.cash-controls').boundingBox();assert.equal(track.height,44);assert.equal(await page.locator('.cash-controls').evaluate(e=>getComputedStyle(e).padding),'4px');assert.equal(await page.locator('.transaction-metric-expense .transaction-metric-copy').evaluate(e=>getComputedStyle(e).textAlign),'right');const expense=await page.locator('.transaction-metric-expense').boundingBox(),bar=await page.locator('.cash-balance-track').boundingBox();assert(Math.abs(expense.x+expense.width-8-bar.x-bar.width)<=1);for(const id of ['cashBalanceBreakdown','cashCommitments']){const icon=await page.locator('#'+id+'>summary').evaluate(e=>({marker:getComputedStyle(e).listStyleType,mask:getComputedStyle(e,'::before').maskImage}));assert.equal(icon.marker,'none');assert(icon.mask.includes('svg'));}await page.locator('#cashTab-income').click();assert.equal(await page.locator('#cashHistory-income').isVisible(),true);}await page.setViewportSize({width:390,height:844});await page.evaluate(()=>financeCashFlow.select('expense'));});
 await check('Top month popover filters summaries and both histories on desktop and mobile',async()=>{const original=await page.evaluate(()=>JSON.stringify(state));const older=await page.evaluate(()=>{const month=addMonthsClamped(currentMonthKey()+'-01',-1,1).slice(0,7);state.income.push({id:'master-income',member:state.customValues.familyMembers[0],date:month+'-02',source:'Other',amount:900});state.expenses.push({id:'master-expense',date:month+'-03',category:'Other',amount:250});renderIncome();renderExpenses();return month;});const label=await page.evaluate(month=>new Date(month+'-01T12:00:00').toLocaleDateString('en-IN',{month:'long',year:'numeric'}),older);for(const style of ['modern','emerald-flow'])for(const width of [320,390,700,1440]){await page.setViewportSize({width,height:900});await page.evaluate(style=>{PFT_STYLE.apply(style);document.querySelector('.nav-tab[data-tab="income-expenses"]').click();},style);const trigger=page.locator('#cashMonthFilterPopoverTrigger');assert(await trigger.isVisible(),JSON.stringify({style,width}));await trigger.click();await page.locator('.pft-glass-popover:popover-open').getByRole('option',{name:label,exact:true}).click();assert.equal(await page.locator('#transactionIncomeTotal').textContent(),'₹900');assert.equal(await page.locator('#transactionExpenseTotal').textContent(),'₹250');assert.equal(await page.locator('#transactionNetTotal').textContent(),'₹650');for(const kind of ['income','expense']){await page.evaluate(kind=>financeCashFlow.select(kind),kind);assert.equal(await page.locator('#'+kind+'HistoryMonth').inputValue(),older);assert.equal(await page.locator('#cashHistory-'+kind+' .history-filter-controls').isVisible(),false,JSON.stringify({style,width,kind}));assert.equal(await page.locator('#'+kind+'Body tr[data-cash-record="master-'+kind+'"]').count(),1);}await page.waitForFunction(month=>document.querySelector('#cashBalanceBreakdown .finance-insight-note').textContent.includes(month),older);assert.equal(await page.locator('#cashHistory-expense .history-filter-controls').isVisible(),false,JSON.stringify({style,width}));}await page.evaluate(original=>{Object.assign(state,JSON.parse(original));document.getElementById('income-expenses').dataset.cashMonth=currentMonthKey();renderIncome();renderExpenses();renderTransactionOverview();},original);await page.setViewportSize({width:390,height:844});});
 await check('Glass filter popovers select months, dismiss and support keyboard navigation',async()=>{await page.waitForFunction(()=>Boolean(window.financeFilterPopovers));await page.evaluate(()=>{document.querySelector('.nav-tab[data-tab="income-expenses"]').click();financeCashFlow.select('expense');});const trigger=page.locator('#cashMonthFilterPopoverTrigger');await trigger.click();const panel=page.locator('.pft-glass-popover:popover-open');assert(await panel.isVisible());assert.equal(await trigger.getAttribute('aria-expanded'),'true');const rect=await panel.boundingBox();assert(rect.x>=0&&rect.x+rect.width<=390);await panel.getByRole('option').first().click();assert.equal(await trigger.getAttribute('aria-expanded'),'false');assert.equal(await trigger.evaluate(e=>e===document.activeElement),true);await trigger.press('ArrowDown');await page.keyboard.press('End');await page.keyboard.press('Escape');assert.equal(await trigger.getAttribute('aria-expanded'),'false');assert.equal(await trigger.evaluate(e=>e===document.activeElement),true);await page.evaluate(()=>document.querySelector('.nav-tab[data-tab="reports"]').click());await page.locator('#reportTypePopoverTrigger').click();const options=page.locator('.pft-glass-popover:popover-open [role=option]');assert(await options.count()>1);await options.first().click();await page.evaluate(()=>document.querySelector('.nav-tab[data-tab="income-expenses"]').click());});

 await check('Mobile investment sections switch between Investments and Retirement without altering records',async()=>{
  const before=await page.evaluate(()=>JSON.stringify(state));
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>{PFT_STYLE.apply('modern');document.querySelector('.nav-tab[data-tab="investments"]').click();});
  const tabs=page.locator('#investmentMobileSectionTabs');
  assert(await tabs.isVisible());
  await page.locator('#investmentMobileTabInvestments').click();
  assert.equal(await page.locator('#investmentListPanel').isVisible(),true);
  assert.equal(await page.locator('#retirementAccountsPanel').isVisible(),false);
  await page.locator('#investmentMobileTabRetirement').click();
  assert.equal(await page.locator('#investmentListPanel').isVisible(),false);
  assert.equal(await page.locator('#retirementAccountsPanel').isVisible(),true);
  assert.equal(await page.locator('#investmentMobileTabRetirement').getAttribute('aria-selected'),'true');
  await page.locator('#investmentMobileTabRetirement').focus();
  await page.keyboard.press('ArrowLeft');
  assert.equal(await page.locator('#investmentMobileTabInvestments').getAttribute('aria-selected'),'true');
  await page.setViewportSize({width:1024,height:900});
  assert.equal(await tabs.isVisible(),false);
  assert.equal(await page.locator('#investmentListPanel').isVisible(),true);
  assert.equal(await page.locator('#retirementAccountsPanel').isVisible(),true);
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>JSON.stringify(state)),before);
 });
 await check('PMS-style investment and retirement actions are full-width on desktop and preserve mobile',async()=>{
  const original=await page.evaluate(()=>JSON.stringify(state));
  try{
   await page.setViewportSize({width:1440,height:900});
   await page.evaluate(()=>{
    PFT_STYLE.apply('modern');
    document.querySelector('.nav-tab[data-tab="investments"]').click();
    const member=state.customValues.familyMembers[0];
    state.investments=[{id:'footer-fund',member,type:'Mutual Funds',name:'Test fund',date:'2025-01-01',invested:100000,current:120000,monthly:2500,autoMonthlyContribution:true}];
    state.pf=[{id:'footer-pf',member,account:'Test PF',employee:2000,employer:1000,monthly:3000,rate:8.25,invested:50000,current:65000,epsCurrent:0,date:'2025-01-01'}];
    renderInvestments();renderPf();renderInvestmentCategoryDialog('Mutual Funds',true);
   });
   const investment=page.locator('#investmentCategoryDialog');
   assert.deepEqual(await investment.locator('.pms-modal-action-button span').allTextContents(),['View History','Edit','Delete','Add contribution','Update value']);
   assert.equal(await investment.locator('td.pms-modal-original-actions').evaluate(el=>getComputedStyle(el).display),'none');
   const investmentGeometry=await investment.locator('.pms-modal-action-button').evaluateAll(buttons=>buttons.map(b=>b.getBoundingClientRect().toJSON()));
   assert(investmentGeometry.every(box=>Math.abs(box.y-investmentGeometry[0].y)<3),JSON.stringify(investmentGeometry));
   await page.evaluate(()=>{closeInvestmentCategoryDialog();renderRetirementCategoryDialog('pf',true);});
   const retirement=page.locator('#retirementCategoryDialog');
   assert.deepEqual(await retirement.locator('.pms-modal-action-button span').allTextContents(),['View History','Edit','Delete','Add contribution']);
   assert.equal(await retirement.locator('td.pms-modal-original-actions').evaluate(el=>getComputedStyle(el).display),'none');
   const retirementGeometry=await retirement.locator('.pms-modal-action-button').evaluateAll(buttons=>buttons.map(b=>b.getBoundingClientRect().toJSON()));
   assert(retirementGeometry.every(box=>Math.abs(box.y-retirementGeometry[0].y)<3),JSON.stringify(retirementGeometry));
   await page.setViewportSize({width:390,height:844});
   assert.equal(await retirement.locator('.pms-modal-action-list').isVisible(),false);
   assert.notEqual(await retirement.locator('td.pms-modal-original-actions').evaluate(el=>getComputedStyle(el).display),'none');
   await page.evaluate(()=>{closeRetirementCategoryDialog();renderInvestmentCategoryDialog('Mutual Funds',true);});
   assert.equal(await investment.locator('.pms-modal-action-list').isVisible(),false);
   assert.notEqual(await investment.locator('td.pms-modal-original-actions').evaluate(el=>getComputedStyle(el).display),'none');
  }finally{
   await page.evaluate(original=>{
    closeInvestmentCategoryDialog();closeRetirementCategoryDialog();
    Object.assign(state,JSON.parse(original));renderInvestments();renderPf();
   },original);
   await page.setViewportSize({width:390,height:844});
  }
 });
 await check('Mobile detail sheet headers and PMS metrics have no overlap',async()=>{
  const original=await page.evaluate(()=>JSON.stringify(state));
  await page.evaluate(()=>{
   PFT_STYLE.apply('modern');
   document.querySelector('.nav-tab[data-tab="investments"]').click();
   const member=state.customValues.familyMembers[0];
   state.gratuityAccounts=[{id:'gratuity-mobile-layout',member,date:'2018-06-15',basicSalary:68000}];
   state.pf=[{id:'pf-mobile-layout',member,account:'Employer PF',employee:7000,employer:3000,monthly:10000,rate:8.25,invested:670000,current:790000,epsCurrent:0,date:'2026-01-01'}];
   state.investments=[{id:'pms-mobile-layout',member,type:'Stallion PMS',name:'Long-term PMS',invested:1080000,current:1280000,monthly:25000,date:'2022-01-01'}];
   state.stallionPms=[{id:'pms-mobile-layout',name:'Long-term PMS',member,invested:1080000,profit:200000}];
   renderInvestments();renderPf();
   renderRetirementCategoryDialog('gratuity',true);
  });
  const gratuity=page.locator('#retirementCategoryDialog');
  const header=await gratuity.locator('.investment-category-dialog-header').boundingBox();
  const title=await gratuity.locator('#retirementCategoryDialogTitle').boundingBox();
  const close=await gratuity.locator('.investment-category-dialog-close').boundingBox();
  assert(header&&title&&close&&header.height<90&&close.x>title.x+title.width-2&&Math.abs(title.y+title.height/2-(close.y+close.height/2))<24,JSON.stringify({header,title,close}));
  await gratuity.locator('.investment-category-dialog-close[data-close-retirement-category-dialog]').click();
  await page.evaluate(()=>renderRetirementCategoryDialog('pf',true));
  const actions=gratuity.locator('#retirementCategoryDialogTable tbody td[data-mobile-label="Actions"]').first();
  assert(await actions.count()>0);
  const geometry=await actions.evaluate(td=>[...td.querySelectorAll('button')].map(b=>b.getBoundingClientRect().toJSON()));
  assert(geometry.length>=3&&geometry.every(b=>Math.abs(b.y-geometry[0].y)<3),JSON.stringify(geometry));
  await gratuity.locator('.investment-category-dialog-close[data-close-retirement-category-dialog]').click();
  await page.locator('#stallionPmsTileBody .pms-summary-tile').first().click();
  const row=page.locator('#investmentCategoryDialogTable .stallion-pms-holdings tbody tr').first();
  const monthly=await row.locator('[data-label="Monthly Contribution"]').boundingBox();
  const gain=await row.locator('[data-label="Gain / Loss"]').boundingBox();
  assert(monthly&&gain,JSON.stringify({monthly,gain}));
  await page.locator('#investmentCategoryDialog [data-close-investment-category-dialog]').first().click();
  await page.evaluate(()=>financeWorkbench.valuations('pf'));
  const workbench=page.locator('#financeWorkbenchDialog');
  const workHead=await workbench.locator('header.finance-workbench-header').boundingBox();
  const workTitle=await workbench.locator('h2').first().boundingBox();
  const workClose=await workbench.getByRole('button',{name:'Close',exact:true}).boundingBox();
  assert(workHead&&workHead.height<95&&workTitle&&workClose&&workClose.x>workTitle.x,JSON.stringify({workHead,workTitle,workClose}));
  const buttons=await workbench.locator('.valuation-account-actions button').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().toJSON()));
  assert(buttons.length>=2&&Math.abs(buttons[0].y-buttons[1].y)<3,JSON.stringify(buttons));
  await workbench.getByRole('button',{name:'Close',exact:true}).click();
  await page.evaluate(original=>{Object.assign(state,JSON.parse(original));renderInvestments();renderPf();PFT_STYLE.apply('modern');},original);
  assert.equal(await page.evaluate(()=>JSON.stringify(state)),original);
 });
 await check('Investment cards and Debt overview share compact styling and working Add controls',async()=>{const original=await page.evaluate(()=>JSON.stringify(state));await page.evaluate(()=>{state.investments=[];state.stallionPms=[];state.pf=[];state.ppf=[];state.nps=[];state.gratuityAccounts=[];state.debts=[];PFT_STYLE.apply('modern');renderInvestments();renderDebts();});for(const width of [320,390,700]){await page.setViewportSize({width,height:844});await page.evaluate(()=>document.querySelector('.nav-tab[data-tab="investments"]').click());const type=await page.evaluate(()=>['#investmentListPanel h2','#retirementAccountsHeading'].map(s=>{const c=getComputedStyle(document.querySelector(s));return[c.fontSize,c.fontWeight];}));assert.deepEqual(type,[['16px','600'],['16px','600']]);await page.locator('#investmentMobileTabInvestments').click();assert(await page.locator('.investment-empty-state').isVisible());assert.equal(await page.locator('.investment-empty-state').evaluate(e=>getComputedStyle(e).borderTopStyle),'solid');for(const selector of ['.investment-empty-state','#retirementEmptyState']){await page.locator(selector==='.investment-empty-state'?'#investmentMobileTabInvestments':'#investmentMobileTabRetirement').click();const empty=page.locator(selector),icon=await empty.locator('.account-empty-icon').boundingBox(),copy=await empty.locator('.account-empty-copy').boundingBox(),box=await empty.boundingBox();assert(icon&&copy&&box&&icon.width>=40&&icon.x+icon.width<=copy.x+1&&copy.x+copy.width<=box.x+box.width+1,JSON.stringify({width,selector,icon,copy,box}));assert.equal(await empty.locator('svg').getAttribute('aria-hidden'),null);assert.equal(await empty.locator('.account-empty-icon').getAttribute('aria-hidden'),'true');}for(const [title,button,description] of [['#investmentListPanel > .panel-header h2','#openGeneralInvestmentBtn','.investment-portfolio-title p'],['#retirementAccountsHeading','#retirementAddBtn','.retirement-accounts-heading p']]){await page.locator(title.startsWith('#investmentListPanel')?'#investmentMobileTabInvestments':'#investmentMobileTabRetirement').click();const t=await page.locator(title).boundingBox(),b=await page.locator(button).boundingBox(),d=await page.locator(description).boundingBox();assert(t.x+t.width<=b.x+1&&Math.abs((t.y+t.height/2)-(b.y+b.height/2))<3&&d.y>=t.y+t.height-1&&b.width>=43.9&&b.height>=43.9,JSON.stringify({width,title,t,b,d}));}await page.locator('#investmentMobileTabInvestments').click();await page.locator('#openGeneralInvestmentBtn').click();assert(await page.locator('#investmentAddMenu').isVisible());await page.locator('#openGeneralInvestmentBtn').click();const hero=await page.locator('.investment-overview-grid').boundingBox();assert(hero.width<=width,JSON.stringify({width,hero}));await page.locator('#investmentMobileTabRetirement').click();await page.locator('#retirementAddBtn').click();assert(await page.locator('#retirementAddMenu').isVisible());await page.locator('#retirementAddMenu [data-retirement-add="pf"]').click();assert(await page.locator('#entryFormModal').isVisible());await page.evaluate(()=>closeEntryFormModal());await page.evaluate(()=>document.querySelector('.nav-tab[data-tab="debts"]').click());const title=await page.locator('.debt-page-intro h1').boundingBox(),badge=await page.locator('#debtPageStatus').boundingBox();assert(title.x+title.width<=badge.x);assert.equal(await page.locator('#debtPageStatus').textContent(),'0 active · 0 total');assert.equal(await page.locator('#debtListCount').isVisible(),false);assert.equal(await page.locator('.debt-page-stat-count').isVisible(),false);assert(await page.locator('.debt-empty-state').isVisible());const debtEmptyBox=await page.locator('.debt-empty-state').boundingBox(),debtPanelBox=await page.locator('.debt-list-panel').boundingBox();assert(debtEmptyBox.width>=debtPanelBox.width-35,JSON.stringify({width,debtEmptyBox,debtPanelBox}));const debtTitle=await page.locator('.debt-list-panel h2').boundingBox(),debtButton=await page.locator('#openAddLoanBtn').boundingBox(),debtDescription=await page.locator('.debt-list-panel .debt-section-title p').boundingBox(),debtIcon=await page.locator('.debt-empty-state .account-empty-icon').boundingBox(),debtCopy=await page.locator('.debt-empty-state .account-empty-copy').boundingBox(),debtStats=await page.locator('.debt-page-stat:not(.debt-page-stat-count)').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().toJSON()));assert(debtTitle.x+debtTitle.width<=debtButton.x+1&&Math.abs((debtTitle.y+debtTitle.height/2)-(debtButton.y+debtButton.height/2))<3&&debtDescription.y>=debtTitle.y+debtTitle.height-1&&debtIcon.x+debtIcon.width<=debtCopy.x+1,JSON.stringify({width,debtTitle,debtButton,debtDescription,debtIcon,debtCopy}));assert(debtStats[0].right<=debtStats[1].left+1&&Math.abs(debtStats[0].y-debtStats[1].y)<2);const icons=await page.locator('.debt-page-stat:not(.debt-page-stat-count) .debt-page-stat-icon').evaluateAll(es=>es.map(e=>{const c=getComputedStyle(e);return[c.width,c.height,c.backgroundColor];}));assert.deepEqual(icons[0],icons[1]);assert.equal(icons[0][0],'40px');await page.locator('#openAddLoanBtn').click();assert(await page.locator('#entryFormModal').isVisible());await page.evaluate(()=>closeEntryFormModal());assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}await page.evaluate(original=>{Object.assign(state,JSON.parse(original));renderInvestments();renderDebts();document.querySelector('.nav-tab[data-tab="income-expenses"]').click();},original);await page.setViewportSize({width:390,height:844});});
 await check('Desktop Debt empty state keeps its icon within the card',async()=>{const original=await page.evaluate(()=>JSON.stringify(state.debts));await page.evaluate(()=>{state.debts=[];renderDebts();document.querySelector('.nav-tab[data-tab="debts"]').click();});for(const style of ['modern','emerald-flow','obsidian-black'])for(const width of [701,1024,1440,1920]){await page.setViewportSize({width,height:900});await page.evaluate(style=>PFT_STYLE.apply(style),style);const info=await page.locator('.debt-empty-state').evaluate(e=>{const box=e.getBoundingClientRect(),icon=e.querySelector('.account-empty-icon').getBoundingClientRect(),svg=e.querySelector('svg').getBoundingClientRect(),copy=e.querySelector('.account-empty-copy').getBoundingClientRect();return{box:box.toJSON(),icon:icon.toJSON(),svg:svg.toJSON(),copy:copy.toJSON(),fill:getComputedStyle(e.querySelector('svg')).fill};});assert(info.svg.width<=24&&info.svg.height<=24&&info.icon.width<=44&&info.icon.height<=44&&info.box.height<160&&info.copy.right<=info.box.right+1&&info.fill==='none',JSON.stringify({style,width,info}));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}await page.evaluate(original=>{state.debts=JSON.parse(original);renderDebts();PFT_STYLE.apply('modern');document.querySelector('.nav-tab[data-tab="income-expenses"]').click();},original);await page.setViewportSize({width:390,height:844});});
 await check('Expandable household balance uses live records and does not modify them',async()=>{const before=await page.evaluate(()=>JSON.stringify(state));await page.locator('#cashBalanceBreakdown summary').click();assert.match(await page.locator('#cashBalanceBreakdown').textContent(),/₹8,500/);await page.locator('#cashBalanceBreakdown').getByRole('button',{name:'Review balances'}).click();await page.locator('#financeWorkbenchDialog').getByRole('button',{name:'Close',exact:true}).click();assert.equal(await page.evaluate(()=>JSON.stringify(state)),before);});
 await check('Balance correction opens the existing bank-balance form without saving a record',async()=>{const before=await page.evaluate(()=>JSON.stringify(state));await page.locator('#cashBalanceBreakdown').getByRole('button',{name:'Review balances'}).click();await page.locator('#financeWorkbenchDialog').getByRole('button',{name:/Set bank balance/}).click();assert(await page.locator('#balanceStartAmount').isVisible());assert.equal(await page.locator('#balanceMonth').inputValue(),await page.evaluate(()=>addMonthsClamped(currentMonthKey()+'-01',1,1).slice(0,7)));assert.equal(await page.evaluate(()=>JSON.stringify(state)),before);await page.locator('#toggleBalanceForm').click();});
 await check('Automatic contribution confirmation remains non-posting in compact cards',async()=>{
  await page.locator('#cashAutomaticReview').getByRole('button').click();
  const before=await page.evaluate(()=>JSON.stringify(state));
  const d=page.locator('#financeWorkbenchDialog');
  assert.equal(await d.getByRole('button',{name:'Mark as reviewed',exact:true}).count(),0);
  await d.locator('.automatic-entry-card').first().locator('summary').click();
  await d.getByRole('button',{name:'Mark paid from statement',exact:true}).first().click();
  await page.waitForFunction(()=>document.getElementById('cashAutomaticReview').hidden);
  assert.equal(await page.evaluate(()=>JSON.stringify(state)),before);
  await d.getByRole('button',{name:'Close',exact:true}).click();
  await page.evaluate(()=>{localDateKey=()=>currentMonthKey()+'-30';financeInsights.refresh();});
  assert.equal(await page.locator('#cashAutomaticReview').isVisible(),false);
 });
 await check('Bottom sync appears with search and hides after scrolling up',async()=>{await page.evaluate(()=>{window.scrollTo(0,0);});assert.equal(await page.locator('#financeBottomSync').isVisible(),false);await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));await page.waitForFunction(()=>document.getElementById('financeBottomSync').classList.contains('at-page-bottom'));await page.locator('#financeBottomSync').waitFor({state:'visible'});assert(await page.locator('#financeBottomSync').isVisible());const a=await page.locator('#financeBottomSync').boundingBox(),b=await page.locator('#openRecordSearch').boundingBox();assert(a.y+a.height<=b.y||b.y+b.height<=a.y||a.x+a.width<=b.x||b.x+b.width<=a.x);await page.evaluate(()=>window.scrollTo(0,0));await page.waitForFunction(()=>!document.getElementById('financeBottomSync').classList.contains('at-page-bottom'));});
 await check('Quiet sync text stays centred beside Search with consistent typography',async()=>{for(const style of ['modern','emerald-flow'])for(const width of [320,390,701,1440]){await page.setViewportSize({width,height:844});await page.evaluate(style=>{PFT_STYLE.apply(style);document.querySelector('.nav-tab[data-tab="income-expenses"]').click();financeInsights.refresh();},style);await page.waitForTimeout(80);await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));await page.locator('#financeBottomSync').waitFor({state:'visible'});const a=await page.locator('#financeBottomSync').boundingBox(),b=await page.locator('#openRecordSearch').boundingBox();assert(Math.abs((a.y+a.height/2)-(b.y+b.height/2))<=2,JSON.stringify({style,width,a,b}));if(width<=700){assert(b.x+b.width<=a.x-7);assert.equal(await page.locator('#openRecordSearch>span').isVisible(),false);const nav=await page.locator('.pft-style-navigation').boundingBox();assert(Math.abs(nav.y-(b.y+b.height))<=1);}else{assert(a.x+a.width<=b.x-7);}assert(a.x>=0&&b.x+b.width<=width);assert(Math.abs(a.x+a.width/2-width/2)<=1);assert(b.height>=44);const syncType=await page.locator('#financeBottomSync').evaluate(e=>({size:getComputedStyle(e).fontSize,weight:getComputedStyle(e).fontWeight,border:getComputedStyle(e).borderTopWidth,bg:getComputedStyle(e).backgroundColor}));assert.deepEqual(syncType,{size:width<=700?'10px':'11px',weight:'400',border:'0px',bg:'rgba(0, 0, 0, 0)'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);const type=await page.locator('#cashBalanceBreakdown>summary').evaluate(e=>({size:getComputedStyle(e).fontSize,weight:getComputedStyle(e).fontWeight}));assert.deepEqual(type,{size:'14px',weight:'500'});}await page.evaluate(()=>document.querySelector('.nav-tab[data-tab="dashboard"]').click());assert.equal(await page.locator('#dashboard button').filter({hasText:/^Backup & record checks$/}).count(),0);assert(await page.locator('.settings-quick-tile').filter({has:page.locator('strong',{hasText:/^Data & backup$/})}).count());await page.evaluate(()=>PFT_STYLE.apply('modern'));await page.setViewportSize({width:390,height:844});});
 await check('Fixed and no-return accounts have contribution actions, not valuation updates',async()=>{
  const original=await page.evaluate(()=>JSON.stringify(state));
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>{
   const member=state.customValues.familyMembers[0],base={member,date:'2025-01-01',invested:10000,current:10800,monthly:0,autoMonthlyContribution:false};
   state.pf=[{id:'review-pf',member,account:'PF test account',date:'2025-01-01',invested:670000,current:790000,rate:8.25,employee:5000,employer:5000,epsMonthly:1000,epsCurrent:0,autoMonthlyContribution:false}];
   state.ppf=[{id:'review-ppf',member,account:'PPF test account',date:'2025-01-01',invested:315000,current:360000,rate:7.1,monthly:5000,autoMonthlyContribution:false}];
   state.nps=[{id:'review-nps',member,account:'NPS market test',date:'2025-01-01',invested:20000,current:22500,monthly:0,autoMonthlyContribution:false}];
   state.customInvestmentProfiles={...state.customInvestmentProfiles,'No Return Test':{growthType:'no-return'}};
   state.investments.push(
    {...base,id:'review-bond',type:'Bonds',name:'Fixed bond',rate:7.5},
    {...base,id:'review-deposit',type:'Fixed Deposits',name:'Bank FD',rate:6.5},
    {...base,id:'review-no-return',type:'No Return Test',name:'No return holding'},
    {...base,id:'review-fund',type:'Mutual Funds',name:'Market fund'}
   );
   PFT_STYLE.apply('emerald-flow');document.querySelector('.nav-tab[data-tab="investments"]').click();
   renderInvestments();renderPf();renderPpf();renderNps();financeInsights.refresh();
  });
  const selectorForType=type=>'.investment-category-card[data-investment-type="'+type+'"]';
  await page.waitForFunction(()=>document.querySelector('.retirement-account-card[data-retirement-type="nps"] [title="Update value"]'));
  for(const kind of ['pf','ppf']){
   const card=page.locator('.retirement-account-card[data-retirement-type="'+kind+'"]');
   assert.equal(await card.locator('[title="Update value"]').count(),0,kind+' must not have Update value');
   const name=kind==='pf'?'openManualPfContribution':'openManualPpfContribution';
   assert.equal(await page.locator('#'+kind+'Body button[onclick^="'+name+'"]').count(),1,kind+' must retain Add Contribution inside');
  }
  for(const type of ['Bonds','Fixed Deposits','No Return Test']){
   const card=page.locator(selectorForType(type));
   assert.equal(await card.locator('[title="Update value"]').count(),0,type+' must not show Update value');
   assert(await card.locator('button[onclick^="openManualInvestmentContribution"]').count()>0,type+' must retain contribution action');
  }
  for(const card of [page.locator('.retirement-account-card[data-retirement-type="nps"]'),page.locator(selectorForType('Mutual Funds'))]){
   assert.equal(await card.locator('[title="Update value"]').count(),1,'market-valued investment still needs Update value');
  }
  // The value-confirmation dialog also offers Add contribution, never Update balance.
  await page.evaluate(()=>financeWorkbench.valuations('investments','review-bond'));
  let dialog=page.locator('#financeWorkbenchDialog');
  assert(await dialog.getByRole('button',{name:'Add contribution'}).isVisible());
  assert.equal(await dialog.getByRole('button',{name:'Update balance'}).count(),0);
  await dialog.getByRole('button',{name:'Add contribution'}).click();
  assert(await page.locator('#investmentContributionModal').isVisible());
  await page.locator('#investmentContributionAmount').fill('1250');
  // Isolate the local contribution math from the mock cloud listener: cloud
  // persistence and replay are covered by the dedicated save/recovery suites.
  const credit=await page.evaluate(()=>{
   const actualSave=saveData;
   try{
    saveData=()=>Promise.resolve(true);
    document.getElementById('saveInvestmentContribution').click();
    const row=state.investments.find(r=>r.id==='review-bond');
    return row?{invested:row.invested,current:row.current,contributions:state.investmentContributions.filter(r=>r.investmentId===row.id&&r.automatic!==true).map(r=>r.amount)}:null;
   }finally{saveData=actualSave;}
  });
  assert.deepEqual(credit,{invested:11250,current:12050,contributions:[1250]});
  await page.evaluate(original=>{Object.assign(state,JSON.parse(original));renderInvestments();renderPf();renderPpf();renderNps();PFT_STYLE.apply('modern');document.querySelector('.nav-tab[data-tab="income-expenses"]').click();},original);
 });
 await check('Mobile portfolio tiles stay equally compact with monthly contributions and valuation actions',async()=>{
  const contributionModal=page.locator('#investmentContributionModal');
  if(await contributionModal.isVisible()){
   await contributionModal.getByRole('button',{name:/close/i}).click();
   await contributionModal.waitFor({state:'hidden'});
  }
  const original=await page.evaluate(()=>JSON.stringify(state));
  try{
   await page.evaluate(()=>{
    const member=state.customValues.familyMembers[0],base={member,date:'2025-01-01',autoMonthlyContribution:false,monthly:0};
    state.investments=[
     {...base,id:'height-mf',type:'Mutual Funds',name:'Monthly fund',invested:514500,current:497000,monthly:7500,autoMonthlyContribution:true},
     {...base,id:'height-bond',type:'Bonds',name:'Bond',invested:320000,current:359000,rate:7.4},
     {...base,id:'height-fd',type:'Fixed Deposits',name:'Deposit',invested:400000,current:443000,rate:7.25}
    ];
    document.querySelector('.nav-tab[data-tab="investments"]').click();
    renderInvestments();financeInsights.refresh();
   });
   for(const style of ['modern','emerald-flow'])for(const width of [320,390,430,700]){
    await page.setViewportSize({width,height:900});
    await page.evaluate(style=>{PFT_STYLE.apply(style);document.getElementById('investmentMobileTabInvestments').click();financeInsights.refresh();},style);
    await page.waitForFunction(()=>document.querySelector('[data-investment-type="Mutual Funds"] [title="Update value"]'));
    const geometry=await page.locator('#investmentCategoryPanels>.investment-category-card').evaluateAll(cards=>cards.map(card=>{
     const r=card.getBoundingClientRect(),summary=card.querySelector('.investment-category-summary-grid');
     return {type:card.dataset.investmentType,height:r.height-(card.querySelector('.finance-valuation-footer')?card.querySelector('.finance-valuation-footer').getBoundingClientRect().height+parseFloat(getComputedStyle(card.querySelector('.finance-valuation-footer')).marginTop):0),header:card.querySelector('.panel-header').getBoundingClientRect().height,summary:summary.getBoundingClientRect().height,headerWidth:card.querySelector('.panel-header').getBoundingClientRect().width,headerText:card.querySelector('.investment-category-summary').getBoundingClientRect().toJSON(),value:card.querySelector('.investment-summary-value').getBoundingClientRect().toJSON(),rate:card.querySelector('.investment-summary-metric').getBoundingClientRect().toJSON(),overflow:card.scrollWidth>card.clientWidth+1,rows:[...summary.children].filter(e=>!e.classList.contains('investment-summary-chevron')&&e.getClientRects().length).map(e=>Math.round(e.getBoundingClientRect().top))};
    }));
    assert.equal(geometry.length,3);
    assert(Math.max(...geometry.map(r=>r.height))-Math.min(...geometry.map(r=>r.height))<=2,JSON.stringify({style,width,geometry}));
    for(const card of geometry){assert(!card.overflow,JSON.stringify({style,width,card}));assert.equal(new Set(card.rows).size,2,JSON.stringify({style,width,card}));}
    const mf=page.locator('[data-investment-type="Mutual Funds"]');
    assert(await mf.locator('.investment-monthly-inline').isVisible());
    assert.match(await mf.locator('.investment-monthly-inline').textContent(),/7,500/);
    assert.equal(await mf.locator('.investment-summary-monthly').isVisible(),false);
    assert.equal(await mf.locator('.panel-header [title="Update value"]').count(),0);assert.equal(await mf.locator('.finance-valuation-footer').count(),0);assert.equal(await mf.locator('.investment-row-action-group [title="Update value"]').count(),1);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   }
   await page.locator('[data-investment-type="Mutual Funds"] .investment-category-summary-grid').click();
   assert(await page.locator('#investmentCategoryDialogSummary .investment-summary-monthly').isVisible());
   assert.match(await page.locator('#investmentCategoryDialogSummary .investment-summary-monthly').textContent(),/7,500/);
   await page.locator('[data-close-investment-category-dialog]').first().click();
   await page.setViewportSize({width:1440,height:900});
   assert(await page.locator('[data-investment-type="Mutual Funds"] .investment-summary-monthly').isVisible());
   assert.equal(await page.locator('[data-investment-type="Mutual Funds"] .investment-monthly-inline').isVisible(),false);
  }finally{
   await page.evaluate(original=>{Object.assign(state,JSON.parse(original));renderInvestments();PFT_STYLE.apply('modern');financeInsights.refresh();},original);
   await page.setViewportSize({width:390,height:844});
  }
 });
 await check('Stallion PMS only shows its two contribution and gain-loss actions',async()=>{
  const historyModal=page.locator('#investmentContributionModal');
  if(await historyModal.isVisible()){
   await historyModal.getByRole('button',{name:/close/i}).click();
   await historyModal.waitFor({state:'hidden'});
  }
  await page.evaluate(()=>{localDateKey=()=> '2026-10-31';document.querySelector('.nav-tab[data-tab="investments"]').click();renderInvestments();financeInsights.refresh();});
  await page.locator('#investmentMobileTabInvestments').click();
  const pms=page.locator('#stallionPmsPanel');
  await page.waitForFunction(()=>!document.querySelector('#stallionPmsPanel [title="Update value"]'));
  assert.equal(await pms.locator('[title="Update value"]').count(),0);
  assert.equal(await pms.locator('.finance-stale-dot').count(),0);
  assert(await pms.locator('.pms-summary-tile').first().isVisible());
  assert.equal(await pms.locator('#openStallionContributionBtn').isVisible(),false);
  await pms.locator('.pms-summary-tile').first().click();
  assert.equal(await page.locator('#investmentCategoryDialogTable [data-pms-compact-action]').count(),2);
  assert(await page.locator('#investmentCategoryDialogTable [aria-label="Add contribution"]').isVisible());
  assert(await page.locator('#investmentCategoryDialogTable [aria-label="Update PMS gain/loss"]').isVisible());
  await page.locator('#investmentCategoryDialog [data-close-investment-category-dialog]').first().click();
  await page.evaluate(()=>{localDateKey=window.__originalDate;});
 });
 await check('Monthly changes is visible across Appearance styles without horizontal overflow',async()=>{for(const style of ['modern','emerald-flow'])for(const width of [320,390,701,1440]){await page.setViewportSize({width,height:844});await page.evaluate(style=>{PFT_STYLE.apply(style);document.querySelector('.nav-tab[data-tab="dashboard"]').click();financeInsights.refresh();},style);await page.locator('#monthlyChanges > summary').waitFor({state:'visible'});await page.waitForFunction(desktop=>document.getElementById('monthlyChanges').parentElement.classList.contains('desktop-changes-row')===desktop,width>700);if(width>700){assert(await page.locator('#monthlyChanges').evaluate(e=>e.open));if(width>=1100){const layout=await page.locator('#monthlyChanges').evaluate(e=>{const a=e.getBoundingClientRect(),b=e.parentElement.querySelector('.flow-chart,.advanced-dashboard-chart-panel').getBoundingClientRect();return{a:a.toJSON(),b:b.toJSON()};});assert(layout.a.x>=layout.b.x+layout.b.width);assert(Math.abs(layout.a.y-layout.b.y)<2);}}await page.locator('#monthlyChanges').evaluate(e=>e.open=true);assert.match(await page.locator('#monthlyChanges').textContent(),/Dated snapshots needed/);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.evaluate(()=>document.querySelector('.nav-tab[data-tab="income-expenses"]').click());await page.locator('#cashCommitments summary').waitFor({state:'visible'});await page.locator('#cashCommitments').evaluate(e=>e.open=true);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}});
 await check('Investment add menu survives layout scrolls across styles and opens the selected form',async()=>{for(const style of ['modern','emerald-flow'])for(const width of [390,1440]){await page.setViewportSize({width,height:844});await page.evaluate(style=>{PFT_STYLE.apply(style);document.querySelector('.nav-tab[data-tab="investments"]').click();},style);if(style==='emerald-flow')await page.locator('.flow-investments [role=tab]').filter({hasText:/^(Portfolio|Investments)$/}).click();else if(width<=700)await page.locator('#investmentMobileTabInvestments').click();await page.locator('#openGeneralInvestmentBtn').click();await page.evaluate(()=>new Promise(resolve=>{document.dispatchEvent(new Event('scroll'));document.getElementById('investmentAddMenu').dispatchEvent(new Event('scroll',{bubbles:true}));requestAnimationFrame(resolve);}));assert(await page.locator('#investmentAddMenu').isVisible());await page.locator('#investmentAddMenu button:not(:disabled)').first().click();assert(await page.locator('#entryFormModal').isVisible());await page.evaluate(()=>closeEntryFormModal());}});
 await check('Projection uses dark transparent plot, interactive scenarios and a scrollable FY table',async()=>{await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{PFT_STYLE.apply('modern');document.querySelector('.nav-tab[data-tab="growth-projection"]').click();});await page.waitForFunction(()=>typeof growthProjectionChartInstance!=='undefined'&&growthProjectionChartInstance);const config=await page.evaluate(()=>({yTitle:growthProjectionChartInstance.options.scales.y.title.display,whitePlugin:(growthProjectionChartInstance.config.plugins||[]).some(p=>p.id==='growthProjectionLightPlot'),dash:growthProjectionChartInstance.data.datasets[0].borderDash}));assert.equal(config.yTitle,false);assert.equal(config.whitePlugin,false);assert.deepEqual(config.dash,[6,5]);const before=await page.evaluate(()=>JSON.stringify(state));for(const scenario of ['stress','base','optimistic']){await page.locator('[data-projection-scenario="'+scenario+'"]').click();assert.equal(await page.locator('[data-projection-scenario="'+scenario+'"]').getAttribute('aria-pressed'),'true');const expected=await page.evaluate(s=>formatProjectionLakh(growthProjectionChartInstance.data.datasets[['stress','base','optimistic'].indexOf(s)].data.at(-1)),scenario);assert.equal(await page.locator('#growthProjectionTakeaway .is-projected .growth-takeaway-value').textContent(),expected);assert.match(await page.locator('#growthProjectionTakeaway').getAttribute('aria-label'),new RegExp(scenario,'i'));}assert.equal(await page.evaluate(()=>JSON.stringify(state)),before);
assert.equal(await page.locator('#growthProjectionSummary').evaluate(e=>e.previousElementSibling.id==='growthProjectionChartWrap'),true);
assert.match(await page.locator('#growthScenarioDetails').textContent(),/Projected value.*Monthly contributions.*Projected growth/);
await page.locator('[data-projection-scenario="stress"]').focus();
assert.match(await page.locator('#growthScenarioDetails').textContent(),/Stress/);
assert.equal(await page.evaluate(()=>growthProjectionChartInstance.data.datasets[0].borderWidth),4);
assert.equal(await page.locator('[data-projection-scenario="optimistic"]').getAttribute('aria-pressed'),'true');
const buttons=await page.locator('#growthProjectionSummary [data-projection-scenario]').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().y));assert(Math.max(...buttons)-Math.min(...buttons)<2);assert.equal(await page.locator('#growthProjectionResultsTable').evaluate(e=>{const p=e.parentElement;return p.scrollWidth>p.clientWidth&&getComputedStyle(e.querySelector('td')).position==='sticky';}),true);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);});
 await check('Analytics zero values show an honest empty state and allocation placeholder ring',async()=>{const original=await page.evaluate(()=>JSON.stringify(state));await page.evaluate(()=>{state.investments=[];state.stallionPms=[];state.pf=[];state.ppf=[];state.nps=[];document.querySelector('.nav-tab[data-tab="analytics"]').click();renderCharts();});await page.waitForFunction(()=>document.getElementById('investmentReturnsEmpty')&&!document.getElementById('investmentReturnsEmpty').hidden);assert.equal(await page.locator('#investmentReturnsChartScroll').isVisible(),false);assert.equal(await page.evaluate(()=>chartInstances.assetAllocationChart.data.datasets[0].data.every(n=>n===0)),true);assert.equal(await page.evaluate(()=>chartInstances.assetAllocationChart.config.plugins.some(p=>p.id==='emptyAllocationRing')),true);await page.evaluate(original=>{Object.assign(state,JSON.parse(original));renderCharts();},original);await page.waitForFunction(()=>!document.getElementById('investmentReturnsChartScroll').hidden);});
 await check('Settings removes the duplicate Last sync label and keeps it in the bottom status',async()=>{await page.evaluate(()=>document.querySelector('.nav-tab[data-tab="settings"]').click());assert.equal(await page.locator('#cloudLastUpdated').count(),0);assert.match(await page.locator('#financeBottomSync').textContent(),/^Synced /);assert.equal(await page.locator('#cloudSignOut').evaluate(e=>e.closest('#settingsAccountPanel')!==null),true);assert.equal(await page.locator('.cloud-account-panel #cloudSignOut').count(),0);assert.match(await page.locator('#cloudRefresh').textContent(),/Sync now/);for(const width of [320,390,700,1024]){await page.setViewportSize({width,height:844});const geometry=await page.locator('#cloudRefresh').evaluate(e=>{const b=e.getBoundingClientRect(),i=e.querySelector('svg').getBoundingClientRect(),t=e.querySelector('span').getBoundingClientRect();return {display:getComputedStyle(e).display,b:b.toJSON(),i:i.toJSON(),t:t.toJSON()};});assert(['flex','inline-flex'].includes(geometry.display));assert(geometry.b.width>=43.99&&geometry.b.height>=43.99&&geometry.i.left>=geometry.b.left&&geometry.t.right<=geometry.b.right&&geometry.i.top>=geometry.b.top&&geometry.t.bottom<=geometry.b.bottom&&Math.abs((geometry.i.top+geometry.i.height/2)-(geometry.t.top+geometry.t.height/2))<2,JSON.stringify({width,geometry}));}await page.setViewportSize({width:390,height:844});assert(await page.locator('#settingsProfileName').textContent());const icons=await page.evaluate(()=>[document.querySelector('[data-style-page="settings"] svg').innerHTML,document.querySelector('#themeToggle svg').innerHTML]);assert.notEqual(icons[0],icons[1]);await page.locator('.settings-quick-tile').filter({has:page.locator('strong',{hasText:/^Account$/})}).click();assert(await page.locator('#cloudSignOut').isVisible());await page.locator('#settingsTileClose').click();});

 await check('Guided tour is replayable, accessible and does not change financial records',async()=>{
  await page.evaluate(()=>{PFT_STYLE.apply('modern');document.querySelector('.nav-tab[data-tab="settings"]').click();});
  const before=await page.evaluate(()=>JSON.stringify(state));
  assert.equal(await page.evaluate(()=>PFTTour.shouldOffer(false)),false);
  await page.locator('.settings-quick-tile').filter({has:page.locator('strong',{hasText:/^App info$/})}).click();
  await page.locator('#replayAppTour').click();
  const tour=page.locator('#appGuideTour');
  await tour.waitFor({state:'visible'});
  assert.equal(await tour.locator('[data-tour-back]').isDisabled(),true);
  await tour.locator('[data-tour-next]').click();
  assert.match(await page.locator('#appGuideTourTitle').textContent(),/Record money/);
  await tour.locator('[data-tour-back]').click();
  assert.match(await page.locator('#appGuideTourTitle').textContent(),/finances at a glance/);
  for(const width of [320,390,700,1440]){
    await page.setViewportSize({width,height:844});
    const fits=await tour.evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1&&e.scrollWidth<=e.clientWidth+1;});
    assert.equal(fits,true,'Tour fits '+width);
  }
  for(let i=0;i<8;i++)await tour.locator('[data-tour-next]').click();
  assert.match(await page.locator('#appGuideTourTitle').textContent(),/backup/);
  assert.equal(await tour.locator('[data-tour-next]').textContent(),'Finish');
  await tour.locator('[data-tour-next]').click();assert.equal(await tour.isVisible(),false);
  assert.equal(await page.evaluate(()=>PFTTour.shouldOffer(true)),false);
  assert.equal(await page.evaluate(()=>document.querySelector('.nav-tab.active').dataset.tab),'settings');
  assert.equal(await page.evaluate(()=>JSON.stringify(state)),before);
  await page.evaluate(()=>PFTTour.start());await tour.waitFor({state:'visible'});
  await page.keyboard.press('Escape');assert.equal(await tour.isVisible(),false);
  await page.evaluate(()=>PFTTour.maybeStart(true));assert.equal(await tour.isVisible(),false);
  await page.setViewportSize({width:390,height:844});
 });


 await check('Projection groups disclose one list and contribution management stays compact',async()=>{
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>{PFT_STYLE.apply('modern');document.querySelector('.nav-tab[data-tab="growth-projection"]').click();});
  await page.evaluate(async()=>{window.__compactFixtureState=JSON.stringify(state);window.__compactFixtureSave=saveData;saveData=async()=>true;activeFamilyProfile='__combined__';const member=state.customValues.familyMembers[0]||'Tester';state.investments=[{id:'assumption-market',member,type:'Mutual Funds',name:'Tour fund',date:'2025-01-01',invested:100000,current:110000,monthly:1000,autoMonthlyContribution:true},{id:'assumption-fixed',member,type:'Bonds',name:'Test bond',date:'2025-01-01',invested:10000,current:11000,interestRate:7},{id:'assumption-cash',member,type:'Cash Reserve',name:'Test cash',date:'2025-01-01',invested:1000,current:1000}];state.projectionSettings.includeMonthlyContributions=true;await saveData('Projection control test fixture');renderGrowthProjection();});
  const before=await page.evaluate(()=>JSON.stringify(state));
  const choices=page.locator('.growth-assumption-choices [data-assumption-group]');
  assert.equal(await choices.count(),3);
  for(let i=0;i<3;i++){
    const choice=choices.nth(i);if(await choice.isDisabled())continue;
    await choice.click();const group=await choice.getAttribute('data-assumption-group');
    assert.equal(await page.locator('[data-assumption-group-panel]:visible').count(),1);
    assert.equal(await page.locator('[data-assumption-group-panel]:visible').getAttribute('data-assumption-group-panel'),group);
    await page.evaluate(()=>renderGrowthProjection({preserveAssumptions:true}));
    assert.equal(await choice.getAttribute('aria-expanded'),'true');
    await choice.click();assert.equal(await page.locator('[data-assumption-group-panel]:visible').count(),0);
  }
  assert.equal(await page.evaluate(()=>JSON.stringify(state)),before);
  assert.equal(await page.locator('#growthProjectionControls .form-group>label').filter({hasText:/^Monthly contributions$/}).count(),0);
  assert.equal(await page.locator('#growthContributionExclusionsWrap').isVisible(),false);
  const manage=page.locator('#manageGrowthContributions');
  assert.equal(await manage.isEnabled(),true,'Saved monthly fixture is available in combined profile');
  if(await manage.isEnabled()){
    await manage.click();assert.equal(await page.locator('#growthContributionDialog').isVisible(),true);
    const toggle=page.locator('#growthContributionDialog .growth-monthly-exclude-toggle').first();
    const checked=await toggle.isChecked();await toggle.click();assert.equal(await toggle.isChecked(),!checked);
    assert.equal(await page.locator('#growthContributionDialog').isVisible(),true);
    await toggle.click();
    await page.locator('#growthContributionDialog [data-close-contribution-dialog]').first().click();
    await page.keyboard.press('Tab');
  }
  const master=page.locator('#growthIncludeMonthlyContributions'),masterBefore=await master.isChecked();
  if(masterBefore){
    const exclusions=await page.evaluate(()=>JSON.stringify(state.projectionSettings.excludedMonthlyContributions));
    await master.uncheck();assert.match(await page.locator('#growthContributionSummary').textContent(),/excluded/);assert.equal(await manage.isDisabled(),true);
    assert.equal(await page.evaluate(()=>JSON.stringify(state.projectionSettings.excludedMonthlyContributions)),exclusions);
    await master.check();assert.equal(await manage.isEnabled(),true);
  }
  for(const width of [320,390,700,1440]){
    await page.setViewportSize({width,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }
  await page.evaluate(()=>{state=JSON.parse(window.__compactFixtureState);saveData=window.__compactFixtureSave;delete window.__compactFixtureState;delete window.__compactFixtureSave;renderGrowthProjection();});
  await page.setViewportSize({width:390,height:844});
 });

 await check('New-user checklist, quiet Dashboard, empty actions and zero opening balance work on desktop and mobile',async()=>{
  const fresh=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});fresh.on('pageerror',e=>errors.push(e.message));
  await fresh.goto(url+'/?user=setup-new&email=setup-new@example.test&name=Setup');await fresh.locator('#cloudLogin').click();await fresh.waitForFunction(()=>window.financeCloud&&document.getElementById('cloudGate').hidden);
  if(await fresh.locator('#firstNameSetup').isVisible())await fresh.locator('#firstNameContinue').click();await fresh.evaluate(()=>window.trackerReady);if(await fresh.locator('#appGuideTour').isVisible())await fresh.locator('#appGuideTour [data-tour-skip]').click();await fresh.waitForFunction(()=>Boolean(window.PFTGettingStarted));
  for(const width of [320,390,700,1024,1440]){await fresh.setViewportSize({width,height:900});await fresh.evaluate(()=>{document.querySelector('.nav-tab[data-tab="dashboard"]').click();renderGettingStarted();});assert(await fresh.locator('#gettingStartedChecklist').isVisible());assert(await fresh.locator('#dashboardFirstRecord').isVisible());assert.equal(await fresh.locator('#dashboardMonthlyOverview').isVisible(),false);assert.equal(await fresh.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
  for(const width of [390,1440]){
   await fresh.setViewportSize({width,height:900});await fresh.locator('#dashboardFirstRecord [data-setup-action="income"]').click();
   assert(await fresh.locator('#income-expenses').isVisible());
   await fresh.locator('#incomeAmount').waitFor({state:'visible'});
   if(width<=700){assert(await fresh.locator('#cashEntryDialog').isVisible());await fresh.locator('#cashEntryDialog .cash-entry-close').click();}
   else{assert.equal(await fresh.locator('#cashEntryDialog').isVisible(),false);assert.equal(await fresh.evaluate(()=>document.activeElement.id),'incomeAmount');}
   await fresh.evaluate(()=>document.querySelector('.nav-tab[data-tab="dashboard"]').click());
  }
  await fresh.locator('#gettingStartedChecklist [data-setup-action="no-loans"]').click();assert.equal(await fresh.locator('#gettingStartedChecklist [data-setup-action="no-loans"]').count(),0);
  await fresh.locator('#gettingStartedChecklist [data-setup-action="skip"]').click();assert.equal(await fresh.locator('#gettingStartedChecklist').isVisible(),false);await fresh.evaluate(()=>document.querySelector('.nav-tab[data-tab="settings"]').click());await fresh.locator('#resumeGettingStarted').click();assert(await fresh.locator('#gettingStartedChecklist').isVisible());
  await fresh.evaluate(()=>{state.monthlyBalances=[{id:'setup-zero',month:currentMonthKey(),startBalance:0}];updateDashboard();});assert.equal(await fresh.locator('#dashboardFirstRecord').isVisible(),false);assert(await fresh.locator('#dashboardMonthlyOverview').isVisible());
  await fresh.evaluate(()=>{window.financeCloud.canEdit=false;renderGettingStarted();PFTGettingStarted.enhance();});assert.equal(await fresh.locator('#gettingStartedChecklist').isVisible(),false);await fresh.evaluate(()=>document.querySelector('.nav-tab[data-tab="income-expenses"]').click());await fresh.waitForTimeout(100);assert.equal(await fresh.locator('#incomeBody [data-setup-action]:visible').count(),0);await fresh.close();
 });
 assert.deepEqual(errors,[]);await browser.close();server.close();console.log(JSON.stringify({passed:results.length,failed:0}));
})().catch(e=>{console.error(e);server.close();process.exit(1)});

