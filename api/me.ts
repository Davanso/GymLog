import type { IncomingMessage, ServerResponse } from 'node:http';
import { requireUser } from '../server/auth.js';
import { getUserDatabase } from '../server/db.js';
import { httpError, json } from '../server/http.js';

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    json(response, 405, { error: 'Método não permitido.' });
    return;
  }
  try {
    const user = await requireUser(request, response);
    const db = getUserDatabase(user.id);
    const profile = await db.profile(user.name?.trim().slice(0, 120) || 'Atleta');
    json(response, 200, { user: { ...user, profile } });
  } catch (error) {
    httpError(response, error);
  }
}
