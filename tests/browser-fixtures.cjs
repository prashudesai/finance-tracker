const fs=require('node:fs'),path=require('node:path');
// Browser regressions use a mock Firebase account. Complete the new vault gate
// with a test-only passphrase; production has no automatic unlock path.
const chromium=require('playwright').chromium,launch=chromium.launch.bind(chromium);
chromium.launch=async(...args)=>{
 const browser=await launch(...args),newContext=browser.newContext.bind(browser);
 browser.newContext=async(...options)=>{
  const context=await newContext(...options);
  await context.addInitScript(()=>{
   const answer=()=>{const form=document.querySelector('#cloudGate .cloud-vault-form');if(!form||form.dataset.testAnswered)return;
    const title=form.querySelector('h2')?.textContent||'';if(!/Create your private vault|Unlock your private vault|Save your recovery key/.test(title))return;
    form.dataset.testAnswered='true';for(const field of form.querySelectorAll('input[type=password]'))field.value='Browser Test Vault Passphrase 2026!';
    const check=form.querySelector('input[type=checkbox]');if(check)check.checked=true;form.requestSubmit();};
   new MutationObserver(answer).observe(document,{childList:true,subtree:true});answer();
  });return context;
 };return browser;
};
const manifests=new Map();
exports.logicalURL=(root,url)=>{
 const pathname=url.split('?')[0];if(!pathname.startsWith('/assets/'))return pathname;
 if(!manifests.has(root))manifests.set(root,JSON.parse(fs.readFileSync(path.join(root,'asset-manifest.json'),'utf8')));
 return '/'+(Object.entries(manifests.get(root)).find(([,built])=>'/'+built===pathname)?.[0]||pathname.slice(1));
};
// Exercise the visible dropdown when a native-backed popover is installed.
exports.selectControl=async(page,selector,value)=>{
 const native=page.locator(selector),id=await native.getAttribute('id');
 const trigger=page.locator('#'+id+'PopoverTrigger');
 if(await trigger.isVisible()){
  await trigger.click();
  const panel=page.locator('#'+await trigger.getAttribute('aria-controls'));
  await panel.locator('[role=option]').evaluateAll((buttons,value)=>{const b=buttons.find(b=>b.dataset.value===String(value));if(!b)throw Error('Dropdown option missing: '+value);b.dataset.testSelect='true';},value);
  await panel.locator('[data-test-select=true]').click();
 }else await native.selectOption(value,{force:true});
};
// Poll a resolved flag instead of returning a long-lived browser Promise over CDP.
// The app reveals its shell before first-name setup, so wait for either state.
exports.readyTracker=async (page,{completeName=true}={})=>{
 await page.evaluate(()=>{window.__testTrackerReady=false;window.__testTrackerFailure='';Promise.resolve(window.trackerReady).then(()=>window.__testTrackerReady=true,error=>window.__testTrackerFailure=error?.message||String(error));});
 await page.waitForFunction(()=>window.__testTrackerReady||window.__testTrackerFailure||document.getElementById('firstNameSetup')?.hidden===false);
 if(await page.locator('#firstNameSetup').isVisible()&&await page.locator('#firstNameContinue').isEnabled())await page.locator('#firstNameContinue').click();
 await page.waitForFunction(()=>window.__testTrackerReady||window.__testTrackerFailure);
 const error=await page.evaluate(()=>window.__testTrackerFailure);if(error)throw Error(error);
 if(completeName&&await page.locator('#quickSetupFirstName').isVisible()){
  const givenName=await page.evaluate(()=>new URLSearchParams(location.search).get('name')?.trim().split(/\s+/)[0]||'Tester');
  await page.locator('#quickSetupFirstName').fill(givenName);
  await page.locator('#gettingStartedChecklist [data-setup-action="wizard-next"]').click();
  await page.waitForFunction(()=>state.firstNameSetup?.completed===true);
 }
};

