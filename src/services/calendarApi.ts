import type { CalendarDashboard } from '../../shared/calendar';
import { WorkoutApiError } from './workoutApi';

type CalendarOptions = { month?: string; subjectId?: string; refresh?: boolean };
const cache = new Map<string, CalendarDashboard>();
const pending = new Map<string, Promise<CalendarDashboard>>();

function calendarKey(options: CalendarOptions) {
  return `${options.month || ''}:${options.subjectId || ''}`;
}

export function readCalendarCache(options: CalendarOptions) {
  return cache.get(calendarKey(options)) ?? null;
}

export function clearCalendarCache() {
  cache.clear();
  pending.clear();
}

export async function calendarApi(input?: unknown, options: CalendarOptions = {}) {
  const params = new URLSearchParams();
  if (options.month) params.set('month', options.month);
  if (options.subjectId) params.set('subject', options.subjectId);
  const key = calendarKey(options);
  if (!input && !options.refresh && cache.has(key)) return cache.get(key)!;
  if (!input && pending.has(key)) return pending.get(key)!;
  const request = (async () => {
    const response = await fetch(`/api/calendar${params.size ? `?${params}` : ''}`, {
      method: input ? 'POST' : 'GET',
      credentials: 'same-origin',
      ...(input
        ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }
        : {}),
    });
    if (response.status === 401) {
      window.location.replace('/entrar');
      throw new WorkoutApiError('Sua sessão expirou.', 401);
    }
    const data = await response.json();
    if (!response.ok)
      throw new WorkoutApiError(
        data.error || 'Não foi possível carregar a agenda.',
        response.status,
      );
    if (input) cache.clear();
    else cache.set(key, data as CalendarDashboard);
    return data as CalendarDashboard;
  })();
  if (input) return request;
  pending.set(key, request);
  try {
    return await request;
  } finally {
    pending.delete(key);
  }
}
