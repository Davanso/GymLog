import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { createCatalogHandler } from '../catalog-handler.js';
import { CatalogError, createExerciseProvider, parseCatalogRequest } from '../exercise-provider.js';
import { standardMuscleGroup } from '../muscle-group-map.js';

const config = { RAPIDAPI_KEY: 'test-secret' };
const sample = {
  exerciseId: 'exr_test',
  name: ' Bench Press ',
  imageUrl: 'https://cdn.exercisedb.dev/test.jpg',
  bodyParts: ['CHEST'],
};
const request = (query: string) => parseCatalogRequest(new URLSearchParams(query));

test('consolidates provider anatomy into the editable GymLog groups', () => {
  assert.equal(standardMuscleGroup('TRAPEZIUS LOWER FIBERS'), 'Costas');
  assert.equal(standardMuscleGroup('TRAPEZIUS MIDDLE FIBERS'), 'Costas');
  assert.equal(standardMuscleGroup('TRAPEZIUS UPPER FIBERS'), 'Costas');
  assert.equal(standardMuscleGroup('TENSOR FASCIAE LATAE'), 'Abdômen');
  assert.equal(standardMuscleGroup('unknown provider value'), 'Outros');
});

test('validates filters, pagination and rejects arbitrary upstream URLs', () => {
  assert.equal(request('name=bench&limit=5&after=exr_test').params.get('limit'), '5');
  for (const query of [
    'limit=0',
    'limit=26',
    'limit=1.5',
    'limit=2&limit=3',
    'resource=unknown',
    'resource=exercise&id=../secret',
    'resource=exercise',
    'before=exr_a&after=exr_b',
    'url=https://example.com',
    'resource=search',
  ]) {
    assert.throws(() => request(query), CatalogError, query);
  }
});

test('forwards credentials only to fixed host and normalizes list and pagination', async () => {
  const provider = createExerciseProvider(async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.hostname, 'edb-with-videos-and-images-by-ascendapi.p.rapidapi.com');
    assert.equal(url.searchParams.get('name'), 'bench');
    assert.equal(new Headers(init?.headers).get('x-rapidapi-key'), 'test-secret');
    assert.equal(init?.redirect, 'error');
    assert.equal(init?.cache, 'no-store');
    return Response.json({
      success: true,
      data: [sample],
      meta: { total: 20, hasNextPage: true, nextCursor: 'exr_next' },
    });
  }, config);
  const result = await provider(request('name=bench'));
  assert.ok('meta' in result && result.meta);
  assert.equal(result.meta.nextCursor, 'exr_next');
  assert.ok(Array.isArray(result.data));
  assert.equal(result.data[0].name, 'Supino');
  assert.equal(JSON.stringify(result).includes('test-secret'), false);
});

test('detail preserves video/instructions and rejects untrusted media URLs', async () => {
  const provider = createExerciseProvider(
    async () =>
      Response.json({
        success: true,
        data: {
          ...sample,
          videoUrl: 'https://cdn.exercisedb.dev/test.mp4',
          instructions: ['Step 1'],
          imageUrl: 'javascript:alert(1)',
          imageUrls: {
            '720p': 'https://cdn.exercisedb.dev/test.jpg',
            '1080p': 'https://evil.example/test.jpg',
          },
        },
      }),
    config,
  );
  const { data } = await provider(request('resource=exercise&id=exr_test'));
  assert.ok(!Array.isArray(data));
  assert.equal(data.imageUrl, null);
  assert.equal(data.videoUrl, 'https://cdn.exercisedb.dev/test.mp4');
  assert.deepEqual(data.instructions, ['Step 1']);
  assert.deepEqual(Object.keys(data.imageUrls), ['720p']);
});

test('handles provider failures without leaking response details or retrying', async () => {
  for (const [status, expected] of [
    [401, 502],
    [403, 502],
    [429, 429],
    [404, 404],
    [500, 502],
  ]) {
    let calls = 0;
    const provider = createExerciseProvider(async () => {
      calls++;
      return new Response('sensitive-provider-details', { status });
    }, config);
    await assert.rejects(
      provider(request('')),
      (error: unknown) =>
        error instanceof CatalogError &&
        error.status === expected &&
        !error.message.includes('sensitive'),
    );
    assert.equal(calls, 1);
  }
  await assert.rejects(
    createExerciseProvider(async () => {
      throw new DOMException('secret', 'TimeoutError');
    }, config)(request('')),
    { status: 504 },
  );
  await assert.rejects(
    createExerciseProvider(
      async () => Response.json({ success: true, data: [{}] }),
      config,
    )(request('')),
    { status: 502 },
  );
  await assert.rejects(createExerciseProvider(fetch, {})(request('')), { status: 503 });
  await assert.rejects(
    createExerciseProvider(fetch, { ...config, RAPIDAPI_HOST: 'evil.example' })(request('')),
    { status: 503 },
  );
});

test('HTTP endpoint serves bodyparts, disables caching and rejects writes/bad input', async () => {
  let calls = 0;
  const provider = createExerciseProvider(async () => {
    calls++;
    return Response.json({
      success: true,
      data: [{ name: 'CHEST', imageUrl: 'https://cdn.exercisedb.dev/chest.webp' }],
    });
  }, config);
  const server = createServer(createCatalogHandler(provider));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api/catalog`;
  try {
    const good = await fetch(`${base}?resource=bodyparts`);
    assert.equal(good.status, 200);
    assert.equal(good.headers.get('cache-control'), 'no-store');
    assert.equal((await good.json()).data[0].name, 'CHEST');
    const post = await fetch(base, { method: 'POST' });
    assert.equal(post.status, 405);
    assert.equal(post.headers.get('allow'), 'GET');
    assert.equal((await fetch(`${base}?limit=500`)).status, 400);
    assert.equal(calls, 1);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
