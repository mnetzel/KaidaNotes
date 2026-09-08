import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const port = Number(process.env.PORT || 4173);
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json' };
createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    const pathname = decodeURIComponent(url.pathname).replace(/^\/KaidaNotes(?=\/|$)/, '');
    const path = resolve(root, `.${pathname || '/'}`);
    if (path !== root && !path.startsWith(root + sep)) { response.writeHead(403).end(); return; }
    const info = await stat(path);
    const target = info.isDirectory() ? resolve(path, 'index.html') : path;
    if (!['index.html', 'sw.js', 'css', 'js', 'assets'].some(name => target === resolve(root, name) || target.startsWith(resolve(root, name) + sep))) {
      response.writeHead(404).end(); return;
    }
    response.writeHead(200, { 'Content-Type': `${types[extname(target)] || 'application/octet-stream'}${['.html', '.css', '.js', '.json'].includes(extname(target)) ? '; charset=utf-8' : ''}`, 'Cache-Control': 'no-store' });
    response.end(await readFile(target));
  } catch { response.writeHead(404).end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`KaidaNotes: http://localhost:${port}/KaidaNotes/`));
