import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { clearReportsCache, readReportsCache, reportsApi } from '../../src/services/reportsApi.js';
import { WorkoutApiError } from '../../src/services/workoutApi.js';

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  clearReportsCache();
});

test('reports service deduplicates reads and caches by period and subject', async () => {
  let requests = 0;
  globalThis.fetch = async () => {
    requests += 1;
    return Response.json({ period: 'week', anchor: '2026-09-11' });
  };
  const options = { period: 'week' as const, anchor: '2026-09-11', subjectId: 'student' };
  const [first, second] = await Promise.all([
    reportsApi({ ...options, refresh: true }),
    reportsApi({ ...options, refresh: true }),
  ]);
  assert.equal(requests, 1);
  assert.equal(first, second);
  assert.equal(readReportsCache(options), first);
  await reportsApi(options);
  assert.equal(requests, 1);
});

test('reports service requests exercise detail only when selected', async () => {
  const requests: string[] = [];
  globalThis.fetch = async (input) => {
    requests.push(String(input));
    return Response.json({});
  };
  await reportsApi({ period: 'month', anchor: '2026-09-11' });
  await reportsApi({ period: 'month', anchor: '2026-09-11', exerciseId: 'exercise-1' });
  assert.equal(requests[0], '/api/reports?period=month&anchor=2026-09-11');
  assert.equal(requests[1], '/api/reports?period=month&anchor=2026-09-11&exercise=exercise-1');
});

test('reports service preserves authorization errors', async () => {
  globalThis.fetch = async () => Response.json({ error: 'Sem acesso.' }, { status: 403 });
  await assert.rejects(
    () => reportsApi({ period: 'week', anchor: '2026-09-11' }),
    (error: unknown) => error instanceof WorkoutApiError && error.status === 403,
  );
});
