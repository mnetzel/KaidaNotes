import { appendBol, createComposition } from './model.js';

export function endCursor(composition) {
  const last = composition.bols.at(-1)?.position;
  return { vibhag: last?.vibhag ?? 1, matra: (last?.matra ?? 0) + 1 };
}

export function insertAtCursor(composition, text, cursor) {
  const { vibhag, matra } = cursor;
  if (!Number.isSafeInteger(vibhag) || !Number.isSafeInteger(matra) || vibhag < 1 || matra < 1) return composition;
  if (composition.bols.some(b => b.position.vibhag === vibhag && b.position.matra === matra)) return composition;
  const added = appendBol(createComposition(), text).bols.map(b => ({ ...b, position: { ...b.position, vibhag, matra: b.position.matra + matra - 1 } }));
  const lastMatra = added.at(-1).position.matra;
  const next = composition.bols.find(b => b.position.vibhag === vibhag && b.position.matra > matra);
  const shift = next ? Math.max(0, lastMatra - next.position.matra + 1) : 0;
  const before = composition.bols.filter(b => b.position.vibhag < vibhag || (b.position.vibhag === vibhag && b.position.matra < matra));
  const after = composition.bols.filter(b => b.position.vibhag > vibhag || (b.position.vibhag === vibhag && b.position.matra > matra)).map(b => shift && b.position.vibhag === vibhag ? { ...b, position: { ...b.position, matra: b.position.matra + shift } } : b);
  const bols = [...before, ...added, ...after].map((b, i) => ({ ...b, order: i + 1 }));
  return { ...composition, bols, ui: { ...composition.ui, entryVibhag: bols.at(-1).position.vibhag } };
}
