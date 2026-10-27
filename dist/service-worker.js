// Only app files belong in this cache. Finance records stay in IndexedDB.
const CACHE_NAME = 'personal-finance-tracker-shell-cloud-v87-e2e750eeb156cecb';
const SCOPE = new URL('./', self.location.href);
const SHELL = new URL('index.html', SCOPE).href;
const APP_SHELL = ["assets/cash-flow.e4e2b2e71e5125a2.js","assets/cash-flow.c78ee88cbd3d7094.css","assets/review-model.d354997477d97472.js","assets/review-sync.6e9fadd66111fab2.js","assets/record-search.84e74d7c495aaa61.js","assets/attention.af957b319a9d55c5.js","assets/legacy-1.2de7a35f4d3485dd.css","assets/legacy-2.2bf3b4402c360219.css","assets/legacy-3.da8e96c8d3a1dcce.css","assets/legacy-4.453862e3306d6301.css","assets/chart-3.9.1.201631840661244a.js","assets/bootstrap-2.d146d9c1acc0d967.js","assets/app-core.a7c6364154fd1d4e.js","assets/finance-model.d243c1e8dd153ca8.js","assets/finance-workbench.51e2c2a4f6026ada.js","assets/experience.15f8843937163b93.js","assets/workbench.eb5c159b5cdda315.css","assets/record-recovery.e95614776b4a9f39.js","assets/work-protection.31ff6098f35f73ce.js","assets/cloud-notice.89b8760b5121ea7d.js","assets/recurring.21005de2ca263681.js","assets/recurring-ui.7063af9db85dae04.js","assets/account-photo.9959cb3c0a6c10ba.js","index.html","assets/app-style.de258ce5b2969840.css","assets/app-style.1a4712f5bf26cc11.js","assets/app-info.58729a4842f3654f.js","assets/loan-ledger.68deb1413e30aa08.js","assets/jspdf.umd.min.fa438fc5411fafc3.js","assets/firebase-client.bcf8a9c286a8fa9f.js","assets/firebase-store.f04311ddefe6f891.js","assets/family-access.63d8dfd7566fce91.js","assets/firebase-app.cf65fb8452c139ac.js","assets/firebase-auth.5eab6d5ab0a88d4c.js","assets/firebase-firestore.d51801f57daa5a5e.js","assets/pwa-client.413a672c4e71a741.js","assets/tracker-enhancements.3971baac5ae3ded7.js","assets/tracker-enhancements.5bc821fb9276df08.css","manifest.webmanifest","icons/icon-192.9e1b24ddae720af1.png","icons/icon-512.11926f609d950641.png","images/signin-light-desktop.webp","images/signin-light-mobile.webp","assets/boot.28e0806a927b04c7.js","assets/filter-popovers.dafcd7f8dd0183b2.js","assets/finance-insights-model.c94c0d6075283790.js","assets/finance-insights.b81f1595a20c9648.js","assets/print.e13a02846eb11264.css"].map(path => new URL(path, SCOPE).href);
const STATIC_URLS = new Set(APP_SHELL);
const NAVIGATION_TIMEOUT_MS = 3000;
self.addEventListener('install', event => {
  // Wait for explicit approval before replacing a worker used by an open tracker.
  event.waitUntil((async () => {
    const responses = await Promise.all(APP_SHELL.map(async url => {
      const response = await fetch(new Request(url, {cache:'reload', credentials:'same-origin'}));
      if (!response.ok || response.redirected || (url === SHELL && !(response.headers.get('Content-Type') || '').includes('text/html'))) throw new Error('App download failed');
      return response;
    }));
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(APP_SHELL.map((url, index) => cache.put(url, responses[index])));
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith('personal-finance-tracker-shell-') && key !== CACHE_NAME)
    .map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
async function cached(url) {
  try { return await (await caches.open(CACHE_NAME)).match(url); }
  catch (_) { return undefined; }
}
async function store(url, response) {
  try { await (await caches.open(CACHE_NAME)).put(url, response); }
  catch (_) { /* A cache quota error must not discard a usable online response. */ }
}
async function navigation(request) {
  // Keep HTML and modules from the same fully installed release until activation.
  const installed=await cached(SHELL);
  if(installed)return installed;
  const controller = new AbortController();
  let timeout;
  try {
    const response = await Promise.race([
      fetch(request, { signal: controller.signal }),
      new Promise((_, reject) => { timeout = setTimeout(() => { controller.abort(); reject(new Error('Navigation timed out')); }, NAVIGATION_TIMEOUT_MS); })
    ]);
    // Respect online authentication failures and redirects; never cache sign-in pages.
    if (response.status >= 500) {
      const offline = await cached(SHELL);
      if (offline) return offline;
    }
    if (response.ok && !response.redirected && (response.headers.get('Content-Type') || '').includes('text/html')) await store(SHELL, response.clone());
    return response;
  } catch (_) {
    return (await cached(SHELL)) || new Response('The tracker is not available offline yet. Connect to the internet and reopen it.', {status:503, headers:{'Content-Type':'text/plain; charset=utf-8'}});
  } finally { clearTimeout(timeout); }
}
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== SCOPE.origin) return;
  // Authentication routes, APIs, JSON backups and other downloads pass through untouched.
  if (request.mode === 'navigate') {
    if (url.pathname === SCOPE.pathname || url.pathname === new URL(SHELL).pathname) event.respondWith(navigation(request));
    return;
  }
  if (!STATIC_URLS.has(url.href)) return;
  event.respondWith((async () => {
    const hit = await cached(url.href);
    if (hit) return hit;
    const response = await fetch(request);
    if (response.ok && !response.redirected) await store(url.href, response.clone());
    return response;
  })());
});
