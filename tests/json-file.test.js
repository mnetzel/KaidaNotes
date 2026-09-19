import test from 'node:test';
import assert from 'node:assert/strict';
import { createComposition, appendToVibhag, insertPause } from '../js/model.js';
import { exportJSON, importJSON, MAX_JSON_BYTES } from '../js/json-file.js';
import { createShareLink, readShareLink } from '../js/share-link.js';
import { createStore } from '../js/state.js';

test('readable JSON preserves the same full composition as its share link', async () => {
  let composition = appendToVibhag(createComposition(), 'TeRe', 1);
  composition = insertPause(composition, composition.bols[0].id, 'after');
  composition = appendToVibhag(composition, 'Dha', 3);
  composition.notes = 'Żółć — प्रणाम 🥁\nA second line';
  composition.compositionType = 'part-practice';
  composition.ui = { showSubSubMatra: true, entryVibhag: 3, emptyMatras: [{ vibhag: 2, matra: 1 }] };
  Object.assign(composition.bols[0].tags, { dayanArticulation: 'sur', membraneControl: 'right-4',
    leftHandFinger: '1-5', rightHandFinger: '3-and-4', openClose: 'close', bayanDirection: 'down', extra: ['quiet'] });
  composition.bols[0].note = 'Individual bol note';
  composition.clapping = { timestamps: [0, 430, 1020, 1590], structure: [4, 4, 4, 4], name: 'Tintal', snap: true };
  const json = exportJSON(composition);
  assert.ok(json.includes('\n  "schemaVersion": 2,'));
  assert.ok(json.includes('Żółć'));
  assert.ok(json.endsWith('\n'));
  assert.deepEqual(JSON.parse(json), composition);
  assert.deepEqual(importJSON(json), composition);
  const link = new URL(await createShareLink(composition, 'https://example.com/'));
  assert.deepEqual(importJSON(json), await readShareLink(link.hash));
});

test('empty compositions and UTF-8 BOM files import; omitted optional tags retain defaults', () => {
  const empty = createComposition();
  assert.deepEqual(importJSON('\uFEFF' + exportJSON(empty)), empty);
  const composition = appendToVibhag(empty, 'Na', 1);
  const older = structuredClone(composition);
  delete older.bols[0].tags;
  assert.deepEqual(importJSON(JSON.stringify(older)), composition);
});

test('bad JSON and dangerous positions are rejected before replacing the editor; import is undoable', () => {
  const original = appendToVibhag(createComposition(), 'Dha', 1);
  const store = createStore(original);
  for (const value of ['{', '{}', 'null', '[]',
    JSON.stringify({ ...original, schemaVersion: 99 }),
    JSON.stringify({ ...original, bols: [null] }),
    JSON.stringify({ ...original, vibhagStructure: [-1] }),
    JSON.stringify({ ...original, bols: [{ ...original.bols[0], position: { ...original.bols[0].position, vibhag: 1e9 } }] }),
    JSON.stringify({ ...original, ui: { entryVibhag: 1e9 } }),
    JSON.stringify({ ...original, clapping: { timestamps: [5, 1] } }),
    ' '.repeat(MAX_JSON_BYTES + 1)]) {
    assert.throws(() => store.update(() => importJSON(value)));
    assert.deepEqual(store.composition, original);
  }
  const replacement = appendToVibhag(createComposition(), 'Tin', 1);
  store.update(() => importJSON(exportJSON(replacement)));
  assert.deepEqual(store.composition, replacement);
  store.undo(); assert.deepEqual(store.composition, original);
  store.redo(); assert.deepEqual(store.composition, replacement);
});
