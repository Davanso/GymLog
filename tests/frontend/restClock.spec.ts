import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  extendClock,
  hasActiveRest,
  pauseClock,
  readClock,
  remainingMs,
  resumeClock,
  startClock,
} from '../../src/components/sessionRunner/restClock.js';

test('rest clock uses elapsed time and resumes without drift', () => {
  const clock = { setId: 'set', remaining: 60000, deadline: 61000 };
  assert.equal(remainingMs(clock, 11000), 50000);
  assert.equal(remainingMs(clock, 120000), 0);
  assert.equal(hasActiveRest(clock, 11000), true);
  assert.equal(hasActiveRest(clock, 120000), false);
  assert.equal(hasActiveRest(null, 120000), false);
  const paused = pauseClock(clock, 11000);
  assert.equal(remainingMs(paused, 999999), 50000);
  assert.equal(resumeClock(paused, 100000).deadline, 150000);
  assert.deepEqual(extendClock(paused, 999999), { ...paused, remaining: 80000 });
  assert.deepEqual(extendClock(clock, 11000), {
    ...clock,
    remaining: 80000,
    deadline: 91000,
  });
});

test('rest clock starts and safely restores persisted state', () => {
  const originalStorage = globalThis.localStorage;
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (key: string) => values.get(key) ?? null },
  });
  try {
    const started = startClock('set-2', 90);
    assert.equal(started.setId, 'set-2');
    assert.equal(started.remaining, 90000);

    values.set('clock', JSON.stringify({ setId: 'set-2', remaining: 5000, deadline: null }));
    assert.deepEqual(readClock('clock'), { setId: 'set-2', remaining: 5000, deadline: null });
    for (const invalid of [
      '{',
      'null',
      JSON.stringify({ setId: 1, remaining: 1, deadline: null }),
      JSON.stringify({ setId: 'set', remaining: -1, deadline: null }),
      JSON.stringify({ setId: 'set', remaining: 86400001, deadline: null }),
      JSON.stringify({ setId: 'set', remaining: 1, deadline: 'later' }),
    ]) {
      values.set('clock', invalid);
      assert.equal(readClock('clock'), null);
    }
  } finally {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: originalStorage,
    });
  }
});
