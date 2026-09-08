export const TAGS = {
  strikeZone: [
    { id: 'zone-orange', label: 'orange zone', color: 'orange' },
    { id: 'zone-green', label: 'green zone', color: 'green' },
    { id: 'zone-blue', label: 'blue zone', color: 'blue' },
    { id: 'zone-purple', label: 'purple zone', color: 'purple' },
    { id: 'zone-red', label: 'red zone', color: 'red' },
  ],
  leftHandFinger: [{ id: '4-and-3', label: 'left fingers 4 and 3' }, { id: '2', label: 'left finger 2' }],
  rightHandFinger: [{ id: '2', label: 'right finger 2' }, { id: '3-and-4', label: 'right fingers 3 and 4' }, { id: '3', label: 'right finger 3' }],
  bayanDirection: [{ id: 'up', label: 'bayan up' }, { id: 'down', label: 'bayan down' }],
  openClose: [{ id: 'open', label: 'open' }, { id: 'close', label: 'close' }],
};

export const emptyTags = () => ({ strikeZone: null, leftHandFinger: null, rightHandFinger: null, bayanDirection: null, openClose: null, extra: [] });
export const tagDefinition = (group, id) => TAGS[group]?.find(tag => tag.id === id);

export function sanitizeTags(value) {
  const tags = emptyTags();
  if (!value || typeof value !== 'object') return tags;
  for (const group of Object.keys(TAGS)) if (tagDefinition(group, value[group])) tags[group] = value[group];
  tags.extra = Array.isArray(value.extra) ? [...new Set(value.extra.filter(x => typeof x === 'string').map(x => x.slice(0, 120)))] : [];
  return tags;
}

export function applyTagToSelection(bols, ids, group, value) {
  if (!tagDefinition(group, value)) return bols;
  const selected = new Set(ids);
  const targets = bols.filter(bol => selected.has(bol.id));
  const toggleOff = targets.length > 0 && targets.every(bol => bol.tags[group] === value);
  return bols.map(bol => selected.has(bol.id) ? { ...bol, tags: { ...bol.tags, [group]: toggleOff ? null : value } } : bol);
}

export function tagLabels(tags) {
  return [...Object.keys(TAGS).map(group => tagDefinition(group, tags[group])?.label).filter(Boolean), ...(tags.extra || [])];
}
