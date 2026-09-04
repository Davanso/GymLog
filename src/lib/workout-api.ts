export class WorkoutApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
export async function workoutApi<T>(
  input?: unknown,
  signal?: AbortSignal,
  sessionId?: string,
): Promise<T> {
  const response = await fetch(
    `/api/workouts${sessionId ? `?session=${encodeURIComponent(sessionId)}` : ''}`,
    {
      method: input ? 'POST' : 'GET',
      credentials: 'same-origin',
      signal,
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
      data.error || 'Não foi possível salvar. Tente novamente.',
      response.status,
    );
  return data;
}
