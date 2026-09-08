import test from 'node:test';
import assert from 'node:assert/strict';
import { appendBol, createComposition, sanitizeComposition } from '../js/model.js';
import { BOL_SEQUENCES, SINGLE_MATRA_SHORTCUTS } from '../js/keyboard.js';
import { applyTagToSelection, sanitizeTags } from '../js/tags.js';
import { bolColor } from '../js/renderer.js';
import { recognizeTala, matchTala } from '../js/talas.js';
import { validateRhythm } from '../js/rhythm.js';
import { exportBasic, exportComplete } from '../js/export.js';
import { createStore } from '../js/state.js';
import { startComposition } from '../js/persistence.js';

const withoutIds = composition => composition.bols.map(({ id, ...bol }) => bol);

test('shortcuts retain independent bols and selected shortcuts occupy one matra', () => {
  for (const [label, sequence] of Object.entries(BOL_SEQUENCES)) {
    for (const forced of [false, true]) {
      const start = ['Dha', 'Dha', 'Ti'].reduce((c, b) => appendBol(c, b), createComposition());
      const compound = appendBol(start, label, forced);
      const taps = sequence.reduce((c, b, i) => appendBol(c, b, forced && i === 0), start);
      if (SINGLE_MATRA_SHORTCUTS.has(label)) {
        const first = taps.bols[3].position;
        taps.bols.slice(3).forEach((bol, index) => { bol.position = { ...first, subMatra: index + 1 }; });
      }
      assert.deepEqual(withoutIds(compound), withoutIds(taps), `${label}, next vibhag=${forced}`);
      assert.ok(validateRhythm(compound.bols));
      assert.deepEqual(compound.bols.slice(0, 3), start.bols);
      assert.equal(new Set(compound.bols.map(b => b.id)).size, compound.bols.length);
      assert.equal(exportBasic(compound), exportBasic(taps));
    }
  }
});

test('a compound shortcut is one undoable action; each resulting bol can be edited separately', () => {
  const store = createStore(createComposition());
  store.update(c => appendBol(c, 'TeReKeTe'));
  assert.equal(store.composition.bols.length, 4);
  const ids = store.composition.bols.map(b => b.id);
  store.undo();
  assert.equal(store.composition.bols.length, 0);
  store.redo();
  assert.deepEqual(store.composition.bols.map(b => b.id), ids);
  store.update(c => ({ ...c, bols: applyTagToSelection(c.bols, [ids[1]], 'membraneControl', 'right-4') }));
  assert.deepEqual(store.composition.bols.map(b => b.tags.membraneControl), [null, 'right-4', null, null]);
});

test('membrane control is independent of articulation, fingering, text and rhythm', () => {
  const c = appendBol(createComposition(), 'GheGhe');
  const ids = c.bols.map(b => b.id);
  let bols = applyTagToSelection(c.bols, ids, 'dayanArticulation', 'kinar');
  const before = bols.map(bolColor);
  bols = applyTagToSelection(bols, ids, 'membraneControl', 'right-4');
  assert.deepEqual(bols.map(bolColor), before);
  bols = applyTagToSelection(bols, ids, 'rightHandFinger', '3');
  assert.ok(bols.every(b => b.tags.membraneControl === 'right-4' && b.tags.rightHandFinger === '3'));
  bols = applyTagToSelection(bols, ids, 'dayanArticulation', 'open-tin');
  assert.ok(bols.every(b => bolColor(b) === 'var(--purple-strong)' && b.tags.membraneControl === 'right-4'));
  bols = applyTagToSelection(bols, ids, 'membraneControl', 'right-4');
  assert.ok(bols.every(b => b.tags.membraneControl === null && b.tags.dayanArticulation === 'open-tin'));
  assert.deepEqual(bols.map(b => [b.text, b.position]), c.bols.map(b => [b.text, b.position]));
  const fingerOnly = applyTagToSelection(c.bols, ids, 'rightHandFinger', '3-and-4');
  assert.ok(fingerOnly.every(b => b.tags.membraneControl === null));
});

test('old color tags migrate to the user-specified meaning, including red as control only', () => {
  for (const [old, value] of [['zone-orange', 'sur'], ['zone-blue', 'kinar'], ['zone-green', 'syahi'], ['zone-purple', 'open-tin']]) {
    const tags = sanitizeTags({ strikeZone: old, rightHandFinger: '3' });
    assert.equal(tags.dayanArticulation, value);
    assert.equal(tags.membraneControl, null);
    assert.equal(tags.rightHandFinger, '3');
  }
  const red = sanitizeTags({ strikeZone: 'zone-red' });
  assert.equal(red.dayanArticulation, null);
  assert.equal(red.membraneControl, 'right-4');
  assert.equal(bolColor({ tags: red }), '');
});

test('complete export names articulations and membrane control; basic keeps only bols', () => {
  let c = appendBol(createComposition(), 'Dha');
  const ids = [c.bols[0].id];
  for (const [group, value] of [['dayanArticulation', 'sur'], ['membraneControl', 'right-4'], ['rightHandFinger', '3']]) {
    c = { ...c, bols: applyTagToSelection(c.bols, ids, group, value) };
  }
  assert.match(exportComplete(c), /Dha\{sur; membrane control: right finger 4; right finger 3\}/);
  assert.doesNotMatch(exportBasic(c), /sur|control|finger|\{/);
});

test('recognize common taals from exact vibhag structure, not total beats', () => {
  for (const [name, structure] of [
    ['Tintal', [4, 4, 4, 4]], ['Kaherwa', [4, 4]], ['Dadra', [3, 3]],
    ['Rupak', [3, 2, 2]], ['Jhaptal', [2, 3, 2, 3]], ['Ektal', [2, 2, 2, 2, 2, 2]],
    ['Deepchandi', [3, 4, 3, 4]], ['Dhamar', [5, 2, 3, 4]], ['Sultal', [2, 2, 2, 2, 2]],
  ]) assert.equal(recognizeTala(structure), name);
  assert.equal(recognizeTala([2, 2, 4]), 'Custom');
  assert.equal(recognizeTala([8]), 'Custom');
  assert.equal(recognizeTala([]), '');
  assert.ok(matchTala([2, 2, 2, 2, 2, 2]).alternatives.includes('Chautal'));
  assert.ok(matchTala([3, 4, 3, 4]).alternatives.includes('Jhumra'));
  const c = { ...createComposition(), vibhagStructure: [4, 4] };
  assert.match(exportBasic(c), /^KAIDA — KAHERWA/);
});

test('legacy compounds expand without losing annotations, existing IDs, notes or parent grouping', () => {
  const old = { schemaVersion: 1, notes: 'lesson note', vibhagStructure: [4, 4], bols: [
    { id: 'old-a', order: 1, text: 'Dha', position: { vibhag: 1, matra: 1, subMatra: 1, subSubMatra: 1 } },
    { id: 'old-b', order: 2, text: 'TeRe / KeTe', note: 'phrase note', tags: { strikeZone: 'zone-red', rightHandFinger: '3' }, position: { vibhag: 1, matra: 2, subMatra: 1, subSubMatra: 1 } },
    { id: 'old-c', order: 3, text: 'Na', position: { vibhag: 2, matra: 1, subMatra: 1, subSubMatra: 1 } },
  ] };
  const c = sanitizeComposition(old);
  assert.equal(c.schemaVersion, 2);
  assert.deepEqual(c.bols.map(b => b.text), ['Dha', 'Te', 'Re', 'Ke', 'Te', 'Na']);
  assert.deepEqual([c.bols[0].id, c.bols[1].id, c.bols[5].id], ['old-a', 'old-b', 'old-c']);
  assert.ok(c.bols.slice(1, 5).every(b => b.position.vibhag === 1 && b.position.matra === 2 && b.tags.membraneControl === 'right-4'));
  assert.equal(c.bols[5].position.vibhag, 2);
  assert.equal(c.notes, 'lesson note');
  assert.equal(c.bols[1].note, 'phrase note');
  assert.ok(validateRhythm(c.bols));
  assert.deepEqual(sanitizeComposition(c), c);
});

test('unavailable browser storage does not block a fresh editor or in-memory editing', () => {
  const denied = { removeItem() { throw new Error('storage disabled'); } };
  const c = startComposition(denied);
  assert.equal(c.bols.length, 0);
  const store = createStore(c);
  store.update(value => appendBol(value, 'GheGhe'));
  assert.equal(store.composition.bols.length, 2);
  store.undo();
  assert.equal(store.composition.bols.length, 0);
  assert.equal(startComposition(denied).bols.length, 0);
});
