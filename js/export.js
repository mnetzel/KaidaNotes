import { recognizeTala } from './model.js';
import { tagLabels } from './tags.js';

export function exportNotation(composition, complete = false) {
  const type = composition.compositionType.replaceAll('-', ' ').toUpperCase();
  const tala = recognizeTala(composition.vibhagStructure);
  const lines = [`${type}${tala ? ` — ${tala.toUpperCase()}` : ''}`, ''];
  let previous = null;
  let row = '';
  for (const bol of composition.bols) {
    const p = bol.position;
    if (!previous || p.vibhag !== previous.vibhag) {
      if (row) lines.push(`${row} |`);
      row = `V${p.vibhag}: | `;
    } else if (p.matra !== previous.matra) row += ' | ';
    // Bols inside one matra form one continuous written phrase.
    row += bol.text;
    if (complete) {
      const labels = tagLabels(bol.tags);
      if (bol.note) labels.push(`note: ${bol.note}`);
      if (labels.length) row += `{${labels.join('; ')}}`;
    }
    previous = p;
  }
  if (row) lines.push(`${row} |`);
  if (composition.notes.trim()) lines.push('', 'Notes:', composition.notes.trim());
  return lines.join('\n');
}

export const exportBasic = composition => exportNotation(composition);
export const exportComplete = composition => exportNotation(composition, true);

export async function shareText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
