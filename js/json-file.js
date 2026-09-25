import { compositionFilename } from './filename.js';
import { sanitizeComposition } from './model.js';
import { LEVELS } from './rhythm.js';

export const MAX_JSON_BYTES = 10 * 1024 * 1024;

export function exportJSON(composition) {
  return JSON.stringify(composition, null, 2) + '\n';
}

export const jsonFilename = composition => compositionFilename(composition, 'json');

export function importJSON(text) {
  if (new TextEncoder().encode(text).length > MAX_JSON_BYTES) throw new Error('JSON file is too large (maximum 10 MB).');
  let raw;
  try { raw = JSON.parse(text.replace(/^\uFEFF/, '')); }
  catch { throw new Error('This file is not valid JSON.'); }
  if (!raw || ![1, 2].includes(raw.schemaVersion) || !Array.isArray(raw.bols) || !Array.isArray(raw.vibhagStructure)) {
    throw new Error('Choose a KaidaNotes JSON file (schemaVersion 1 or 2, bols and vibhagStructure).');
  }
  if (raw.bols.length > 10000 || raw.vibhagStructure.length > 128
    || raw.vibhagStructure.some(n => !Number.isSafeInteger(n) || n < 1 || n > 128)) {
    throw new Error('The file contains an unsupported rhythm structure.');
  }
  const validPosition = n => Number.isSafeInteger(n) && n >= 1 && n <= 10000;
  if (raw.bols.some(b => !b || typeof b.text !== 'string' || !b.text.trim() || b.text.length > 120
    || LEVELS.some(level => !validPosition(b.position?.[level])))) {
    throw new Error('Each bol needs text and a valid rhythm position.');
  }
  if ((raw.ui?.entryVibhag !== undefined && !validPosition(raw.ui.entryVibhag))
    || (raw.ui?.emptyMatras !== undefined && (!Array.isArray(raw.ui.emptyMatras)
      || raw.ui.emptyMatras.length > 10000
      || raw.ui.emptyMatras.some(p => !p || !validPosition(p.vibhag) || !validPosition(p.matra))))) {
    throw new Error('The file contains invalid empty matras or an invalid entry vibhag.');
  }
  // Use the same migration and tag handling as opening an editable Kaida link.
  return sanitizeComposition(raw);
}

export function setupJSONFiles(getComposition, loadComposition) {
  const input = document.querySelector('#json-file');
  const button = document.querySelector('#json-import');
  const status = document.querySelector('#json-status');
  document.querySelector('#json-export').addEventListener('click', () => {
    const composition = getComposition();
    const blob = new Blob([exportJSON(composition)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = jsonFilename(composition);
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    status.textContent = 'JSON exported.';
  });
  button.addEventListener('click', () => input.click());
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    button.disabled = true;
    status.textContent = 'Reading JSON…';
    try {
      if (file.size > MAX_JSON_BYTES) throw new Error('JSON file is too large (maximum 10 MB).');
      const composition = importJSON(await file.text());
      loadComposition(composition);
      status.textContent = 'JSON imported. Undo restores the previous composition.';
    } catch (error) {
      status.textContent = `${error.message} Current composition kept.`;
    } finally {
      button.disabled = false;
      input.value = '';
    }
  });
}
