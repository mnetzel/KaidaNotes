import test from 'node:test';
import assert from 'node:assert/strict';
import { createComposition, appendToVibhag, insertPause } from '../js/model.js';
import { createManualDraft, manualCapture } from '../js/manual-timing.js';
import { resolveStrokeSamples, createPlaybackPlan, selectPlaybackVibhags, playbackCursor, playbackWindow, STROKE_SAMPLES } from '../js/playback-data.js';

const bol = tags => ({ id: 'test', text: 'Any label', tags });

test('audio is chosen only by stroke tags, including Hold and simultaneous hands', () => {
  for (const [tags, samples] of [
    [{ dayanArticulation: 'sur', rightHandFinger: '2' }, ['Ta']],
    [{ dayanArticulation: 'syahi', rightHandFinger: '3-and-4' }, ['Te']],
    [{ dayanArticulation: 'syahi', rightHandFinger: '2' }, ['Re']],
    [{ dayanArticulation: 'open-tin' }, ['Tin']],
    [{ dayanArticulation: 'open-tin', rightHandFinger: '3', membraneControl: 'right-4' }, ['Tin']],
    [{ dayanArticulation: 'kinar', rightHandFinger: '2' }, ['Na']],
    [{ dayanArticulation: 'syahi', rightHandFinger: '3', membraneControl: 'right-4' }, ['Ti']],
    [{ leftHandFinger: '2' }, ['Ghe']],
    [{ leftHandFinger: '4-and-3' }, ['Ghe']],
    [{ leftHandFinger: '1-5' }, ['Ke']],
    [{ dayanArticulation: 'kinar', rightHandFinger: '2', leftHandFinger: '4-and-3' }, ['Na', 'Ghe']],
  ]) {
    assert.deepEqual(resolveStrokeSamples(bol(tags)), { samples, unmapped: false });
  }
  assert.deepEqual(resolveStrokeSamples({ ...bol({}), text: 'Dha' }), { samples: [], unmapped: true });
  assert.deepEqual(resolveStrokeSamples(bol({ dayanArticulation: 'syahi', rightHandFinger: '3' })).samples, []);
  assert.deepEqual(resolveStrokeSamples(bol({ membraneControl: 'right-4' })).samples, []);
  assert.deepEqual(resolveStrokeSamples({ ...bol({ dayanArticulation: 'open-tin', leftHandFinger: '2' }), text: '—' }), { samples: [], unmapped: false });
  assert.equal(resolveStrokeSamples(bol({ rightHandFinger: '2', leftHandFinger: '2' })).unmapped, true);
});

test('notation playback respects subdivisions, pauses, empty vibhags, and never mutates the document', () => {
  let c = appendToVibhag(createComposition(), 'TeRe', 1);
  c = insertPause(c, c.bols[1].id, 'after');
  c = appendToVibhag(c, 'Misnamed', 3);
  c.bols.forEach(b => { b.tags.leftHandFinger = '1-5'; });
  const original = structuredClone(c);
  const plan = createPlaybackPlan(c);
  assert.equal(plan.totalMatras, 16);
  assert.equal(plan.timing, 'notation');
  assert.deepEqual(plan.events.map(e => [e.start, e.end]), [[0, 1 / 3], [1 / 3, 2 / 3], [8, 9]]);
  assert.deepEqual(c, original);
});

test('manual playback preserves independent ends and matching recordings follow optional snapping', () => {
  let c = appendToVibhag(createComposition(), 'TeRe', 1);
  c.bols.forEach(b => { b.tags.leftHandFinger = '2'; });
  const draft = createManualDraft(c); draft.intervals[0].end = .25;
  c.clapping = manualCapture(draft, c.bols);
  assert.equal(createPlaybackPlan(c).timing, 'manual');
  assert.equal(createPlaybackPlan(c).events[0].end, .25);
  c.clapping.snap = true;
  assert.equal(createPlaybackPlan(c).events[0].end, .5);
  c.clapping = { timestamps: [0, 300, 1600], structure: [4, 4, 4, 4], name: 'Tintal', snap: false };
  assert.equal(createPlaybackPlan(c).events[1].start, 3);
  c.clapping.timestamps[1] = 323;
  c.clapping.snap = true;
  assert.equal(createPlaybackPlan(c).events[1].start, 3);
  c.clapping.timestamps = [0, 1600];
  const fallback = createPlaybackPlan(c);
  assert.equal(fallback.fallback, true);
  assert.equal(fallback.events.length, 2);
  assert.equal(fallback.events[1].start, .5);
});

test('look-ahead windows loop without drifting, duplicates or phantom end-of-cycle hits', () => {
  const plan = { totalMatras: 2, events: [0, .5, 1.5].map(start => ({ start, end: start + .25, samples: ['Ke'] })) };
  const a = playbackWindow(plan, 0, 2), b = playbackWindow(plan, 2, 4);
  assert.deepEqual(a.map(e => e.beat), [0, .5, 1.5]);
  assert.deepEqual(b.map(e => e.beat), [2, 2.5, 3.5]);
  assert.deepEqual(playbackWindow(plan, 200, 202).map(e => e.beat), [200, 200.5, 201.5]);
  assert.deepEqual(playbackWindow(plan, 1.5, 2).map(e => e.beat), [1.5]);
  assert.equal(playbackWindow({ totalMatras: 4, events: [] }, 0, 1).length, 0);
  for (const [i, sample] of Object.values(STROKE_SAMPLES).entries()) {
    assert.ok(sample.offset >= i && sample.offset < i + .1);
    assert.ok(sample.duration > .8 && sample.offset + sample.duration < i + 1);
  }
});

test('practice loops concatenate selected vibhags, preserve pauses, and map back to original matras', () => {
  const base = { structure: [2, 3, 1, 2], totalMatras: 8, events: [
    { bolId: 'a', start: 0, end: .5, samples: ['Ta'] },
    { bolId: 'b', start: 2, end: 3, samples: ['Ghe'] },
    { bolId: 'c', start: 5.5, end: 6, samples: ['Ke'] },
    { bolId: 'd', start: 6, end: 8, samples: ['Tin'] },
  ] };
  const original = structuredClone(base);
  const plan = selectPlaybackVibhags(base, [2, 0, 2]);
  assert.equal(plan.totalMatras, 3);
  assert.deepEqual(plan.events.map(e => [e.bolId, e.start, e.end]), [['a', 0, .5], ['c', 2.5, 3]]);
  assert.deepEqual(playbackWindow(plan, 0, 6).map(e => [e.bolId, e.beat]), [['a', 0], ['c', 2.5], ['a', 3], ['c', 5.5]]);
  assert.deepEqual(playbackCursor(plan, 2.25), { phase: 2.25, vibhag: 2, matra: 5.25 });
  assert.deepEqual(playbackCursor(plan, 3.25), { phase: .25, vibhag: 0, matra: .25 });
  assert.equal(playbackCursor(plan, -1), null);
  const empty = selectPlaybackVibhags(base, []);
  assert.equal(empty.totalMatras, 0); assert.deepEqual(empty.events, []);
  assert.equal(playbackCursor(empty, 1), null); assert.deepEqual(playbackWindow(empty, 0, 10), []);
  assert.deepEqual(base, original);
});

test('practice selection clips crossing strokes but never retriggers them at adjacent selected rows', () => {
  const base = { structure: [2, 2, 2], totalMatras: 6,
    events: [{ bolId: 'held', start: 1, end: 5, samples: ['Tin', 'Ghe'] }] };
  assert.deepEqual(selectPlaybackVibhags(base, [0, 1, 2]).events, base.events);
  assert.deepEqual(selectPlaybackVibhags(base, [1]).events.map(e => [e.start, e.end]), [[0, 2]]);
  assert.deepEqual(selectPlaybackVibhags(base, [0, 2]).events.map(e => [e.start, e.end]), [[1, 2], [2, 3]]);
  const plan = selectPlaybackVibhags(base, [1, 2]);
  assert.equal(plan.events.length, 1);
  assert.deepEqual([plan.events[0].start, plan.events[0].end], [0, 3]);
  assert.deepEqual(playbackCursor(plan, 2.5), { phase: 2.5, vibhag: 2, matra: 4.5 });
});
