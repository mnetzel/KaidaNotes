import test from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { createComposition, appendToVibhag, clearVibhag } from '../js/model.js';
import { createShareLink, readShareLink, MAX_DOCUMENT_BYTES } from '../js/share-link.js';
import { moveSelectedAtLevel } from '../js/rhythm.js';

const hashFor = value => '#kaida=1.' + gzipSync(Buffer.from(JSON.stringify(value))).toString('base64url');
test('share link round-trips full Unicode composition, tags, nested rhythm, empty rows and UI', async () => {
  let c = appendToVibhag(createComposition(), 'TeReKeTe', 1);
  c = moveSelectedAtLevel({composition:c,selectedBolId:c.bols[1].id,level:'matra',direction:'left'});
  c = appendToVibhag(c, 'Dha', 2);
  c = appendToVibhag(c, 'Ta', 3);
  c = clearVibhag(c, 2);
  c.notes = 'Żółć — प्रणाम 🥁\nDha & Ta # + / ? <script>literal text</script>';
  c.compositionType = 'part-practice';
  c.ui.showSubSubMatra = true;
  Object.assign(c.bols[0].tags, {dayanArticulation:'sur', membraneControl:'right-4', leftHandFinger:'2', rightHandFinger:'3-and-4', openClose:'open', bayanDirection:'up', extra:['quiet']});
  c.bols[0].note = 'Individual note';
  const url = new URL(await createShareLink(c, 'https://mnetzel.github.io/KaidaNotes/?debug=1&_reload=old#previous'));
  assert.equal(url.pathname, '/KaidaNotes/'); assert.equal(url.search, '');
  assert.deepEqual(await readShareLink(url.hash), c);
  const oldLink = url.hash;
  c.notes = 'Changed after sharing';
  assert.notEqual((await readShareLink(oldLink)).notes, c.notes);
  const reply = await readShareLink(new URL(await createShareLink(c, url.href)).hash);
  assert.deepEqual(reply, c);
});
test('empty composition is shareable; unrelated hashes are ignored', async () => {
  const c = createComposition();
  assert.deepEqual(await readShareLink(new URL(await createShareLink(c, 'https://example.com/KaidaNotes/')).hash), c);
  assert.equal(await readShareLink('#notes'), null);
});
test('invalid, truncated, unsupported and oversized payloads are rejected', async () => {
  for (const hash of ['#kaida=', '#kaida=2.AAAA', '#kaida=1.not-gzip', hashFor({schemaVersion:99,bols:[]}), hashFor({schemaVersion:2,bols:[null],vibhagStructure:[]}), hashFor({...createComposition(), notes:'x'.repeat(MAX_DOCUMENT_BYTES+1)})]) await assert.rejects(readShareLink(hash));
  const link = new URL(await createShareLink(createComposition(), 'https://example.com/'));
  await assert.rejects(readShareLink(link.hash.slice(0,-6)));
  await assert.rejects(createShareLink({...createComposition(),notes:'x'.repeat(MAX_DOCUMENT_BYTES+1)},'https://example.com/'));
});
