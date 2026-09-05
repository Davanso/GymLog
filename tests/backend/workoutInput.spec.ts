import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { draft } from '../../server/workoutInput.js';

test('workout input validates plans, ranges, notes and duplicate exercises', () => {
  const item = {
    exerciseId: randomUUID(),
    sets: 3,
    reps: 10,
    repsMax: 12,
    seconds: null,
    load: 0,
    notes: ' Alternativa: rosca na polia. ',
  };
  const valid = { id: randomUUID(), name: ' A ', notes: '', restSeconds: 60, items: [item] };
  const parsed = draft(valid);
  assert.equal(parsed.name, 'A');
  assert.equal(parsed.items[0].notes, 'Alternativa: rosca na polia.');
  assert.equal(parsed.items[0].repsMax, 12);
  for (const patch of [
    { sets: 0 },
    { sets: 1.2 },
    { load: Infinity },
    { load: NaN },
    { load: -1 },
    { load: 0.0001 },
    { seconds: 10 },
    { reps: null },
    { repsMax: 9 },
    { exerciseId: 'bad' },
  ])
    assert.throws(() => draft({ ...valid, items: [{ ...item, ...patch }] }));
  assert.throws(() => draft({ ...valid, items: Array(21).fill(item) }));
  assert.throws(() => draft({ ...valid, items: [] }));
  assert.throws(() => draft({ ...valid, name: ' ' }));
  assert.throws(() => draft({ ...valid, restSeconds: -1 }));
  assert.throws(() => draft({ ...valid, items: [item, item] }));
});
