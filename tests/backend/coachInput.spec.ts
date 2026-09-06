import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { coachAction, coachText, studentIds } from '../../server/coachInput.js';

test('coach input validates actions, text and unique student identifiers', () => {
  const first = randomUUID();
  const second = randomUUID();
  assert.deepEqual(studentIds([first, second]), [first, second]);
  assert.equal(coachText(' orientação ', 20, true), 'orientação');
  assert.equal(coachAction({ action: 'enable' }).action, 'enable');
  assert.throws(() => studentIds([]));
  assert.throws(() => studentIds([first, first]));
  assert.throws(() => studentIds(['invalid']));
  assert.throws(() => coachText('', 20, true));
  assert.throws(() => coachText('muito longo', 3));
  assert.throws(() => coachAction({}));
});
