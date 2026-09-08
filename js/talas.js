// Common structures, not unique identifications: different thekas may share one.
// Source: https://digitabla.com/reference/tals-and-thekas/extended-list/
export const TALAS = [
  { name: 'Tintal', structure: [4, 4, 4, 4], alternatives: ['Tilwara', 'Sitarkhani', 'Panjabi'] },
  { name: 'Kaherwa', structure: [4, 4], alternatives: ['Dhumali'] },
  { name: 'Dadra', structure: [3, 3], alternatives: [] },
  { name: 'Rupak', structure: [3, 2, 2], alternatives: ['Pashto'] },
  { name: 'Jhaptal', structure: [2, 3, 2, 3], alternatives: [] },
  { name: 'Ektal', structure: [2, 2, 2, 2, 2, 2], alternatives: ['Chautal'] },
  { name: 'Deepchandi', structure: [3, 4, 3, 4], alternatives: ['Jhumra'] },
  { name: 'Dhamar', structure: [5, 2, 3, 4], alternatives: [] },
  { name: 'Sultal', structure: [2, 2, 2, 2, 2], alternatives: [] },
];

export const matchTala = structure => TALAS.find(tala => tala.structure.join(',') === structure.join(',')) ?? null;
export const recognizeTala = structure => matchTala(structure)?.name ?? (structure.length ? 'Custom' : '');
