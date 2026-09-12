import type { ReportPeriod, ReportsDashboard } from '../../shared/reports';
import { WorkoutApiError } from './workoutApi';

export type ReportsOptions = {
  period: ReportPeriod;
  anchor: string;
  subjectId?: string;
  exerciseId?: string;
  refresh?: boolean;
};
const cache = new Map<string, ReportsDashboard>();
const pending = new Map<string, Promise<ReportsDashboard>>();
const key = (options: ReportsOptions) =>
  [options.period, options.anchor, options.subjectId || '', options.exerciseId || ''].join(':');

export function readReportsCache(options: ReportsOptions) {
  return cache.get(key(options)) ?? null;
}
export function clearReportsCache() {
  cache.clear();
  pending.clear();
}
export async function reportsApi(options: ReportsOptions) {
  const cacheKey = key(options);
  if (!options.refresh && cache.has(cacheKey)) return cache.get(cacheKey)!;
  if (pending.has(cacheKey)) return pending.get(cacheKey)!;
  const params = new URLSearchParams({ period: options.period, anchor: options.anchor });
  if (options.subjectId) params.set('subject', options.subjectId);
  if (options.exerciseId) params.set('exercise', options.exerciseId);
  const request = (async () => {
    const response = await fetch(`/api/reports?${params}`, { credentials: 'same-origin' });
    if (response.status === 401) {
      window.location.replace('/entrar');
      throw new WorkoutApiError('Sua sessão expirou.', 401);
    }
    const data = await response.json();
    if (response.status === 403 && options.subjectId) clearReportsCache();
    if (!response.ok)
      throw new WorkoutApiError(
        data.error || 'Não foi possível carregar os relatórios.',
        response.status,
      );
    cache.set(cacheKey, data as ReportsDashboard);
    return data as ReportsDashboard;
  })();
  pending.set(cacheKey, request);
  try {
    return await request;
  } finally {
    pending.delete(cacheKey);
  }
}
