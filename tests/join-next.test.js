import test from 'node:test';
import assert from 'node:assert/strict';
import { createComposition, appendToVibhag, clearVibhag } from '../js/model.js';
import { moveSelectedAtLevel, canMoveBoundary } from '../js/rhythm.js';
import { exportBasic } from '../js/export.js';
import { createStore } from '../js/state.js';
const fixture = () => ['Ke','Te','Re','Na'].reduce((c,t)=>appendToVibhag(c,t,2),createComposition());
const right = (c,id) => moveSelectedAtLevel({composition:c,selectedBolId:id,level:'matra',direction:'right'});

test('singleton right joins the next bol, preserves identity/tags, empty rows, and supports undo', () => {
  const c = fixture();
  c.bols[1].tags.membraneControl = 'right-4';
  const store = createStore(c);
  assert.equal(canMoveBoundary(c.bols,'matra','right',c.bols[0].id),true);
  store.update(v=>right(v,c.bols[0].id));
  assert.match(exportBasic(store.composition), /V2: \| KeTe \| Re \| Na \|/);
  assert.deepEqual(store.composition.bols.map(b=>({...b,position:null})),c.bols.map(b=>({...b,position:null})));
  assert.deepEqual(store.composition.bols.map(b=>b.position.subMatra),[1,2,1,1]);
  assert.equal(canMoveBoundary(store.composition.bols,'matra','right',c.bols[0].id),false);
  store.undo();assert.deepEqual(store.composition,c);
  store.redo();assert.equal(store.composition.bols[1].position.matra,1);
});

test('only first bol of the next matra joins; suffix retains a separate matra', () => {
  let c = fixture();
  c.bols[2].position = {vibhag:2,matra:2,subMatra:1,subSubMatra:2};
  c.bols[3].position.matra=3;
  c = right(c,c.bols[0].id);
  assert.match(exportBasic(c), /V2: \| KeTe \| Re \| Na \|/);
  assert.deepEqual(c.bols[2].position,{vibhag:2,matra:2,subMatra:1,subSubMatra:1});
});

test('last matra cannot pull from another vibhag; surrounding vibhags are untouched', () => {
  let c = appendToVibhag(fixture(),'Dha',3);
  const outside=structuredClone(c.bols.at(-1));
  assert.equal(canMoveBoundary(c.bols,'matra','right',c.bols[3].id),false);
  assert.equal(right(c,c.bols[3].id),c);
  c=right(c,c.bols[1].id);
  assert.deepEqual(c.bols.at(-1),outside);
  c=clearVibhag(c,2);
  assert.equal(canMoveBoundary(c.bols,'matra','right',c.bols[0].id),false);
});
