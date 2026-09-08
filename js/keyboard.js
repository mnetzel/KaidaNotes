// Shortcuts are recited bol sequences. Each item is entered like a single tap.
export const BOL_SEQUENCES = {
  GheGhe: ['Ghe', 'Ghe'],
  'GheGhe (reverse)': ['Ghe', 'Ghe'],
  TeTe: ['Te', 'Te'],
  'TeTe (reverse)': ['Te', 'Te'],
  TeReKeTe: ['Te', 'Re', 'Ke', 'Te'],
  'TeRe / KeTe': ['Te', 'Re', 'Ke', 'Te'],
  TeRe: ['Te', 'Re'],
  KeTe: ['Ke', 'Te'],
  TaKe: ['Ta', 'Ke'],
};

export const expandBolSequence = label => [...(BOL_SEQUENCES[label] ?? [label])];
