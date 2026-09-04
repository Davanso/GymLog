import { exerciseNames } from './exercise-name-translations.js';
import { primaryMuscleGroup, standardMuscleGroup } from './muscle-group-map.js';
import {
  translateExerciseName,
  translateInstruction,
  translateTaxonomy,
} from './exercise-translations.js';

const HOST = 'edb-with-videos-and-images-by-ascendapi.p.rapidapi.com';

export class CatalogError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export type CatalogResource =
  | 'exercises'
  | 'exercise'
  | 'search'
  | 'bodyparts'
  | 'muscles'
  | 'equipments'
  | 'exercisetypes';
export interface CatalogRequest {
  resource: CatalogResource;
  params: URLSearchParams;
}

const allowed: Record<CatalogResource, string[]> = {
  exercises: [
    'name',
    'keywords',
    'targetMuscles',
    'secondaryMuscles',
    'exerciseType',
    'bodyParts',
    'equipments',
    'limit',
    'after',
    'before',
  ],
  exercise: ['id'],
  search: ['search'],
  bodyparts: [],
  muscles: [],
  equipments: [],
  exercisetypes: [],
};

export function parseCatalogRequest(query: URLSearchParams): CatalogRequest {
  const resource = query.get('resource') || 'exercises';
  if (!Object.hasOwn(allowed, resource)) throw new CatalogError(400, 'Recurso inválido.');
  const params = new URLSearchParams();
  for (const [key, value] of query) {
    if (query.getAll(key).length !== 1) throw new CatalogError(400, 'Parâmetro duplicado.');
    if (key === 'resource') continue;
    if (
      !allowed[resource as CatalogResource].includes(key) ||
      !value.trim() ||
      value.length > 200
    ) {
      throw new CatalogError(400, 'Parâmetro inválido.');
    }
    params.set(key, value.trim());
  }
  if (resource === 'exercises') {
    const limit = params.get('limit') ?? '10';
    if (!/^\d+$/.test(limit) || Number(limit) < 1 || Number(limit) > 25)
      throw new CatalogError(400, 'Limit deve estar entre 1 e 25.');
    if (params.has('before') && params.has('after'))
      throw new CatalogError(400, 'Use somente um cursor.');
    params.set('limit', String(Number(limit)));
  }
  for (const key of ['id', 'after', 'before']) {
    if (params.has(key) && !/^exr_[a-zA-Z0-9]{1,100}$/.test(params.get(key)!))
      throw new CatalogError(400, 'Identificador inválido.');
  }
  if (resource === 'exercise' && !params.has('id'))
    throw new CatalogError(400, 'Informe o id do exercício.');
  if (resource === 'search' && !params.has('search'))
    throw new CatalogError(400, 'Informe um termo de busca.');
  return { resource: resource as CatalogResource, params };
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new CatalogError(502, 'Resposta inválida do catálogo.');
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== 'string' || !value.trim())
    throw new CatalogError(502, 'Resposta inválida do catálogo.');
  return value.trim();
}
function strings(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string'))
    throw new CatalogError(502, 'Resposta inválida do catálogo.');
  return value as string[];
}
function mediaUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      (url.hostname === 'exercisedb.dev' || url.hostname.endsWith('.exercisedb.dev'))
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export interface ProviderExercise {
  provider: 'ascendapi';
  externalId: string;
  name: string;
  imageUrl: string | null;
  imageUrls: Record<string, string>;
  videoUrl: string | null;
  bodyParts: string[];
  equipments: string[];
  targetMuscles: string[];
  secondaryMuscles: string[];
  primaryMuscleGroup: string;
  exerciseType: string | null;
  instructions: string[];
  overview: string | null;
}
function exercise(value: unknown): ProviderExercise {
  const item = object(value);
  const bodyParts = strings(item.bodyParts);
  const targetMuscles = strings(item.targetMuscles);
  const imageUrls: Record<string, string> = {};
  if (item.imageUrls !== undefined) {
    for (const [resolution, value] of Object.entries(object(item.imageUrls))) {
      const url = mediaUrl(value);
      if (url && /^(360|480|720|1080)p$/.test(resolution)) imageUrls[resolution] = url;
    }
  }
  return {
    provider: 'ascendapi',
    externalId: text(item.exerciseId),
    name: exerciseNames[text(item.exerciseId)] || translateExerciseName(text(item.name)),
    imageUrl: mediaUrl(item.imageUrl),
    imageUrls,
    videoUrl: mediaUrl(item.videoUrl),
    bodyParts: bodyParts.map(translateTaxonomy),
    equipments: strings(item.equipments).map(translateTaxonomy),
    targetMuscles: targetMuscles.map(standardMuscleGroup),
    secondaryMuscles: strings(item.secondaryMuscles).map(standardMuscleGroup),
    primaryMuscleGroup: primaryMuscleGroup(bodyParts, targetMuscles, text(item.exerciseId)),
    exerciseType:
      typeof item.exerciseType === 'string' ? translateTaxonomy(item.exerciseType) : null,
    instructions: strings(item.instructions).map(translateInstruction),
    overview: typeof item.overview === 'string' ? item.overview : null,
  };
}

export function createExerciseProvider(
  fetcher: typeof fetch = fetch,
  env: NodeJS.ProcessEnv = process.env,
) {
  return async ({ resource, params }: CatalogRequest) => {
    const key = env.RAPIDAPI_KEY;
    const configuredHost = env.RAPIDAPI_HOST || HOST;
    if (!key || configuredHost !== HOST) throw new CatalogError(503, 'Catálogo não configurado.');
    const path =
      resource === 'exercise'
        ? `exercises/${params.get('id')}`
        : resource === 'search'
          ? 'exercises/search'
          : resource;
    const url = new URL(`https://${HOST}/api/v1/${path}`);
    if (resource !== 'exercise') url.search = params.toString();
    let payload: unknown;
    try {
      const response = await fetcher(url, {
        headers: { 'x-rapidapi-key': key, 'x-rapidapi-host': HOST, Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
        redirect: 'error',
        cache: 'no-store',
      });
      if (response.status === 429)
        throw new CatalogError(429, 'Limite do catálogo atingido. Tente novamente mais tarde.');
      if (response.status === 404) throw new CatalogError(404, 'Exercício não encontrado.');
      if (!response.ok) throw new CatalogError(502, 'Catálogo temporariamente indisponível.');
      payload = await response.json();
    } catch (error) {
      if (error instanceof CatalogError) throw error;
      if (error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name))
        throw new CatalogError(504, 'O catálogo demorou para responder.');
      throw new CatalogError(502, 'Não foi possível consultar o catálogo.');
    }
    const body = object(payload);
    if (body.success !== true) throw new CatalogError(502, 'Resposta inválida do catálogo.');
    if (resource === 'exercise') return { data: exercise(body.data) };
    if (!Array.isArray(body.data)) throw new CatalogError(502, 'Resposta inválida do catálogo.');
    if (resource === 'exercises' || resource === 'search') {
      const meta = body.meta === undefined ? {} : object(body.meta);
      return {
        data: body.data.map(exercise),
        meta: {
          total: typeof meta.total === 'number' ? meta.total : null,
          hasNextPage: meta.hasNextPage === true,
          hasPreviousPage: meta.hasPreviousPage === true,
          nextCursor: typeof meta.nextCursor === 'string' ? meta.nextCursor : null,
          previousCursor: typeof meta.previousCursor === 'string' ? meta.previousCursor : null,
        },
      };
    }
    return {
      data: body.data.map((value) => {
        const item = typeof value === 'string' ? { name: value } : object(value);
        return { name: text(item.name), imageUrl: mediaUrl(item.imageUrl) };
      }),
    };
  };
}
