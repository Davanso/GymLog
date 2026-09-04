import { useEffect, useState } from 'react';
import type { Session, SessionExercise, SessionSet } from '../../../shared/workouts';
import { RestTimer } from './RestTimer';
import { readClock, startClock, type RestClock } from './rest-clock';
import { loadLabel } from './labels';
import { useConfirmation } from '../../components/useConfirmation';
import { ExercisePreview } from './ExercisePreview';

type SetInput = { setId: string; status: 'completed' | 'skipped'; amount?: number; load?: number };
function SetRow({
  set,
  exercise,
  editable,
  onSave,
}: {
  set: SessionSet;
  exercise: SessionExercise;
  editable: boolean;
  onSave: (input: SetInput) => void;
}) {
  const [amount, setAmount] = useState(
    set.actual_reps?.toString() || set.actual_duration_seconds?.toString() || '',
  );
  const [load, setLoad] = useState(set.actual_load_kg?.toString() ?? '');
  const duration = exercise.tracking_mode_snapshot === 'duration';
  const pending = set.status === 'pending' && editable;
  return (
    <form
      className={`session-set session-set--${set.status}`}
      onSubmit={(event) => {
        event.preventDefault();
        onSave({ setId: set.id, status: 'completed', amount: Number(amount), load: Number(load) });
      }}
    >
      <div>
        <strong>Série {set.position}</strong>
        <small>
          Meta: {set.target_reps_min ?? set.target_duration_seconds ?? '—'}{' '}
          {duration ? 's' : 'reps'} · {set.target_load_kg ?? 0}{' '}
          {loadLabel(exercise.load_convention_snapshot)}
        </small>
      </div>
      {pending ? (
        <>
          <label>
            {duration ? 'Duração (s)' : 'Repetições'}
            <input
              type="number"
              required
              min={1}
              max={duration ? 86400 : 1000}
              placeholder={String(set.target_reps_min ?? set.target_duration_seconds ?? '')}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <label>
            Carga ({loadLabel(exercise.load_convention_snapshot)})
            <input
              type="number"
              required
              min={0}
              max={99999}
              step="0.001"
              placeholder={String(set.target_load_kg ?? 0)}
              value={load}
              onChange={(e) => setLoad(e.target.value)}
            />
          </label>
          <button className="primary-button">Concluir série</button>
          <button
            type="button"
            className="text-button"
            onClick={() => onSave({ setId: set.id, status: 'skipped' })}
          >
            Pular série
          </button>
        </>
      ) : (
        <p className="set-result">
          {set.status === 'completed'
            ? `✓ ${set.actual_reps ?? set.actual_duration_seconds} ${duration ? 's' : 'reps'} · ${set.actual_load_kg} ${loadLabel(exercise.load_convention_snapshot)}`
            : set.status === 'skipped'
              ? 'Série pulada'
              : 'Não realizada'}
        </p>
      )}
    </form>
  );
}
export function SessionRunner({
  session,
  userId,
  onMutation,
  onBack,
}: {
  session: Session;
  userId: string;
  onMutation: (input: object) => Promise<Session | undefined>;
  onBack: () => void;
}) {
  const storageKey = `gymlog:rest:${userId}:${session.id}`;
  const { requestConfirmation, confirmation } = useConfirmation();
  const [clock, setClock] = useState<RestClock | null>(() => readClock(storageKey));
  const [elapsed, setElapsed] = useState(() => Date.now() - new Date(session.started_at).getTime());
  const active = session.status === 'in_progress';
  useEffect(() => {
    const tick = () => setElapsed(Date.now() - new Date(session.started_at).getTime());
    const interval = window.setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [session.started_at]);
  useEffect(() => {
    try {
      if (clock && active) localStorage.setItem(storageKey, JSON.stringify(clock));
      else localStorage.removeItem(storageKey);
    } catch {
      /* Storage may be unavailable; the timer still works in this tab. */
    }
  }, [clock, storageKey, active]);
  async function saveSet(input: SetInput, set: SessionSet) {
    const result = await onMutation({
      action: 'set',
      id: session.id,
      version: session.version,
      ...input,
    });
    if (result && input.status === 'completed') {
      const rest = set.rest_seconds ?? 0;
      setClock(
        rest > 0 && result.exercises.some((e) => e.sets.some((s) => s.status === 'pending'))
          ? startClock(set.id, rest)
          : null,
      );
    }
  }
  const sets = session.exercises.flatMap((e) => e.sets),
    completed = sets.filter((s) => s.status === 'completed').length;
  const finalizable = completed > 0 && !sets.some((s) => s.status === 'pending');
  return (
    <section className="session-runner">
      <div className="workout-heading">
        <div>
          <p className="eyebrow">
            {active
              ? 'TREINO EM ANDAMENTO'
              : session.status === 'completed'
                ? 'TREINO CONCLUÍDO'
                : 'TREINO CANCELADO'}
          </p>
          <h2>{session.name}</h2>
          <p className="muted">
            {completed}/{sets.length} séries concluídas ·{' '}
            {Math.max(
              0,
              Math.floor(
                (active
                  ? elapsed
                  : new Date(session.ended_at!).getTime() -
                    new Date(session.started_at).getTime()) / 60000,
              ),
            )}{' '}
            min decorridos
          </p>
        </div>
        <button type="button" className="text-button" onClick={onBack}>
          Voltar às fichas
        </button>
      </div>
      {active && <RestTimer clock={clock} onChange={setClock} />}
      <p className="muted">
        {active
          ? 'Preencha o que você realmente fez. Cada série é salva ao concluir.'
          : 'Os registros deste treino preservam a ficha usada naquele dia.'}
      </p>
      {session.exercises.map((exercise, index) => (
        <section className="session-exercise" key={exercise.id}>
          <h3>
            <span>{String(index + 1).padStart(2, '0')}</span> {exercise.exercise_name_snapshot}
          </h3>
          {exercise.external_id && (
            <ExercisePreview
              externalId={exercise.external_id}
              name={exercise.exercise_name_snapshot}
              imageUrl={exercise.image_url}
              videoUrl={exercise.video_url}
            />
          )}
          {exercise.sets.map((set) => (
            <SetRow
              key={set.id}
              set={set}
              exercise={exercise}
              editable={active}
              onSave={(input) => {
                if (input.status === 'skipped') {
                  requestConfirmation(
                    {
                      title: `Pular a série ${set.position}?`,
                      description: 'Ela ficará registrada como não realizada neste treino.',
                      confirmLabel: 'Pular série',
                      cancelLabel: 'Continuar série',
                    },
                    () => void saveSet(input, set),
                  );
                } else if (clock) {
                  requestConfirmation(
                    {
                      title: 'Substituir o descanso atual?',
                      description:
                        'Esta série será registrada e o descanso atual será substituído pelo próximo intervalo, se houver.',
                      confirmLabel: 'Registrar série',
                      cancelLabel: 'Manter descanso',
                    },
                    () => void saveSet(input, set),
                  );
                } else void saveSet(input, set);
              }}
            />
          ))}
        </section>
      ))}
      {active && (
        <div className="workout-actions editor-footer">
          <button
            type="button"
            className="primary-button"
            disabled={!finalizable}
            onClick={() =>
              requestConfirmation(
                {
                  title: 'Finalizar este treino?',
                  description: `${completed} de ${sets.length} séries serão registradas como concluídas.`,
                  confirmLabel: 'Finalizar treino',
                  cancelLabel: 'Continuar treino',
                },
                () =>
                  void onMutation({ action: 'finish', id: session.id, version: session.version }),
              )
            }
          >
            Finalizar treino
          </button>
          <button
            type="button"
            className="text-button danger"
            onClick={() => {
              requestConfirmation(
                {
                  title: 'Cancelar este treino?',
                  description:
                    'As séries salvas serão preservadas, mas o treino não contará como concluído.',
                  confirmLabel: 'Cancelar treino',
                  cancelLabel: 'Continuar treino',
                },
                () =>
                  void onMutation({ action: 'cancel', id: session.id, version: session.version }),
              );
            }}
          >
            Cancelar treino
          </button>
          {!finalizable && <small>Conclua ao menos uma série e conclua ou pule as demais.</small>}
        </div>
      )}
      {confirmation}
    </section>
  );
}
