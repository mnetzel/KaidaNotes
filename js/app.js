import { appendBol, recognizeTala } from './model.js';
import { moveSelectedAtLevel } from './rhythm.js';
import { createSelection, selectBol, setMultiSelect, getPrimarySelection } from './selection.js';
import { applyTagToSelection } from './tags.js';
import { startComposition } from './persistence.js';
import { createStore } from './state.js';
import { renderNotation, renderInspector } from './renderer.js';
import { exportBasic, exportComplete, shareText } from './export.js';
import { matchTala } from './talas.js';

const $ = selector => document.querySelector(selector);
let selection = createSelection();
let structureDraft = null;
let nextVibhag = false;
let toastTimeout;
const debug = new URLSearchParams(location.search).get('debug') === '1';
const store = createStore(startComposition());

function toast(message) {
  clearTimeout(toastTimeout);
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  toastTimeout = setTimeout(() => { $('#toast').hidden = true; }, 2500);
}

function render() {
  const composition = store.composition;
  const validIds = new Set(composition.bols.map(bol => bol.id));
  selection = { ...selection, ids: selection.ids.filter(id => validIds.has(id)) };
  document.querySelectorAll('[data-type]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.type === composition.compositionType)));
  $('#tala-name').textContent = recognizeTala(composition.vibhagStructure) || 'Free form';
  const talaMatch = matchTala(composition.vibhagStructure);
  $('#tala-alternatives').textContent = talaMatch?.alternatives.length ? `Same grouping: ${talaMatch.alternatives.join(', ')}` : '';
  $('#structure-summary').textContent = composition.vibhagStructure.join(' · ') || 'Set a structure above';
  $('#structure-draft').textContent = structureDraft === null ? '' : (structureDraft.length ? `${structureDraft.join(' · ')} — done to apply` : 'Draft cleared — add lengths or use done');
  $('#structure-done').disabled = structureDraft === null;
  $('#select-more').setAttribute('aria-pressed', String(selection.multi));
  $('#select-more').textContent = selection.multi ? '✓ select more' : 'select more';
  $('#next-vibhag').setAttribute('aria-pressed', String(nextVibhag));
  $('#entry-status').textContent = nextVibhag ? 'Next bol starts a new vibhag' : composition.bols.length ? `${composition.bols.length} bols · V${composition.bols.at(-1).position.vibhag}` : 'Tap a bol to begin';
  $('#undo').disabled = !store.canUndo;
  $('#redo').disabled = !store.canRedo;
  $('#clear-bols').disabled = !composition.bols.length;
  if ($('#extra-notes').value !== composition.notes) $('#extra-notes').value = composition.notes;
  renderNotation($('#notation'), composition, selection, debug);
  renderInspector(composition, selection);
}

store.subscribe(render);
document.querySelectorAll('[data-type]').forEach(button => button.addEventListener('click', () => {
  store.update(composition => ({ ...composition, compositionType: button.dataset.type }));
}));

document.querySelectorAll('[data-bol]').forEach(button => button.addEventListener('click', () => {
  const composition = appendBol(store.composition, button.dataset.bol, nextVibhag);
  selection = { ...selection, ids: [composition.bols.at(-1).id] };
  nextVibhag = false;
  store.update(() => composition);
}));

$('#next-vibhag').addEventListener('click', () => { nextVibhag = !nextVibhag; render(); });
$('#clear-bols').addEventListener('click', () => {
  $('#clear-dialog').returnValue = '';
  $('#clear-dialog').showModal();
});
$('#clear-dialog').addEventListener('close', () => {
  if ($('#clear-dialog').returnValue !== 'clear') return;
  nextVibhag = false;
  selection = createSelection();
  store.update(composition => ({ ...composition, bols: [] }));
  toast('Bols cleared. Undo is available.');
});

document.querySelectorAll('[data-length]').forEach(button => button.addEventListener('click', () => {
  structureDraft = [...(structureDraft ?? []), Number(button.dataset.length)];
  render();
}));
$('#structure-clear').addEventListener('click', () => { structureDraft = []; render(); });
$('#structure-done').addEventListener('click', () => {
  if (structureDraft === null) return;
  const structure = [...structureDraft];
  structureDraft = null;
  store.update(composition => ({ ...composition, vibhagStructure: structure, talaName: recognizeTala(structure) }));
  render();
});

$('#notation').addEventListener('click', event => {
  const button = event.target.closest('[data-bol-id]');
  if (!button) return;
  selection = selectBol(selection, button.dataset.bolId);
  render();
});
$('#select-more').addEventListener('click', () => { selection = setMultiSelect(selection, !selection.multi); render(); });
document.querySelectorAll('[data-tag-group]').forEach(button => button.addEventListener('click', () => {
  store.update(composition => ({ ...composition, bols: applyTagToSelection(composition.bols, selection.ids, button.dataset.tagGroup, button.dataset.tag) }));
}));

$('#address-controls').addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.id === 'hide-subsub') {
    store.update(composition => ({ ...composition, ui: { ...composition.ui, showSubSubMatra: false } }));
    $('#show-subsub').focus();
    return;
  }
  if (!button.dataset.level) return;
  store.update(composition => moveSelectedAtLevel({ composition, selectedBolId: getPrimarySelection(selection), level: button.dataset.level, direction: button.dataset.direction }));
});
$('#show-subsub').addEventListener('click', () => {
  store.update(composition => ({ ...composition, ui: { ...composition.ui, showSubSubMatra: true } }));
  $('#hide-subsub').focus();
});
$('#extra-notes').addEventListener('input', event => {
  const notes = event.target.value;
  store.update(composition => ({ ...composition, notes }), 'notes');
});

function undo() { nextVibhag = false; store.undo(); }
function redo() { nextVibhag = false; store.redo(); }
$('#undo').addEventListener('click', undo);
$('#redo').addEventListener('click', redo);
document.addEventListener('keydown', event => {
  if (!(event.ctrlKey || event.metaKey) || event.altKey || $('dialog[open]')) return;
  if (event.key.toLowerCase() === 'z') {
    event.preventDefault();
    if (event.shiftKey) redo(); else undo();
  }
});

// Reuse the same icon for both share buttons.
$('[data-share="basic"] svg path').id = 'whatsapp-mark';
document.querySelectorAll('[data-share]').forEach(button => button.addEventListener('click', async () => {
  const complete = button.dataset.share === 'complete';
  const text = complete ? exportComplete(store.composition) : exportBasic(store.composition);
  $('#share-title').textContent = complete ? 'Complete notation' : 'Basic notation';
  $('#share-preview').value = text;
  $('#whatsapp-link').href = `https://wa.me/?text=${encodeURIComponent(text)}`;
  $('#copy-status').textContent = 'Copying…';
  $('#share-dialog').showModal();
  const copied = await shareText(text);
  $('#copy-status').textContent = copied ? 'Copied. Ready to paste or share.' : 'Select the text and copy it, or try copy text below.';
  if (copied) toast('Copied');
  else { $('#share-preview').focus(); $('#share-preview').select(); }
}));
$('#copy-again').addEventListener('click', async () => {
  const copied = await shareText($('#share-preview').value);
  $('#copy-status').textContent = copied ? 'Copied. Ready to paste or share.' : 'Press Ctrl / Cmd + C, or touch and hold the selected text to copy.';
  if (!copied) { $('#share-preview').focus(); $('#share-preview').select(); }
});
$('#close-share').addEventListener('click', () => $('#share-dialog').close());

render();
if (debug) Object.defineProperty(window, 'kaidaDebug', { value: Object.freeze({
  snapshot: () => structuredClone(store.composition),
  exportJSON: () => JSON.stringify(store.composition, null, 2),
}), configurable: false });
