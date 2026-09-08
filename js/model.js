import { normalizePositions, nextPosition, LEVELS } from './rhythm.js';
import { emptyTags, sanitizeTags } from './tags.js';

export const COMPOSITION_TYPES = ['kaida', 'palta', 'rela', 'part-practice'];
export const id = prefix => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
export const recognizeTala = structure => structure.join(',') === '4,4,4,4' ? 'Tintal' : (structure.length ? 'Custom' : '');

export function createComposition() {
  return { schemaVersion: 1, id: id('composition'), compositionType: 'kaida', talaName: 'Tintal',
    vibhagStructure: [4, 4, 4, 4], notes: '', bols: [], ui: { showSubSubMatra: true } };
}

export function appendBol(composition, text, forceVibhag = false) {
  const bol = { id: id('bol'), order: (composition.bols.at(-1)?.order ?? 0) + 1, text,
    position: nextPosition(composition.bols, composition.vibhagStructure, forceVibhag), tags: emptyTags(), note: '' };
  return { ...composition, bols: [...composition.bols, bol] };
}

export function sanitizeComposition(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid composition');
  if (raw.schemaVersion !== undefined && raw.schemaVersion !== 1) throw new Error('Unsupported document version');
  const fresh = createComposition();
  const structure = Array.isArray(raw.vibhagStructure) ? raw.vibhagStructure.filter(n => Number.isSafeInteger(n) && n > 0 && n <= 128).slice(0, 128) : fresh.vibhagStructure;
  const ids = new Set();
  let order = 0;
  const bols = (Array.isArray(raw.bols) ? raw.bols : []).filter(bol => bol && typeof bol.text === 'string' && bol.text.trim()).map(bol => {
    const bolId = typeof bol.id === 'string' && bol.id && !ids.has(bol.id) ? bol.id : id('bol');
    ids.add(bolId);
    order = Number.isSafeInteger(bol.order) && bol.order > order ? bol.order : order + 1;
    const position = Object.fromEntries(LEVELS.map(level => [level, Number.isSafeInteger(bol.position?.[level]) && bol.position[level] > 0 ? bol.position[level] : 1]));
    return { id: bolId, order, text: bol.text.slice(0, 120), position, tags: sanitizeTags(bol.tags), note: typeof bol.note === 'string' ? bol.note : '' };
  });
  return { schemaVersion: 1, id: typeof raw.id === 'string' ? raw.id : fresh.id,
    compositionType: COMPOSITION_TYPES.includes(raw.compositionType) ? raw.compositionType : 'kaida',
    vibhagStructure: structure, talaName: recognizeTala(structure), notes: typeof raw.notes === 'string' ? raw.notes : '',
    bols: normalizePositions(bols), ui: { showSubSubMatra: raw.ui?.showSubSubMatra !== false } };
}
