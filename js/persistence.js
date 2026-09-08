import { createComposition, sanitizeComposition } from './model.js';
export const STORAGE_KEY = 'kaidanotes.composition.v1';
export const LEGACY_BACKUP_KEY = `${STORAGE_KEY}.before-v2`;

export function loadComposition(storage) {
  try {
    const adapter = storage ?? globalThis.localStorage;
    const raw = adapter.getItem(STORAGE_KEY);
    if (!raw) return { composition: createComposition(), warning: null };
    const parsed = JSON.parse(raw);
    const composition = sanitizeComposition(parsed);
    if (parsed.schemaVersion !== 2) {
      try {
        if (!adapter.getItem(LEGACY_BACKUP_KEY)) adapter.setItem(LEGACY_BACKUP_KEY, raw);
        adapter.setItem(STORAGE_KEY, JSON.stringify(composition));
      } catch {
        return { composition, warning: 'Your earlier notation was opened, but its update could not be saved. Keep this page open and copy complete notation.' };
      }
    }
    return { composition, warning: null };
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
