import { validateClapCapture } from './clap-data.js';
import { normalizePositions, nextPosition, LEVELS, deriveBoundaries, positionsFromBoundaries } from './rhythm.js';
import { emptyTags, sanitizeTags } from './tags.js';
import { expandBolSequence, SINGLE_MATRA_SHORTCUTS } from './keyboard.js';
import { recognizeTala } from './talas.js';
export { recognizeTala } from './talas.js';

export const COMPOSITION_TYPES = ['kaida', 'palta', 'rela', 'part-practice'];
export const id = prefix => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;

export function createComposition() {
  return { schemaVersion: 2, id: id('composition'), compositionType: 'kaida', talaName: 'Tintal',
    vibhagStructure: [4, 4, 4, 4], notes: '', bols: [], ui: { showSubSubMatra: false } };
}

export function appendBol(composition, text, forceVibhag = false) {
  return expandBolSequence(text).reduce((current, bol, index) => appendSingleBol(current, bol, forceVibhag && index === 0, SINGLE_MATRA_SHORTCUTS.has(text) && index > 0), composition);
}

function appendSingleBol(composition, text, forceVibhag, sameMatra = false) {
  const previous = composition.bols.at(-1)?.position;
  const position = sameMatra && previous
    ? { ...previous, subMatra: previous.subMatra + 1, subSubMatra: 1 }
    : nextPosition(composition.bols, composition.vibhagStructure, forceVibhag);
  const bol = { id: id('bol'), order: (composition.bols.at(-1)?.order ?? 0) + 1, text,
    position, tags: emptyTags(), note: '' };
  return { ...composition, bols: [...composition.bols, bol] };
}

export function insertPause(composition, selectedBolId, side) {
  const target = composition.bols.find(b => b.id === selectedBolId);
  if (!target || !['before', 'after'].includes(side)) return composition;
  const sameMatra = b => b.position.vibhag === target.position.vibhag && b.position.matra === target.position.matra;
  const group = composition.bols.filter(sameMatra);
  const index = group.findIndex(b => b.id === selectedBolId);
  const sharedSubMatra = group.filter(b => b.position.subMatra === target.position.subMatra).length > 1;
  const depth = sharedSubMatra ? 3 : 2;
  const edges = deriveBoundaries(group);
  const at = index + (side === 'after' ? 1 : 0);
  const incoming = side === 'before' ? Math.min(edges[at], depth) : depth;
  const pause = { id: id('bol'), order: 0, text: '—', position: { ...target.position }, tags: emptyTags(), note: '' };
  group.splice(at, 0, pause);
  edges.splice(at, 0, incoming);
  if (at + 1 < edges.length) edges[at + 1] = side === 'before' ? depth : Math.min(edges[at + 1], depth);
  const updated = positionsFromBoundaries(group, edges).map(b => ({ ...b, position: { ...b.position, vibhag: target.position.vibhag, matra: target.position.matra } }));
  const first = composition.bols.findIndex(sameMatra);
  const bols = [...composition.bols.slice(0, first), ...updated, ...composition.bols.slice(first + group.length - 1)].map((b, i) => ({ ...b, order: i + 1 }));
  return { ...composition, bols };
}

// Keep empty vibhags and surrounding rows in place when deleting/refilling.
export function appendToVibhag(composition, text, vibhag) {
  const row = composition.bols.filter(b => b.position.vibhag === vibhag);
  const appended = appendBol({ ...composition, bols: row }, text).bols.map(b => ({ ...b, position: { ...b.position, vibhag } }));
  const bols = [...composition.bols.filter(b => b.position.vibhag < vibhag), ...appended, ...composition.bols.filter(b => b.position.vibhag > vibhag)];
  return { ...composition, bols: bols.map((b, i) => ({ ...b, order: i + 1 })), ui: { ...composition.ui, entryVibhag: vibhag } };
}

export function clearVibhag(composition, vibhag) {
  return { ...composition, bols: composition.bols.filter(b => b.position.vibhag !== vibhag), ui: { ...composition.ui, entryVibhag: vibhag } };
}

export function deleteBol(composition, bolId, { preserveMatra = false } = {}) {
  const target = composition.bols.find(b => b.id === bolId);
  if (!target) return composition;
  if (preserveMatra) {
    const bols = normalizeRetainingVibhags(composition.bols.filter(b => b.id !== bolId));
    const emptyMatras = [...(composition.ui.emptyMatras ?? [])];
    const { vibhag, matra } = target.position;
    if (!bols.some(b => b.position.vibhag === vibhag && b.position.matra === matra) &&
        !emptyMatras.some(p => p.vibhag === vibhag && p.matra === matra)) emptyMatras.push({ vibhag, matra });
    return { ...composition, bols, ui: { ...composition.ui, emptyMatras } };
  }
  const row = normalizePositions(composition.bols.filter(b => b.position.vibhag === target.position.vibhag && b.id !== bolId));
  const byId = new Map(row.map(b => [b.id, { ...b, position: { ...b.position, vibhag: target.position.vibhag } }]));
  return { ...composition, bols: composition.bols.filter(b => b.id !== bolId).map(b => byId.get(b.id) ?? b), ui: { ...composition.ui, entryVibhag: target.position.vibhag } };
}

function normalizeRetainingVibhags(bols) {
  const normalized = normalizePositions(bols);
  // Preserve valid nondecreasing row numbers, including intentionally empty rows.
  if (bols.some((b, i) => i && (b.position.vibhag < bols[i - 1].position.vibhag || (b.position.vibhag === bols[i - 1].position.vibhag && b.position.matra < bols[i - 1].position.matra)))) return normalized;
  return normalized.map((b, i) => ({ ...b, position: { ...b.position, vibhag: bols[i].position.vibhag,
    matra: bols[i].position.matra } }));
}

export function replaceBol(composition, selectedBolId, text) {
  // Correction changes just one recited syllable, never its identity or address.
  if (expandBolSequence(text).length !== 1 || !text.trim()) return composition;
  const target = composition.bols.find(bol => bol.id === selectedBolId);
  if (!target || target.text === text) return composition;
  return { ...composition, bols: composition.bols.map(bol => bol.id === selectedBolId ? { ...bol, text } : bol) };
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
  return { ...(raw.clapping !== undefined ? { clapping: validateClapCapture(raw.clapping) } : {}), schemaVersion: 2, id: typeof raw.id === 'string' ? raw.id : fresh.id,
    compositionType: COMPOSITION_TYPES.includes(raw.compositionType) ? raw.compositionType : 'kaida',
    vibhagStructure: structure, talaName: recognizeTala(structure), notes: typeof raw.notes === 'string' ? raw.notes : '',
    bols: expandLegacyCompounds(normalizeRetainingVibhags(bols)), ui: { showSubSubMatra: raw.ui?.showSubSubMatra === true,
      ...(Array.isArray(raw.ui?.emptyMatras) ? { emptyMatras: raw.ui.emptyMatras.filter(p => p && Number.isSafeInteger(p.vibhag) && p.vibhag > 0 && p.vibhag <= 10000 && Number.isSafeInteger(p.matra) && p.matra > 0 && p.matra <= 10000).map(({vibhag, matra}) => ({vibhag, matra})) } : {}), ...(Number.isSafeInteger(raw.ui?.entryVibhag) && raw.ui.entryVibhag > 0 ? { entryVibhag: raw.ui.entryVibhag } : {}) } };
}
