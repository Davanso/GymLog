const conventions: Record<string, string> = {
  total: 'Kg/total',
  per_hand: 'Kg/mão',
  machine: 'Kg/máquina',
  added: 'Kg/adicional',
  assistance: 'Kg/assistência',
};
export function loadLabel(convention: string) {
  return conventions[convention] || 'Kg';
}
