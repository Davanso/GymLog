import type { IncomingMessage, ServerResponse } from 'node:http';
import { requireUser } from '../server/auth.js';
import { HttpError, httpError, json, toWebRequest } from '../server/http.js';
import { pushStore } from '../server/push.js';
import { userTransaction } from '../server/userTransaction.js';

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  try {
    if (!['GET', 'POST'].includes(request.method || ''))
      throw new HttpError(405, 'Método não permitido.');
    const web = await toWebRequest(request);
    const user = await requireUser(request, response);
    let input: unknown;
    if (web.method === 'POST') {
      if (!web.headers.get('content-type')?.includes('application/json'))
        throw new HttpError(415, 'Envie JSON.');
      input = await web.json();
    }
    const result = await userTransaction(user.id, async (db) => {
      const store = pushStore(db, user.id);
      return web.method === 'POST' ? store.execute(input) : store.settings();
    });
    json(response, 200, result);
  } catch (error) {
    httpError(response, error);
  }
}
