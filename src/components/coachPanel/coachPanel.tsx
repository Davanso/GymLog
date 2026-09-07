import { useEffect, useState, type FormEvent } from 'react';
import type { CoachDashboard, StudentHistory } from '../../../shared/coach';
import { useConfirmation } from '../../hooks/useConfirmation';
import { coachApi } from '../../services/coachApi';
import { LoadingState } from '../loadingState/loadingState';
import './coachPanel.css';

export function CoachPanel() {
  const [data, setData] = useState<CoachDashboard | null>(null);
  const [history, setHistory] = useState<StudentHistory | null>(null);
  const [inviteUrl, setInviteUrl] = useState('');
  const [pendingOperation, setPendingOperation] = useState<string | null>('initial-load');
  const [error, setError] = useState('');
  const { requestConfirmation, confirmation } = useConfirmation();
  const inviteToken = new URLSearchParams(window.location.search).get('convite');
  useEffect(() => {
    let active = true;
    coachApi<CoachDashboard>()
      .then((result) => {
        if (active) setData(result);
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : 'Não foi possível carregar seus vínculos.',
          );
      })
      .finally(() => {
        if (active) setPendingOperation(null);
      });
    return () => {
      active = false;
    };
  }, []);
  async function action(operation: string, job: () => Promise<unknown>) {
    if (pendingOperation) return;
    setPendingOperation(operation);
    setError('');
    try {
      await job();
      setData(await coachApi<CoachDashboard>());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível concluir esta ação.');
    } finally {
      setPendingOperation(null);
    }
  }
  function endRelationship(id: string, name: string) {
    requestConfirmation(
      {
        title: `Encerrar vínculo com ${name}?`,
        description:
          'O acesso compartilhado será encerrado. Treinos e histórico serão preservados.',
        confirmLabel: 'Encerrar vínculo',
        cancelLabel: 'Manter vínculo',
      },
      () => void action(`relationship-${id}`, () => coachApi({ action: 'end-relationship', id })),
    );
  }
  async function assign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const templateId = String(values.get('templateId'));
    const template = data?.templates.find((item) => item.id === templateId);
    if (!template) return;
    const selectedStudents = values.getAll('studentId').map(String);
    await action('assign', () =>
      coachApi({
        action: 'assign',
        templateId,
        version: template.version,
        studentIds: selectedStudents,
        title: String(values.get('title')),
        instructions: String(values.get('instructions')),
        recipientInstructions: Object.fromEntries(
          selectedStudents.map((studentId) => [
            studentId,
            String(values.get(`instructions-${studentId}`) ?? ''),
          ]),
        ),
      }),
    );
  }
  async function showHistory(studentId: string) {
    if (pendingOperation) return;
    setPendingOperation(`history-${studentId}`);
    setError('');
    try {
      setHistory(await coachApi<StudentHistory>(undefined, studentId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar o histórico.');
    } finally {
      setPendingOperation(null);
    }
  }
  return (
    <section className="coach-panel">
      {pendingOperation === 'initial-load' && !data && (
        <LoadingState label="Carregando vínculos…" />
      )}
      <div className="workout-heading">
        <div>
          <p className="eyebrow">COACH E ALUNOS</p>
          <h2>Acompanhamento compartilhado</h2>
          <p className="muted">Treinos orientados sem abrir mão do seu próprio GymLog.</p>
        </div>
        {!data?.enabled && (
          <button
            type="button"
            className="primary-button"
            disabled={Boolean(pendingOperation)}
            onClick={() => void action('enable', () => coachApi({ action: 'enable' }))}
          >
            {pendingOperation === 'enable' ? 'Habilitando…' : 'Habilitar perfil de coach'}
          </button>
        )}
      </div>
      {error && <p className="message error">{error}</p>}
      {inviteToken && (
        <article className="coach-card coach-invite-accept">
          <div>
            <h3>Você recebeu um convite de coach</h3>
            <p>Ao aceitar, o coach poderá atribuir fichas e acompanhar seu histórico.</p>
          </div>
          <button
            type="button"
            className="primary-button"
            disabled={Boolean(pendingOperation)}
            onClick={() =>
              void action('accept-invite', async () => {
                await coachApi({ action: 'accept-invite', token: inviteToken });
                window.history.replaceState(null, '', '/app');
              })
            }
          >
            {pendingOperation === 'accept-invite' ? 'Aceitando…' : 'Aceitar convite'}
          </button>
        </article>
      )}
      {data?.enabled && (
        <article className="coach-card">
          <div className="coach-card__heading">
            <div>
              <p className="eyebrow">CONVIDAR ALUNO</p>
              <h3>Link válido por 7 dias</h3>
            </div>
            <button
              type="button"
              className="secondary-button"
              disabled={Boolean(pendingOperation)}
              onClick={() =>
                void action('create-invite', async () => {
                  const result = await coachApi<{ url: string }>({ action: 'create-invite' });
                  setInviteUrl(result.url);
                })
              }
            >
              {pendingOperation === 'create-invite' ? 'Gerando…' : 'Gerar link'}
            </button>
          </div>
          {pendingOperation === 'create-invite' && (
            <LoadingState label="Gerando seu link de convite…" delayMs={0} compact />
          )}
          {inviteUrl && (
            <div className="invite-link">
              <input readOnly value={inviteUrl} aria-label="Link do convite" />
              <button
                type="button"
                className="text-button"
                onClick={() => void navigator.clipboard.writeText(inviteUrl)}
              >
                Copiar
              </button>
            </div>
          )}
          {!!data.invites.length && (
            <ul className="pending-invites">
              {data.invites.map((invite) => (
                <li key={invite.id}>
                  <span>
                    Convite criado em {new Date(invite.createdAt).toLocaleDateString('pt-BR')} ·
                    expira em {new Date(invite.expiresAt).toLocaleDateString('pt-BR')}
                  </span>
                  <button
                    type="button"
                    className="text-button danger"
                    onClick={() =>
                      void action(`revoke-${invite.id}`, () =>
                        coachApi({ action: 'revoke-invite', id: invite.id }),
                      )
                    }
                  >
                    Revogar
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="disable-coach-action">
            <button
              type="button"
              className="text-button danger disable-coach"
              disabled={Boolean(pendingOperation)}
              onClick={() =>
                requestConfirmation(
                  {
                    title: 'Desabilitar o perfil de coach?',
                    description:
                      'Convites pendentes serão revogados e o acesso aos históricos ficará suspenso. Seus registros serão preservados.',
                    confirmLabel: 'Desabilitar perfil',
                    cancelLabel: 'Manter perfil',
                  },
                  () => void action('disable', () => coachApi({ action: 'disable' })),
                )
              }
            >
              {pendingOperation === 'disable' ? 'Desabilitando…' : 'Desabilitar perfil de coach'}
            </button>
            {pendingOperation === 'disable' && (
              <LoadingState label="Desabilitando perfil de coach…" delayMs={0} compact />
            )}
          </div>
        </article>
      )}
      <div className="coach-columns">
        <article className="coach-card">
          <p className="eyebrow">MEUS COACHES</p>
          <h3>{data?.coaches.length || 0} de 3 vínculos ativos</h3>
          {!data?.coaches.length && <p className="muted">Você ainda não possui um coach.</p>}
          <ul className="connection-list">
            {data?.coaches.map((coach) => (
              <li key={coach.relationshipId}>
                <strong>{coach.name}</strong>
                <button
                  type="button"
                  className="text-button danger"
                  onClick={() => endRelationship(coach.relationshipId, coach.name)}
                >
                  Encerrar
                </button>
              </li>
            ))}
          </ul>
        </article>
        {data?.enabled && (
          <article className="coach-card">
            <p className="eyebrow">MEUS ALUNOS</p>
            <h3>{data.students.length} vínculos ativos</h3>
            {!data.students.length && <p className="muted">Envie um convite para começar.</p>}
            <ul className="connection-list">
              {data.students.map((student) => (
                <li key={student.relationshipId}>
                  <strong>{student.name}</strong>
                  <span>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => void showHistory(student.profileId)}
                      disabled={Boolean(pendingOperation)}
                    >
                      {pendingOperation === `history-${student.profileId}`
                        ? 'Carregando…'
                        : 'Histórico'}
                    </button>
                    <button
                      type="button"
                      className="text-button danger"
                      onClick={() => endRelationship(student.relationshipId, student.name)}
                    >
                      Remover
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </article>
        )}
      </div>
      {data?.enabled && data.students.length > 0 && data.templates.length > 0 && (
        <form className="coach-card assignment-form" onSubmit={(event) => void assign(event)}>
          <p className="eyebrow">ATRIBUIR FICHA</p>
          <h3>Envie uma versão fechada do treino</h3>
          <label>
            Ficha
            <select name="templateId" required>
              {data.templates.map((template) => (
                <option value={template.id} key={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Título da atribuição
            <input name="title" required maxLength={120} placeholder="Treino A — semana 1" />
          </label>
          <fieldset>
            <legend>Alunos</legend>
            {data.students.map((student) => (
              <div className="student-recipient" key={student.profileId}>
                <label className="student-check">
                  <input type="checkbox" name="studentId" value={student.profileId} />
                  {student.name}
                </label>
                <input
                  name={`instructions-${student.profileId}`}
                  maxLength={2000}
                  placeholder={`Instrução individual para ${student.name}`}
                />
              </div>
            ))}
          </fieldset>
          <label>
            Instruções
            <textarea name="instructions" maxLength={2000} rows={3} />
          </label>
          <button type="submit" className="primary-button" disabled={Boolean(pendingOperation)}>
            {pendingOperation === 'assign' ? 'Atribuindo…' : 'Atribuir ficha'}
          </button>
        </form>
      )}
      {history && (
        <article className="coach-card student-history">
          <div className="coach-card__heading">
            <div>
              <p className="eyebrow">HISTÓRICO DO ALUNO</p>
              <h3>{history.student.name}</h3>
            </div>
            <button type="button" className="text-button" onClick={() => setHistory(null)}>
              Fechar
            </button>
          </div>
          {!history.sessions.length && <p className="muted">Nenhum treino encerrado.</p>}
          {history.sessions.map((session) => (
            <details key={session.id}>
              <summary>
                {session.name} · {new Date(session.started_at).toLocaleDateString('pt-BR')} ·{' '}
                {session.status === 'completed' ? 'Concluído' : 'Cancelado'}
              </summary>
              {session.exercises.map((exercise) => (
                <div className="history-exercise" key={exercise.id}>
                  <strong>{exercise.exercise_name_snapshot}</strong>
                  {exercise.notes && <p>{exercise.notes}</p>}
                  <ul>
                    {exercise.sets.map((set) => (
                      <li key={set.id}>
                        Série {set.position}: {set.status === 'completed' ? 'concluída' : 'pulada'}{' '}
                        · {set.actual_reps ?? set.actual_duration_seconds ?? '—'} ·{' '}
                        {set.actual_load_kg ?? '—'} kg
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </details>
          ))}
        </article>
      )}
      {confirmation}
    </section>
  );
}
