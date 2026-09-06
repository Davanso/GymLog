import type { IncomingMessage, ServerResponse } from 'node:http';
import { requireUser } from '../server/auth.js';
import { coachStore } from '../server/coach.js';
import { HttpError, httpError, json, toWebRequest } from '../server/http.js';
import { userTransaction } from '../server/userTransaction.js';
import { uuid } from '../server/workoutInput.js';

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  try {
    if (!['GET', 'POST'].includes(request.method || '')) {
      response.setHeader('Allow', 'GET, POST');
      throw new HttpError(405, 'Método não permitido.');
    }
    const web = await toWebRequest(request);
    const user = await requireUser(request, response);
    let input: unknown;
    if (web.method === 'POST') {
      if (!web.headers.get('content-type')?.includes('application/json'))
        throw new HttpError(415, 'Envie JSON.');
      try {
        input = await web.json();
      } catch {
        throw new HttpError(400, 'JSON inválido.');
      }
    }
    const student = new URL(web.url).searchParams.get('student');
    if (student) uuid(student);
    const result = await userTransaction(user.id, async (db) => {
      await db.query(
        'INSERT INTO profiles(id,display_name) VALUES($1,$2) ON CONFLICT(id) DO NOTHING',
        [user.id, user.name?.trim().slice(0, 120) || 'Atleta'],
      );
      const store = coachStore(db, user.id);
      if (web.method === 'POST') return store.execute(input);
      if (student) return store.studentHistory(student);
      return store.dashboard();
    });
    json(response, 200, result);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === '23505') return httpError(response, new HttpError(409, 'Registro duplicado.'));
    if (code === '23514' || code === '23503')
      return httpError(response, new HttpError(400, 'Dados incompatíveis.'));
    httpError(response, error);
  }
}
