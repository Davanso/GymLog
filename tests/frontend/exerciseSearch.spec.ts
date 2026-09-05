import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import type { Exercise } from '../../shared/workouts.js';
import {
  matchesExercise,
  templateChanged,
} from '../../src/components/templateEditor/exerciseSearch.js';

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
test('exercise search handles accents, terms and primary group filters', () => {
  assert.equal(matchesExercise(exercise, 'triceps'), true);
  assert.equal(matchesExercise(exercise, 'peito barra'), true);
  assert.equal(matchesExercise(exercise, 'SUPINO', 'Peito'), true);
  assert.equal(matchesExercise(exercise, '', 'Tríceps'), false);
});
test('template comparison ignores trimming and detects order changes', () => {
  const first = {
    exerciseId: randomUUID(),
    sets: 3,
    reps: 10,
    repsMax: 10,
    seconds: null,
    load: 0,
    notes: '',
  };
  const second = { ...first, exerciseId: randomUUID() };
  const initial = {
    id: randomUUID(),
    name: 'Treino A',
    notes: '',
    restSeconds: 60,
    items: [first, second],
  };
  assert.equal(templateChanged({ ...initial, name: ' Treino A ' }, initial), false);
  assert.equal(templateChanged({ ...initial, items: [second, first] }, initial), true);
});
