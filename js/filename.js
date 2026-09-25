export function compositionFilename(composition, extension) {
  const rows = [];
  let previousVibhag;
  for (const bol of composition.bols) {
    if (bol.position.vibhag !== previousVibhag) rows.push('');
    rows[rows.length - 1] += bol.text;
    previousVibhag = bol.position.vibhag;
  }
  const phrase = rows.join('_').replace(/\s+/g, '').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-');
  // Leave room for the extension within common filesystem filename limits.
  let name = '', bytes = 0;
  const encoder = new TextEncoder();
  for (const character of phrase) {
    bytes += encoder.encode(character).length;
    if (bytes > 240) break;
    name += character;
  }
  name = name.replace(/\.+$/, '') || 'Kaida';
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) name = `Kaida_${name}`;
  return `${name}.${extension}`;
}
