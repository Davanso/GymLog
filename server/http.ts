import type { IncomingMessage, ServerResponse } from 'node:http';

export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export function json(response: ServerResponse, status: number, body: unknown) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(body));
}
export function httpError(response: ServerResponse, error: unknown) {
  json(response, error instanceof HttpError ? error.status : 503, {
    error: error instanceof HttpError ? error.message : 'Serviço indisponível. Tente novamente.',
  });
}
export function appOrigin() {
  const value = process.env.APP_URL;
  if (!value) throw new HttpError(503, 'Autenticação não configurada.');
  const url = new URL(value);
  if (
    url.protocol !== 'https:' &&
    !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))
  )
    throw new HttpError(503, 'Origem da aplicação inválida.');
  return url.origin;
}
export async function toWebRequest(request: IncomingMessage) {
  const origin = appOrigin();
  const method = request.method || 'GET';
  if (method !== 'GET' && method !== 'HEAD' && request.headers.origin !== origin)
    throw new HttpError(403, 'Origem da requisição inválida.');
  const headers = new Headers();
  for (const name of ['cookie', 'origin', 'content-type', 'user-agent']) {
    const value = request.headers[name];
    if (typeof value === 'string') headers.set(name, value);
  }
  let body: string | undefined;
  if (method !== 'GET' && method !== 'HEAD') {
    const parsed = (request as IncomingMessage & { body?: unknown }).body;
    if (parsed !== undefined) body = typeof parsed === 'string' ? parsed : JSON.stringify(parsed);
    else {
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of request) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += buffer.length;
        if (size > 16_384) throw new HttpError(413, 'Requisição muito grande.');
        chunks.push(buffer);
      }
      body = Buffer.concat(chunks).toString('utf8');
    }
    if (Buffer.byteLength(body || '') > 16_384)
      throw new HttpError(413, 'Requisição muito grande.');
  }
  return new Request(new URL(request.url || '/', origin), { method, headers, body });
}
export async function writeWebResponse(response: ServerResponse, result: Response) {
  response.statusCode = result.status;
  for (const [key, value] of result.headers)
    if (key !== 'set-cookie') response.setHeader(key, value);
  const cookies = result.headers.getSetCookie();
  if (cookies.length) response.setHeader('Set-Cookie', cookies);
  response.setHeader('Cache-Control', 'no-store');
  response.end(Buffer.from(await result.arrayBuffer()));
}
