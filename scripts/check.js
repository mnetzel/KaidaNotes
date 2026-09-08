import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
for (const directory of ['js', 'scripts', 'tests']) {
  for (const file of await readdir(directory)) {
    if (!file.endsWith('.js')) continue;
    const result = spawnSync(process.execPath, ['--check', `${directory}/${file}`], { encoding: 'utf8' });
    if (result.status) { console.error(result.stderr); process.exit(1); }
  }
}
const html = await readFile('index.html', 'utf8');
for (const match of html.matchAll(/(?:src|href)="((?:css|js|assets)\/[^"]+)"/g)) await readFile(match[1]);
console.log('JavaScript syntax and local entry assets verified. No build step required.');
