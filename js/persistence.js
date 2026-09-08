import { createComposition, sanitizeComposition } from './model.js';
export const STORAGE_KEY = 'kaidanotes.composition.v1';

export function loadComposition(storage) {
  try {
    const raw = (storage ?? globalThis.localStorage).getItem(STORAGE_KEY);
    return { composition: raw ? sanitizeComposition(JSON.parse(raw)) : createComposition(), warning: null };
  } catch {
    return { composition: createComposition(), warning: 'Saved notation could not be read. A new sheet is ready; the stored copy remains until you make an edit.' };
  }
}

export function saveComposition(composition, storage) {
  try {
    (storage ?? globalThis.localStorage).setItem(STORAGE_KEY, JSON.stringify(composition));
    return { saved: true };
  } catch {
    return { saved: false, warning: 'Could not save on this device. Keep this page open and copy your notation with complete.' };
  }
}
