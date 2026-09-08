import test from 'node:test';
import assert from 'node:assert/strict';
import { createComposition, appendBol, replaceBol } from '../js/model.js';
import { createSelection, createBolInteraction, clickNotationBol, getPrimarySelection } from '../js/selection.js';
import { applyTagToSelection } from '../js/tags.js';
import { createStore } from '../js/state.js';

test('entry exceeds the target without changing it; only explicit next-vibhag advances', () => {
  let c = createComposition();
  for (let i = 0; i < 10; i++) c = appendBol(c, 'Dha');
  assert.deepEqual(c.vibhagStructure, [4, 4, 4, 4]);
  assert.ok(c.bols.every(b => b.position.vibhag === 1));
  assert.deepEqual(c.bols.map(b => b.position.matra), [1,2,3,4,5,6,7,8,9,10]);
  c = appendBol(c, 'TeReKeTe', true);
  assert.deepEqual(c.bols.slice(-4).map(b => b.position), [1,2,3,4].map(subMatra => ({vibhag:2, matra:1, subMatra, subSubMatra:1})));
  c = appendBol(c, 'Ta');
  assert.equal(c.bols.at(-1).position.vibhag, 2);
  assert.equal(c.bols.at(-1).position.matra, 2);
});

test('three consecutive taps select one, all exact matches across vibhags, then one replacement', () => {
  let c = appendBol(appendBol(appendBol(createComposition(), 'Dha'), 'Ta'), 'Dha', true);
  let state = { selection: createSelection(), interaction: createBolInteraction() };
  const target = c.bols[0].id;
  const tap = id => state = clickNotationBol(state.selection, state.interaction, c.bols, id);
  tap(target);
  assert.deepEqual(state.selection.ids, [target]);
  tap(target);
  assert.deepEqual(new Set(state.selection.ids), new Set([target, c.bols[2].id]));
  assert.equal(getPrimarySelection(state.selection), target);
  c = { ...c, bols: applyTagToSelection(c.bols, state.selection.ids, 'dayanArticulation', 'sur') };
  assert.deepEqual(c.bols.map(b => b.tags.dayanArticulation), ['sur', null, 'sur']);
  tap(target);
  assert.deepEqual(state.selection.ids, [target]);
  assert.equal(state.interaction.editingId, target);
  assert.equal(c.bols[0].text, 'Dha'); // Pending correction has not deleted data.
  tap(c.bols[1].id);
  assert.equal(state.interaction.editingId, null);
  assert.equal(state.interaction.clicks, 1);
});

test('a unique bol also reaches replacement on the third tap', () => {
  const c = appendBol(createComposition(), 'Ta');
  let state = { selection: createSelection(), interaction: createBolInteraction() };
  for (let i = 0; i < 3; i++) state = clickNotationBol(state.selection, state.interaction, c.bols, c.bols[0].id);
  assert.equal(state.interaction.editingId, c.bols[0].id);
});

test('replacement changes only the target text and is one undoable operation', () => {
  const c = appendBol(appendBol(createComposition(), 'Dha'), 'Dha');
  c.bols[0].tags.membraneControl = 'right-4';
  c.bols[0].note = 'Keep this note';
  const store = createStore(c);
  store.update(value => replaceBol(value, c.bols[0].id, 'Ta'));
  assert.deepEqual(store.composition.bols[0], { ...c.bols[0], text: 'Ta' });
  assert.deepEqual(store.composition.bols[1], c.bols[1]);
  assert.equal(store.composition.bols.length, 2);
  store.undo(); assert.deepEqual(store.composition, c);
  store.redo(); assert.equal(store.composition.bols[0].text, 'Ta');
  assert.equal(replaceBol(c, c.bols[0].id, 'TeReKeTe'), c);
  assert.equal(replaceBol(c, c.bols[0].id, ''), c);
  assert.equal(replaceBol(c, 'missing', 'Ta'), c);
});
