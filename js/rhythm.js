export const LEVELS = ['vibhag', 'matra', 'subMatra', 'subSubMatra'];
const firstPosition = () => ({ vibhag: 1, matra: 1, subMatra: 1, subSubMatra: 1 });

export function comparePosition(a, b) {
  for (const level of LEVELS) {
    if (a[level] !== b[level]) return a[level] < b[level] ? -1 : 1;
  }
  return 0;
}

// An edge records the outermost group that starts before this bol.
// 0 = vibhag, 1 = matra, 2 = subMatra, 3 = subSubMatra, 4 = same leaf.
export function deriveBoundaries(bols) {
  return bols.map((bol, index) => {
    if (!index) return 0;
    const depth = LEVELS.findIndex(level => bol.position[level] !== bols[index - 1].position[level]);
    return depth < 0 ? LEVELS.length : depth;
  });
}

export function positionsFromBoundaries(bols, boundaries) {
  let position = firstPosition();
  return bols.map((bol, index) => {
    if (index) {
      const depth = boundaries[index];
      position = { ...position };
      if (depth < LEVELS.length) {
        position[LEVELS[depth]] += 1;
        for (let child = depth + 1; child < LEVELS.length; child++) position[LEVELS[child]] = 1;
      }
    }
    return { ...bol, position: { ...position } };
  });
}

export function normalizePositions(bols) {
  return positionsFromBoundaries(bols, deriveBoundaries(bols));
}

export function getParentScope(bols, level, selectedBolId) {
  const depth = LEVELS.indexOf(level);
  const index = bols.findIndex(bol => bol.id === selectedBolId);
  if (depth < 0 || index < 0) return null;
  const boundaries = deriveBoundaries(bols);
  let start = index;
  let end = index + 1;
  while (start > 0 && boundaries[start] >= depth) start--;
  while (end < bols.length && boundaries[end] >= depth) end++;
  return { start, end, index };
}

export function getBolGroup(bols, level, selectedBolId) {
  const depth = LEVELS.indexOf(level);
  const scope = getParentScope(bols, level, selectedBolId);
  if (!scope) return null;
  const boundaries = deriveBoundaries(bols);
  let start = scope.index;
  let end = start + 1;
  while (start > scope.start && boundaries[start] > depth) start--;
  while (end < scope.end && boundaries[end] > depth) end++;
  return { start, end };
}

export function isFirstInGroup(bols, level, id) {
  const group = getBolGroup(bols, level, id);
  return !!group && bols[group.start].id === id;
}

export function isLastInGroup(bols, level, id) {
  const group = getBolGroup(bols, level, id);
  return !!group && bols[group.end - 1].id === id;
}

export function canJoinNextMatra(bols, selectedBolId) {
  const scope = getParentScope(bols, 'matra', selectedBolId);
  const group = getBolGroup(bols, 'matra', selectedBolId);
  return !!scope && !!group && group.end - group.start === 1 && group.end < scope.end;
}

function editedBoundaries(bols, level, direction, selectedBolId) {
  const scope = getParentScope(bols, level, selectedBolId);
  if (!scope || !['left', 'right'].includes(direction)) return null;
  const depth = LEVELS.indexOf(level);
  const boundaries = deriveBoundaries(bols);
  const { index, start, end } = scope;
  if (direction === 'right') {
    // A singleton matra can pull in exactly the first bol of the next matra.
    // If that next matra has a suffix, keep the suffix in its own matra.
    if (level === 'matra' && canJoinNextMatra(bols, selectedBolId)) {
      boundaries[index + 1] = depth + 1;
      if (index + 2 < end && boundaries[index + 2] > depth) boundaries[index + 2] = depth;
      return boundaries;
    }
    // Split this parent at the anchor; an existing boundary cannot be split twice.
    if (index === start || boundaries[index] <= depth) return null;
    boundaries[index] = depth;
  } else {
    const group = getBolGroup(bols, level, selectedBolId);
    if (group.start === start) return null;
    // Move the prefix through the anchor into the previous group. Preserve child
    // boundaries, and leave the remaining suffix in its own group.
    boundaries[group.start] = Math.min(depth + 1, LEVELS.length);
    if (index + 1 < end && boundaries[index + 1] > depth) boundaries[index + 1] = depth;
  }
  return boundaries;
}

export function canMoveBoundary(bols, level, direction, selectedBolId) {
  return editedBoundaries(bols, level, direction, selectedBolId) !== null;
}

export function moveBoundary(bols, level, direction, selectedBolId) {
  const boundaries = editedBoundaries(bols, level, direction, selectedBolId);
  if (!boundaries) return bols;
  if (level === 'matra') {
    // Matra edits stay within their vibhag, including after another row was cleared.
    const { start, end } = getParentScope(bols, level, selectedBolId);
    const row = positionsFromBoundaries(bols.slice(start, end), boundaries.slice(start, end))
      .map(bol => ({ ...bol, position: { ...bol.position, vibhag: bols[start].position.vibhag } }));
    return [...bols.slice(0, start), ...row, ...bols.slice(end)];
  }
  return positionsFromBoundaries(bols, boundaries);
}

export function moveSelectedAtLevel({ composition, selectedBolId, level, direction }) {
  const bols = moveBoundary(composition.bols, level, direction, selectedBolId);
  return bols === composition.bols ? composition : { ...composition, bols };
}

export function vibhagLength(structure, vibhag) {
  return structure.length ? structure[(vibhag - 1) % structure.length] : null;
}

export function nextPosition(bols, _structure, forceVibhag = false) {
  if (!bols.length) return firstPosition();
  const last = bols.at(-1).position;
  if (forceVibhag) {
    return { ...firstPosition(), vibhag: last.vibhag + 1 };
  }
  return { ...firstPosition(), vibhag: last.vibhag, matra: last.matra + 1 };
}

export function validateRhythm(bols) {
  const normalized = normalizePositions(bols);
  return bols.every((bol, i) => LEVELS.every(level =>
    Number.isSafeInteger(bol.position[level]) && bol.position[level] >= 1 &&
    bol.position[level] === normalized[i].position[level]) &&
    (!i || (bol.order > bols[i - 1].order && comparePosition(bols[i - 1].position, bol.position) <= 0))) &&
    new Set(bols.map(bol => bol.id)).size === bols.length;
}
