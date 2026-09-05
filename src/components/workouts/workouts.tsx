import { useEffect, useRef, useState } from 'react';
import type { Session, Template, TemplateDraft, WorkoutDashboard } from '../../../shared/workouts';
import { workoutApi } from '../../services/workoutApi';
import { SessionRunner } from '../sessionRunner/sessionRunner';
import { TemplateEditor } from '../templateEditor/templateEditor';
import './workouts.css';
import { useConfirmation } from '../../hooks/useConfirmation';

export function Workouts({
  userId,
  onInitialLoadComplete,
  registerNavigationGuard,
}: {
  userId: string;
  onInitialLoadComplete: () => void;
  registerNavigationGuard: (guard: ((action: () => void) => void) | null) => void;
}) {
  const { requestConfirmation, confirmation } = useConfirmation();
  const cacheKey = `gymlog:dashboard:v5:${userId}`;
  const [data, setData] = useState<WorkoutDashboard | null>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(cacheKey) || 'null');
    } catch {
      return null;
    }
  });
  const [editor, setEditor] = useState<TemplateDraft | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [busy, setBusy] = useState(!data);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const starting = useRef<{ id: string; templateId: string } | null>(null);
  const saving = useRef(false);
  const history = useRef(new Map<string, Session>());
  const [pendingLabel, setPendingLabel] = useState('Carregando seus treinos…');
  useEffect(() => {
    const controller = new AbortController();
    workoutApi<WorkoutDashboard>(undefined, controller.signal)
      .then((result) => {
        setData(result);
        setError('');
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : 'Não foi possível carregar seus treinos.');
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setBusy(false);
          onInitialLoadComplete();
        }
      });
    return () => controller.abort();
  }, [cacheKey, onInitialLoadComplete, reload]);
  useEffect(() => {
    if (!data) return;
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify(data));
    } catch {
      /* Cache is an optional performance enhancement. */
    }
  }, [cacheKey, data]);
  async function perform<T>(
    job: () => Promise<T>,
    label = 'Salvando alterações…',
  ): Promise<T | undefined> {
    if (saving.current) return;
    saving.current = true;
    setPendingLabel(label);
    setBusy(true);
    setError('');
    try {
      return await job();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar. Tente novamente.');
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  function save(plan: TemplateDraft) {
    const version = data?.templates.find((t) => t.id === plan.id)?.version;
    void perform(async () => {
      const saved = await workoutApi<Template>({
        action: version ? 'update' : 'create',
        template: plan,
        version,
      });
      setData((old) =>
        old
          ? {
              ...old,
              templates: version
                ? old.templates.map((t) => (t.id === saved.id ? saved : t))
                : [...old.templates, saved],
            }
          : old,
      );
      setEditor(null);
    });
  }
  function start(template: Template) {
    if (starting.current?.templateId !== template.id)
      starting.current = { id: crypto.randomUUID(), templateId: template.id };
    void perform(async () => {
      const result = await workoutApi<Session>({
        action: 'start',
        ...starting.current,
        version: template.version,
      });
      setSession(result);
      history.current.set(result.id, result);
      setData((old) => (old ? { ...old, active: result } : old));
      starting.current = null;
    });
  }
  async function mutate(input: object) {
    return perform(async () => {
      const result = await workoutApi<Session>(input);
      setSession(result);
      history.current.set(result.id, result);
      setData((old) =>
        old
          ? {
              ...old,
              active: result.status === 'in_progress' ? result : null,
              recent:
                result.status === 'in_progress'
                  ? old.recent
                  : [result, ...old.recent.filter((s) => s.id !== result.id)].slice(0, 20),
            }
          : old,
      );
      return result;
    });
  }
  return (
    <div className="workouts">
      <div className="operation-status" role="status">
        {busy && data ? pendingLabel : ''}
      </div>
      {error && (
        <div className="message error" role="alert">
          {error}{' '}
          <button
            type="button"
            onClick={() => {
              setEditor(null);
              setSession(null);
              history.current.clear();
              setPendingLabel('Atualizando seus treinos…');
              setBusy(true);
              setReload((n) => n + 1);
            }}
          >
            Recarregar dados
          </button>
        </div>
      )}
      <fieldset className="workout-surface" disabled={busy} aria-busy={busy}>
        {editor && data ? (
          <TemplateEditor
            key={editor.id}
            initial={editor}
            exercises={data.exercises}
            onSave={save}
            onCancel={() => setEditor(null)}
            registerNavigationGuard={registerNavigationGuard}
          />
        ) : session ? (
          <SessionRunner
            key={session.id}
            session={session}
            userId={userId}
            onMutation={mutate}
            onBack={() => {
              setSession(null);
            }}
          />
        ) : (
          data && (
            <>
              <div className="workout-heading">
                <div>
                  <p className="eyebrow">CONSISTÊNCIA COMEÇA AQUI</p>
                  <h2>Meus treinos</h2>
                  <p className="muted">Organize sua ficha. Registre cada conquista.</p>
                </div>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() =>
                    setEditor({
                      id: crypto.randomUUID(),
                      name: '',
                      notes: '',
                      restSeconds: 60,
                      items: [],
                    })
                  }
                >
                  ＋ Criar ficha
                </button>
              </div>
              {data.active && (
                <div className="active-workout">
                  <div>
                    <strong>{data.active.name}</strong>
                    <p>Você tem um treino em andamento.</p>
                  </div>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => setSession(data.active)}
                  >
                    Retomar treino →
                  </button>
                </div>
              )}
              {!data.templates.length && (
                <div className="workout-empty">
                  <h3>Sua primeira ficha começa aqui.</h3>
                  <p>Escolha exercícios, séries e descanso para montar sua rotina.</p>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() =>
                      setEditor({
                        id: crypto.randomUUID(),
                        name: '',
                        notes: '',
                        restSeconds: 60,
                        items: [],
                      })
                    }
                  >
                    Criar minha primeira ficha →
                  </button>
                </div>
              )}
              <div className="template-grid">
                {data.templates.map((template) => (
                  <article className="template-card" key={template.id}>
                    <p className="eyebrow">
                      {template.items.length} EXERCÍCIOS ·{' '}
                      {template.items.reduce((n, i) => n + i.sets, 0)} SÉRIES
                    </p>
                    <h3>{template.name}</h3>
                    {template.notes && <p className="muted">{template.notes}</p>}
                    <ol>
                      {template.items.map((item, index) => (
                        <li key={index}>
                          {data.exercises.find((e) => e.id === item.exerciseId)?.name ||
                            'Exercício'}{' '}
                          <span>
                            {item.sets} ×{' '}
                            {item.reps === null
                              ? `${item.seconds}s`
                              : item.repsMax && item.repsMax !== item.reps
                                ? `${item.reps}-${item.repsMax}`
                                : item.reps}
                          </span>
                        </li>
                      ))}
                    </ol>
                    <div className="workout-actions">
                      <button
                        type="button"
                        className="primary-button"
                        disabled={!!data.active}
                        onClick={() => start(template)}
                      >
                        Iniciar treino
                      </button>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => setEditor(template)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="text-button danger"
                        onClick={() => {
                          requestConfirmation(
                            {
                              title: `Excluir a ficha “${template.name}”?`,
                              description: 'Seus treinos realizados serão preservados.',
                              confirmLabel: 'Excluir ficha',
                              cancelLabel: 'Manter ficha',
                            },
                            () => {
                              void perform(async () => {
                                await workoutApi({
                                  action: 'archive',
                                  id: template.id,
                                  version: template.version,
                                });
                                setData((old) =>
                                  old
                                    ? {
                                        ...old,
                                        templates: old.templates.filter(
                                          (t) => t.id !== template.id,
                                        ),
                                      }
                                    : old,
                                );
                              });
                            },
                          );
                        }}
                      >
                        Excluir
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              {!!data.recent.length && (
                <section className="recent-workouts">
                  <h3>Treinos recentes</h3>
                  <ul>
                    {data.recent.map((item) => (
                      <li key={item.id}>
                        <div>
                          <strong>{item.name}</strong>
                          <small className={item.status === 'cancelled' ? 'status-negative' : ''}>
                            {new Date(item.started_at).toLocaleDateString('pt-BR')} ·{' '}
                            {item.status === 'completed' ? 'Concluído' : 'Cancelado'}
                          </small>
                        </div>
                        <div className="recent-workout-actions">
                          <button
                            type="button"
                            className="text-button"
                            onClick={() => {
                              const cached = history.current.get(item.id);
                              if (cached) {
                                setSession(cached);
                                return;
                              }
                              void perform(async () => {
                                const result = await workoutApi<Session>(
                                  undefined,
                                  undefined,
                                  item.id,
                                );
                                history.current.set(result.id, result);
                                setSession(result);
                              }, 'Carregando registro…');
                            }}
                          >
                            Ver registro →
                          </button>
                          <button
                            type="button"
                            className="text-button danger"
                            onClick={() =>
                              requestConfirmation(
                                {
                                  title: `Excluir “${item.name}” do histórico?`,
                                  description:
                                    'As séries, cargas e anotações deste treino serão apagadas permanentemente.',
                                  confirmLabel: 'Excluir do histórico',
                                  cancelLabel: 'Manter treino',
                                },
                                () => {
                                  void perform(async () => {
                                    await workoutApi({ action: 'delete-session', id: item.id });
                                    history.current.delete(item.id);
                                    setData((current) =>
                                      current
                                        ? {
                                            ...current,
                                            recent: current.recent.filter(
                                              (sessionItem) => sessionItem.id !== item.id,
                                            ),
                                          }
                                        : current,
                                    );
                                  }, 'Excluindo treino…');
                                },
                              )
                            }
                          >
                            Excluir
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )
        )}
      </fieldset>
      {confirmation}
    </div>
  );
}
