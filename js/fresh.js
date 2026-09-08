// Loaded with a unique URL even on the first, not-yet-controlled navigation.
export async function prepareFreshPage() {
  if (!('serviceWorker' in navigator)) throw new Error('Fresh loading requires a browser with service worker support over HTTPS or localhost.');
  const workerURL = new URL('../sw.js', import.meta.url);
  workerURL.search = '';
  const scope = new URL('./', workerURL);
  let refreshing = false;
  function refresh() {
    if (refreshing) return;
    refreshing = true;
    const url = new URL(location.href);
    url.searchParams.set('_reload', crypto.randomUUID());
    location.replace(url.href);
  }

  navigator.serviceWorker.addEventListener('controllerchange', refresh);
  const wasControlled = navigator.serviceWorker.controller?.scriptURL === workerURL.href;
  let timeout;
  try {
    await Promise.race([
      (async () => {
        await navigator.serviceWorker.register(workerURL.href, { scope: scope.href, updateViaCache: 'none' });
        await navigator.serviceWorker.ready;
      })(),
      new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Could not load the latest version. Check your connection and try again.')), 15000); }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
  // The very first HTML/CSS request may predate the worker. Replace that entire
  // document once, before the editor starts, to refresh every resource together.
  if (!wasControlled || refreshing) {
    refresh();
    return false;
  }

  window.addEventListener('pageshow', event => { if (event.persisted) refresh(); });
  let wasHidden = document.visibilityState === 'hidden';
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') wasHidden = true;
    else if (wasHidden) refresh();
  });
  return true;
}
