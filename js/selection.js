export const createSelection = () => ({ multi: false, ids: [] });
export const getPrimarySelection = selection => selection.ids.at(-1) ?? null;
export function selectBol(selection, id) {
  if (!selection.multi) return { ...selection, ids: [id] };
  return { ...selection, ids: selection.ids.includes(id) ? selection.ids.filter(value => value !== id) : [...selection.ids, id] };
}
export function setMultiSelect(selection, enabled) {
  return { multi: enabled, ids: enabled ? selection.ids : selection.ids.slice(-1) };
}
export const clearSelection = selection => ({ ...selection, ids: [] });
