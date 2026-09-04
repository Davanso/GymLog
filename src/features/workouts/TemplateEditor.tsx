import { useState } from 'react';
import type { Exercise, PlanItem, TemplateDraft } from '../../../shared/workouts';

import { loadLabel } from './labels';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { matchesExercise, templateChanged } from './exercise-search';

export function TemplateEditor({
  initial,
  exercises,
  onSave,
  onCancel,
}: {
  initial: TemplateDraft;
  exercises: Exercise[];
  onSave: (draft: TemplateDraft) => void;
  onCancel: () => void;
}) {
  const [plan, setPlan] = useState(initial);
  const [search, setSearch] = useState('');
  const [muscle, setMuscle] = useState('');
  const [confirmExit, setConfirmExit] = useState(false);
  const dirty = templateChanged(plan, initial);
  function requestClose() {
    if (dirty) setConfirmExit(true);
    else onCancel();
  }
  function update(index: number, patch: Partial<PlanItem>) {
    setPlan((p) => ({
      ...p,
      items: p.items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }));
  }
  function move(index: number, direction: number) {
    setPlan((p) => {
      const items = [...p.items];
      [items[index], items[index + direction]] = [items[index + direction], items[index]];
      return { ...p, items };
    });
  }
  const filtered = exercises.filter((exercise) => matchesExercise(exercise, search, muscle));
  const muscles = [...new Set(exercises.flatMap((exercise) => exercise.muscle_groups || []))].sort(
    (a, b) => a.localeCompare(b, 'pt-BR'),
  );
  return (
    <form
      className="workout-editor"
      onSubmit={(e) => {
        e.preventDefault();
        if (dirty) onSave(plan);
        else onCancel();
      }}
    >
      <div className="workout-heading editor-heading">
        <div>
          <p className="eyebrow">SUA ROTINA, DO SEU JEITO</p>
          <h2>{initial.items.length ? 'Editar ficha' : 'Nova ficha'}</h2>
          <p>Monte a sequência. Ajuste as metas. O próximo treino começa aqui.</p>
        </div>
        <button type="button" className="text-button" onClick={requestClose}>
          ← Voltar às fichas
        </button>
      </div>
      <div className="editor-details">
        <label>
          Nome da ficha
          <input
            autoFocus
            required
            maxLength={120}
            placeholder="Treino A — Peito e tríceps"
            value={plan.name}
            onChange={(e) => setPlan({ ...plan, name: e.target.value })}
          />
        </label>
        <label>
          <span>
            Observações <span className="muted">(opcional)</span>
          </span>
          <textarea
            maxLength={2000}
            rows={2}
            value={plan.notes}
            onChange={(e) => setPlan({ ...plan, notes: e.target.value })}
          />
        </label>
      </div>
      <div className="editor-columns">
        <section aria-label="Exercícios da ficha" className="planned-exercises">
          <h3>
            Exercícios <span className="muted">{plan.items.length}/20</span>
          </h3>
          {!plan.items.length && (
            <p className="workout-empty">
              Escolha um exercício no catálogo para começar sua ficha.
            </p>
          )}
          {plan.items.map((item, index) => {
            const exercise = exercises.find((e) => e.id === item.exerciseId);
            return (
              <section
                className="planned-item"
                aria-labelledby={`exercise-title-${index}`}
                key={`${index}-${item.exerciseId}`}
              >
                <div className="planned-item__heading">
                  <span className="exercise-number" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h4 id={`exercise-title-${index}`}>
                      {exercise?.name || 'Exercício indisponível'}
                    </h4>
                    <p>
                      {exercise?.equipment} · {(exercise?.muscle_groups || []).join(' / ')}
                    </p>
                  </div>
                </div>
                <div className="plan-fields">
                  <label>
                    Séries
                    <input
                      type="number"
                      required
                      min={1}
                      max={10}
                      value={Number.isNaN(item.sets) ? '' : item.sets}
                      onChange={(e) => update(index, { sets: e.target.valueAsNumber })}
                    />
                  </label>
                  <label>
                    {exercise?.tracking_mode === 'duration' ? 'Duração (s)' : 'Repetições'}
                    <input
                      type="number"
                      required
                      min={1}
                      max={exercise?.tracking_mode === 'duration' ? 86400 : 1000}
                      value={
                        (exercise?.tracking_mode === 'duration' ? item.seconds : item.reps) || ''
                      }
                      onChange={(e) =>
                        update(
                          index,
                          exercise?.tracking_mode === 'duration'
                            ? { seconds: e.target.valueAsNumber }
                            : { reps: e.target.valueAsNumber },
                        )
                      }
                    />
                  </label>
                  <label>
                    Carga · {loadLabel(exercise?.load_convention || '')}
                    <input
                      type="number"
                      required
                      min={0}
                      max={99999}
                      step="0.001"
                      value={Number.isNaN(item.load) ? '' : item.load}
                      onChange={(e) => update(index, { load: e.target.valueAsNumber })}
                    />
                  </label>
                  <label>
                    Descanso · seg
                    <input
                      type="number"
                      required
                      min={0}
                      max={3600}
                      value={Number.isNaN(item.rest) ? '' : item.rest}
                      onChange={(e) => update(index, { rest: e.target.valueAsNumber })}
                    />
                  </label>
                </div>
                <div className="workout-actions planned-item__actions">
                  {plan.items.length > 1 && (
                    <>
                      <button
                        type="button"
                        className="text-button"
                        disabled={index === 0}
                        aria-label={`Mover ${exercise?.name} para cima`}
                        onClick={() => move(index, -1)}
                      >
                        ↑ Subir
                      </button>
                      <button
                        type="button"
                        className="text-button"
                        disabled={index === plan.items.length - 1}
                        aria-label={`Mover ${exercise?.name} para baixo`}
                        onClick={() => move(index, 1)}
                      >
                        ↓ Descer
                      </button>
                    </>
                  )}
                  {plan.items.length === 1 && (
                    <span className="muted">Primeiro exercício da ficha</span>
                  )}
                  <button
                    type="button"
                    className="text-button danger"
                    onClick={() =>
                      setPlan({ ...plan, items: plan.items.filter((_, i) => i !== index) })
                    }
                  >
                    Remover
                  </button>
                </div>
              </section>
            );
          })}
        </section>
        <aside className="exercise-picker">
          <h3>Catálogo de exercícios</h3>
          <label>
            Buscar exercício
            <input
              type="search"
              value={search}
              placeholder="Ex.: peito, bíceps, barra…"
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label>
            Grupo muscular
            <select value={muscle} onChange={(e) => setMuscle(e.target.value)}>
              <option value="">Todos os grupos</option>
              {muscles.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
          <p className="picker-count">
            {filtered.length}{' '}
            {filtered.length === 1 ? 'exercício disponível' : 'exercícios disponíveis'}
          </p>
          <ul>
            {filtered.map((exercise) => (
              <li key={exercise.id}>
                <div>
                  <strong>{exercise.name}</strong>
                  <small>
                    {exercise.equipment} · {loadLabel(exercise.load_convention)}
                  </small>
                  <div className="muscle-tags">
                    {(exercise.muscle_groups || []).map((name) => (
                      <span key={name}>{name}</span>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={plan.items.length >= 20}
                  aria-label={`Adicionar ${exercise.name}`}
                  onClick={() =>
                    setPlan({
                      ...plan,
                      items: [
                        ...plan.items,
                        {
                          exerciseId: exercise.id,
                          sets: 3,
                          reps: exercise.tracking_mode === 'reps' ? 10 : null,
                          seconds: exercise.tracking_mode === 'duration' ? 30 : null,
                          load: 0,
                          rest: 60,
                        },
                      ],
                    })
                  }
                >
                  ＋
                </button>
              </li>
            ))}
          </ul>
          {!filtered.length && <p>Nenhum exercício encontrado.</p>}
        </aside>
      </div>
      <div className="workout-actions editor-footer">
        <div className="editor-summary">
          <strong>
            {plan.items.length} {plan.items.length === 1 ? 'exercício' : 'exercícios'} ·{' '}
            {plan.items.reduce(
              (sum, item) => sum + (Number.isFinite(item.sets) ? item.sets : 0),
              0,
            )}{' '}
            séries
          </strong>
          <small>{dirty ? 'Alterações ainda não salvas' : 'Nenhuma alteração pendente'}</small>
        </div>
        <button className="primary-button" disabled={!plan.items.length || !dirty}>
          Salvar ficha
        </button>
        <button type="button" className="secondary-button" onClick={requestClose}>
          Cancelar
        </button>
      </div>
      {confirmExit && (
        <ConfirmDialog
          title="Sair da edição?"
          eyebrow="ANTES DE VOLTAR"
          cancelLabel="Continuar editando"
          description="As alterações não salvas serão descartadas."
          confirmLabel="Descartar e sair"
          onCancel={() => setConfirmExit(false)}
          onConfirm={onCancel}
        />
      )}
    </form>
  );
}
