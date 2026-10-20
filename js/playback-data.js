import { notatedTimings } from './manual-timing.js';
import { clapDisplay } from './clap-data.js';

// One eight-second WAV. Offset each one-second slot to align the attacks.
// Keep a few milliseconds before the transient and exclude the next slot.
export const STROKE_SAMPLES = Object.fromEntries(
  ['Ta', 'Te', 'Re', 'Tin', 'Na', 'Ti', 'Ghe', 'Ke'].map((name, slot) => {
    const trim = [.014, .028, .022, .008, .042, .014, .040, .016][slot];
    return [name, { offset: slot + trim, duration: 1 - trim - .001 }];
  }),
);

export function resolveStrokeSamples(bol) {
  if (bol.text.trim() === '—') return { samples: [], unmapped: false };
  const tags = bol.tags || {};
  const finger = tags.rightHandFinger, zone = tags.dayanArticulation;
  let right;
  if (zone === 'open-tin') right = 'Tin';
  else if (zone === 'sur' && finger === '2') right = 'Ta';
  else if (zone === 'kinar' && finger === '2') right = 'Na';
  else if (zone === 'syahi' && finger === '3-and-4') right = 'Te';
  else if (zone === 'syahi' && finger === '2') right = 'Re';
  else if (zone === 'syahi' && finger === '3' && tags.membraneControl === 'right-4') right = 'Ti';
  const left = tags.leftHandFinger === '1-5' ? 'Ke'
    : ['2', '4-and-3'].includes(tags.leftHandFinger) ? 'Ghe' : undefined;
  const samples = [right, left].filter(Boolean);
  return { samples, unmapped: !samples.length || !!((finger || zone) && !right) || !!(tags.leftHandFinger && !left) };
}

export function createPlaybackPlan(composition) {
  const sounding = composition.bols.filter(b => b.text.trim() && b.text.trim() !== '—');
  const byId = new Map(composition.bols.map(b => [b.id, b]));
  const capture = composition.clapping;
  let intervals, structure, timing, fallback = false;
  if (capture?.manualTimings) {
    structure = capture.structure; timing = 'manual';
    const snap = value => capture.snap ? Math.round(value * 2) / 2 : value;
    intervals = capture.manualTimings.map(t => ({ bolId: t.bolId, start: snap(t.start), end: snap(t.end) }));
  } else if (capture && capture.timestamps.length - 1 === sounding.length) {
    structure = capture.structure; timing = 'clapping';
    const result = clapDisplay(capture, composition.bols);
    intervals = result.hits.map((hit, i) => ({ bolId: sounding[i].id, start: hit.matra,
      end: result.hits[i + 1]?.matra ?? result.totalMatras }));
  } else {
    structure = composition.vibhagStructure; timing = 'notation';
    intervals = notatedTimings(composition);
    fallback = !!capture;
  }
  const totalMatras = structure.reduce((a, b) => a + b, 0);
  const timedIds = new Set(intervals.map(t => t.bolId));
  const unmapped = sounding.filter(b => resolveStrokeSamples(b).unmapped).length;
  const untimed = sounding.filter(b => !timedIds.has(b.id)).length;
  const events = intervals.flatMap(t => {
    const bol = byId.get(t.bolId);
    if (!bol || t.start < 0 || t.start >= totalMatras) return [];
    const { samples } = resolveStrokeSamples(bol);
    return samples.length ? [{ bolId: bol.id, start: t.start, end: Math.min(totalMatras, t.end), samples }] : [];
  }).sort((a, b) => a.start - b.start);
  return { events, intervals, structure: [...structure], totalMatras, timing, fallback, unmapped, untimed };
}

// Compress chosen vibhags into a practice cycle without editing saved timings.
// Adjacent chosen rows form one run, so a held bol crossing them is not retriggered.
export function selectPlaybackVibhags(base, selected, gapMatras = 0) {
  const chosen = new Set(selected);
  const segments = [], runs = [];
  let sourceStart = 0, totalMatras = 0;
  base.structure.forEach((length, index) => {
    if (chosen.has(index)) {
      const segment = { index, sourceStart, sourceEnd: sourceStart + length, start: totalMatras, end: totalMatras + length };
      segments.push(segment);
      const previous = runs.at(-1);
      if (previous?.sourceEnd === sourceStart) {
        previous.sourceEnd += length; previous.end += length;
      } else runs.push({ ...segment });
      totalMatras += length;
    }
    sourceStart += length;
  });
  const events = runs.flatMap(run => base.events.flatMap(event => {
    const start = Math.max(event.start, run.sourceStart), end = Math.min(event.end, run.sourceEnd);
    if (end < start || event.start >= run.sourceEnd || event.end <= run.sourceStart && event.end !== event.start) return [];
    return [{ ...event, start: run.start + start - run.sourceStart, end: run.start + end - run.sourceStart }];
  })).sort((a, b) => a.start - b.start);
  return { ...base, events, totalMatras, segments, gapMatras, cycleMatras: totalMatras ? totalMatras + gapMatras : 0 };
}

export function playbackCursor(plan, beat) {
  if (beat < 0 || !plan.totalMatras) return null;
  const phase = beat % plan.cycleMatras;
  if (phase >= plan.totalMatras) return null; // Silent space between repetitions.
  const segment = plan.segments.find(row => row.start <= phase && phase < row.end);
  return { phase, vibhag: segment.index, matra: segment.sourceStart + phase - segment.start };
}

// Half-open scheduling windows avoid duplicate hits at loop/look-ahead borders.
export function playbackWindow(plan, from, until) {
  if (until <= from || !plan.events.length) return [];
  const events = [];
  const cycle = plan.cycleMatras ?? plan.totalMatras;
  const first = Math.max(0, Math.floor(from / cycle));
  const last = Math.floor(until / cycle);
  for (let loop = first; loop <= last; loop++) {
    for (const event of plan.events) {
      const beat = loop * cycle + event.start;
      if (beat >= from && beat < until) events.push({ ...event, beat });
    }
  }
  return events;
}
