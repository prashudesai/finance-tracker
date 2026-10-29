// Only app files belong in this cache. Finance records stay in IndexedDB.
const CACHE_NAME = 'personal-finance-tracker-shell-cloud-v86';
const SCOPE = new URL('./', self.location.href);
const SHELL = new URL('index.html', SCOPE).href;
const APP_SHELL = ['cash-flow.js?v=86', 'cash-flow.css?v=86', 'review-model.js?v=83', 'review-sync.js?v=83', 'record-search.js?v=85', 'attention.js?v=81', 'runtime/legacy-1.css?v=80', 'runtime/legacy-2.css?v=80', 'runtime/legacy-3.css?v=80', 'runtime/legacy-4.css?v=80', 'runtime/chart-3.9.1.js?v=80', 'runtime/bootstrap-2.js?v=80', 'runtime/app-core.js?v=80', 'finance-model.js?v=79', 'finance-workbench.js?v=79', 'experience.js?v=79', 'workbench.css?v=85', 'record-recovery.js?v=77', 'work-protection.js?v=76', 'cloud-notice.js?v=75', 'recurring.js?v=66', 'recurring-ui.js?v=66', 'account-photo.js?v=66', 'index.html', 'app-style.css?v=66', 'app-style.js?v=66', 'app-info.js?v=66', 'loan-ledger.js?v=66', 'vendor/jspdf.umd.min.js', 'firebase-client.js?v=66', 'firebase-store.js?v=66', 'family-access.js?v=66', 'vendor/firebase-app.js', 'vendor/firebase-auth.js', 'vendor/firebase-firestore.js', 'pwa-client.js?v=66', 'tracker-enhancements.js?v=66', 'tracker-enhancements.css?v=66', 'manifest.webmanifest', 'icons/icon-192.9e1b24ddae720af1.png', 'icons/icon-512.11926f609d950641.png', 'icons/settings-provided.png', 'images/signin-light-desktop.webp', 'images/signin-light-mobile.webp'].map(path => new URL(path, SCOPE).href);
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
