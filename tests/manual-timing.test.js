import test from 'node:test';
import assert from 'node:assert/strict';
import { createComposition, appendToVibhag, insertPause } from '../js/model.js';
import { notatedTimings, createManualDraft, moveManualTiming, manualCapture } from '../js/manual-timing.js';
import { clapDisplay, clapBlocks, validateClapCapture } from '../js/clap-data.js';
import { createShareLink, readShareLink } from '../js/share-link.js';
import { exportJSON, importJSON } from '../js/json-file.js';

const sample = () => {
  let c = appendToVibhag(createComposition(), 'TeRe', 1);
  c = appendToVibhag(c, 'Dha', 1);
  return c;
};

test('notation initializes grouped bols, nested subdivisions, pauses and empty matras', () => {
  let c = sample();
  c = insertPause(c, c.bols[2].id, 'after');
  assert.deepEqual(notatedTimings(c).map(t => [t.start, t.end]), [[0, .5], [.5, 1], [1, 1.5], [1.5, 2]]);
  const nested = structuredClone(c);
  nested.bols[0].position.subSubMatra = 1;
  nested.bols[1].position = { ...nested.bols[0].position, subSubMatra: 2 };
  nested.bols[2].position = { ...nested.bols[0].position, subMatra: 2 };
  nested.bols.pop();
  assert.deepEqual(notatedTimings(nested).map(t => [t.start, t.end]), [[0, .25], [.25, .5], [.5, 1]]);
  const overflow = sample(); overflow.bols[0].position.matra = 5;
  assert.throws(() => notatedTimings(overflow), /structure/);
});

test('matching recordings keep raw onsets; incomplete recordings include every bol from notation', () => {
  const c = sample();
  c.clapping = { timestamps: [0, 110, 420, 2000], structure: [4, 4, 4, 4], name: 'Tintal', snap: true };
  const draft = createManualDraft(c);
  assert.deepEqual(draft.intervals.map(t => t.start), [0, .88, 3.36]);
  assert.equal(draft.intervals.at(-1).end, 16);
  const original = structuredClone(c);
  c.clapping.timestamps = [0, 400, 2000];
  assert.equal(createManualDraft(c).intervals.length, c.bols.length);
  assert.match(createManualDraft(c).notice, /2 hits for 3/);
  assert.deepEqual(createManualDraft(original, true).intervals, notatedTimings(c));
});

test('quarter snapping rounds both ways; resizing/moving respects neighbours and cycle bounds', () => {
  const entries = [{ bolId: 'a', start: 0, end: 1 }, { bolId: 'b', start: 2, end: 3 }, { bolId: 'c', start: 4, end: 5 }];
  assert.equal(moveManualTiming(entries, 1, 'move', 2.13, 8)[1].start, 2.25);
  assert.equal(moveManualTiming(entries, 1, 'move', 2.12, 8)[1].start, 2);
  assert.equal(moveManualTiming(entries, 1, 'start', 1.12, 8)[1].start, 1);
  assert.equal(moveManualTiming(entries, 1, 'end', 8, 8)[1].end, 4);
  assert.equal(moveManualTiming(entries, 0, 'move', -10, 8)[0].start, 0);
  assert.equal(moveManualTiming(entries, 1, 'move', 2.13, 8, false)[1].start, 2.13);
  assert.deepEqual(entries[1], { bolId: 'b', start: 2, end: 3 });
});

test('independent ends, pauses, tags, duration, JSON and links round-trip without changing notation', async () => {
  let c = sample();
  c = insertPause(c, c.bols[1].id, 'after');
  c.bols[0].tags.leftHandFinger = '1-5';
  c.bols[0].tags.rightHandFinger = '2';
  const original = structuredClone(c);
  const draft = createManualDraft(c);
  draft.intervals[0].end = .25;
  c.clapping = manualCapture(draft, c.bols);
  assert.equal(c.clapping.snap, false);
  const display = clapDisplay(c.clapping, c.bols);
  assert.equal(display.hits.length, 3);
  assert.deepEqual(display.hits[0].hands, ['right', 'left']);
  assert.equal(clapBlocks(display)[0].endMatra, .25);
  assert.equal(clapBlocks(clapDisplay({ ...c.clapping, snap: true }, c.bols))[0].endMatra, .5);
  assert.equal(c.clapping.manualTimings[0].end, .25);
  assert.equal(clapBlocks(display)[1].endMatra, draft.intervals[1].end);
  assert.deepEqual(createManualDraft(c).intervals, draft.intervals);
  assert.deepEqual(importJSON(exportJSON(c)), c);
  assert.deepEqual(await readShareLink(new URL(await createShareLink(c, 'https://example.com/')).hash), c);
  assert.deepEqual(c.bols, original.bols);
  assert.deepEqual(c.vibhagStructure, original.vibhagStructure);
  const leadingRest = structuredClone(c);
  leadingRest.bols[0].text = '—';
  const leadingCapture = manualCapture(draft, leadingRest.bols);
  assert.equal(leadingCapture.timestamps[0], 0);
  assert.ok(clapDisplay(leadingCapture, leadingRest.bols).hits[0].matra > 0);
});

test('linked boundaries adjust neighbours; moving a block preserves its length and does not reorder bols', () => {
  const entries = [{ bolId: 'a', start: 0, end: 1 }, { bolId: 'b', start: 1, end: 2 }, { bolId: 'c', start: 2, end: 3 }];
  const resize = moveManualTiming(entries, 0, 'end', 1.5, 4, true, true);
  assert.equal(resize[0].end, 1.5); assert.equal(resize[1].start, 1.5);
  assert.equal(resize[1].end, 2);
  const moved = moveManualTiming(entries, 1, 'move', 1.25, 4, true, true);
  assert.deepEqual(moved.map(t => [t.start, t.end]), [[0, 1.25], [1.25, 2.25], [2.25, 3]]);
  assert.deepEqual(moved.map(t => t.bolId), ['a', 'b', 'c']);
  assert.equal(moveManualTiming(entries, 0, 'end', 1.5, 4, true, false)[0].end, 1);
});

test('manual timelines reject overlaps, duplicate IDs, negative times and out-of-cycle ends', () => {
  const c = sample();
  const capture = manualCapture(createManualDraft(c), c.bols);
  for (const change of [
    x => { x.manualTimings[0].start = -1; },
    x => { x.manualTimings[1].start = 0; },
    x => { x.manualTimings[1].bolId = x.manualTimings[0].bolId; },
    x => { x.manualTimings[2].end = 17; },
    x => { x.manualTimings[0].end = 0; },
  ]) {
    const value = structuredClone(capture); change(value);
    assert.throws(() => validateClapCapture(value), /manual/);
  }
});
