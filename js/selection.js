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

export const createBolInteraction = () => ({ id: null, clicks: 0, editingId: null });

export function clickNotationBol(selection, interaction, bols, id) {
  const bol = bols.find(value => value.id === id);
  if (!bol) return { selection, interaction };
  const clicks = interaction.id === id ? Math.min(interaction.clicks + 1, 3) : 1;
  if (clicks === 3) return {
    selection: { ...selection, ids: [id] },
    interaction: { id, clicks, editingId: id },
  };
  if (clicks === 2) return {
    selection: { ...selection, ids: [...bols.filter(value => value.text === bol.text && value.id !== id).map(value => value.id), id] },
    interaction: { id, clicks, editingId: null },
  };
  return { selection: selectBol(selection, id), interaction: { id, clicks, editingId: null } };
}
