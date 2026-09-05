import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { WorkoutApiError, workoutApi } from '../../src/services/workoutApi.js';

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('workout service sends JSON mutations and returns the response', async () => {
  let request: { input: string | URL | Request; init?: RequestInit } | undefined;
  globalThis.fetch = async (input, init) => {
    request = { input, init };
    return Response.json({ id: 'saved' });
  };
  assert.deepEqual(await workoutApi({ action: 'archive', id: 'id' }), { id: 'saved' });
  assert.equal(request?.input, '/api/workouts');
  assert.equal(request?.init?.method, 'POST');
  assert.equal(request?.init?.body, JSON.stringify({ action: 'archive', id: 'id' }));
});

test('workout service preserves API errors and session query parameters', async () => {
  let requestedUrl = '';
  globalThis.fetch = async (input) => {
    requestedUrl = String(input);
    return Response.json({ error: 'Treino não encontrado.' }, { status: 404 });
  };
  await assert.rejects(
    () => workoutApi(undefined, undefined, 'session id'),
    (error: unknown) =>
      error instanceof WorkoutApiError &&
      error.status === 404 &&
      error.message === 'Treino não encontrado.',
  );
  assert.equal(requestedUrl, '/api/workouts?session=session%20id');
});
