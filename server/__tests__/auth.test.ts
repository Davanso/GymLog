import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';
import authHandler from '../../api/auth.js';
import meHandler from '../../api/me.js';
import catalogHandler from '../../api/catalog.js';
import { requireUser } from '../auth.js';
import { json, httpError, writeWebResponse } from '../http.js';

test('auth proxy and protected routes enforce origin, method and verified session', async () => {
  const previous = {
    base: process.env.NEON_AUTH_BASE_URL,
    secret: process.env.NEON_AUTH_COOKIE_SECRET,
    origin: process.env.APP_URL,
  };
  const originalFetch = globalThis.fetch;
  const id = '01900000-0000-7000-8000-000000000001';
  let authenticated = false;
  let remoteCalls = 0;
  let forwardedOrigin = '';
  let forwardedBody = '';
  process.env.NEON_AUTH_BASE_URL = 'https://ep-test.neonauth.sa-east-1.aws.neon.build/neondb/auth';
  process.env.NEON_AUTH_COOKIE_SECRET = 'test-cookie-secret-with-at-least-thirty-two-characters';
  const server = createServer(async (req, res) => {
    if (req.url?.startsWith('/api/auth')) return authHandler(req, res);
    if (req.url === '/api/me') return meHandler(req, res);
    if (req.url === '/api/catalog') return catalogHandler(req, res);
    if (req.url === '/cookies')
      return writeWebResponse(
        res,
        new Response('ok', {
          headers: [
            ['Set-Cookie', 'one=1; Path=/; HttpOnly'],
            ['Set-Cookie', 'two=2; Path=/; HttpOnly'],
          ],
        }),
      );
    try {
      json(res, 200, await requireUser(req, res));
    } catch (error) {
      httpError(res, error);
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const origin = `http://127.0.0.1:${address.port}`;
  process.env.APP_URL = origin;
  globalThis.fetch = async (input, init) => {
    if (new URL(String(input)).origin === origin) return originalFetch(input, init);
    remoteCalls++;
    assert.ok(String(input).startsWith(process.env.NEON_AUTH_BASE_URL!));
    forwardedOrigin = new Headers(init?.headers).get('origin') || '';
    if (init?.body) forwardedBody = String(init.body);
    return Response.json(
      authenticated
        ? {
            user: {
              id,
              name: 'Test',
              email: 'test@example.invalid',
              emailVerified: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            session: {
              id: 'session-test',
              userId: id,
              token: 'test-session-token',
              expiresAt: new Date(Date.now() + 3600000).toISOString(),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          }
        : null,
    );
  };
  try {
    for (const path of ['/api/me', '/api/catalog']) {
      const response = await originalFetch(origin + path);
      assert.equal(response.status, 401, path);
      assert.equal(response.headers.get('cache-control'), 'no-store');
    }
    const calls = remoteCalls;
    const blocked = await originalFetch(origin + '/api/auth/sign-in/email', {
      method: 'POST',
      headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(blocked.status, 403);
    assert.equal(remoteCalls, calls);
    assert.equal((await originalFetch(origin + '/api/auth/admin/delete-user')).status, 404);
    assert.equal((await originalFetch(origin + '/api/auth/sign-in/email')).status, 405);
    const payload = { email: 'test@example.invalid', password: 'test-password' };
    const signIn = await originalFetch(origin + '/api/auth/sign-in/email', {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert.equal(signIn.status, 200);
    assert.deepEqual(JSON.parse(forwardedBody), payload);
    const session = await originalFetch(origin + '/api/auth?path=get-session');
    assert.equal(session.status, 200);
    assert.equal(await session.json(), null);
    const cookies = await originalFetch(origin + '/cookies');
    assert.equal(cookies.headers.getSetCookie().length, 2);
    authenticated = true;
    const verified = await originalFetch(origin + '/verify', {
      headers: {
        Cookie: '__Secure-neon-auth.session_token=test',
        'x-neon-auth-middleware': 'true',
      },
    });
    assert.equal(verified.status, 200);
    assert.deepEqual(await verified.json(), { id, name: 'Test', email: 'test@example.invalid' });
    assert.equal(forwardedOrigin, origin);
    authenticated = false;
    const revoked = await originalFetch(origin + '/verify', {
      headers: { Cookie: '__Secure-neon-auth.session_token=test' },
    });
    assert.equal(revoked.status, 401);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [name, value] of Object.entries({
      NEON_AUTH_BASE_URL: previous.base,
      NEON_AUTH_COOKIE_SECRET: previous.secret,
      APP_URL: previous.origin,
    })) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
