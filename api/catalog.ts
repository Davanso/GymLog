import { createCatalogHandler } from '../server/catalog-handler.js';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { requireUser } from '../server/auth.js';
import { httpError } from '../server/http.js';

const catalog = createCatalogHandler();
export default async function handler(request: IncomingMessage, response: ServerResponse) {
  try {
    await requireUser(request, response);
    await catalog(request, response);
  } catch (error) {
    httpError(response, error);
  }
}
