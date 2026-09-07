import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { CoachDashboard, StudentHistory } from '../../../shared/coach';
import { useConfirmation } from '../../hooks/useConfirmation';
import { coachApi } from '../../services/coachApi';
import { LoadingState } from '../loadingState/loadingState';
import './coachPanel.css';

export function CoachPanel() {
  const [data, setData] = useState<CoachDashboard | null>(null);
  const [history, setHistory] = useState<StudentHistory | null>(null);
  const [inviteUrl, setInviteUrl] = useState('');
  const [copyFeedback, setCopyFeedback] = useState('');
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [success, setSuccess] = useState('');
  const [pendingOperation, setPendingOperation] = useState<string | null>('initial-load');
  const [error, setError] = useState('');
  const copyFeedbackTimer = useRef<number | null>(null);
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
  useEffect(
    () => () => {
      if (copyFeedbackTimer.current) window.clearTimeout(copyFeedbackTimer.current);
    },
    [],
  );
  async function action(operation: string, job: () => Promise<unknown>) {
    if (pendingOperation) return false;
    setPendingOperation(operation);
    setError('');
    try {
      await job();
      setData(await coachApi<CoachDashboard>());
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível concluir esta ação.');
      return false;
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
    const completed = await action('assign', () =>
      coachApi({
        action: 'assign',
        templateId,
        version: template.version,
        studentIds: selectedStudents,
        title: String(values.get('title')),
        instructions: String(values.get('instructions')),
      }),
    );
    if (!completed) return;
    setAssignmentOpen(false);
    setSuccess(
      `Ficha atribuída ${selectedStudents.length === 1 ? 'ao aluno selecionado.' : `a ${selectedStudents.length} alunos.`}`,
    );
  }
  async function copyInviteLink() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopyFeedback('Link copiado.');
    } catch {
      setCopyFeedback('Não foi possível copiar o link.');
    }
    if (copyFeedbackTimer.current) window.clearTimeout(copyFeedbackTimer.current);
    copyFeedbackTimer.current = window.setTimeout(() => setCopyFeedback(''), 3000);
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
      {success && (
        <p className="message success" role="status">
          {success}
        </p>
      )}
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
              <button type="button" className="text-button" onClick={() => void copyInviteLink()}>
                Copiar
              </button>
            </div>
          )}
          {copyFeedback && (
            <p className="copy-feedback" role="status">
              {copyFeedback}
            </p>
          )}
          {!!data.invites.length && (
            <ul className="pending-invites">
              {data.invites.map((invite) => (
                <li key={invite.id}>
                  <span className="student-actions">
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
      {data?.enabled &&
        data.students.length > 0 &&
        data.templates.length > 0 &&
        !assignmentOpen && (
          <article className="coach-card assignment-intro">
            <p className="eyebrow">ATRIBUIR FICHA</p>
            <h3>Envie uma versão fechada do treino para seus alunos</h3>
            <p className="muted">
              A ficha fica preservada como foi enviada, mesmo que você a edite depois.
            </p>
            <button
              type="button"
              className="primary-button"
              onClick={() => setAssignmentOpen(true)}
            >
              Atribuir uma ficha
            </button>
          </article>
        )}
      {data?.enabled && data.students.length > 0 && data.templates.length > 0 && assignmentOpen && (
        <form className="coach-card assignment-form" onSubmit={(event) => void assign(event)}>
          <div className="coach-card__heading">
            <div>
              <p className="eyebrow">ATRIBUIR FICHA</p>
              <h3>Envie uma versão fechada do treino</h3>
            </div>
            <button type="button" className="text-button" onClick={() => setAssignmentOpen(false)}>
              Cancelar
            </button>
          </div>
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
          <section className="assignment-history">
            <p className="eyebrow">FICHAS ATRIBUÍDAS</p>
            <h4>Envios para {history.student.name}</h4>
            {!history.assignments.length && (
              <p className="muted">Nenhuma ficha foi atribuída ainda.</p>
            )}
            <ul>
              {history.assignments.map((assignment) => (
                <li key={assignment.id}>
                  <div>
                    <strong>{assignment.title}</strong>
                    <span>{assignment.templateName}</span>
                  </div>
                  <div className="assignment-history__meta">
                    <span>{new Date(assignment.assignedAt).toLocaleDateString('pt-BR')}</span>
                    <span className={`assignment-status assignment-status--${assignment.status}`}>
                      {assignment.status === 'assigned'
                        ? 'Não iniciada'
                        : assignment.status === 'started'
                          ? 'Em andamento'
                          : assignment.status === 'completed'
                            ? 'Concluída'
                            : 'Retirada'}
                    </span>
                  </div>
                  {assignment.instructions && <p>{assignment.instructions}</p>}
                </li>
              ))}
            </ul>
          </section>
        </article>
      )}
      {confirmation}
    </section>
  );
}
