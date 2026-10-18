import { clapDisplay, validateClapCapture } from './clap-data.js';

const groupBy = (items, key) => {
  const groups = new Map();
  for (const item of items) {
    const value = key(item);
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(item);
  }
  return [...groups.values()];
};

export function notatedTimings(composition) {
  const structure = composition.vibhagStructure;
  if (!structure.length || !composition.bols.length) throw new Error('Add bols and set a vibhag structure first.');
  const offsets = [0];
  for (const length of structure) offsets.push(offsets.at(-1) + length);
  const intervals = [];
  for (const matra of groupBy(composition.bols, b => `${b.position.vibhag}:${b.position.matra}`)) {
    const { vibhag, matra: number } = matra[0].position;
    if (vibhag > structure.length || number > structure[vibhag - 1]) throw new Error('Some bols exceed the configured cycle. Adjust the vibhag structure first.');
    const base = offsets[vibhag - 1] + number - 1;
    const submatras = groupBy(matra, b => b.position.subMatra);
    submatras.forEach((sub, i) => {
      const leaves = groupBy(sub, b => b.position.subSubMatra);
      leaves.forEach((leaf, j) => leaf.forEach((bol, k) => {
        const span = 1 / submatras.length / leaves.length / leaf.length;
        const start = base + i / submatras.length + j / submatras.length / leaves.length + k * span;
        intervals.push({ bolId: bol.id, start, end: start + span });
      }));
    });
  }
  return intervals;
}

export function createManualDraft(composition, fromNotation = false) {
  const intervals = notatedTimings(composition);
  const structure = [...composition.vibhagStructure];
  const totalMatras = structure.reduce((a, b) => a + b, 0);
  const capture = composition.clapping;
  const draft = { structure, intervals, totalMatras, duration: totalMatras * 500,
    name: composition.talaName || 'Custom tala', notice: 'Initial layout follows the notated matras, including pauses.' };
  if (fromNotation || !capture) return draft;
  draft.duration = capture.timestamps.at(-1);
  if (JSON.stringify(structure) !== JSON.stringify(capture.structure)) {
    draft.notice = 'Recording uses a different structure. Initial layout follows the current notation.';
    return draft;
  }
  if (capture.manualTimings && capture.manualTimings.length === intervals.length
    && capture.manualTimings.every((t, i) => t.bolId === intervals[i].bolId)) {
    draft.intervals = capture.manualTimings.map(t => ({ ...t }));
    draft.notice = 'Editing your saved manual timeline.';
    return draft;
  }
  const sounds = composition.bols.map((b, i) => b.text === '—' ? -1 : i).filter(i => i >= 0);
  const result = clapDisplay({ ...capture, snap: false }, composition.bols);
  if (capture.manualTimings || sounds.length !== result.hits.length || sounds[0] !== 0) {
    draft.notice = `Recording has ${result.hits.length} hits for ${sounds.length} sounding bols. Initial layout follows notation so every bol is included.`;
    return draft;
  }
  // Preserve the raw recorded onsets. Pauses following a sounding bol divide
  // that interval in the same proportions as their notated durations.
  sounds.forEach((index, i) => {
    const next = sounds[i + 1] ?? intervals.length;
    const entries = intervals.slice(index, next);
    const weights = entries.map(t => t.end - t.start);
    const sum = weights.reduce((a, b) => a + b, 0);
    let start = result.hits[i].matra;
    const end = result.hits[i + 1]?.matra ?? totalMatras;
    entries.forEach((t, j) => {
      const length = weights[j] / sum * (end - result.hits[i].matra);
      draft.intervals[index + j] = { bolId: t.bolId, start, end: start + length };
      start += length;
    });
  });
  draft.notice = 'Initial layout follows the original recorded timings. Snap applies when you edit.';
  return draft;
}

export function moveManualTiming(intervals, index, part, value, total, snap = true, linkEdges = false) {
  const current = intervals[index];
  const before = intervals[index - 1], after = intervals[index + 1];
  const linkedBefore = linkEdges && before && Math.abs(before.end - current.start) < 1e-6;
  const linkedAfter = linkEdges && after && Math.abs(after.start - current.end) < 1e-6;
  const previous = linkedBefore ? before.start + Math.min(.01, before.end - before.start) : before?.end ?? 0;
  const next = linkedAfter ? after.end - Math.min(.01, after.end - after.start) : after?.start ?? total;
  const length = current.end - current.start;
  const minimum = Math.min(.01, length);
  const clamp = (number, min, max) => {
    if (!Number.isFinite(number)) return null;
    if (snap) {
      const low = Math.ceil((min - 1e-7) * 4) / 4;
      const high = Math.floor((max + 1e-7) * 4) / 4;
      if (low <= high) return Math.max(low, Math.min(high, Math.round(number * 4) / 4)) || 0;
    }
    return Math.max(min, Math.min(max, number));
  };
  let updated;
  if (part === 'move') {
    const start = clamp(value, previous, next - length);
    if (start === null) return intervals;
    updated = { ...current, start, end: start + length };
  } else if (part === 'start') {
    const start = clamp(value, previous, current.end - minimum);
    if (start === null) return intervals;
    updated = { ...current, start };
  } else {
    const end = clamp(value, current.start + minimum, next);
    if (end === null) return intervals;
    updated = { ...current, end };
  }
  return intervals.map((entry, i) => {
    if (i === index) return updated;
    if (linkedBefore && i === index - 1 && part !== 'end') return { ...entry, end: updated.start };
    if (linkedAfter && i === index + 1 && part !== 'start') return { ...entry, start: updated.end };
    return entry;
  });
}

export function manualCapture(draft, bols) {
  const sounding = new Set(bols.filter(b => b.text !== '—').map(b => b.id));
  const starts = draft.intervals.filter(t => sounding.has(t.bolId)).map(t => t.start / draft.totalMatras * draft.duration);
  const timestamps = [...new Set([0, ...starts, draft.duration])];
  return validateClapCapture({ name: draft.name, structure: draft.structure, snap: false,
    timestamps: timestamps.length <= 4096 ? timestamps : [0, draft.duration], manualTimings: draft.intervals });
}
