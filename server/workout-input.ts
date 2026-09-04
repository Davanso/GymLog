import { HttpError } from './http.js';
import type { TemplateDraft } from '../shared/workouts.js';

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new HttpError(400, 'Dados inválidos.');
  return value as Record<string, unknown>;
}
export function uuid(value: unknown) {
  if (
    typeof value !== 'string' ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)
  )
    throw new HttpError(400, 'Identificador inválido.');
  return value;
}
export function number(value: unknown, min: number, max: number, integer = true) {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (integer && !Number.isInteger(value))
  )
    throw new HttpError(400, 'Confira os valores de séries, carga e descanso.');
  return value;
}
export function loadKg(value: unknown) {
  const load = number(value, 0, 99999, false);
  if (Math.abs(load * 1000 - Math.round(load * 1000)) > 0.000001)
    throw new HttpError(400, 'Use até três casas decimais para carga.');
  return load;
}
function text(value: unknown, max: number, required = false) {
  if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim()))
    throw new HttpError(400, 'Confira o nome e as observações.');
  return value.trim();
}
export function draft(value: unknown): TemplateDraft {
  const input = object(value);
  if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > 20)
    throw new HttpError(400, 'Escolha de 1 a 20 exercícios.');
  return {
    id: uuid(input.id),
    name: text(input.name, 120, true),
    notes: text(input.notes ?? '', 2000),
    items: input.items.map((raw) => {
      const item = object(raw);
      const reps = item.reps === null ? null : number(item.reps, 1, 1000);
      const seconds = item.seconds === null ? null : number(item.seconds, 1, 86400);
      if ((reps === null) === (seconds === null))
        throw new HttpError(400, 'Informe repetições ou duração para cada exercício.');
      return {
        exerciseId: uuid(item.exerciseId),
        sets: number(item.sets, 1, 10),
        reps,
        seconds,
        load: loadKg(item.load),
        rest: number(item.rest, 0, 3600),
      };
    }),
  };
}
