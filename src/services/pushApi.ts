import type { PushSettings } from '../../shared/push';
import { WorkoutApiError } from './workoutApi';

export async function pushApi(input?: unknown) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15_000);
  let response: Response;
  try {
    response = await fetch('/api/push', {
      method: input ? 'POST' : 'GET',
      credentials: 'same-origin',
      signal: controller.signal,
      ...(input
        ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }
        : {}),
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError')
      throw new WorkoutApiError('O servidor demorou demais para salvar. Tente novamente.', 408);
    throw cause;
  } finally {
    window.clearTimeout(timeout);
  }
  const data = await response.json();
  if (!response.ok)
    throw new WorkoutApiError(
      data.error || 'Não foi possível configurar as notificações.',
      response.status,
    );
  return data as PushSettings;
}

export function withPushTimeout<T>(operation: Promise<T>, message: string, milliseconds = 12_000) {
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(message)), milliseconds);
    operation.then(
      (value) => {
        window.clearTimeout(timeout);
        resolve(value);
      },
      (cause) => {
        window.clearTimeout(timeout);
        reject(cause);
      },
    );
  });
}

export function applicationServerKey(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const bytes = atob((value + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bytes, (character) => character.charCodeAt(0));
}
