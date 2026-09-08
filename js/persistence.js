import { createComposition } from './model.js';
export const STORAGE_KEY = 'kaidanotes.composition.v1';
export const LEGACY_BACKUP_KEY = `${STORAGE_KEY}.before-v2`;

// Each document owns a fresh, in-memory composition. Retire only this app's
// old autosave keys; never clear storage belonging to other apps on the origin.
export function startComposition(storage) {
  try {
    const adapter = storage ?? globalThis.localStorage;
    adapter.removeItem(STORAGE_KEY);
    adapter.removeItem(LEGACY_BACKUP_KEY);
  } catch {
    // Storage may be unavailable. The editor no longer needs it to operate.
  }
  return createComposition();
}
