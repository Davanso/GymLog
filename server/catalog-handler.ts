import type { IncomingMessage, ServerResponse } from 'node:http';
import { CatalogError, createExerciseProvider, parseCatalogRequest } from './exercise-provider.js';

export function createCatalogHandler(provider = createExerciseProvider()) {
  return async (request: IncomingMessage, response: ServerResponse) => {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('CDN-Cache-Control', 'no-store');
    response.setHeader('Vercel-CDN-Cache-Control', 'no-store');
    if (request.method !== 'GET') {
      response.setHeader('Allow', 'GET');
      response.statusCode = 405;
      response.end(JSON.stringify({ error: 'Método não permitido.' }));
      return;
    }
    try {
      const url = new URL(request.url || '/', 'http://localhost');
      const result = await provider(parseCatalogRequest(url.searchParams));
      response.statusCode = 200;
      response.end(JSON.stringify(result));
    } catch (error) {
      response.statusCode = error instanceof CatalogError ? error.status : 502;
      response.end(
        JSON.stringify({
          error:
            error instanceof CatalogError
              ? error.message
              : 'Catálogo temporariamente indisponível.',
        }),
      );
    }
  };
}
