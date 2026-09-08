// Each shortcut expands to independent bols. Selected shortcuts share one matra.
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

export const SINGLE_MATRA_SHORTCUTS = new Set(['TeTe', 'TeReKeTe', 'TeRe / KeTe', 'TaKe', 'TeRe', 'KeTe']);
