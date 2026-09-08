import { createComposition, sanitizeComposition } from './model.js';
export const STORAGE_KEY = 'kaidanotes.composition.v1';
export const LEGACY_BACKUP_KEY = `${STORAGE_KEY}.before-v2`;

export function startComposition(storage) {
  try {
    const saved = (storage ?? globalThis.localStorage).getItem(STORAGE_KEY);
    if (saved) return sanitizeComposition(JSON.parse(saved));
  } catch { /* Corrupt or unavailable storage must not block editing. */ }
  return createComposition();
}

export function saveComposition(composition, storage) {
  try {
    const adapter = storage ?? globalThis.localStorage;
    adapter.setItem(STORAGE_KEY, JSON.stringify(composition));
    adapter.removeItem(LEGACY_BACKUP_KEY);
    return true;
  } catch { return false; }
}
