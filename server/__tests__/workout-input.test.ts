import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { draft } from '../workout-input.js';
import { matchesExercise, templateChanged } from '../../src/features/workouts/exercise-search.js';
import type { Exercise } from '../../shared/workouts.js';
import {
  extendClock,
  pauseClock,
  remainingMs,
  resumeClock,
} from '../../src/features/workouts/rest-clock.js';

test('workout input rejects invalid modes, large plans, non-finite metrics and invalid ids', () => {
  const item = { exerciseId: randomUUID(), sets: 3, reps: 10, seconds: null, load: 0 };
  const valid = { id: randomUUID(), name: ' A ', notes: '', restSeconds: 60, items: [item] };
  assert.equal(draft(valid).name, 'A');
  assert.equal(draft(valid).items[0].load, 0);
  for (const patch of [
    { sets: 0 },
    { sets: 1.2 },
    { load: Infinity },
    { load: NaN },
    { load: -1 },
    { load: 0.0001 },
    { seconds: 10 },
    { reps: null },
    { exerciseId: 'bad' },
  ])
    assert.throws(() => draft({ ...valid, items: [{ ...item, ...patch }] }));
  assert.throws(() => draft({ ...valid, items: Array(21).fill(item) }));
  assert.throws(() => draft({ ...valid, items: [] }));
  assert.throws(() => draft({ ...valid, name: ' ' }));
  assert.throws(() => draft({ ...valid, restSeconds: -1 }));
  assert.throws(() => draft({ ...valid, restSeconds: 3601 }));
  assert.throws(() => draft({ ...valid, items: [item, item] }));
});
test('rest clock uses elapsed time, pauses without drift and extends paused or completed rest', () => {
  const clock = { setId: 'set', remaining: 60000, deadline: 61000 };
  assert.equal(remainingMs(clock, 11000), 50000);
  assert.equal(remainingMs(clock, 120000), 0);
  const paused = pauseClock(clock, 11000);
  assert.equal(remainingMs(paused, 999999), 50000);
  assert.equal(resumeClock(paused, 100000).deadline, 150000);
  assert.deepEqual(extendClock(paused, 999999), { ...paused, remaining: 80000 });
  assert.equal(extendClock(clock, 120000).deadline, 150000);
});

test('exercise search combines muscle groups, equipment and name without accents', () => {
  const exercise: Exercise = {
    id: randomUUID(),
    name: 'Supino reto',
    equipment: 'Barra',
    muscle_groups: ['Peito', 'Tríceps'],
    primary_muscle_groups: ['Peito'],
    secondary_muscle_groups: ['Tríceps'],
    tracking_mode: 'reps',
    load_mode: 'external',
    load_convention: 'total',
  };
  assert.equal(matchesExercise(exercise, 'triceps'), true);
  assert.equal(matchesExercise(exercise, 'peito barra'), true);
  assert.equal(matchesExercise(exercise, 'SUPINO', 'Peito'), true);
  assert.equal(matchesExercise(exercise, '', 'Costas'), false);
  assert.equal(matchesExercise(exercise, '', 'Tríceps'), false);
  assert.equal(matchesExercise(exercise, 'pernas'), false);
});

test('unchanged editor ignores server metadata and trimming, but detects order and values', () => {
  const first = { exerciseId: randomUUID(), sets: 3, reps: 10, seconds: null, load: 0 };
  const second = { ...first, exerciseId: randomUUID() };
  const initial = {
    id: randomUUID(),
    name: 'Treino A',
    notes: '',
    restSeconds: 60,
    items: [first, second],
    version: 1,
  };
  assert.equal(templateChanged({ ...initial, name: ' Treino A ' }, initial), false);
  assert.equal(templateChanged({ ...initial, items: [second, first] }, initial), true);
  assert.equal(templateChanged({ ...initial, restSeconds: 90 }, initial), true);
});
