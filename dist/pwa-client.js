(() => {
  const status = document.getElementById('pwaStatus');
  const check = document.getElementById('pwaCheckUpdate');
  const apply = document.getElementById('pwaApplyUpdate');
  if(apply)apply.disabled=true;
  const notice = document.getElementById('dashboardUpdateNotice');
  const dashboardApply = document.getElementById('dashboardApplyUpdate');
  const dashboardStatus = document.getElementById('dashboardUpdateStatus');
  const install = document.getElementById('pwaInstall');
  const installHelp = document.getElementById('pwaInstallHelp');
  const displayMode = window.matchMedia('(display-mode: standalone)');
  let installPrompt = null, installBusy = false;
  let installed = displayMode.matches || navigator.standalone === true;
  function installInstructions() {
    if (!window.isSecureContext) return 'Open the hosted HTTPS tracker to install the app.';
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (ios) return 'On iPhone or iPad, open in Safari, tap Share, then Add to Home Screen.';
    return 'Chrome / Edge: open the browser menu and choose Install app or Install Personal Finance Tracker. On Mac Safari, choose File → Add to Dock. If installation is unavailable, keep using the tracker in your browser.';
  }
  function updateInstall(message) {
    installed = installed || displayMode.matches || navigator.standalone === true;
    if (install) { install.textContent = installed ? 'App installed' : 'Install app'; install.disabled = installed || installBusy; }
    if (installHelp) installHelp.textContent = installed ? 'Personal Finance Tracker is installed on this device.' : message || (installPrompt ? 'Install Personal Finance Tracker on this device.' : installInstructions());
  }
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault(); installPrompt = event; updateInstall();
  });
  window.addEventListener('appinstalled', () => { installed = true; installPrompt = null; updateInstall(); });
  displayMode.addEventListener?.('change', () => updateInstall());
  install?.addEventListener('click', async () => {
    if (installed || installBusy) return;
    if (!installPrompt) { updateInstall(installInstructions()); return; }
    const prompt = installPrompt; installPrompt = null; installBusy = true; updateInstall('Opening installation…');
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      updateInstall(choice?.outcome === 'accepted' ? 'Installation requested. Follow the browser instructions to finish.' : 'Installation cancelled. You can install later from your browser menu.');
    } catch (_) { updateInstall('Installation could not open. '+installInstructions()); }
    finally { installBusy = false; if (install) install.disabled = installed; }
  });
  updateInstall();
  let registration, offlineReady = false, applying = false;
  let lastAutomaticCheck = 0, checkingAutomatically = false;
  async function checkOnReturn() {
    if (!registration || document.hidden || navigator.onLine === false || checkingAutomatically || Date.now()-lastAutomaticCheck < 5*60*1000) return;
    checkingAutomatically = true; lastAutomaticCheck = Date.now();
    try { await registration.update(); updateStatus(); }
    catch (_) { /* Keep working offline; the next return can retry. */ }
    finally { checkingAutomatically = false; }
  }
  document.addEventListener('visibilitychange', checkOnReturn);
  window.addEventListener('focus', checkOnReturn);
  window.addEventListener('online', checkOnReturn);
  const show = message => { if (status) status.textContent = message; if(dashboardStatus)dashboardStatus.textContent=message; };
  function updateStatus() {
    const updateReady = Boolean(registration?.waiting);
    if (apply) {apply.hidden = !updateReady;apply.disabled = !updateReady || applying;}
    if (notice) notice.hidden = !updateReady;
    show(updateReady ? 'An app update is ready. Saved device records are kept when applying the update.' : offlineReady
      ? (navigator.onLine === false ? 'Offline · changes save on this device and sync when connected.' : 'App ready · local saving with automatic cloud sync.')
      : 'Preparing the installed app…');
  }
  if (!('serviceWorker' in navigator) || !window.isSecureContext) {
    show('Open the hosted HTTPS app to enable installation and offline use.');
    if (check) check.disabled = true;
    return;
  }
  window.addEventListener('online', updateStatus);
  window.addEventListener('offline', updateStatus);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (applying) { applying = false; location.reload(); }
  });
  check?.addEventListener('click', async () => {
    if (!registration) return;
    check.disabled = true;
    show('Checking for an app update…');
    try { await registration.update(); updateStatus(); }
    catch (_) { show('Unable to check for updates. Reconnect and try again.'); }
    finally { check.disabled = false; }
  });
  async function applyUpdate() {
    if (!registration?.waiting || applying) return;
    try { if (typeof saveQueue !== 'undefined') await saveQueue; }
    catch (_) { show('Finish saving or export a backup before updating the app.'); return; }
    if (applying) return;
    if ((typeof persistenceDirty !== 'undefined' && persistenceDirty) ||
        (typeof pendingSaves !== 'undefined' && pendingSaves > 0) ||
        (typeof storageLoadFailed !== 'undefined' && storageLoadFailed) ||
        (typeof dataOperationBusy !== 'undefined' && dataOperationBusy)) {
      show('Finish saving or export a backup before updating the app.'); return;
    }
    if (!confirm('Reload to apply the app update? Saved records will stay. Any unfinished form entries will be cleared.')) return;
    if (!registration.waiting) { updateStatus(); return; }
    applying = true;
    if(apply)apply.disabled = true;
    if(dashboardApply)dashboardApply.disabled = true;
    registration.waiting.postMessage({type:'SKIP_WAITING'});
  }
  apply?.addEventListener('click',applyUpdate);
  dashboardApply?.addEventListener('click',applyUpdate);
  async function register() {
    try {
      registration = await navigator.serviceWorker.register('./service-worker.js', {updateViaCache:'none'});
      lastAutomaticCheck = Date.now();
      updateStatus();
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed') updateStatus();
          if (worker.state === 'redundant' && !offlineReady) show('Offline setup failed. Reconnect and reload to try again.');
        });
      });
      await navigator.serviceWorker.ready;
      offlineReady = true;
      updateStatus();
    } catch (_) {
      show('Offline setup could not finish. Reconnect and reload to try again.');
      if (check) check.disabled = true;
    }
  }
  if(window.PFTPerformance){let started=false;const start=()=>{if(started)return;started=true;setTimeout(register,0);};window.addEventListener('pft:visible',start,{once:true});window.addEventListener('pft:signed-out',start,{once:true});if(!document.body.classList.contains('cloud-loading'))start();setTimeout(start,10000);}else register();
})();
