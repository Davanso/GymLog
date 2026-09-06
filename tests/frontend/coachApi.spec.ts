import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { coachApi } from '../../src/services/coachApi.js';

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('coach service reads dashboard, student history and sends mutations', async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return Response.json({ ok: true });
  };
  await coachApi();
  await coachApi(undefined, 'student id');
  await coachApi({ action: 'enable' });
  assert.equal(calls[0].url, '/api/coach');
  assert.equal(calls[0].init?.method, 'GET');
  assert.equal(calls[1].url, '/api/coach?student=student%20id');
  assert.equal(calls[2].init?.method, 'POST');
  assert.equal(calls[2].init?.body, JSON.stringify({ action: 'enable' }));
});

test('coach service preserves API errors', async () => {
  globalThis.fetch = async () => Response.json({ error: 'Vínculo encerrado.' }, { status: 403 });
  await assert.rejects(() => coachApi(), /Vínculo encerrado/);
});
