import { createComposition, clearVibhag, deleteBol, insertPause, replaceBol, recognizeTala } from './model.js';
import { moveSelectedAtLevel } from './rhythm.js';
import { createSelection, createBolInteraction, clickNotationBol, setMultiSelect, getPrimarySelection } from './selection.js';
import { applyTagToSelection } from './tags.js';
import { startComposition, saveComposition } from './persistence.js';
import { createStore } from './state.js';
import { renderNotation, renderInspector } from './renderer.js';
import { exportBasic, exportComplete, shareText } from './export.js';
import { matchTala } from './talas.js';
import { expandBolSequence } from './keyboard.js';
import { createShareLink, readShareLink } from './share-link.js';
import { endCursor, insertAtCursor } from './cursor.js';
import { setupClapping } from './clapping.js';
import { fitPortraitLayout } from './layout.js';

const $ = selector => document.querySelector(selector);
let selection = createSelection();
let interaction = createBolInteraction();
let structureDraft = null;
let nextVibhag = false;
let entryCursor = null;
const cursor = () => entryCursor ?? endCursor(store.composition);
let toastTimeout;
let shareRequest = 0;
const debug = new URLSearchParams(location.search).get('debug') === '1';
const store = createStore(startComposition(), composition => {
  $('#session-status').textContent = saveComposition(composition) ? 'Saved on this device' : 'Storage unavailable — copy to keep';
});
function currentVibhag() {
  return store.composition.bols.find(b => b.id === getPrimarySelection(selection))?.position.vibhag
    ?? cursor().vibhag;
}
function currentBol() {
  return store.composition.bols.find(b => b.id === getPrimarySelection(selection))
    ?? store.composition.bols.filter(b => b.position.vibhag === currentVibhag()).at(-1);
}
fitPortraitLayout();
const clapping = setupClapping(() => store.composition, transform => store.update(transform));

function toast(message) {
  clearTimeout(toastTimeout);
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  toastTimeout = setTimeout(() => { $('#toast').hidden = true; }, 2500);
}

function render() {
  clapping.sync();
  const composition = store.composition;
  const validIds = new Set(composition.bols.map(bol => bol.id));
  selection = { ...selection, ids: selection.ids.filter(id => validIds.has(id)) };
  if (interaction.id && !validIds.has(interaction.id)) interaction = createBolInteraction();
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
  $('#entry-status').textContent = interaction.editingId ? 'Replace selected bol' : `Next bol: V${cursor().vibhag} · matra ${cursor().matra}`;
  $('#delete-selected-bol').disabled = !getPrimarySelection(selection);
  document.querySelectorAll('[data-pause]').forEach(button => { button.disabled = !getPrimarySelection(selection) || !!interaction.editingId; });
  $('#undo').disabled = !store.canUndo;
  $('#redo').disabled = !store.canRedo;
  $('#clear-bols').disabled = !composition.bols.some(b => b.position.vibhag === currentVibhag());
  $('#backspace-bol').disabled = !currentBol();
  if ($('#extra-notes').value !== composition.notes) $('#extra-notes').value = composition.notes;
  renderNotation($('#notation'), composition, selection, debug, interaction.editingId, interaction.editingId ? null : cursor());
  renderInspector(composition, selection, interaction.editingId);
  $('#cancel-replacement').hidden = !interaction.editingId;
  document.querySelectorAll('[data-bol]').forEach(button => {
    button.disabled = !!interaction.editingId && expandBolSequence(button.dataset.bol).length !== 1;
  });
}

store.subscribe(render);
document.querySelectorAll('[data-type]').forEach(button => button.addEventListener('click', () => {
  store.update(composition => ({ ...composition, compositionType: button.dataset.type }));
}));

document.querySelectorAll('[data-bol]').forEach(button => button.addEventListener('click', () => {
  if (interaction.editingId) {
    const selectedBolId = interaction.editingId;
    interaction = createBolInteraction(); entryCursor = null; nextVibhag = false;
    store.update(composition => replaceBol(composition, selectedBolId, button.dataset.bol));
    render();
    return;
  }
  const target = cursor();
  const oldIds = new Set(store.composition.bols.map(b => b.id));
  const composition = insertAtCursor(store.composition, button.dataset.bol, target);
  interaction = createBolInteraction();
  selection = { ...selection, ids: composition.bols.filter(b => !oldIds.has(b.id)).slice(-1).map(b => b.id) };
  nextVibhag = false; entryCursor = null;
  store.update(() => composition);
}));

document.querySelectorAll('[data-pause]').forEach(button => button.addEventListener('click', () => {
  const target = getPrimarySelection(selection);
  if (!target || interaction.editingId) return;
  interaction = createBolInteraction(); entryCursor = null; nextVibhag = false;
  store.update(composition => insertPause(composition, target, button.dataset.pause));
}));

$('#next-vibhag').addEventListener('click', () => {
  if (!nextVibhag) {
    const vibhag = cursor().vibhag + (store.composition.bols.length ? 1 : 0);
    entryCursor = { vibhag, matra: (store.composition.bols.filter(b => b.position.vibhag === vibhag).at(-1)?.position.matra ?? 0) + 1 };
  }
  interaction = createBolInteraction(); nextVibhag = true; render();
});
$('#clear-bols').addEventListener('click', () => {
  const vibhag = currentVibhag();
  selection = createSelection(); interaction = createBolInteraction(); nextVibhag = false;
  entryCursor = { vibhag, matra: 1 };
  store.update(composition => clearVibhag(composition, vibhag));
  toast(`Vibhag ${vibhag} cleared. Undo is available.`);
});
$('#backspace-bol').addEventListener('click', () => {
  const target = currentBol();
  if (!target) return;
  const previous = store.composition.bols.filter(b => b.position.vibhag === target.position.vibhag && b.order < target.order).at(-1);
  selection = { ...selection, ids: previous ? [previous.id] : [] };
  interaction = createBolInteraction(); nextVibhag = false;
  entryCursor = null;
  store.update(composition => deleteBol(composition, target.id));
});
$('#delete-selected-bol').addEventListener('click', () => {
  const id = getPrimarySelection(selection);
  if (!id) return;
  selection = createSelection(); interaction = createBolInteraction();
  entryCursor = null; nextVibhag = false;
  store.update(composition => deleteBol(composition, id, { preserveMatra: true }));
});
$('#clear-all').addEventListener('click', () => {
  $('#clear-dialog').returnValue = '';
  $('#clear-dialog').showModal();
});
$('#clear-dialog').addEventListener('close', () => {
  if ($('#clear-dialog').returnValue !== 'clear') return;
  nextVibhag = false; structureDraft = null; entryCursor = null;
  selection = createSelection(); interaction = createBolInteraction();
  $('#toast').hidden = true; clearTimeout(toastTimeout);
  $('#link-status').hidden = true;
  clapping.reset();
  store.reset(createComposition());
  $('#notation').scrollLeft = 0;
  toast('New empty Kaida. App reset.');
});

document.querySelectorAll('[data-length]').forEach(button => button.addEventListener('click', () => {
  structureDraft = [...(structureDraft ?? []), Number(button.dataset.length)];
  render();
}));
$('#structure-clear').addEventListener('click', () => { structureDraft = []; render(); });
$('#structure-done').addEventListener('click', () => {
  if (structureDraft === null) return;
  const structure = [...structureDraft];
  structureDraft = null; entryCursor = null; nextVibhag = false;
  store.update(composition => ({ ...composition, vibhagStructure: structure, talaName: recognizeTala(structure) }));
  render();
});

$('#notation').addEventListener('click', event => {
  const empty = event.target.closest('[data-empty-matra]');
  if (empty) {
    entryCursor = { vibhag: Number(empty.dataset.vibhag), matra: Number(empty.dataset.emptyMatra) };
    nextVibhag = false; selection = createSelection(); interaction = createBolInteraction();
    render(); return;
  }
  const button = event.target.closest('[data-bol-id]');
  if (!button) return;
  ({ selection, interaction } = clickNotationBol(selection, interaction, store.composition.bols, button.dataset.bolId));
  render();
});
$('#select-more').addEventListener('click', () => { interaction = createBolInteraction(); selection = setMultiSelect(selection, !selection.multi); render(); });
$('#cancel-replacement').addEventListener('click', () => { interaction = createBolInteraction(); render(); });
// A tap sequence consists of consecutive taps on the same notation button,
// independent of timing. Other controls restart the count, but typing a
// replacement must retain the pending target until its keyboard handler runs.
document.addEventListener('click', event => {
  if (!event.target.closest('#notation') && event.target.closest('button, textarea')) {
    interaction = { ...interaction, id: null, clicks: 0 };
  }
}, true);
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
  entryCursor = null; nextVibhag = false;
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

function undo() { entryCursor = null; nextVibhag = false; interaction = createBolInteraction(); store.undo(); render(); }
function redo() { entryCursor = null; nextVibhag = false; interaction = createBolInteraction(); store.redo(); render(); }
$('#undo').addEventListener('click', undo);
$('#redo').addEventListener('click', redo);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && interaction.editingId) { interaction = createBolInteraction(); render(); return; }
  if (!(event.ctrlKey || event.metaKey) || event.altKey || $('dialog[open]')) return;
  if (event.key.toLowerCase() === 'z') {
    event.preventDefault();
    if (event.shiftKey) redo(); else undo();
  }
});

// Reuse the same icon for both share buttons.
$('[data-share="basic"] svg path').id = 'whatsapp-mark';
document.querySelectorAll('[data-share]').forEach(button => button.addEventListener('click', async () => {
  const request = ++shareRequest;
  const kind = button.dataset.share;
  const snapshot = structuredClone(store.composition);
  $('#share-title').textContent = kind === 'link' ? 'Share Kaida link' : kind === 'complete' ? 'Complete notation' : 'Basic notation';
  $('#share-details').hidden = kind !== 'link';
  $('#share-preview').value = '';
  $('#copy-again').disabled = true;
  $('#copy-again').textContent = kind === 'link' ? 'copy link' : 'copy text';
  $('#whatsapp-link').hidden = true;
  $('#whatsapp-link').removeAttribute('href');
  $('#copy-status').textContent = kind === 'link' ? 'Creating link…' : 'Copying…';
  $('#share-dialog').showModal();
  try {
    const text = kind === 'link' ? await createShareLink(snapshot, location.href) : kind === 'complete' ? exportComplete(snapshot) : exportBasic(snapshot);
    if (request !== shareRequest) return;
    $('#share-preview').value = text;
    $('#copy-again').disabled = false;
    $('#whatsapp-link').href = `https://wa.me/?text=${encodeURIComponent(text)}`;
    $('#whatsapp-link').hidden = false;
    const copied = await shareText(text);
    if (request !== shareRequest) return;
    $('#copy-status').textContent = copied ? 'Copied. Ready to paste or share.' : 'Use the copy button, or select and copy the text below.';
    if (kind === 'link' && text.length > 8000) $('#copy-status').textContent += ' This is a long link; make sure your messenger sends it in full.';
    if (!copied) { $('#share-preview').focus(); $('#share-preview').select(); }
  } catch (error) { if (request === shareRequest) $('#copy-status').textContent = error.message; }
}));
$('#copy-again').addEventListener('click', async () => {
  const copied = await shareText($('#share-preview').value);
  $('#copy-status').textContent = copied ? 'Copied. Ready to paste or share.' : 'Press Ctrl / Cmd + C, or touch and hold the selected text to copy.';
  if (!copied) { $('#share-preview').focus(); $('#share-preview').select(); }
});
$('#close-share').addEventListener('click', () => $('#share-dialog').close());
$('#share-dialog').addEventListener('close', () => { shareRequest++; });

async function openSharedKaida() {
  const hash = location.hash;
  if (!hash.startsWith('#kaida=')) return;
  try {
    const composition = await readShareLink(hash);
    if (location.hash !== hash) return;
    selection = createSelection(); interaction = createBolInteraction();
    structureDraft = null; nextVibhag = false; entryCursor = null;
    store.update(() => composition);
    const url = new URL(location.href); url.hash = '';
    history.replaceState(null, '', url.href);
    $('#link-status').textContent = 'Shared Kaida loaded. You can edit it and send a new link. Undo restores the previous composition.';
    $('#link-status').hidden = false;
  } catch (error) {
    if (location.hash !== hash) return;
    $('#link-status').textContent = error.message + ' Your saved composition has not been changed.';
    $('#link-status').hidden = false;
  }
}
window.addEventListener('hashchange', openSharedKaida);
await openSharedKaida();

render();
if (debug) Object.defineProperty(window, 'kaidaDebug', { value: Object.freeze({
  snapshot: () => structuredClone(store.composition),
  exportJSON: () => JSON.stringify(store.composition, null, 2),
}), configurable: false });
