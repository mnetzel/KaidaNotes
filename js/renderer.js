import { LEVELS, canMoveBoundary, vibhagLength } from './rhythm.js';
import { getPrimarySelection } from './selection.js';
import { tagDefinition, tagLabels } from './tags.js';

const element = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

export function bolColor(bol) {
  const color = tagDefinition('strikeZone', bol.tags.strikeZone)?.color;
  return color ? `var(--${color}${color === 'purple' ? '-strong' : ''})` : '';
}

function bolButton(bol, selection, debug) {
  const selected = selection.ids.includes(bol.id);
  const primary = getPrimarySelection(selection) === bol.id;
  const button = element('button', `notation-bol${selected ? ' selected' : ''}${primary ? ' primary' : ''}${bol.text.length > 5 ? ' compound' : ''}`);
  button.type = 'button';
  button.dataset.bolId = bol.id;
  button.setAttribute('aria-pressed', String(selected));
  const labels = tagLabels(bol.tags);
  button.setAttribute('aria-label', `${bol.text}, bol ${bol.order}, ${LEVELS.map(level => `${level} ${bol.position[level]}`).join(', ')}${labels.length ? `, ${labels.join(', ')}` : ''}${primary ? ', primary selection' : ''}`);
  button.title = labels.join(' · ') || `${bol.text} — select to annotate`;
  const text = element('span', 'notation-text', bol.text);
  text.style.color = bolColor(bol);
  button.append(text);
  const markers = element('span', 'tag-markers');
  markers.setAttribute('aria-hidden', 'true');
  for (const [group, cls] of [['leftHandFinger', 'finger-left'], ['rightHandFinger', 'finger-right']]) {
    if (bol.tags[group]) markers.append(element('span', cls, `●${bol.tags[group].replaceAll('-and-', '+')}`));
  }
  if (bol.tags.bayanDirection) markers.append(element('span', 'execution', bol.tags.bayanDirection === 'up' ? '↑' : '↓'));
  if (bol.tags.openClose) markers.append(element('span', 'execution', bol.tags.openClose === 'open' ? '○' : '×'));
  if (bol.tags.extra.length) markers.append(element('span', 'execution', '+'));
  if (markers.childNodes.length) button.append(markers);
  if (debug) button.append(element('small', 'address-debug', LEVELS.map(level => bol.position[level]).join(':')));
  return button;
}

export function renderNotation(container, composition, selection, debug = false) {
  const focused = document.activeElement?.dataset.bolId;
  const fragment = document.createDocumentFragment();
  if (!composition.bols.length) fragment.append(element('p', 'notation-empty', 'Tap the drum keyboard to start your composition.'));
  const rows = new Map();
  // Traverse the immutable sequence. Never sort by an editable address.
  for (const bol of composition.bols) {
    const vibhag = bol.position.vibhag;
    if (!rows.has(vibhag)) rows.set(vibhag, []);
    rows.get(vibhag).push(bol);
  }
  const count = Math.max(composition.vibhagStructure.length, composition.bols.at(-1)?.position.vibhag ?? 1);
  for (let vibhag = 1; vibhag <= count; vibhag++) {
    const row = element('div', 'vibhag-row');
    row.setAttribute('aria-label', `Vibhag ${vibhag}`);
    const bols = rows.get(vibhag) ?? [];
    const expected = vibhagLength(composition.vibhagStructure, vibhag);
    const actual = bols.at(-1)?.position.matra ?? 0;
    const label = element('div', 'vibhag-label');
    label.append(element('span', 'count', expected ?? (actual || '–')));
    label.title = `Vibhag ${vibhag}${expected ? ` · ${expected} matras in structure` : ''}`;
    if (expected && actual > expected) label.append(element('small', '', `${actual} entered`));
    row.append(label);
    const matras = element('div', 'matras');
    let matra = null;
    let previous = null;
    for (const bol of bols) {
      if (!previous || bol.position.matra !== previous.position.matra) {
        matra = element('div', 'matra');
        matra.setAttribute('aria-label', `Matra ${bol.position.matra}`);
        matras.append(matra);
      } else if (bol.position.subMatra === previous.position.subMatra && bol.position.subSubMatra !== previous.position.subSubMatra) {
        const separator = element('span', 'subsub-separator', '/');
        separator.setAttribute('aria-hidden', 'true');
        matra.append(separator);
      }
      matra.append(bolButton(bol, selection, debug));
      previous = bol;
    }
    for (let i = actual; i < (expected ?? (actual || 1)); i++) {
      const empty = element('div', 'matra empty-matra');
      empty.setAttribute('aria-label', `Matra ${i + 1}, empty`);
      matras.append(empty);
    }
    row.append(matras);
    fragment.append(row);
  }
  container.replaceChildren(fragment);
  if (focused) [...container.querySelectorAll('[data-bol-id]')].find(node => node.dataset.bolId === focused)?.focus({ preventScroll: true });
}

export function renderInspector(composition, selection) {
  const primaryId = getPrimarySelection(selection);
  const bol = composition.bols.find(value => value.id === primaryId);
  const preview = document.querySelector('#selected-bol');
  preview.textContent = bol?.text ?? '—';
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
      button.disabled = !bol || !canMoveBoundary(composition.bols, level, direction, primaryId);
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
  help.textContent = bol ? (tagLabels(bol.tags).join(' · ') || '← join the previous group · → start a group at this bol. Drum controls add execution tags.') : 'Select a bol below the drums to edit its rhythm and execution.';

  const selected = composition.bols.filter(value => selection.ids.includes(value.id));
  document.querySelectorAll('[data-tag-group]').forEach(button => {
    const { tagGroup, tag } = button.dataset;
    const matches = selected.filter(value => value.tags[tagGroup] === tag).length;
    button.disabled = !selected.length;
    button.setAttribute('aria-pressed', matches && matches < selected.length ? 'mixed' : String(!!matches));
    button.title = `${tagDefinition(tagGroup, tag)?.label ?? tag}${selected.length ? ' — apply to selection' : ' — select a bol first'}`;
  });
}
