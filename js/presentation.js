import { renderNotation } from './renderer.js';
import { createSelection } from './selection.js';
import { clapDisplay } from './clap-data.js';
import { renderClapPlot } from './clapping.js';

export function setupPresentation(getComposition) {
  const dialog = document.querySelector('#presentation-dialog');
  const stage = document.querySelector('#presentation-stage');
  const content = document.querySelector('#presentation-content');
  const fit = () => {
    if (!dialog.open) return;
    const scale = Math.min(stage.clientWidth / content.offsetWidth, stage.clientHeight / content.offsetHeight, 1);
    content.style.transform = `scale(${scale})`;
    content.style.left = `${Math.max(0, (stage.clientWidth - content.offsetWidth * scale) / 2)}px`;
  };
  const observer = new ResizeObserver(fit);
  observer.observe(stage);
  observer.observe(content);
  document.querySelector('#presentation-open').addEventListener('click', () => {
    const composition = getComposition();
    const title = document.createElement('h1');
    title.textContent = `${composition.compositionType.replaceAll('-', ' ').toUpperCase()} — ${composition.talaName || 'Custom tala'}`;
    const structure = document.createElement('p');
    structure.className = 'presentation-structure';
    structure.textContent = composition.vibhagStructure.join(' · ');
    const notation = document.createElement('div');
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
    content.replaceChildren(title, structure, notation);
    content.style.width = '840px';
    if (composition.clapping) {
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
    dialog.showModal();
    // Expand exceptionally wide notation before scaling the entire sheet to fit.
    const overflow = Math.max(0, notation.scrollWidth - notation.clientWidth);
    if (overflow) content.style.width = `${840 + overflow}` + 'px';
    fit();
  });
  document.querySelector('#presentation-close').addEventListener('click', () => dialog.close());
}
