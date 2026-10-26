// Only app files belong in this cache. Finance records stay in IndexedDB.
const CACHE_NAME = 'personal-finance-tracker-shell-cloud-v87-40f1208107f6de1b';
const SCOPE = new URL('./', self.location.href);
const SHELL = new URL('index.html', SCOPE).href;
const APP_SHELL = ["assets/cash-flow.e02a62d2dbc94338.js","assets/cash-flow.f6ae78bf7d4dbb12.css","assets/review-model.d354997477d97472.js","assets/review-sync.6e9fadd66111fab2.js","assets/record-search.741fc71c0cfb2c66.js","assets/attention.f50c768c4fc4131e.js","assets/legacy-1.e3b790b2ba002e59.css","assets/legacy-2.9cbb5af1c73898b1.css","assets/legacy-3.da8e96c8d3a1dcce.css","assets/legacy-4.453862e3306d6301.css","assets/chart-3.9.1.201631840661244a.js","assets/bootstrap-2.d146d9c1acc0d967.js","assets/app-core.71e2208e5577b87c.js","assets/finance-model.d243c1e8dd153ca8.js","assets/finance-workbench.6edc6fa66ebfd23a.js","assets/experience.15f8843937163b93.js","assets/workbench.2874805f42ef7d1d.css","assets/record-recovery.6c3b47623f991159.js","assets/work-protection.31ff6098f35f73ce.js","assets/cloud-notice.14f08ebd0b9216bf.js","assets/recurring.21005de2ca263681.js","assets/recurring-ui.7063af9db85dae04.js","assets/account-photo.cfe2691cc9bf3338.js","index.html","assets/app-style.4d2dca3618dfebbc.css","assets/app-style.bb29c08da70751af.js","assets/app-info.9d2c07bec8eeee4e.js","assets/loan-ledger.68deb1413e30aa08.js","assets/jspdf.umd.min.fa438fc5411fafc3.js","assets/firebase-client.ed1625c81fa5dcb6.js","assets/firebase-store.f04311ddefe6f891.js","assets/family-access.63d8dfd7566fce91.js","assets/firebase-app.cf65fb8452c139ac.js","assets/firebase-auth.5eab6d5ab0a88d4c.js","assets/firebase-firestore.d51801f57daa5a5e.js","assets/pwa-client.413a672c4e71a741.js","assets/tracker-enhancements.ba92144a1f121614.js","assets/tracker-enhancements.2898ff9bcb30e400.css","manifest.webmanifest","icons/icon-192.9e1b24ddae720af1.png","icons/icon-512.11926f609d950641.png","images/signin-light-desktop.webp","images/signin-light-mobile.webp","assets/boot.2891d6f1fa89e7ee.js","assets/print.7aa8f0c59a63dd9c.css"].map(path => new URL(path, SCOPE).href);
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
