import type { CalendarDashboard } from '../../shared/calendar';
import { WorkoutApiError } from './workoutApi';

export async function calendarApi(
  input?: unknown,
  options: { month?: string; subjectId?: string; signal?: AbortSignal } = {},
) {
  const params = new URLSearchParams();
  if (options.month) params.set('month', options.month);
  if (options.subjectId) params.set('subject', options.subjectId);
  const response = await fetch(`/api/calendar${params.size ? `?${params}` : ''}`, {
    method: input ? 'POST' : 'GET',
    credentials: 'same-origin',
    signal: options.signal,
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
    throw new WorkoutApiError(data.error || 'Não foi possível carregar a agenda.', response.status);
  return data as CalendarDashboard;
}
