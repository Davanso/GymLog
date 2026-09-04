import { fileURLToPath } from 'node:url';
import { applySeed } from './seed-sql.mjs';

export async function seedCuratedExercises() {
  return applySeed(
    new URL('../database/seeds/001_curated_exercises_pt_br.sql', import.meta.url),
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
