import type { Exercise, TemplateDraft } from '../../../shared/workouts.js';

function normalize(text: string) {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}
export function matchesExercise(exercise: Exercise, query: string, muscle = '') {
  const groups = exercise.muscle_groups || [];
  const text = normalize([exercise.name, exercise.equipment, ...groups].join(' '));
  return (
    (!muscle || (exercise.primary_muscle_groups || groups).includes(muscle)) &&
    normalize(query)
      .split(/\s+/)
      .every((word) => text.includes(word))
  );
}
export function templateChanged(plan: TemplateDraft, original: TemplateDraft) {
  const signature = (value: TemplateDraft) =>
    JSON.stringify({
      name: value.name.trim(),
      notes: value.notes.trim(),
      restSeconds: value.restSeconds,
      items: value.items,
    });
  return signature(plan) !== signature(original);
}
