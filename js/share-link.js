import { sanitizeComposition } from './model.js';

export const MAX_LINK_LENGTH = 64000;
export const MAX_DOCUMENT_BYTES = 1000000;
const canonical = value => JSON.stringify(value, function (key, item) {
  return item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(name => [name, item[name]])) : item;
});
const invalid = () => new Error('This Kaida link is incomplete or invalid. Ask the sender to copy the full link again.');

async function readLimited(stream, limit) {
  const reader = stream.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) { await reader.cancel(); throw new Error('This composition is too large for a share link.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}

export async function createShareLink(composition, pageURL) {
  if (typeof CompressionStream === 'undefined') throw new Error('Update your browser to create Kaida links.');
  const bytes = new TextEncoder().encode(JSON.stringify(composition));
  if (bytes.length > MAX_DOCUMENT_BYTES) throw new Error('This composition is too large for a share link.');
  const compressed = await readLimited(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip')), MAX_DOCUMENT_BYTES);
  const encoded = btoa(Array.from(compressed, byte => String.fromCharCode(byte)).join('')).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  const url = new URL(pageURL);
  url.search = '';
  url.hash = `kaida=1.${encoded}`;
  if (url.href.length > MAX_LINK_LENGTH) throw new Error('This composition is too large for one link. Share a shorter section instead.');
  return url.href;
}

export async function readShareLink(hash) {
  if (!hash.startsWith('#kaida=')) return null;
  if (hash.length > MAX_LINK_LENGTH) throw invalid();
  const match = /^#kaida=1\.([A-Za-z0-9_-]+)$/.exec(hash);
  if (!match) throw invalid();
  if (typeof DecompressionStream === 'undefined') throw new Error('Update your browser to open this Kaida link.');
  try {
    const bytes = Uint8Array.from(atob(match[1].replaceAll('-', '+').replaceAll('_', '/')), char => char.charCodeAt(0));
    const json = await readLimited(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')), MAX_DOCUMENT_BYTES);
    const raw = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(json));
    if (raw?.schemaVersion !== 2 || !Array.isArray(raw.bols) || raw.bols.length > 10000 || !Array.isArray(raw.vibhagStructure)) throw invalid();
    if (raw.bols.some(b => !b || typeof b.text !== 'string' || !b.position || !Number.isSafeInteger(b.position.vibhag) || b.position.vibhag < 1 || b.position.vibhag > 10000)) throw invalid();
    if (raw.ui?.entryVibhag > 10000) throw invalid();
    const composition = sanitizeComposition(raw);
    // Reject a damaged or unsupported document rather than silently dropping data.
    if (canonical(composition) !== canonical(raw)) throw invalid();
    return composition;
  } catch { throw invalid(); }
}
