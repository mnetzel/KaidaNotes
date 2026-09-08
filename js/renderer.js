import { LEVELS, canMoveBoundary, canJoinNextMatra, vibhagLength } from './rhythm.js';
import { getPrimarySelection } from './selection.js';
import { tagDefinition, tagLabels } from './tags.js';

const element = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

export function bolColor(bol) {
  const color = tagDefinition('dayanArticulation', bol.tags.dayanArticulation)?.color;
  return color ? `var(--${color}${color === 'purple' ? '-strong' : ''})` : '';
}

function bolButton(bol, selection, debug, editingId) {
  const editing = bol.id === editingId;
  const selected = selection.ids.includes(bol.id);
  const primary = getPrimarySelection(selection) === bol.id;
  const button = element('button', `notation-bol${selected ? ' selected' : ''}${primary ? ' primary' : ''}${editing ? ' editing' : ''}${bol.text.length > 5 ? ' compound' : ''}`);
  button.type = 'button';
  button.dataset.bolId = bol.id;
  button.setAttribute('aria-pressed', String(selected));
  const labels = tagLabels(bol.tags);
  button.setAttribute('aria-label', `${bol.text}, bol ${bol.order}, ${LEVELS.map(level => `${level} ${bol.position[level]}`).join(', ')}${labels.length ? `, ${labels.join(', ')}` : ''}${primary ? ', primary selection' : ''}`);
  button.title = labels.join(' · ') || `${bol.text} — select to annotate`;
  if (editing) button.setAttribute('aria-label', `Replace ${bol.text}, bol ${bol.order}: choose a new bol on the keyboard`);
  const text = element('span', 'notation-text', editing ? '\u00a0' : bol.text);
  text.style.color = bolColor(bol);
  button.append(text);
  const markers = element('span', 'tag-markers');
  markers.setAttribute('aria-hidden', 'true');
  for (const [group, cls] of [['leftHandFinger', 'finger-left'], ['rightHandFinger', 'finger-right']]) {
    if (bol.tags[group]) markers.append(element('span', cls, bol.tags[group].replaceAll('-and-', '+')));
  }
  if (bol.tags.membraneControl === 'right-4') markers.append(element('span', 'membrane-control-marker', '●'));
  if (bol.tags.bayanDirection) markers.append(element('span', 'execution', bol.tags.bayanDirection === 'up' ? '↑' : '↓'));
  if (bol.tags.openClose) markers.append(element('span', 'execution', bol.tags.openClose === 'open' ? '○' : '×'));
  if (bol.tags.extra.length) markers.append(element('span', 'execution', '+'));
  if (!editing && markers.childNodes.length) button.append(markers);
  if (debug) button.append(element('small', 'address-debug', LEVELS.map(level => bol.position[level]).join(':')));
  return button;
}

export function renderNotation(container, composition, selection, debug = false, editingId = null, cursor = null) {
  const focused = document.activeElement?.dataset.bolId;
  // Every row uses the same columns, independent of its bol count or overflow.
  container.style.setProperty('--matra-columns', String(Math.max(1, ...composition.vibhagStructure, composition.vibhagStructure.length ? 1 : 4)));
  const fragment = document.createDocumentFragment();
  if (!composition.bols.length) fragment.append(element('p', 'notation-empty', 'Tap the drum keyboard to start your composition.'));
  const rows = new Map();
  // Traverse the immutable sequence. Never sort by an editable address.
  for (const bol of composition.bols) {
    const vibhag = bol.position.vibhag;
    if (!rows.has(vibhag)) rows.set(vibhag, []);
    rows.get(vibhag).push(bol);
  }
  const count = Math.max(composition.vibhagStructure.length, composition.bols.at(-1)?.position.vibhag ?? 1, cursor?.vibhag ?? 1, ...(composition.ui.emptyMatras ?? []).map(p => p.vibhag));
  for (let vibhag = 1; vibhag <= count; vibhag++) {
    const row = element('div', 'vibhag-row');
    row.setAttribute('aria-label', `Vibhag ${vibhag}`);
    const bols = rows.get(vibhag) ?? [];
    const expected = vibhagLength(composition.vibhagStructure, vibhag);
    const actual = bols.at(-1)?.position.matra ?? 0;
    const label = element('div', 'vibhag-label');
    label.append(element('span', 'count', expected ?? (actual || '–')));
    label.title = `Vibhag ${vibhag}${expected ? ` · ${expected} matras in structure` : ''}`;
    if (expected && actual > expected) {
      label.classList.add('overfull');
      label.setAttribute('aria-label', `Vibhag ${vibhag}: ${actual} matras entered, target ${expected} exceeded`);
      label.title += ` · ${actual} entered — target exceeded`;
    }
    row.append(label);
    const matras = element('div', 'matras');
    const cells = new Map();
    let matra = null;
    let previous = null;
    for (const bol of bols) {
      if (!previous || bol.position.matra !== previous.position.matra) {
        matra = element('div', 'matra');
        matra.setAttribute('aria-label', `Matra ${bol.position.matra}`);
        cells.set(bol.position.matra, matra);
      }
      matra.append(bolButton(bol, selection, debug, editingId));
      previous = bol;
    }
    const visibleMatras = Math.max(expected ?? (actual || 1), actual, cursor?.vibhag === vibhag ? cursor.matra : 0, ...(composition.ui.emptyMatras ?? []).filter(p => p.vibhag === vibhag).map(p => p.matra));
    for (let i = 1; i <= visibleMatras; i++) {
      const cell = cells.get(i) ?? element('button', 'matra empty-matra');
      if (!cells.has(i)) {
        cell.type = 'button';
        cell.dataset.emptyMatra = i;
        cell.dataset.vibhag = vibhag;
        cell.setAttribute('aria-label', `Vibhag ${vibhag}, matra ${i}, empty: place entry cursor here`);
      }
      if (cursor?.vibhag === vibhag && cursor.matra === i) {
        cell.classList.add('entry-cursor');
        cell.setAttribute('aria-current', 'location');
        cell.title = 'The next bol will appear here';
      }
      matras.append(cell);
    }
    row.append(matras);
    fragment.append(row);
  }
  fragment.querySelectorAll('.matra').forEach(cell => {
    cell.classList.toggle('dense', cell.querySelectorAll('.notation-bol').length > 1);
  });
  container.replaceChildren(fragment);
  const cursorKey = cursor ? `${cursor.vibhag}:${cursor.matra}` : '';
  if (container.dataset.cursor !== cursorKey) {
    container.dataset.cursor = cursorKey;
    const marker = container.querySelector('.entry-cursor');
    if (marker) {
      const panel = container.getBoundingClientRect();
      const rect = marker.getBoundingClientRect();
      const scale = panel.width / container.offsetWidth || 1;
      if (rect.right > panel.right) container.scrollLeft += (rect.right - panel.right) / scale;
      else if (rect.left < panel.left) container.scrollLeft -= (panel.left - rect.left) / scale;
    }
  }
  if (focused) [...container.querySelectorAll('[data-bol-id]')].find(node => node.dataset.bolId === focused)?.focus({ preventScroll: true });
}

export function renderInspector(composition, selection, editingId = null) {
  const primaryId = getPrimarySelection(selection);
  const bol = composition.bols.find(value => value.id === primaryId);
  const preview = document.querySelector('#selected-bol');
  preview.textContent = editingId ? '\u00a0' : (bol?.text ?? '—');
  preview.classList.toggle('editing', !!editingId);
  preview.classList.toggle('compound', (bol?.text.length ?? 0) > 5);
  preview.style.color = bol ? bolColor(bol) : '';
  document.querySelector('#selection-count').textContent = selection.ids.length > 1 ? `${selection.ids.length} selected · last is anchor` : '';
  const container = document.querySelector('#address-controls');
  const focused = document.activeElement;
  const focusKey = focused?.dataset.level ? { level: focused.dataset.level, direction: focused.dataset.direction } : null;
  const fragment = document.createDocumentFragment();
  for (const level of LEVELS) {
    if (level === 'subSubMatra' && !composition.ui.showSubSubMatra) continue;
    const group = element('div', 'address-group');
    group.append(element('span', 'address-number', bol?.position[level] ?? '–'));
    for (const direction of ['left', 'right']) {
      const button = element('button', 'address-arrow', direction === 'left' ? '⟵' : '⟶');
      button.type = 'button';
      button.dataset.level = level;
      button.dataset.direction = direction;
      button.setAttribute('aria-label', `${level} ${direction}`);
      button.title = direction === 'left' ? `Join the previous ${level} through this bol` : `Start a new ${level} at this bol`;
      if (level === 'matra' && direction === 'right' && canJoinNextMatra(composition.bols, primaryId)) button.title = 'Join the first bol of the next matra to this bol';
      button.disabled = !!editingId || !bol || !canMoveBoundary(composition.bols, level, direction, primaryId);
      group.append(button);
    }
    group.append(element('span', 'address-label', level === 'vibhag' ? 'vibhāg' : level));
    if (level === 'subSubMatra') {
      const hide = element('button', 'hide-subsub', '×');
      hide.type = 'button'; hide.id = 'hide-subsub';
      hide.setAttribute('aria-label', 'Hide subSubMatra controls');
      group.append(hide);
    }
    fragment.append(group);
  }
  container.replaceChildren(fragment);
  if (focusKey) container.querySelector(`[data-level="${focusKey.level}"][data-direction="${focusKey.direction}"]`)?.focus({ preventScroll: true });
  document.querySelector('#show-subsub').hidden = composition.ui.showSubSubMatra;
  const help = document.querySelector('#selection-help');
  help.textContent = editingId ? `Replace ${bol?.text}: tap one bol on the drum keyboard, or cancel.` : bol ? (tagLabels(bol.tags).join(' · ') || 'Tap again: select all matching bols. Third tap: replace this bol.') : 'Tap a bol: select it. Again: select all matching bols. Third tap: replace it.';

  const selected = composition.bols.filter(value => selection.ids.includes(value.id));
  document.querySelectorAll('[data-tag-group]').forEach(button => {
    const { tagGroup, tag } = button.dataset;
    const matches = selected.filter(value => value.tags[tagGroup] === tag).length;
    button.disabled = !!editingId || !selected.length;
    button.setAttribute('aria-pressed', matches && matches < selected.length ? 'mixed' : String(!!matches));
    button.title = `${tagDefinition(tagGroup, tag)?.label ?? tag}${selected.length ? ' — apply to selection' : ' — select a bol first'}`;
  });
}
