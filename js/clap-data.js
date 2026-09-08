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
  return { timestamps: [...raw.timestamps], structure: [...raw.structure], name: raw.name, snap: raw.snap };
}

export function clapDisplay(capture) {
  const result = analyzeClaps(capture.timestamps, capture.structure);
  return { ...result, snap: capture.snap, hits: result.hits.map(hit => ({ ...hit,
    matra: capture.snap ? Math.round(hit.matra * 2) / 2 : hit.matra,
  })) };
}
