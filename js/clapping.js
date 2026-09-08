import { analyzeClaps, clapDisplay } from './clap-data.js';
export { analyzeClaps } from './clap-data.js';

const svgNode = (tag, attrs = {}, text) => {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  return node;
};

export function renderClapPlot(container, result) {
  const { totalMatras, structure, hits, duration } = result;
  const width = Math.max(760, totalMatras * 40 + 64);
  const start = 32, end = width - 32, top = 70;
  const x = matra => start + matra / totalMatras * (end - start);
  // Reserve enough horizontal space for each label; coincident hits stack vertically.
  const laneEnds = [];
  const plotted = hits.map(hit => {
    const px = x(hit.matra);
    const halfWidth = Math.max(8, (hit.label || '').length * 6 + 4);
    const labelX = Math.max(halfWidth, Math.min(width - halfWidth, px));
    let lane = laneEnds.findIndex(previous => labelX - halfWidth >= previous + 6);
    if (lane < 0) lane = laneEnds.length;
    laneEnds[lane] = labelX + halfWidth;
    return { hit, px, labelX, lane };
  });
  const baseline = 166 + Math.max(0, laneEnds.length - 2) * 30;
  const gridBottom = baseline + 34;
  const svg = svgNode('svg', { viewBox: `0 0 ${width} ${baseline + 94}`, role: 'img', 'aria-labelledby': 'clap-plot-title clap-plot-description', class: 'clap-plot' });
  svg.append(svgNode('title', { id: 'clap-plot-title' }, 'Claps over one tala cycle'));
  svg.append(svgNode('desc', { id: 'clap-plot-description' }, `${hits.length} hits over ${(duration / 1000).toFixed(2)} seconds. ${totalMatras} equal matras grouped ${structure.join(', ')}. The last tap marks the next sam and is excluded from the hit count.`));
  let offset = 0;
  structure.forEach((length, i) => {
    svg.append(svgNode('rect', { x: x(offset), y: top, width: x(offset + length) - x(offset), height: gridBottom - top, fill: i % 2 ? '#f8f0fb' : '#f0f4ff' }));
    svg.append(svgNode('text', { x: x(offset + length / 2), y: 35, 'text-anchor': 'middle', class: 'clap-vibhag-label' }, `V${i + 1} · ${length}`));
    offset += length;
  });
  for (let m = 0; m <= totalMatras; m++) {
    svg.append(svgNode('line', { x1: x(m), x2: x(m), y1: top, y2: gridBottom, class: 'clap-matra-line' }));
    if (m < totalMatras) svg.append(svgNode('text', { x: x(m + .5), y: gridBottom + 24, 'text-anchor': 'middle', class: 'clap-matra-label' }, m + 1));
  }
  if (result.snap) {
    for (let q = 1; q < totalMatras * 2; q++) if (q % 2) svg.append(svgNode('line', { x1: x(q / 2), x2: x(q / 2), y1: top, y2: gridBottom, class: 'clap-half-line' }));
  }
  offset = 0;
  for (const length of [...structure, 0]) {
    svg.append(svgNode('line', { x1: x(offset), x2: x(offset), y1: top - 10, y2: gridBottom, class: 'clap-vibhag-line' }));
    offset += length;
  }
  svg.append(svgNode('line', { x1: start, x2: end, y1: baseline, y2: baseline, class: 'clap-baseline' }));
  plotted.forEach(({ hit, px, labelX, lane }) => {
    const py = baseline - lane * 30 - (hit.matra === totalMatras ? 12 : 0);
    const dot = svgNode('circle', { cx: px, cy: py, r: 5, class: 'clap-hit' });
    dot.append(svgNode('title', {}, `Clap ${hit.index}${hit.label ? ': ' + hit.label : ''}: ${(hit.elapsed / 1000).toFixed(3)} s · ${result.snap ? 'snapped ' : ''}matra ${(hit.matra + 1).toFixed(2)}`));
    svg.append(dot);
    if (hit.label) svg.append(svgNode('text', { x: labelX, y: py - 11, 'text-anchor': 'middle', class: 'clap-bol-label' }, hit.label));
  });
  svg.append(svgNode('circle', { cx: end, cy: baseline, r: 7, class: 'clap-endpoint' }));
  svg.append(svgNode('text', { x: start, y: 58, class: 'clap-sam-label' }, 'sam'));
  svg.append(svgNode('text', { x: end, y: 58, 'text-anchor': 'end', class: 'clap-sam-label' }, 'next sam'));
  container.replaceChildren(svg);
  container.style.setProperty('--clap-plot-width', `${width}px`);
}

export function setupClapping(getComposition, updateComposition) {
  const startButton = document.querySelector('#start-clapping');
  const clapButton = document.querySelector('#clap');
  const status = document.querySelector('#clap-status');
  const resultPanel = document.querySelector('#clap-result');
  const snapButton = document.querySelector('#clap-snap');
  let lastCapture, lastBols;
  let recording = false, times = [], structure = [], name = '';
  const setIdle = () => {
    recording = false; startButton.textContent = 'Start clapping';
    startButton.setAttribute('aria-pressed', 'false'); clapButton.disabled = true;
  };
  const sync = () => {
    const { clapping: capture, bols } = getComposition();
    if (capture === lastCapture && (bols === lastBols || recording)) return;
    if (capture !== lastCapture) setIdle();
    lastCapture = capture; lastBols = bols;
    if (!capture) { resultPanel.hidden = true; document.querySelector('#clap-plot-container').replaceChildren(); return; }
    const result = clapDisplay(capture, bols);
    renderClapPlot(document.querySelector('#clap-plot-container'), result);
    document.querySelector('#clap-summary').textContent = `${capture.name} · ${capture.structure.join('–')} · ${result.totalMatras} matras · ${result.hits.length} claps · ${(result.duration / 1000).toFixed(2)} s · ${capture.snap ? 'Snap ½ matra' : 'Original timing'}`;
    snapButton.setAttribute('aria-pressed', String(capture.snap));
    resultPanel.hidden = false;
    status.textContent = 'Final clap = next sam (end only). This recording is included in your Kaida link.';
  };
  snapButton.addEventListener('click', () => {
    if (recording || !getComposition().clapping) return;
    updateComposition(c => ({ ...c, clapping: { ...c.clapping, snap: !c.clapping.snap } }));
    sync();
  });
  startButton.addEventListener('click', () => {
    if (recording) {
      setIdle();
      try {
        analyzeClaps(times, structure);
        const capture = { timestamps: times.map(t => t - times[0]), structure: [...structure], name, snap: false };
        updateComposition(c => ({ ...c, clapping: capture }));
        sync();
      } catch (error) {
        if (getComposition().clapping) { lastCapture = undefined; sync(); }
        status.textContent = error.message + (getComposition().clapping ? ' Previous recording kept.' : '');
      }
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
  sync();
  return { sync, reset() { setIdle(); times = []; resultPanel.hidden = true; document.querySelector('#clap-plot-container').replaceChildren(); status.textContent = 'Start, then tap Clap from sam to the next sam.'; } };
}
