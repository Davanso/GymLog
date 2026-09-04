import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  createAuthServer,
  extractNeonAuthCookies,
  serializeSetCookie,
} from '@neondatabase/auth/server';
import { appOrigin, HttpError } from './http.js';

export function authConfig() {
  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET;
  if (!baseUrl || !cookieSecret || cookieSecret.length < 32)
    throw new HttpError(503, 'Autenticação não configurada.');
  const url = new URL(baseUrl);
  if (
    url.protocol !== 'https:' ||
    !(
      url.hostname.endsWith('.neon.build') ||
      /^ep-[a-z0-9-]+\.neonauth\.[a-z0-9-]+\.aws\.neon\.tech$/.test(url.hostname)
    ) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new HttpError(503, 'URL de autenticação inválida.');
  return { baseUrl: url.href.replace(/\/$/, ''), cookieSecret, sessionDataTtl: 60 };
}

export async function requireUser(request: IncomingMessage, response: ServerResponse) {
  const auth = createAuthServer({
    ...authConfig(),
    context: () => ({
      getCookies: () => extractNeonAuthCookies(request.headers.cookie || ''),
      setCookie: (name, value, options) => {
        const current = response.getHeader('Set-Cookie');
        const cookies =
          typeof current === 'string'
            ? [current]
            : Array.isArray(current)
              ? current.map(String)
              : [];
        response.setHeader('Set-Cookie', [
          ...cookies,
          serializeSetCookie({ name, value, ...options }),
        ]);
      },
      getHeader: (name) =>
        ['origin', 'cookie', 'user-agent'].includes(name.toLowerCase())
          ? typeof request.headers[name.toLowerCase()] === 'string'
            ? (request.headers[name.toLowerCase()] as string)
            : null
          : null,
      getOrigin: appOrigin,
      getFramework: () => 'vercel-node',
    }),
  });
  const { data, error } = await auth.getSession({ query: { disableCookieCache: 'true' } });
  if (error) throw new HttpError(503, 'Não foi possível validar sua sessão.');
  if (!data?.user || !data.session) throw new HttpError(401, 'Entre na sua conta para continuar.');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.user.id))
    throw new HttpError(401, 'Sessão inválida.');
  return { id: data.user.id, name: data.user.name, email: data.user.email };
}
