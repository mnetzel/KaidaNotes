import { bolColor } from './tags.js';
// Timings belong to one measured cycle, independent of notation editing.
export function analyzeClaps(timestamps, structure) {
  if (!structure.length || structure.some(n => !Number.isSafeInteger(n) || n < 1)) throw new Error('Set a vibhag structure before clapping.');
  if (timestamps.length < 2) throw new Error('Tap the first sam and the next sam before stopping (at least two claps).');
  if (timestamps.some((t, i) => !Number.isFinite(t) || (i > 0 && t <= timestamps[i - 1]))) throw new Error('Clap timings must increase. Please record again.');
  const totalMatras = structure.reduce((sum, n) => sum + n, 0);
  const duration = timestamps.at(-1) - timestamps[0];
  return {
    structure: [...structure], totalMatras, duration,
    // The final tap closes the interval. It is not a plotted rhythmic hit.
    hits: timestamps.slice(0, -1).map((t, index) => ({ index: index + 1, elapsed: t - timestamps[0], matra: (t - timestamps[0]) / duration * totalMatras })),
  };
}

export function validateClapCapture(raw) {
  if (!raw || !Array.isArray(raw.timestamps) || raw.timestamps.length > 4096 || raw.timestamps[0] !== 0 ||
      !Array.isArray(raw.structure) || raw.structure.length > 128 || raw.structure.some(n => n > 128) ||
      typeof raw.name !== 'string' || raw.name.length > 120 || typeof raw.snap !== 'boolean') throw new Error('Invalid clap recording');
  analyzeClaps(raw.timestamps, raw.structure);
  const total = raw.structure.reduce((a, b) => a + b, 0);
  if (raw.manualTimings !== undefined) {
    if (!Array.isArray(raw.manualTimings) || raw.manualTimings.length > 10000) throw new Error('Invalid manual timeline');
    const ids = new Set();
    let end = 0;
    for (const timing of raw.manualTimings) {
      if (!timing || typeof timing.bolId !== 'string' || !timing.bolId || ids.has(timing.bolId)
        || !Number.isFinite(timing.start) || !Number.isFinite(timing.end)
        || timing.start < 0 || timing.start < end - 1e-6 || timing.end <= timing.start || timing.end > total + 1e-6) throw new Error('Invalid manual timeline');
      ids.add(timing.bolId); end = timing.end;
    }
  }
  return { timestamps: [...raw.timestamps], structure: [...raw.structure], name: raw.name, snap: raw.snap,
    ...(raw.manualTimings !== undefined ? { manualTimings: raw.manualTimings.map(({ bolId, start, end }) => ({ bolId, start, end })) } : {}) };
}

export function clapDisplay(capture, bols = []) {
  const soundingBols = bols.filter(bol => bol.text.trim() && bol.text !== '—');
  const result = analyzeClaps(capture.timestamps, capture.structure);
  if (capture.manualTimings) {
    const byId = new Map(soundingBols.map(b => [b.id, b]));
    const snap = value => capture.snap ? Math.round(value * 2) / 2 : value;
    return { ...result, snap: capture.snap, hits: capture.manualTimings.filter(t => byId.has(t.bolId)).map((t, index) => {
      const bol = byId.get(t.bolId);
      return { index: index + 1, bolId: bol.id, elapsed: t.start / result.totalMatras * result.duration,
        matra: snap(t.start), endMatra: snap(t.end), label: bol.text, color: bolColor(bol) || '#141018',
        hands: ['right', 'left'].filter(hand => bol.tags?.[hand + 'HandFinger']) };
    }) };
  }
  return { ...result, snap: capture.snap, hits: result.hits.map(hit => ({ ...hit,
    bolId: soundingBols[hit.index - 1]?.id,
    label: soundingBols[hit.index - 1]?.text || '',
    color: bolColor(soundingBols[hit.index - 1]) || '#141018',
    hands: ['right', 'left'].filter(hand => soundingBols[hit.index - 1]?.tags?.[hand + 'HandFinger']),
    matra: capture.snap ? Math.round(hit.matra * 2) / 2 : hit.matra,
  })) };
}


// Manual intervals have explicit ends; recorded hits last until the next onset.
export function clapBlocks(result) {
  return result.hits.map((hit, index) => ({
    ...hit, endMatra: hit.endMatra ?? result.hits[index + 1]?.matra ?? result.totalMatras,
  }));
}

export function blocksInRange(blocks, start, end, last = false) {
  return blocks.filter(hit => hit.endMatra > start && hit.matra < end ||
    hit.endMatra === hit.matra && hit.matra >= start && (hit.matra < end || last && hit.matra === end))
    .map(hit => ({ ...hit, matra: Math.max(start, hit.matra) - start,
      endMatra: Math.min(end, hit.endMatra) - start }));
}
