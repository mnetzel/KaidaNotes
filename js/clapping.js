import { analyzeClaps, clapDisplay, clapBlocks, blocksInRange } from './clap-data.js';
export { analyzeClaps } from './clap-data.js';

const svgNode = (tag, attrs = {}, text) => {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  return node;
};

export function renderClapPlot(container, result, byVibhag = false, blocks = false) {
  container.classList.toggle('blocks-view', blocks);
  if (blocks && !result.blockIntervals) result = { ...result, hits: clapBlocks(result), blockIntervals: true };
  if (byVibhag) {
    let offset = 0;
    const rows = result.structure.map((length, index) => {
      const row = document.createElement('div');
      row.className = 'clap-vibhag-row';
      const last = index === result.structure.length - 1;
      const hits = blocks ? blocksInRange(result.hits, offset, offset + length, last) : result.hits.filter(hit => hit.matra >= offset && (hit.matra < offset + length || (last && hit.matra === offset + length)))
        .map(hit => ({ ...hit, matra: hit.matra - offset }));
      renderClapPlot(row, { ...result, structure: [length], totalMatras: length, hits,
        rowIndex: index, matraOffset: offset, scaleMatras: Math.max(...result.structure), first: index === 0, last }, false, blocks);
      offset += length;
      return row;
    });
    container.replaceChildren(...rows);
    return;
  }
  const { totalMatras, structure, hits, duration } = result;
  const width = Math.max(760, (result.scaleMatras || totalMatras) * 40 + 64);
  const start = 32, end = width - 32, top = blocks ? 8 : 70;
  const x = matra => start + matra / (result.scaleMatras || totalMatras) * (end - start);
  const rowEnd = x(totalMatras);
  const stacked = result.rowIndex !== undefined;
  const suffix = result.rowIndex === undefined ? '' : '-' + result.rowIndex;
  const baseline = blocks ? 122 : 246;
  const handY = { right: blocks ? 44 : 146, left: baseline, unassigned: blocks ? 83 : 196 };
  const gridBottom = baseline + (blocks ? 36 : 34);
  const paddingX = 48, paddingY = blocks ? 0 : 24;
  const viewHeight = blocks ? gridBottom + 36 : baseline + 94 + paddingY * 2;
  const svg = svgNode('svg', { viewBox: `-${paddingX} -${paddingY} ${width + paddingX * 2} ${viewHeight}`, role: 'img', 'aria-labelledby': `clap-plot-title${suffix} clap-plot-description${suffix}`, class: 'clap-plot' });
  svg.append(svgNode('title', { id: 'clap-plot-title' + suffix }, 'Claps over one tala cycle'));
  svg.append(svgNode('desc', { id: 'clap-plot-description' + suffix }, `${hits.length} hits over ${(duration / 1000).toFixed(2)} seconds. ${totalMatras} equal matras grouped ${structure.join(', ')}. The last tap marks the next sam and is excluded from the hit count.`));
  let offset = 0;
  structure.forEach((length, i) => {
    svg.append(svgNode('rect', { x: x(offset), y: top, width: x(offset + length) - x(offset), height: gridBottom - top, fill: i % 2 ? '#f8f0fb' : '#f0f4ff' }));
    if (!blocks) svg.append(svgNode('text', { x: x(offset + length / 2), y: 35, 'text-anchor': 'middle', class: 'clap-vibhag-label' }, `V${(result.rowIndex ?? i) + 1} · ${length}`));
    offset += length;
  });
  for (let m = 0; m <= totalMatras; m++) {
    svg.append(svgNode('line', { x1: x(m), x2: x(m), y1: top, y2: gridBottom, class: 'clap-matra-line' }));
    if (m < totalMatras) svg.append(svgNode('text', { x: x(m + .5), y: gridBottom + 24, 'text-anchor': 'middle', class: 'clap-matra-label' }, m + 1 + (result.matraOffset || 0)));
  }
  if (result.snap) {
    for (let q = 1; q < totalMatras * 2; q++) if (q % 2) svg.append(svgNode('line', { x1: x(q / 2), x2: x(q / 2), y1: top, y2: gridBottom, class: 'clap-half-line' }));
  }
  offset = 0;
  for (const length of [...structure, 0]) {
    svg.append(svgNode('line', { x1: x(offset), x2: x(offset), y1: blocks ? top : top - 10, y2: gridBottom, class: 'clap-vibhag-line' }));
    offset += length;
  }
  for (const [hand, label] of [['right', 'Dayan · right'], ['left', 'Bayan · left']]) {
    const py = handY[hand];
    svg.append(svgNode('line', { x1: start, x2: rowEnd, y1: py, y2: py, class: 'clap-baseline', 'data-hand': hand }));
    if (!blocks) svg.append(svgNode('text', { x: start, y: py - (stacked ? 72 : 36), class: 'clap-hand-label' }, label));
    if (!blocks && result.last !== false) svg.append(svgNode('circle', { cx: rowEnd, cy: py, r: 7, class: 'clap-endpoint' }));
  }
  if (blocks) hits.forEach(hit => {
    const hands = hit.hands?.length ? hit.hands : ['unassigned'];
    const both = hands.includes('right') && hands.includes('left');
    const height = both ? handY.left - handY.right + 72 : 72;
    const py = both ? handY.right - 36 : handY[hands[0]] - 36;
    const left = x(hit.matra), right = x(hit.endMatra);
    const gap = Math.min(3, Math.max(0, right - left) / 8);
    const blockWidth = Math.max(2, right - left - gap * 2);
    const rect = svgNode('rect', { x: left + gap, y: py, width: blockWidth, height,
      rx: 3, class: 'clap-block', 'data-hands': hands.join(' '), 'data-clap': hit.index });
    rect.style.fill = hit.color || '#141018';
    rect.append(svgNode('title', {}, `${hit.label || 'Clap ' + hit.index} · ${hands.join(' + ')} · ${(hit.endMatra - hit.matra).toFixed(2)} matras${hit.endMatra === hit.matra ? ' (coincident after Snap)' : ''}`));
    svg.append(rect);
    if (hit.label && blockWidth >= 10) {
      const fontSize = Math.min(stacked ? 34 : 22, (blockWidth - 6) / (hit.label.length * .65));
      svg.append(svgNode('text', { x: left + gap + blockWidth / 2, y: py + height / 2,
        'text-anchor': 'middle', 'dominant-baseline': 'central', class: 'clap-block-label',
        style: `font-size: ${Math.max(1, fontSize)}px` }, hit.label));
    }
  });
  else hits.forEach(hit => {
    const hands = hit.hands?.length ? hit.hands : ['unassigned'];
    for (const hand of hands) {
      const px = x(hit.matra), py = handY[hand];
      const dot = svgNode('circle', { cx: px, cy: py, r: stacked ? 16 : 8, class: 'clap-hit' + (hand === 'unassigned' ? ' clap-hit-unassigned' : ''), 'data-hand': hand });
      dot.style.fill = hit.color || '#141018';
      dot.append(svgNode('title', {}, `Clap ${hit.index}${hit.label ? ': ' + hit.label : ''} · ${hand === 'unassigned' ? 'hand not marked' : hand + ' hand'} · ${(hit.elapsed / 1000).toFixed(3)} s · ${result.snap ? 'snapped ' : ''}matra ${(hit.matra + 1 + (result.matraOffset || 0)).toFixed(2)}`));
      svg.append(dot);
      if (hit.label) svg.append(svgNode('text', { x: px, y: py - (stacked ? 30 : 15), 'text-anchor': 'middle', class: 'clap-bol-label' }, hit.label));
    }
  });
  if (!blocks && result.first !== false) svg.append(svgNode('text', { x: start, y: 58, class: 'clap-sam-label' }, 'sam'));
  if (!blocks && result.last !== false) svg.append(svgNode('text', { x: rowEnd, y: 58, 'text-anchor': 'end', class: 'clap-sam-label' }, 'next sam'));
  container.replaceChildren(svg);
  container.style.setProperty('--clap-plot-width', `${width}px`);
}

export function setupClapping(getComposition, updateComposition) {
  const startButton = document.querySelector('#start-clapping');
  const clapButton = document.querySelector('#clap');
  const status = document.querySelector('#clap-status');
  const resultPanel = document.querySelector('#clap-result');
  const resultActions = document.querySelector('#clap-result-actions');
  const snapButton = document.querySelector('#clap-snap');
  const viewButton = document.querySelector('#clap-view');
  const blocksButton = document.querySelector('#clap-blocks');
  let blocks = false;
  let byVibhag = true;
  let lastCapture, lastBols;
  let recording = false, times = [], structure = [], name = '';
  const setIdle = () => {
    recording = false; startButton.textContent = 'Start clapping';
    startButton.setAttribute('aria-pressed', 'false'); clapButton.disabled = true;
  };
  const reset = () => {
    setIdle(); times = []; structure = []; name = '';
    blocks = false; blocksButton.setAttribute('aria-pressed', 'false');
    byVibhag = true; viewButton.setAttribute('aria-pressed', 'true');
    resultPanel.hidden = true; resultActions.hidden = true;
    document.querySelector('#clap-plot-container').replaceChildren();
    document.querySelector('#clap-summary').textContent = '';
    snapButton.setAttribute('aria-pressed', 'true');
    status.textContent = 'Start, then tap Clap from sam to the next sam.';
  };
  const sync = () => {
    const { clapping: capture, bols } = getComposition();
    if (capture === lastCapture && (bols === lastBols || recording)) return;
    if (capture !== lastCapture) setIdle();
    lastCapture = capture; lastBols = bols;
    if (!capture) { reset(); return; }
    const result = clapDisplay(capture, bols);
    renderClapPlot(document.querySelector('#clap-plot-container'), result, byVibhag, blocks);
    document.querySelector('#clap-summary').textContent = `${capture.name} · ${capture.structure.join('–')} · ${result.totalMatras} matras · ${result.hits.length} claps · ${(result.duration / 1000).toFixed(2)} s · ${capture.snap ? 'Snap ½ matra' : 'Original timing'}`;
    snapButton.setAttribute('aria-pressed', String(capture.snap));
    viewButton.setAttribute('aria-pressed', String(byVibhag));
    resultPanel.hidden = false; resultActions.hidden = false;
    status.textContent = 'Final clap = next sam (end only). This recording is included in your Kaida link.';
  };
  blocksButton.addEventListener('click', () => {
    const { clapping: capture, bols } = getComposition();
    if (recording || !capture) return;
    blocks = !blocks;
    blocksButton.setAttribute('aria-pressed', String(blocks));
    renderClapPlot(document.querySelector('#clap-plot-container'), clapDisplay(capture, bols), byVibhag, blocks);
  });
  viewButton.addEventListener('click', () => {
    const { clapping: capture, bols } = getComposition();
    if (recording || !capture) return;
    byVibhag = !byVibhag;
    viewButton.setAttribute('aria-pressed', String(byVibhag));
    renderClapPlot(document.querySelector('#clap-plot-container'), clapDisplay(capture, bols), byVibhag, blocks);
  });
  document.querySelector('#clear-clapping').addEventListener('click', () => {
    reset();
    updateComposition(c => {
      const { clapping, ...composition } = c;
      return composition;
    });
    sync();
  });
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
        const capture = { timestamps: times.map(t => t - times[0]), structure: [...structure], name, snap: true };
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
    times = []; recording = true; resultPanel.hidden = true; resultActions.hidden = true;
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
  return { sync, reset };
}
