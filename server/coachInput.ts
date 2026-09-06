import { HttpError } from './http.js';
import { object, uuid } from './workoutInput.js';

export function coachText(value: unknown, max: number, required = false) {
  if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim()))
    throw new HttpError(400, 'Confira os textos informados.');
  return value.trim();
}
export function studentIds(value: unknown) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 50)
    throw new HttpError(400, 'Escolha de 1 a 50 alunos.');
  const ids = value.map(uuid);
  if (new Set(ids).size !== ids.length) throw new HttpError(400, 'Aluno duplicado.');
  return ids;
}
export function coachAction(value: unknown) {
  const input = object(value);
  if (typeof input.action !== 'string') throw new HttpError(400, 'Operação inválida.');
  return input;
}
