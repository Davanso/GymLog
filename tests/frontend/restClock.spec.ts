import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  extendClock,
  pauseClock,
  remainingMs,
  resumeClock,
} from '../../src/components/sessionRunner/restClock.js';

test('rest clock uses elapsed time and resumes without drift', () => {
  const clock = { setId: 'set', remaining: 60000, deadline: 61000 };
  assert.equal(remainingMs(clock, 11000), 50000);
  assert.equal(remainingMs(clock, 120000), 0);
  const paused = pauseClock(clock, 11000);
  assert.equal(remainingMs(paused, 999999), 50000);
  assert.equal(resumeClock(paused, 100000).deadline, 150000);
  assert.deepEqual(extendClock(paused, 999999), { ...paused, remaining: 80000 });
});
