import { renderNotation, fitNotation } from './renderer.js';
import { createSelection } from './selection.js';
import { clapDisplay } from './clap-data.js';
import { renderClapPlot } from './clapping.js';
import { setupPresentationImage } from './presentation-image.js';
import { setupPresentationPlayback } from './playback.js';
import { resolveStrokeSamples } from './playback-data.js';
import { bolColor } from './tags.js';

export function setupPresentation(getComposition) {
  const dialog = document.querySelector('#presentation-dialog');
  const stage = document.querySelector('#presentation-stage');
  const content = document.querySelector('#presentation-content');
  const viewButtons = [...document.querySelectorAll('[data-presentation-view]')];
  const soundCheckbox = document.querySelector('#presentation-sound');
  const zoomButton = document.querySelector('#presentation-zoom');
  const practiceControls = document.querySelector('#practice-controls');
  const vibhagChoices = document.querySelector('#practice-vibhags');
  let view = 'both', composition, practice = false, selectedVibhags = new Set(), practiceSize = '', resizeFrame;
  const fit = () => {
    if (!dialog.open) return;
    const notation = content.querySelector('.notation');
    if (notation) fitNotation(notation);
    const sidebar = practice ? 44 : 0;
    const available = Math.max(1, stage.clientWidth - sidebar);
    const scale = Math.min(available / content.offsetWidth, stage.clientHeight / content.offsetHeight, practice ? Infinity : 1);
    content.style.transform = `scale(${scale})`;
    content.style.left = `${sidebar + Math.max(0, (available - content.offsetWidth * scale) / 2)}px`;
    content.style.top = practice ? `${Math.max(0, (stage.clientHeight - content.offsetHeight * scale) / 2)}px` : '0px';
    if (practice) {
      const origin = stage.getBoundingClientRect();
      content.querySelectorAll('.clap-vibhag-row').forEach((row, index) => {
        const rect = row.getBoundingClientRect();
        vibhagChoices.children[index].style.top = `${rect.top + rect.height / 2 - origin.top}px`;
      });
    }
  };
  const observer = new ResizeObserver(() => {
    if (practice && dialog.open && practiceSize !== `${stage.clientWidth}:${stage.clientHeight}`) {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => { if (practice && dialog.open) render(); });
    } else fit();
  });
  const image = setupPresentationImage(content, fit);
  const playback = setupPresentationPlayback();
  observer.observe(stage);
  observer.observe(content);
  const syncSelection = () => {
    content.querySelectorAll('.clap-vibhag-row').forEach(row => row.classList.toggle('practice-excluded', !selectedVibhags.has(Number(row.dataset.vibhag))));
  };
  const renderChoices = () => {
    vibhagChoices.replaceChildren();
    playback.getPlan()?.structure.forEach((_, index) => {
      const label = document.createElement('label');
      label.className = 'practice-vibhag';
      const input = document.createElement('input');
      input.type = 'checkbox'; input.checked = selectedVibhags.has(index); input.dataset.loopVibhag = index;
      input.setAttribute('aria-label', `Loop V${index + 1}`);
      input.addEventListener('change', () => {
        if (input.checked) selectedVibhags.add(index); else selectedVibhags.delete(index);
        playback.setVibhags([...selectedVibhags]);
        syncSelection();
      });
      label.append(input, `V${index + 1}`);
      vibhagChoices.append(label);
    });
  };
  const render = () => {
    image.clear();
    dialog.classList.toggle('practice-view', practice);
    practiceControls.hidden = vibhagChoices.hidden = !practice;
    practiceSize = `${stage.clientWidth}:${stage.clientHeight}`;
    const title = document.createElement('h1');
    title.textContent = `${composition.compositionType.replaceAll('-', ' ').toUpperCase()} — ${composition.talaName || 'Custom tala'}`;
    const structure = document.createElement('p');
    structure.className = 'presentation-structure';
    structure.textContent = composition.vibhagStructure.join(' · ');
    content.replaceChildren(...(practice ? [] : [title, structure]));
    let notation;
    if (!practice && view !== 'blocks') {
      notation = document.createElement('div');
      notation.className = 'notation presentation-notation';
      renderNotation(notation, composition, createSelection());
      const columns = Math.max(1, ...[...notation.querySelectorAll('.matras')].map(row => row.children.length));
      notation.style.setProperty('--matra-columns', String(columns));
      // Static notation: retain colors/annotations, remove all interactive controls.
      notation.querySelectorAll('button').forEach(button => {
        const span = document.createElement('span');
        span.className = button.className;
        if (button.dataset.bolId) span.dataset.bolId = button.dataset.bolId;
        span.append(...button.childNodes);
        button.replaceWith(span);
      });
      notation.querySelector('.notation-empty')?.remove();
      content.append(notation);
    }
    content.style.width = '840px';
    if (practice || view !== 'bols' && composition.clapping) {
      const plot = document.createElement('div');
      plot.className = 'presentation-plot';
      // The practice picture follows the exact same timing source as the audio,
      // including notation fallback for incomplete clap recordings.
      const base = playback.getPlan();
      const byId = new Map(composition.bols.map(bol => [bol.id, bol]));
      const result = practice ? {
        structure: base.structure, totalMatras: base.totalMatras, duration: base.totalMatras * 500, snap: composition.clapping?.snap ?? false,
        hits: base.intervals.flatMap((timing, index) => {
          const bol = byId.get(timing.bolId);
          if (!bol?.text.trim() || bol.text.trim() === '—') return [];
          return [{ index: index + 1, bolId: bol.id, matra: timing.start, endMatra: timing.end, elapsed: timing.start * 500,
            label: bol.text, color: bolColor(bol) || '#141018', hands: ['right', 'left'].filter(hand => bol.tags?.[hand + 'HandFinger']) }];
        }),
      } : clapDisplay(composition.clapping, composition.bols);
      if (practice) {
        const viewWidth = Math.max(760, Math.max(...base.structure) * 40 + 64) - 40;
        const rowHeight = stage.clientHeight / base.structure.length * viewWidth / Math.max(1, stage.clientWidth - 44);
        // Use spare vertical space for taller hand lanes, keeping text undistorted.
        result.blockLaneHeight = Math.max(72, (rowHeight - 54) / 2);
      }
      if (soundCheckbox.checked) {
        result.hits = result.hits.map(hit => {
          const bol = byId.get(hit.bolId);
          const resolved = bol && resolveStrokeSamples(bol);
          const sounds = resolved?.samples.join(' + ') || 'No sound';
          return { ...hit, soundLabel: sounds + (resolved?.unmapped && resolved.samples.length ? ' + ?' : '') };
        });
      }
      renderClapPlot(plot, result, true, true);
      if (practice) plot.querySelectorAll('svg').forEach(svg => {
        // Blocks have no labels outside the grid: reclaim the point-view gutters.
        const box = svg.viewBox.baseVal;
        svg.setAttribute('viewBox', `20 -4 ${box.width - 136} ${box.height + 4}`);
      });
      content.append(plot);
    }
    if (!practice && composition.notes.trim()) {
      const notes = document.createElement('p');
      notes.className = 'presentation-notes';
      notes.textContent = composition.notes;
      content.append(notes);
    }
    viewButtons.forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.presentationView === view));
      button.disabled = button.dataset.presentationView === 'blocks' && !composition.clapping;
      button.title = button.disabled ? 'Record clapping or set a manual timeline first.' : '';
    });
    zoomButton.disabled = !playback.getPlan()?.intervals.length;
    if (practice) { renderChoices(); syncSelection(); }
    if (!dialog.open) dialog.showModal();
    if (notation) fitNotation(notation);
    // Expand exceptionally wide notation before scaling the entire sheet to fit.
    const overflow = notation ? Math.max(0, notation.scrollWidth - notation.clientWidth) : 0;
    if (overflow) content.style.width = `${840 + overflow}` + 'px';
    fit();
    playback.refreshVisuals();
    if (!practice) image.prepare(composition);
  };
  document.querySelector('#presentation-open').addEventListener('click', () => {
    composition = getComposition();
    practice = false;
    playback.setComposition(composition);
    selectedVibhags = new Set(playback.getPlan()?.structure.map((_, index) => index) || []);
    if (view === 'blocks' && !composition.clapping) view = 'bols';
    render();
  });
  viewButtons.forEach(button => button.addEventListener('click', () => {
    if (!composition || view === button.dataset.presentationView) return;
    view = button.dataset.presentationView;
    render();
  }));
  soundCheckbox.addEventListener('change', () => { if (composition) render(); });
  zoomButton.addEventListener('click', () => {
    practice = true; render(); document.querySelector('#practice-exit').focus({ preventScroll: true });
    const start = document.querySelector('#presentation-play');
    if (!start.disabled) start.click();
  });
  const exitPractice = () => {
    practice = false; render(); zoomButton.focus({ preventScroll: true });
  };
  document.querySelector('#practice-exit').addEventListener('click', exitPractice);
  document.querySelector('#presentation-close').addEventListener('click', () => {
    playback.stop();
    dialog.close();
  });
  dialog.addEventListener('close', image.clear);
  dialog.addEventListener('close', playback.stop);
  dialog.addEventListener('cancel', event => {
    if (practice) { event.preventDefault(); exitPractice(); } else playback.stop();
  });
}
