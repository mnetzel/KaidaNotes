import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

async function worker(fetch) {
  const handlers = new Map();
  const self = { registration: { scope: 'https://example.test/KaidaNotes/' },
    addEventListener: (type, callback) => handlers.set(type, callback),
    skipWaiting: async () => {}, clients: { claim: async () => {} } };
  runInNewContext(await readFile(new URL('../sw.js', import.meta.url), 'utf8'), { self, URL, Headers, Response, crypto, fetch });
  return request => {
    let result;
    handlers.get('fetch')({ request, respondWith(value) { result = value; } });
    return result;
  };
}

test('fresh transport bypasses HTTP/CDN caching for HTML, module dependencies, CSS and images', async () => {
  const requests = [];
  const dispatch = await worker(async (url, options) => {
    requests.push({ url, options });
    return new Response('latest content', { headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'max-age=600', ETag: 'old-etag', 'Content-Length': '14' } });
  });
  for (const file of ['', 'js/model.js', 'css/app.css', 'assets/tabla.jpg', 'assets/favicon.svg']) {
    const request = new Request(`https://example.test/KaidaNotes/${file}?debug=1`, { headers: { 'If-None-Match': 'old-etag', 'If-Modified-Since': 'yesterday' } });
    const first = await dispatch(request);
    const second = await dispatch(request);
    assert.equal(await first.text(), 'latest content');
    assert.match(second.headers.get('Cache-Control'), /no-store/);
    assert.equal(second.headers.get('ETag'), null);
    const [a, b] = requests.slice(-2);
    assert.notEqual(a.url, b.url);
    assert.equal(new URL(a.url).searchParams.get('debug'), '1');
    assert.equal(a.options.cache, 'no-store');
    assert.equal(a.options.headers.has('If-None-Match'), false);
    assert.equal(a.options.headers.has('If-Modified-Since'), false);
  }
});

test('transport leaves other projects, external origins and writes alone', async () => {
  const dispatch = await worker(() => { throw new Error('must not fetch'); });
  for (const url of ['https://example.test/AnotherApp/js/app.js', 'https://example.test/KaidaNotesOther/', 'https://elsewhere.test/KaidaNotes/']) {
    assert.equal(dispatch(new Request(url)), undefined);
  }
  assert.equal(dispatch(new Request('https://example.test/KaidaNotes/', { method: 'POST', body: 'data' })), undefined);
});

test('failed requests never fall back to stale application files', async () => {
  const dispatch = await worker(async () => { throw new Error('offline'); });
  const response = await dispatch(new Request('https://example.test/KaidaNotes/'));
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.match(await response.text(), /reload to start a fresh composition/);
});
