import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { NeonQueryFunction } from '@neondatabase/serverless';
import { importExercise } from '../../server/catalogImport.js';
import type { ProviderExercise } from '../../server/exerciseProvider.js';

function database(result: unknown[] = [{ id: 'exercise-1' }]) {
  const queries: string[] = [];
  const sql = ((parts: TemplateStringsArray) => {
    queries.push(parts.join('?'));
    return Promise.resolve(result);
  }) as unknown as NeonQueryFunction<false, false>;
  (
    sql as unknown as {
      transaction: (operations: Promise<unknown>[]) => Promise<unknown[]>;
    }
  ).transaction = (operations) => Promise.all(operations);
  return { sql, queries };
}

const exercise: ProviderExercise = {
  provider: 'ascendapi',
  externalId: 'exr_Á-1',
  name: 'Agachamento livre',
  imageUrl: null,
  imageUrls: { '720p': 'https://example.invalid/squat.jpg' },
  videoUrl: 'https://example.invalid/squat.mp4',
  bodyParts: ['Pernas'],
  equipments: ['Peso corporal'],
  targetMuscles: ['Quadríceps', 'Glúteos'],
  secondaryMuscles: ['Glúteos', 'Posteriores de coxa'],
  primaryMuscleGroup: 'Quadríceps',
  exerciseType: null,
  instructions: ['Flexione os joelhos.'],
  overview: 'Movimento composto.',
};

test('imports an exercise with normalized taxonomy, muscles and media in one transaction', async () => {
  const { sql, queries } = database();
  const result = await importExercise(exercise, sql);
  assert.deepEqual(result, { id: 'exercise-1' });
  assert.equal(queries.length, 12);
  assert.ok(queries.some((query) => query.includes('INSERT INTO equipment')));
  assert.ok(queries.some((query) => query.includes('MERGE INTO exercise_media')));
  assert.ok(queries.at(-1)?.includes('FROM exercises'));
});

test('imports provider fallbacks without optional media', async () => {
  const { sql, queries } = database([]);
  const result = await importExercise(
    {
      ...exercise,
      externalId: 'fallback',
      equipments: [],
      targetMuscles: [],
      secondaryMuscles: [],
      primaryMuscleGroup: '',
      imageUrls: {},
      videoUrl: null,
      overview: null,
      instructions: [],
    },
    sql,
  );
  assert.equal(result, undefined);
  assert.equal(queries.filter((query) => query.includes('MERGE INTO exercise_media')).length, 0);
});
