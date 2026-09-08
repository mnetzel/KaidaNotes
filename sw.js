// Network-only transport for this app's scope. Never create an offline cache.
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  const scope = new URL(self.registration.scope);
  if (request.method !== 'GET' || url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  event.respondWith(fetchFresh(request));
});

async function fetchFresh(request) {
  const url = new URL(request.url);
  // Also bypass a shared/CDN cache, whose headers GitHub Pages controls.
  url.searchParams.set('_fresh', crypto.randomUUID());
  const headers = new Headers(request.headers);
  headers.delete('If-None-Match');
  headers.delete('If-Modified-Since');
  try {
    const response = await fetch(url.href, { cache: 'no-store', credentials: 'same-origin', headers });
    const freshHeaders = new Headers(response.headers);
    freshHeaders.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    freshHeaders.set('Pragma', 'no-cache');
    freshHeaders.set('Expires', '0');
    // The fetch body has already been decoded; these original wire headers no
    // longer describe the response returned through the service worker.
    for (const name of ['Content-Encoding', 'Content-Length', 'ETag', 'Last-Modified']) freshHeaders.delete(name);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers: freshHeaders });
  } catch {
    return new Response('KaidaNotes needs a connection to load the latest version. Reconnect and reload. Your saved notation is still on this device.',
      { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
  }
}
