import { createManualDraft, moveManualTiming, manualCapture } from './manual-timing.js';
import { bolColor } from './tags.js';

export function setupManualTimeline(getComposition, saveCapture) {
  const dialog = document.querySelector('#manual-dialog');
  const scroll = document.querySelector('#manual-scroll');
  const track = document.querySelector('#manual-track');
  const overview = document.querySelector('#manual-overview');
  const status = document.querySelector('#manual-status');
  const startInput = document.querySelector('#manual-start');
  const endInput = document.querySelector('#manual-end');
  const snap = document.querySelector('#manual-snap');
  const linkEdges = document.querySelector('#manual-link-edges');
  const zoom = document.querySelector('#manual-zoom');
  let composition, draft, selected = 0, unit = 120, drag = null, animation = 0;
  const number = n => Number(n.toFixed(5));
  const node = (tag, className, text) => {
    const el = document.createElement(tag);
    el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  const select = (index, reveal = false) => {
    selected = index;
    render();
    if (reveal) track.querySelector(`[data-index="${index}"]`)?.scrollIntoView({ block: 'nearest', inline: 'center' });
  };
  function render() {
    track.style.width = `${draft.totalMatras * unit + 32}px`;
    track.style.setProperty('--manual-unit', `${unit}px`);
    const children = [];
    let offset = 0;
    for (const [i, length] of draft.structure.entries()) {
      const label = node('span', 'manual-vibhag', `V${i + 1}`);
      label.style.left = `${16 + offset * unit}px`;
      label.style.width = `${length * unit}px`;
      children.push(label);
      offset += length;
    }
    const boundaries = new Set([0]);
    draft.structure.reduce((sum, length) => { boundaries.add(sum + length); return sum + length; }, 0);
    for (let m = 0; m <= draft.totalMatras; m++) {
      const mark = node('span', `manual-grid-line${boundaries.has(m) ? ' vibhag-start' : ''}`, m === draft.totalMatras ? 'sam' : String(m + 1));
      mark.style.left = `${16 + m * unit}px`;
      children.push(mark);
    }
    const byId = new Map(composition.bols.map(b => [b.id, b]));
    draft.intervals.forEach((timing, index) => {
      const bol = byId.get(timing.bolId);
      const block = node('div', `manual-block${bol.text === '—' ? ' rest' : ''}${index === selected ? ' selected' : ''}`);
      block.dataset.index = index;
      block.style.left = `${16 + timing.start * unit}px`;
      block.style.width = `${(timing.end - timing.start) * unit}px`;
      block.style.setProperty('--bol-color', bolColor(bol) || '#141018');
      for (const part of ['start', 'move', 'end']) {
        const button = node('button', `manual-${part}`, part === 'move' ? bol.text : '');
        button.type = 'button';
        button.dataset.part = part;
        button.setAttribute('aria-label', `${part === 'move' ? 'Move' : 'Resize ' + part + ' of'} ${bol.text}, bol ${index + 1}`);
        button.title = `${bol.text} · ${number(timing.start + 1)}–${number(timing.end + 1)} · drag to ${part === 'move' ? 'move' : 'resize'}`;
        block.append(button);
      }
      children.push(block);
    });
    track.replaceChildren(...children);
    overview.replaceChildren();
    draft.intervals.forEach((timing, index) => {
      const bol = byId.get(timing.bolId);
      const mini = node('button', `manual-mini${index === selected ? ' selected' : ''}${bol.text === '—' ? ' rest' : ''}`);
      mini.type = 'button'; mini.dataset.index = index;
      mini.style.left = `${timing.start / draft.totalMatras * 100}%`;
      mini.style.width = `${(timing.end - timing.start) / draft.totalMatras * 100}%`;
      mini.style.setProperty('--bol-color', bolColor(bol) || '#141018');
      mini.title = `Bol ${index + 1}: ${bol.text}`;
      mini.setAttribute('aria-label', mini.title);
      overview.append(mini);
    });
    const timing = draft.intervals[selected];
    const bol = byId.get(timing.bolId);
    document.querySelector('#manual-selected').textContent = `${selected + 1} / ${draft.intervals.length} · ${bol.text === '—' ? 'Pause' : bol.text}`;
    startInput.value = number(timing.start + 1);
    endInput.value = number(timing.end + 1);
    for (const input of [startInput, endInput]) { input.max = draft.totalMatras + 1; input.step = snap.checked ? '.25' : '.01'; }
    document.querySelector('#manual-duration').textContent = `${number(timing.end - timing.start)} matra${Math.abs(timing.end - timing.start - 1) < 1e-6 ? '' : 's'}`;
  }
  const change = (part, value, base = draft.intervals) => {
    draft.intervals = moveManualTiming(base, selected, part, value, draft.totalMatras, snap.checked, linkEdges.checked);
    render();
  };
  const stopDrag = () => {
    cancelAnimationFrame(animation);
    animation = 0;
    if (drag && track.hasPointerCapture(drag.pointerId)) track.releasePointerCapture(drag.pointerId);
    drag = null;
  };
  const updateDrag = () => {
    if (!drag) return;
    const delta = (drag.clientX - drag.initialX + scroll.scrollLeft - drag.scrollLeft) / unit;
    const original = drag.intervals[selected];
    change(drag.part, (drag.part === 'end' ? original.end : original.start) + delta, drag.intervals);
  };
  const autoScroll = () => {
    if (!drag) return;
    const rect = scroll.getBoundingClientRect();
    const velocity = drag.clientX < rect.left + 30 ? -10 : drag.clientX > rect.right - 30 ? 10 : 0;
    if (velocity) { scroll.scrollLeft += velocity; updateDrag(); }
    animation = requestAnimationFrame(autoScroll);
  };
  track.addEventListener('pointerdown', event => {
    const button = event.target.closest('[data-part]');
    if (!button || event.button !== 0 || !event.isPrimary) return;
    event.preventDefault();
    selected = Number(button.parentElement.dataset.index);
    drag = { part: button.dataset.part, pointerId: event.pointerId,
      initialX: event.clientX, clientX: event.clientX, scrollLeft: scroll.scrollLeft, intervals: draft.intervals };
    track.setPointerCapture(event.pointerId);
    render();
    animation = requestAnimationFrame(autoScroll);
  });
  track.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    drag.clientX = event.clientX; updateDrag();
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) track.addEventListener(type, stopDrag);
  track.addEventListener('keydown', event => {
    const button = event.target.closest('[data-part]');
    if (!button || !['ArrowLeft', 'ArrowRight', 'Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    selected = Number(button.parentElement.dataset.index);
    if (event.key === 'Enter' || event.key === ' ') { select(selected); startInput.focus(); return; }
    const part = button.dataset.part;
    const delta = (snap.checked ? .25 : .01) * (event.key === 'ArrowLeft' ? -1 : 1);
    change(part, (part === 'end' ? draft.intervals[selected].end : draft.intervals[selected].start) + delta);
    track.querySelector(`[data-index="${selected}"] [data-part="${part}"]`)?.focus({ preventScroll: true });
  });
  overview.addEventListener('click', event => {
    const button = event.target.closest('[data-index]');
    if (button) select(Number(button.dataset.index), true);
  });
  for (const [input, part] of [[startInput, 'start'], [endInput, 'end']]) {
    input.addEventListener('change', () => change(part, input.valueAsNumber - 1));
  }
  document.querySelector('#manual-previous').addEventListener('click', () => select(Math.max(0, selected - 1), true));
  document.querySelector('#manual-next').addEventListener('click', () => select(Math.min(draft.intervals.length - 1, selected + 1), true));
  zoom.addEventListener('input', () => {
    stopDrag(); unit = Number(zoom.value); render();
    track.querySelector(`[data-index="${selected}"]`)?.scrollIntoView({ block: 'nearest', inline: 'center' });
  });
  snap.addEventListener('change', render);
  document.querySelector('#manual-reset').addEventListener('click', () => {
    stopDrag(); draft = createManualDraft(composition, true); selected = 0;
    status.textContent = draft.notice; render(); scroll.scrollLeft = 0;
  });
  document.querySelector('#manual-open').addEventListener('click', () => {
    try {
      composition = getComposition(); draft = createManualDraft(composition);
      selected = 0; snap.checked = true; linkEdges.checked = true; unit = Number(zoom.value);
      status.textContent = draft.notice;
      document.querySelector('#manual-help').textContent = `Drag blocks to move; drag edges to resize. Link edges adjusts touching neighbours; turn it off to leave a gap. Empty gaps and — are pauses. 1 = sam; ${draft.totalMatras + 1} = next sam. Use the overview to jump along the cycle.`;
      render(); dialog.showModal(); scroll.scrollLeft = 0;
    } catch (error) { document.querySelector('#clap-status').textContent = error.message; }
  });
  document.querySelector('#manual-cancel').addEventListener('click', () => dialog.close());
  document.querySelector('#manual-ok').addEventListener('click', () => {
    try {
      if (getComposition() !== composition) throw new Error('The composition changed. Close and reopen the editor.');
      const capture = manualCapture(draft, composition.bols);
      saveCapture(capture);
      dialog.close();
    } catch (error) { status.textContent = error.message; }
  });
  dialog.addEventListener('close', stopDrag);
}
