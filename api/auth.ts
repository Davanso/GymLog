import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleAuthProxyRequest } from '@neondatabase/auth/server';
import { authConfig } from '../server/auth.js';
import { HttpError, httpError, toWebRequest, writeWebResponse } from '../server/http.js';

const methods: Record<string, string> = {
  'sign-in/email': 'POST',
  'sign-up/email': 'POST',
  'sign-out': 'POST',
  'get-session': 'GET',
  'request-password-reset': 'POST',
  'reset-password': 'POST',
  'send-verification-email': 'POST',
  'verify-email': 'GET',
};
export default async function handler(request: IncomingMessage, response: ServerResponse) {
  try {
    const webRequest = await toWebRequest(request);
    const url = new URL(webRequest.url);
    const path = url.searchParams.get('path') || url.pathname.replace(/^\/api\/auth\/?/, '');
    const expected =
      methods[path] || (/^reset-password\/[A-Za-z0-9_-]+$/.test(path) ? 'GET' : undefined);
    if (!expected) throw new HttpError(404, 'Rota de autenticação não encontrada.');
    if (webRequest.method !== expected) {
      response.setHeader('Allow', expected);
      throw new HttpError(405, 'Método não permitido.');
    }
    url.searchParams.delete('path');
    const forwarded = new Request(url, webRequest);
    await writeWebResponse(
      response,
      await handleAuthProxyRequest({ ...authConfig(), request: forwarded, path }),
    );
  } catch (error) {
    httpError(response, error);
  }
}
