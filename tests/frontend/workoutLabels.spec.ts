import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadLabel } from '../../src/utils/workoutLabels.js';

test('load conventions have concise Portuguese labels', () => {
  assert.equal(loadLabel('total'), 'Kg/total');
  assert.equal(loadLabel('per_hand'), 'Kg/mão');
  assert.equal(loadLabel('machine'), 'Kg/máquina');
  assert.equal(loadLabel('added'), 'Kg/adicional');
  assert.equal(loadLabel('assistance'), 'Kg/assistência');
});
