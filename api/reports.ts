import type { IncomingMessage, ServerResponse } from 'node:http';
import { requireUser } from '../server/auth.js';
import { HttpError, httpError, json, toWebRequest } from '../server/http.js';
import { reportsStore } from '../server/reports.js';
import { userTransaction } from '../server/userTransaction.js';

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  try {
    if (request.method !== 'GET') throw new HttpError(405, 'Método não permitido.');
    const web = await toWebRequest(request);
    const user = await requireUser(request, response);
    const url = new URL(web.url);
    const result = await userTransaction(user.id, async (db) =>
      reportsStore(db, user.id).dashboard(
        url.searchParams.get('period') || 'week',
        url.searchParams.get('anchor') || new Date().toISOString().slice(0, 10),
        url.searchParams.get('subject') || user.id,
        url.searchParams.get('exercise') || undefined,
      ),
    );
    json(response, 200, result);
  } catch (error) {
    httpError(response, error);
  }
}
