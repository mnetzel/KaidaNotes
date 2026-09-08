import test from 'node:test';
import assert from 'node:assert/strict';
import { createComposition, appendBol, sanitizeComposition, recognizeTala } from '../js/model.js';
import { LEVELS, moveBoundary, normalizePositions, validateRhythm, getParentScope, canMoveBoundary, comparePosition, vibhagLength } from '../js/rhythm.js';
import { applyTagToSelection } from '../js/tags.js';
import { selectBol, createSelection, getPrimarySelection, setMultiSelect } from '../js/selection.js';
import { exportBasic, exportComplete } from '../js/export.js';
import { startComposition, STORAGE_KEY, LEGACY_BACKUP_KEY } from '../js/persistence.js';
import { createStore } from '../js/state.js';

// Structural fixtures explicitly simulate a next-vibhag tap at each target boundary.
const phrase = (text, structure = [4, 4, 4, 4]) => text.split(' ').reduce((c, bol) => {
  const last = c.bols.at(-1);
  const next = !!last && last.position.matra >= vibhagLength(structure, last.position.vibhag);
  return appendBol(c, bol, next);
}, { ...createComposition(), vibhagStructure: structure });
const addresses = bols => bols.map(bol => LEVELS.map(level => bol.position[level]).join(':'));
const move = (composition, index, level, direction) => ({ ...composition, bols: moveBoundary(composition.bols, level, direction, composition.bols[index].id) });

test('Case A: four matras, stable IDs, compound expansion, and overflow within the same vibhag', () => {
  let c = phrase('Dha Dha Ti Ti');
  assert.deepEqual(addresses(c.bols), ['1:1:1:1', '1:2:1:1', '1:3:1:1', '1:4:1:1']);
  const original = c.bols.map(b => ({ id: b.id, order: b.order, text: b.text }));
  c = appendBol(c, 'TeRe / KeTe');
  assert.deepEqual(c.bols.slice(4).map(b => b.text), ['Te', 'Re', 'Ke', 'Te']);
  assert.equal(c.bols.length, 8);
  assert.equal(addresses(c.bols).at(-1), '1:5:4:1');
  assert.deepEqual(c.bols.slice(0, 4).map(b => ({ id: b.id, order: b.order, text: b.text })), original);
  assert.equal(new Set(c.bols.map(b => b.id)).size, 8);
});

test('next vibhag forces a boundary, also after a full vibhag and on an empty sheet', () => {
  assert.equal(addresses(appendBol(phrase('Dha Dha'), 'Na', true).bols).at(-1), '2:1:1:1');
  assert.equal(addresses(appendBol(phrase('Dha Dha Ti Ti'), 'Na', true).bols).at(-1), '2:1:1:1');
  assert.equal(addresses(appendBol(createComposition(), 'Dha', true).bols)[0], '1:1:1:1');
});

test('arbitrary structures with explicit next-vibhag entry and later cycles', () => {
  const c = phrase('Dha Dha Dha Ta Ta Ti Ti Ti Ti Na', [3, 2, 4]);
  assert.deepEqual(addresses(c.bols), ['1:1:1:1', '1:2:1:1', '1:3:1:1', '2:1:1:1', '2:2:1:1', '3:1:1:1', '3:2:1:1', '3:3:1:1', '3:4:1:1', '4:1:1:1']);
  assert.equal(recognizeTala([3, 2, 4]), 'Custom');
  assert.equal(recognizeTala([4, 4, 4, 4]), 'Tintal');
});

test('Case B: join four matras into four subdivisions without fixed subdivision count', () => {
  let c = phrase('Dha Te Re Ke Te', [5]);
  for (const index of [2, 3, 4]) c = move(c, index, 'matra', 'left');
  assert.deepEqual(addresses(c.bols), ['1:1:1:1', '1:2:1:1', '1:2:2:1', '1:2:3:1', '1:2:4:1']);
  assert.match(exportBasic(c), /V1: \| Dha \| TeReKeTe \|/);
  assert.ok(validateRhythm(c.bols));
});

test('Case C: subSubMatra grouping retains joined matra export', () => {
  let c = phrase('Dha Te Re Ke');
  for (const index of [2, 3]) c = move(c, index, 'matra', 'left');
  c = move(c, 2, 'subMatra', 'left');
  assert.deepEqual(addresses(c.bols), ['1:1:1:1', '1:2:1:1', '1:2:1:2', '1:2:2:1']);
  assert.match(exportBasic(c), /\| Dha \| TeReKe \|/);
  const hidden = { ...c, ui: { showSubSubMatra: false } };
  assert.equal(exportBasic(hidden), exportBasic(c));
  assert.deepEqual(addresses(sanitizeComposition(hidden).bols), addresses(c.bols));
});

test('split before anchor; merging an interior prefix preserves the suffix and surrounding scopes', () => {
  let c = phrase('Dha Te Re Ke Ta Na', [5, 2]);
  c = move(c, 2, 'matra', 'left');
  c = move(c, 3, 'matra', 'left');
  const outside = structuredClone(c.bols.at(-1));
  c = move(c, 2, 'matra', 'right');
  assert.deepEqual(addresses(c.bols).slice(0, 5), ['1:1:1:1', '1:2:1:1', '1:3:1:1', '1:3:2:1', '1:4:1:1']);
  c = move(c, 2, 'matra', 'left');
  assert.deepEqual(addresses(c.bols).slice(0, 5), ['1:1:1:1', '1:2:1:1', '1:2:2:1', '1:3:1:1', '1:4:1:1']);
  assert.deepEqual(c.bols.at(-1), outside);
});

test('invalid arrows are disabled and parent scopes are respected', () => {
  const c = phrase('Dha Dha Ti Ti Ta Na');
  for (const level of LEVELS) {
    assert.equal(canMoveBoundary(c.bols, level, 'left', c.bols[0].id), false);
    assert.equal(canMoveBoundary(c.bols, level, 'right', c.bols[0].id), level === 'matra');
    assert.equal(canMoveBoundary(c.bols, level, 'left', 'missing'), false);
  }
  assert.deepEqual(getParentScope(c.bols, 'matra', c.bols[4].id), { start: 4, end: 6, index: 4 });
  assert.equal(canMoveBoundary(c.bols, 'matra', 'left', c.bols[4].id), false);
  assert.equal(canMoveBoundary(c.bols, 'matra', 'right', c.bols[1].id), true);
  assert.ok(canMoveBoundary(c.bols, 'vibhag', 'left', c.bols[4].id));
});

test('normalization removes gaps and reversed addresses without sorting bols', () => {
  const c = phrase('Dha Ti Na');
  c.bols[1].position.matra = 9;
  c.bols[2].position.matra = 2;
  const normalized = normalizePositions(c.bols);
  assert.deepEqual(addresses(normalized), ['1:1:1:1', '1:2:1:1', '1:3:1:1']);
  assert.deepEqual(normalized.map(b => b.id), c.bols.map(b => b.id));
});

test('Case D: 3,000 deterministic edits retain order, IDs, text, contiguity and local scope', () => {
  let c = phrase(Array.from({ length: 48 }, (_, i) => ['Dha', 'Ti', 'Na', 'Te'][i % 4]).join(' '));
  const identity = c.bols.map(b => ({ id: b.id, order: b.order, text: b.text }));
  let seed = 421;
  const random = n => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return Math.floor((seed / 4294967296) * n); };
  for (let i = 0; i < 3000; i++) {
    const index = random(c.bols.length);
    const level = LEVELS[random(4)];
    const direction = random(2) ? 'left' : 'right';
    const before = c;
    const scope = getParentScope(c.bols, level, c.bols[index].id);
    c = move(c, index, level, direction);
    assert.ok(validateRhythm(c.bols), `invalid rhythm after ${i}: ${level} ${direction}`);
    assert.deepEqual(c.bols.map(b => ({ id: b.id, order: b.order, text: b.text })), identity);
    for (let j = 0; j < c.bols.length; j++) {
      if (j < scope.start || j >= scope.end) assert.deepEqual(c.bols[j], before.bols[j]);
      if (j) assert.ok(comparePosition(c.bols[j - 1].position, c.bols[j].position) <= 0);
    }
  }
});

test('Case E: multi-selection tag exclusivity and consistent toggle; no text or rhythm changes', () => {
  const c = phrase('Dha Dha Ti Ti');
  const ids = c.bols.slice(0, 3).map(b => b.id);
  let bols = applyTagToSelection(c.bols, ids, 'openClose', 'open');
  assert.deepEqual(bols.map(b => b.tags.openClose), ['open', 'open', 'open', null]);
  bols = applyTagToSelection(bols, ids, 'openClose', 'close');
  assert.deepEqual(bols.map(b => b.tags.openClose), ['close', 'close', 'close', null]);
  bols = applyTagToSelection(bols, ids, 'openClose', 'close');
  assert.ok(bols.every(b => b.tags.openClose === null));
  assert.deepEqual(addresses(bols), addresses(c.bols));
  assert.deepEqual(bols.map(b => b.text), c.bols.map(b => b.text));
});

test('last selected bol is primary; deselect and exit multi-selection are deterministic', () => {
  let s = setMultiSelect(createSelection(), true);
  for (const id of ['one', 'two', 'three']) s = selectBol(s, id);
  assert.equal(getPrimarySelection(s), 'three');
  s = selectBol(s, 'three');
  assert.equal(getPrimarySelection(s), 'two');
  assert.deepEqual(setMultiSelect(s, false), { multi: false, ids: ['two'] });
});

test('complete export uses human-readable tags; basic excludes tags and both include notes', () => {
  let c = phrase('Dha Ti');
  c.bols = applyTagToSelection(c.bols, [c.bols[0].id], 'dayanArticulation', 'sur');
  c.bols = applyTagToSelection(c.bols, [c.bols[0].id], 'openClose', 'open');
  c.notes = 'Play slowly first.';
  assert.match(exportComplete(c), /Dha\{sur; open\}/);
  assert.doesNotMatch(exportBasic(c), /sur|open/);
  for (const value of [exportBasic(c), exportComplete(c)]) {
    assert.match(value, /Notes:\nPlay slowly first\./);
    assert.doesNotMatch(value, /bol-|composition-|zone-orange|schemaVersion/);
  }
});

test('schema defaults recover duplicate IDs, bad addresses and missing tags safely', () => {
  const c = sanitizeComposition({ bols: [{ text: 'Dha', id: 'same', position: { matra: -1 } }, { text: 'Ti', id: 'same', order: 1 }, null], vibhagStructure: [4, -3, '4'] });
  assert.equal(c.bols.length, 2);
  assert.ok(validateRhythm(c.bols));
  assert.deepEqual(c.vibhagStructure, [4]);
  assert.ok(c.bols.every(b => b.position.subSubMatra === 1 && Array.isArray(b.tags.extra)));
});

test('undo and redo restore entire edits and clear; typing is coalesced and new edits discard redo', () => {
  const c = phrase('Dha Ti');
  const saved = [];
  const store = createStore(c, value => saved.push(value));
  store.update(value => ({ ...value, bols: [] }));
  store.undo(); assert.deepEqual(store.composition, c);
  store.redo(); assert.equal(store.composition.bols.length, 0);
  store.undo();
  store.update(value => ({ ...value, notes: 'A' }), 'notes');
  store.update(value => ({ ...value, notes: 'AB' }), 'notes');
  assert.equal(store.canRedo, false);
  store.undo(); assert.equal(store.composition.notes, '');
  assert.ok(saved.length >= 6);
});
