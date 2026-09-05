import { createCatalogHandler } from '../server/catalogHandler.js';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { requireUser } from '../server/auth.js';
import { httpError } from '../server/http.js';
import { HttpError, json, toWebRequest } from '../server/http.js';
import { createExerciseProvider, parseCatalogRequest } from '../server/exerciseProvider.js';
import { importExercise } from '../server/catalogImport.js';

const catalog = createCatalogHandler();
export default async function handler(request: IncomingMessage, response: ServerResponse) {
  try {
    await requireUser(request, response);
    if (request.method === 'POST') {
      const web = await toWebRequest(request);
      const input = (await web.json()) as { externalId?: unknown };
      if (typeof input.externalId !== 'string') throw new HttpError(400, 'Exercício inválido.');
      const result = await createExerciseProvider()(
        parseCatalogRequest(
          new URLSearchParams({
            resource: 'exercise',
            id: input.externalId,
          }),
        ),
      );
      if (Array.isArray(result.data)) throw new HttpError(502, 'Resposta inválida do catálogo.');
      return json(response, 200, await importExercise(result.data));
    }
    await catalog(request, response);
  } catch (error) {
    httpError(response, error);
  }
}
