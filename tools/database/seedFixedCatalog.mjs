import { fileURLToPath } from 'node:url';
import { applySeed } from './seedSql.mjs';

export function seedFixedCatalog() {
  return applySeed(
    new URL('../../database/seeds/fixedCatalogPtBr.sql', import.meta.url),
    'Catálogo fixo pt-BR',
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    await seedFixedCatalog();
  } catch {
    console.error('Não foi possível conectar para aplicar o catálogo fixo.');
    process.exitCode = 1;
  }
}
