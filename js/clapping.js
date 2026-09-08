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

const svgNode = (tag, attrs = {}, text) => {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  return node;
};

export function renderClapPlot(container, result) {
  const { totalMatras, structure, hits, duration } = result;
  const width = Math.max(760, totalMatras * 40 + 64);
  const start = 32, end = width - 32, top = 70, baseline = 166;
  const x = matra => start + matra / totalMatras * (end - start);
  const svg = svgNode('svg', { viewBox: `0 0 ${width} 260`, role: 'img', 'aria-labelledby': 'clap-plot-title clap-plot-description', class: 'clap-plot' });
  svg.append(svgNode('title', { id: 'clap-plot-title' }, 'Claps over one tala cycle'));
  svg.append(svgNode('desc', { id: 'clap-plot-description' }, `${hits.length} hits over ${(duration / 1000).toFixed(2)} seconds. ${totalMatras} equal matras grouped ${structure.join(', ')}. The last tap marks the next sam and is excluded from the hit count.`));
  let offset = 0;
  structure.forEach((length, i) => {
    svg.append(svgNode('rect', { x: x(offset), y: top, width: x(offset + length) - x(offset), height: 130, fill: i % 2 ? '#f8f0fb' : '#f0f4ff' }));
    svg.append(svgNode('text', { x: x(offset + length / 2), y: 35, 'text-anchor': 'middle', class: 'clap-vibhag-label' }, `V${i + 1} · ${length}`));
    offset += length;
  });
  for (let m = 0; m <= totalMatras; m++) {
    svg.append(svgNode('line', { x1: x(m), x2: x(m), y1: top, y2: 200, class: 'clap-matra-line' }));
    if (m < totalMatras) svg.append(svgNode('text', { x: x(m + .5), y: 224, 'text-anchor': 'middle', class: 'clap-matra-label' }, m + 1));
  }
  offset = 0;
  for (const length of [...structure, 0]) {
    svg.append(svgNode('line', { x1: x(offset), x2: x(offset), y1: top - 10, y2: 200, class: 'clap-vibhag-line' }));
    offset += length;
  }
  svg.append(svgNode('line', { x1: start, x2: end, y1: baseline, y2: baseline, class: 'clap-baseline' }));
  // Nearby hits occupy separate visual lanes while retaining their exact time/x.
  const laneEnds = [];
  hits.forEach(hit => {
    const px = x(hit.matra);
    let lane = laneEnds.findIndex(previous => px - previous >= 16);
    if (lane < 0) lane = laneEnds.length;
    laneEnds[lane] = px;
    const py = baseline - Math.min(lane, 7) * 11;
    const dot = svgNode('circle', { cx: px, cy: py, r: 5, class: 'clap-hit' });
    dot.append(svgNode('title', {}, `Clap ${hit.index}: ${(hit.elapsed / 1000).toFixed(3)} s · matra ${(hit.matra + 1).toFixed(2)}`));
    svg.append(dot);
  });
  svg.append(svgNode('circle', { cx: end, cy: baseline, r: 7, class: 'clap-endpoint' }));
  svg.append(svgNode('text', { x: start, y: 58, class: 'clap-sam-label' }, 'sam'));
  svg.append(svgNode('text', { x: end, y: 58, 'text-anchor': 'end', class: 'clap-sam-label' }, 'next sam'));
  container.replaceChildren(svg);
  container.style.setProperty('--clap-plot-width', `${width}px`);
}

export function setupClapping(getComposition) {
  const startButton = document.querySelector('#start-clapping');
  const clapButton = document.querySelector('#clap');
  const status = document.querySelector('#clap-status');
  const resultPanel = document.querySelector('#clap-result');
  let recording = false, times = [], structure = [], name = '';
  const setIdle = () => {
    recording = false; startButton.textContent = 'Start clapping';
    startButton.setAttribute('aria-pressed', 'false'); clapButton.disabled = true;
  };
  startButton.addEventListener('click', () => {
    if (recording) {
      setIdle();
      try {
        const result = analyzeClaps(times, structure);
        renderClapPlot(document.querySelector('#clap-plot-container'), result);
        document.querySelector('#clap-summary').textContent = `${name} · ${structure.join('–')} · ${result.totalMatras} matras · ${result.hits.length} claps · ${(result.duration / 1000).toFixed(2)} s`;
        resultPanel.hidden = false;
        status.textContent = 'Done. The final clap marks the next sam; it is not counted as a hit. Start again to record another cycle.';
      } catch (error) { status.textContent = error.message; }
      return;
    }
    const composition = getComposition();
    if (!composition.vibhagStructure.length) { status.textContent = 'Set a vibhag structure above before clapping.'; return; }
    structure = [...composition.vibhagStructure]; name = composition.talaName || 'Custom tala';
    times = []; recording = true; resultPanel.hidden = true;
    startButton.textContent = 'Stop clapping'; startButton.setAttribute('aria-pressed', 'true');
    clapButton.disabled = false;
    status.textContent = `Ready · ${name} ${structure.join('–')}. First clap starts the clock. Finish with the next sam, then stop.`;
  });
  const record = () => {
    if (!recording) return;
    if (times.length >= 4096) { status.textContent = 'Recording limit reached. Press Stop clapping.'; return; }
    const now = performance.now();
    if (times.length && now <= times.at(-1)) return;
    times.push(now);
    status.textContent = times.length === 1 ? '1 clap · sam. Clock started.' : `${times.length} claps · ${((now - times[0]) / 1000).toFixed(2)} s since sam. Finish on the next sam, then stop.`;
    clapButton.animate([{ backgroundColor: '#d5b0e5' }, { backgroundColor: '#ffe47b' }], { duration: 130 });
  };
  clapButton.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0 || clapButton.disabled) return;
    event.preventDefault(); record();
  });
  clapButton.addEventListener('keydown', event => {
    if (event.key !== ' ' && event.key !== 'Enter') return;
    event.preventDefault(); if (!event.repeat) record();
  });
  // Assistive technology may activate a button without pointer or keyboard events.
  clapButton.addEventListener('click', event => { if (event.detail === 0) record(); });
  return { reset() { setIdle(); times = []; resultPanel.hidden = true; document.querySelector('#clap-plot-container').replaceChildren(); status.textContent = 'Start, then tap Clap from sam to the next sam.'; } };
}
