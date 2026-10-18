import { renderNotation, fitNotation } from './renderer.js';
import { createSelection } from './selection.js';
import { clapDisplay } from './clap-data.js';
import { renderClapPlot } from './clapping.js';
import { setupPresentationImage } from './presentation-image.js';

export function setupPresentation(getComposition) {
  const dialog = document.querySelector('#presentation-dialog');
  const stage = document.querySelector('#presentation-stage');
  const content = document.querySelector('#presentation-content');
  const viewButtons = [...document.querySelectorAll('[data-presentation-view]')];
  let view = 'both', composition;
  const fit = () => {
    if (!dialog.open) return;
    const notation = content.querySelector('.notation');
    if (notation) fitNotation(notation);
    const scale = Math.min(stage.clientWidth / content.offsetWidth, stage.clientHeight / content.offsetHeight, 1);
    content.style.transform = `scale(${scale})`;
    content.style.left = `${Math.max(0, (stage.clientWidth - content.offsetWidth * scale) / 2)}px`;
  };
  const observer = new ResizeObserver(fit);
  const image = setupPresentationImage(content, fit);
  observer.observe(stage);
  observer.observe(content);
  const render = () => {
    image.clear();
    const title = document.createElement('h1');
    title.textContent = `${composition.compositionType.replaceAll('-', ' ').toUpperCase()} — ${composition.talaName || 'Custom tala'}`;
    const structure = document.createElement('p');
    structure.className = 'presentation-structure';
    structure.textContent = composition.vibhagStructure.join(' · ');
    content.replaceChildren(title, structure);
    let notation;
    if (view !== 'blocks') {
      notation = document.createElement('div');
      notation.className = 'notation presentation-notation';
      renderNotation(notation, composition, createSelection());
      const columns = Math.max(1, ...[...notation.querySelectorAll('.matras')].map(row => row.children.length));
      notation.style.setProperty('--matra-columns', String(columns));
      // Static notation: retain colors/annotations, remove all interactive controls.
      notation.querySelectorAll('button').forEach(button => {
        const span = document.createElement('span');
        span.className = button.className;
        span.append(...button.childNodes);
        button.replaceWith(span);
      });
      notation.querySelector('.notation-empty')?.remove();
      content.append(notation);
    }
    content.style.width = '840px';
    if (view !== 'bols' && composition.clapping) {
      const plot = document.createElement('div');
      plot.className = 'presentation-plot';
      renderClapPlot(plot, clapDisplay(composition.clapping, composition.bols), true, true);
      content.append(plot);
    }
    if (composition.notes.trim()) {
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
    if (!dialog.open) dialog.showModal();
    if (notation) fitNotation(notation);
    // Expand exceptionally wide notation before scaling the entire sheet to fit.
    const overflow = notation ? Math.max(0, notation.scrollWidth - notation.clientWidth) : 0;
    if (overflow) content.style.width = `${840 + overflow}` + 'px';
    fit();
    image.prepare(composition);
  };
  document.querySelector('#presentation-open').addEventListener('click', () => {
    composition = getComposition();
    if (view === 'blocks' && !composition.clapping) view = 'bols';
    render();
  });
  viewButtons.forEach(button => button.addEventListener('click', () => {
    if (!composition || view === button.dataset.presentationView) return;
    view = button.dataset.presentationView;
    render();
  }));
  document.querySelector('#presentation-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', image.clear);
}
