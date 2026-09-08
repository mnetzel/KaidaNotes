import test from 'node:test';
import assert from 'node:assert/strict';
import { createComposition, appendToVibhag, clearVibhag, deleteBol } from '../js/model.js';
import { startComposition, saveComposition, STORAGE_KEY } from '../js/persistence.js';
import { createStore } from '../js/state.js';

const sheet = () => {
  let c = createComposition();
  for (const v of [1,2,3]) c = appendToVibhag(c, 'TeReKeTe', v);
  return { ...c, notes: 'Keep notes', compositionType: 'rela' };
};
test('clear one vibhag preserves other rows, metadata and structure; refill stays in that row', () => {
  const c = sheet();
  const cleared = clearVibhag(c, 2);
  assert.deepEqual(cleared.bols, c.bols.filter(b => b.position.vibhag !== 2));
  assert.deepEqual(cleared.vibhagStructure, c.vibhagStructure);
  assert.equal(cleared.notes, c.notes);
  const filled = appendToVibhag(cleared, 'Dha', cleared.ui.entryVibhag);
  assert.deepEqual(filled.bols.map(b=>b.position.vibhag), [1,1,1,1,2,3,3,3,3]);
  assert.equal(filled.bols[4].text, 'Dha');
  assert.equal(filled.bols[4].position.matra, 1);
  assert.deepEqual(filled.bols.filter(b=>b.position.vibhag===3).map(b=>b.id), c.bols.slice(-4).map(b=>b.id));
});
test('backspace removes one exact ID, normalizes only its row and is undoable', () => {
  const c = sheet();
  const store = createStore(c);
  store.update(value => deleteBol(value, c.bols[5].id));
  assert.equal(store.composition.bols.length, 11);
  assert.deepEqual(store.composition.bols.filter(b=>b.position.vibhag!==2), c.bols.filter(b=>b.position.vibhag!==2));
  assert.deepEqual(store.composition.bols.filter(b=>b.position.vibhag===2).map(b=>b.position.matra), [1,2,3]);
  store.undo(); assert.deepEqual(store.composition, c);
});
test('saved data survives reload including empty vibhags; full reset replaces saved data and history', () => {
  const map = new Map([['other-app','keep']]);
  const storage = { getItem:k=>map.get(k), setItem:(k,v)=>map.set(k,v), removeItem:k=>map.delete(k) };
  const c = clearVibhag(sheet(), 1);
  assert.ok(saveComposition(c, storage));
  assert.deepEqual(startComposition(storage), c);
  const store = createStore(c, value=>saveComposition(value, storage));
  store.update(value=>clearVibhag(value, 2));
  assert.ok(store.canUndo);
  store.reset(createComposition());
  assert.equal(store.canUndo, false); assert.equal(store.canRedo, false);
  assert.deepEqual(startComposition(storage), store.composition);
  assert.equal(startComposition(storage).notes, '');
  assert.equal(map.get('other-app'), 'keep');
  map.set(STORAGE_KEY, 'invalid json');
  assert.equal(startComposition(storage).bols.length, 0);
});
