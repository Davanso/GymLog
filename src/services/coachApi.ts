import { WorkoutApiError } from './workoutApi';

export async function coachApi<T>(input?: unknown, studentId?: string): Promise<T> {
  const response = await fetch(
    `/api/coach${studentId ? `?student=${encodeURIComponent(studentId)}` : ''}`,
    {
      method: input ? 'POST' : 'GET',
      credentials: 'same-origin',
      ...(input
        ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }
        : {}),
    },
  );
  if (response.status === 401) {
    window.location.replace('/entrar');
    throw new WorkoutApiError('Sua sessão expirou.', 401);
  }
  const data = await response.json();
  if (!response.ok)
    throw new WorkoutApiError(
      data.error || 'Não foi possível concluir esta ação.',
      response.status,
    );
  return data;
}
