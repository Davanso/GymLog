import { createExerciseProvider, parseCatalogRequest } from '../server/exercise-provider.js';
import { importExercise } from '../server/catalog-import.js';
import { getDatabase } from '../server/db.js';

const provider = createExerciseProvider();
const summaries = [];
let after: string | undefined;
do {
  const params = new URLSearchParams({ limit: '25' });
  if (after) params.set('after', after);
  const page = await provider(parseCatalogRequest(params));
  if (!Array.isArray(page.data) || !('meta' in page)) throw new Error('Página inválida.');
  summaries.push(...page.data);
  after = page.meta?.nextCursor || undefined;
} while (after);

let completed = 0;
const existing = new Set(
  (
    await getDatabase()`SELECT e.external_id FROM exercises e WHERE e.provider='ascendapi' AND e.external_id IS NOT NULL
      AND EXISTS(SELECT 1 FROM exercise_media m WHERE m.exercise_id=e.id AND m.kind='video')`
  ).map((row) => row.external_id as string),
);
async function detail(externalId: string) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await provider(
        parseCatalogRequest(new URLSearchParams({ resource: 'exercise', id: externalId })),
      );
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 300));
    }
  }
  throw lastError;
}
for (let index = 0; index < summaries.length; index += 4) {
  await Promise.all(
    summaries.slice(index, index + 4).map(async (summary) => {
      const { externalId } = summary;
      await importExercise(summary);
      if (!existing.has(externalId)) {
        try {
          const result = await detail(externalId);
          if (Array.isArray(result.data)) throw new Error(`Detalhe inválido: ${externalId}`);
          await importExercise(result.data);
        } catch {
          console.warn(`Detalhe indisponível; resumo salvo para ${externalId}.`);
        }
      }
      completed++;
    }),
  );
  console.log(`Sincronizados ${completed}/${summaries.length}`);
}
await getDatabase()`DELETE FROM muscle_groups m
  WHERE NOT EXISTS(SELECT 1 FROM exercise_muscles em WHERE em.muscle_group_id=m.id)`;
