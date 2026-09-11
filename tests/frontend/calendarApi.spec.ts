import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import {
  calendarApi,
  clearCalendarCache,
  readCalendarCache,
} from '../../src/services/calendarApi.js';
import { WorkoutApiError } from '../../src/services/workoutApi.js';

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  clearCalendarCache();
});

test('calendar service deduplicates concurrent reads and keeps the last dashboard cached', async () => {
  let requests = 0;
  globalThis.fetch = async () => {
    requests += 1;
    return Response.json({ month: '2026-09', days: [] });
  };
  const options = { month: '2026-09' };
  const [first, second] = await Promise.all([
    calendarApi(undefined, { ...options, refresh: true }),
    calendarApi(undefined, { ...options, refresh: true }),
  ]);
  assert.equal(requests, 1);
  assert.equal(first, second);
  assert.equal(readCalendarCache(options), first);
  await calendarApi(undefined, options);
  assert.equal(requests, 1);
});

test('calendar service sends month and subject and posts JSON mutations', async () => {
  const requests: string[] = [];
  globalThis.fetch = async (input, init) => {
    requests.push(`${input}|${init?.method}|${init?.body || ''}`);
    return Response.json({ month: '2026-09' });
  };
  await calendarApi(undefined, { month: '2026-09', subjectId: 'student id' });
  await calendarApi({ action: 'read-notifications' });
  assert.equal(requests[0], '/api/calendar?month=2026-09&subject=student+id|GET|');
  assert.equal(requests[1], '/api/calendar|POST|{"action":"read-notifications"}');
});

test('calendar service preserves API errors', async () => {
  globalThis.fetch = async () => Response.json({ error: 'Agenda indisponível.' }, { status: 403 });
  await assert.rejects(
    () => calendarApi(),
    (error: unknown) =>
      error instanceof WorkoutApiError &&
      error.status === 403 &&
      error.message === 'Agenda indisponível.',
  );
});
