import { fileURLToPath } from 'node:url';
import { applySeed } from './seedSql.mjs';

export async function seedCuratedExercises() {
  return applySeed(
    new URL('../../database/seeds/curatedExercisesPtBr.sql', import.meta.url),
    'Seed curado pt-BR',
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    await seedCuratedExercises();
  } catch {
    console.error('Não foi possível conectar para aplicar o seed.');
    process.exitCode = 1;
  }
}
