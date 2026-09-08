import { normalizePositions, nextPosition, LEVELS, deriveBoundaries, positionsFromBoundaries } from './rhythm.js';
import { emptyTags, sanitizeTags } from './tags.js';
import { expandBolSequence } from './keyboard.js';
import { recognizeTala } from './talas.js';
export { recognizeTala } from './talas.js';

export const COMPOSITION_TYPES = ['kaida', 'palta', 'rela', 'part-practice'];
export const id = prefix => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;

export function createComposition() {
  return { schemaVersion: 2, id: id('composition'), compositionType: 'kaida', talaName: 'Tintal',
    vibhagStructure: [4, 4, 4, 4], notes: '', bols: [], ui: { showSubSubMatra: true } };
}

export function appendBol(composition, text, forceVibhag = false) {
  return expandBolSequence(text).reduce((current, bol, index) => appendSingleBol(current, bol, forceVibhag && index === 0), composition);
}

function appendSingleBol(composition, text, forceVibhag) {
  const bol = { id: id('bol'), order: (composition.bols.at(-1)?.order ?? 0) + 1, text,
    position: nextPosition(composition.bols, composition.vibhagStructure, forceVibhag), tags: emptyTags(), note: '' };
  return { ...composition, bols: [...composition.bols, bol] };
}

function expandLegacyCompounds(bols) {
  if (!bols.some(bol => expandBolSequence(bol.text).length > 1)) return bols;
  const edges = deriveBoundaries(bols);
  const expanded = [];
  const expandedEdges = [];
  for (let index = 0; index < bols.length; index++) {
    const bol = bols[index];
    // Keep previously edited parent groups. If the old bol already shares a
    // subMatra with another token, subdivide at the deeper level instead.
    const sharesSubMatra = [bols[index - 1], bols[index + 1]].some(other => other &&
      ['vibhag', 'matra', 'subMatra'].every(level => other.position[level] === bol.position[level]));
    expandBolSequence(bol.text).forEach((text, part) => {
      expanded.push({ ...bol, text, id: part ? id('bol') : bol.id, order: expanded.length + 1,
        tags: sanitizeTags(bol.tags), note: part ? '' : bol.note });
      expandedEdges.push(part ? (sharesSubMatra ? 3 : 2) : edges[index]);
    });
  }
  return positionsFromBoundaries(expanded, expandedEdges);
}

export function sanitizeComposition(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid composition');
  if (raw.schemaVersion !== undefined && ![1, 2].includes(raw.schemaVersion)) throw new Error('Unsupported document version');
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
  return { schemaVersion: 2, id: typeof raw.id === 'string' ? raw.id : fresh.id,
    compositionType: COMPOSITION_TYPES.includes(raw.compositionType) ? raw.compositionType : 'kaida',
    vibhagStructure: structure, talaName: recognizeTala(structure), notes: typeof raw.notes === 'string' ? raw.notes : '',
    bols: expandLegacyCompounds(normalizePositions(bols)), ui: { showSubSubMatra: raw.ui?.showSubSubMatra !== false } };
}
