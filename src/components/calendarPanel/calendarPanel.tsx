import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Bell, CalendarDays, Check, ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { CalendarDashboard, CalendarEvent } from '../../../shared/calendar';
import { calendarApi, readCalendarCache } from '../../services/calendarApi';
import { workoutApi } from '../../services/workoutApi';
import { LoadingState } from '../loadingState/loadingState';
import { LocalizedDateField } from '../localizedDateField/localizedDateField';
import './calendarPanel.css';

const weekdayNames = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
function shiftMonth(month: string, amount: number) {
  const [year, value] = month.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, value - 1 + amount, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`;
}
function monthCells(month: string) {
  const [year, value] = month.split('-').map(Number);
  const count = new Date(year, value, 0).getDate();
  const first = new Date(year, value - 1, 1).getDay();
  const offset = first === 0 ? 6 : first - 1;
  return [
    ...Array(offset).fill(null),
    ...Array.from(
      { length: count },
      (_, index) => `${month}-${String(index + 1).padStart(2, '0')}`,
    ),
  ];
}

export function CalendarPanel() {
  const initialMonth = localDate().slice(0, 7);
  const [month, setMonth] = useState(initialMonth);
  const [subjectId, setSubjectId] = useState('');
  const [data, setData] = useState<CalendarDashboard | null>(() =>
    readCalendarCache({ month: initialMonth }),
  );
  const [selectedDate, setSelectedDate] = useState(localDate());
  const [requesting, setRequesting] = useState<CalendarEvent | null>(null);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [selectedRequestId, setSelectedRequestId] = useState(
    () => new URLSearchParams(window.location.search).get('solicitacao') || '',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [reload, setReload] = useState(0);
  const cells = useMemo(() => monthCells(month), [month]);
  useEffect(() => {
    let active = true;
    calendarApi(undefined, {
      month,
      subjectId: subjectId || undefined,
      refresh: true,
    })
      .then((dashboard) => {
        if (!active) return;
        setData(dashboard);
        setError('');
      })
      .catch((cause) => {
        if (active)
          setError(cause instanceof Error ? cause.message : 'Não foi possível carregar a agenda.');
      });
    return () => {
      active = false;
    };
  }, [month, reload, subjectId]);
  async function mutate(input: unknown, message: string) {
    if (busy) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await calendarApi(input);
      setData(
        await calendarApi(undefined, {
          month,
          subjectId: subjectId || undefined,
        }),
      );
      setSuccess(message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar a alteração.');
    } finally {
      setBusy(false);
    }
  }
  async function saveSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const sourceId = String(values.get('sourceId'));
    const source = data?.schedules.find((item) => item.id === sourceId);
    if (!source) return;
    await mutate(
      {
        action: 'save-schedule',
        subjectId: data?.subject.id,
        sourceId,
        source: source.source,
        weekdays: values.getAll('weekday').map(Number),
        startsOn: String(values.get('startsOn')),
      },
      'Dias de treino atualizados.',
    );
  }
  async function sendRequest(
    event: FormEvent<HTMLFormElement>,
    sourceId: string,
    occurrence?: CalendarEvent,
  ) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    await mutate(
      occurrence
        ? {
            action: 'request-change',
            kind: 'one_off',
            recipientId: sourceId,
            scheduledWorkoutId: occurrence.id,
            proposedDate: values.get('proposedDate'),
            message: values.get('message'),
          }
        : {
            action: 'request-change',
            kind: 'recurring',
            recipientId: sourceId,
            weekdays: values.getAll('weekday').map(Number),
            message: values.get('message'),
          },
      'Solicitação enviada ao coach.',
    );
    setRequesting(null);
  }
  async function startWorkout(item: CalendarEvent) {
    setBusy(true);
    setError('');
    try {
      await workoutApi({
        action: item.source === 'personal' ? 'start' : 'start-assigned',
        id: crypto.randomUUID(),
        ...(item.source === 'personal'
          ? { templateId: item.sourceId, version: item.version }
          : { recipientId: item.sourceId }),
        scheduledWorkoutId: item.id,
      });
      window.location.assign('/app');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível iniciar o treino.');
      setBusy(false);
    }
  }
  const day = data?.days.find((item) => item.date === selectedDate);
  const selectedSource = data?.schedules.find((item) => item.id === requesting?.sourceId);
  const selectedRequest = data?.requests.find((item) => item.id === selectedRequestId);
  function openRequest(id: string) {
    setSelectedRequestId(id);
    const url = new URL(window.location.href);
    url.searchParams.set('secao', 'calendario');
    url.searchParams.set('solicitacao', id);
    window.history.replaceState(null, '', `${url.pathname}${url.search}`);
  }
  function closeRequest() {
    setSelectedRequestId('');
    const url = new URL(window.location.href);
    url.searchParams.delete('solicitacao');
    window.history.replaceState(null, '', `${url.pathname}${url.search}`);
  }
  function navigateMonth(amount: number) {
    const next = shiftMonth(month, amount);
    setData(readCalendarCache({ month: next, subjectId: subjectId || undefined }));
    setMonth(next);
    setSelectedDate(`${next}-01`);
  }
  return (
    <section className="calendar-panel">
      <header className="calendar-heading">
        <div>
          <p className="eyebrow">AGENDA DE TREINOS</p>
          <h2>Calendário</h2>
          <p className="muted">Planejamento e aderência.</p>
        </div>
        {!!data?.students.length && (
          <label className="calendar-student-select">
            Visualizando
            <select
              value={subjectId}
              onChange={(event) => {
                const nextSubject = event.target.value;
                setData(readCalendarCache({ month, subjectId: nextSubject || undefined }));
                setSubjectId(nextSubject);
              }}
            >
              <option value="">Meu calendário</option>
              {data.students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>
      {error && data && (
        <p className="message error" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="message success" role="status">
          {success}
        </p>
      )}
      {!data && !error ? (
        <div className="calendar-loading">
          <LoadingState label="Carregando calendário…" />
        </div>
      ) : !data ? (
        <div className="calendar-load-error" role="alert">
          <CalendarDays aria-hidden="true" />
          <h3>Não foi possível abrir o calendário</h3>
          <p>{error}</p>
          <button
            className="secondary-action"
            type="button"
            onClick={() => {
              setError('');
              setReload((value) => value + 1);
            }}
          >
            Tentar novamente
          </button>
        </div>
      ) : (
        <>
          {data.subject.isSelf && (
            <details className="notification-center">
              <summary>
                <Bell aria-hidden="true" /> Notificações{' '}
                {data.unreadNotifications > 0 && <span>{data.unreadNotifications}</span>}
              </summary>
              {!!data.unreadNotifications && (
                <button
                  type="button"
                  className="notification-read-all"
                  onClick={() => void mutate({ action: 'read-all-notifications' }, '')}
                >
                  Marcar todas como lidas
                </button>
              )}
              <ul>
                {data.notifications.length ? (
                  data.notifications.map((item) => (
                    <li key={item.id} className={item.readAt ? '' : 'notification--unread'}>
                      <button
                        type="button"
                        onClick={() => {
                          if (!item.readAt)
                            void mutate({ action: 'read-notification', id: item.id }, '');
                          const requestId = new URL(
                            item.link,
                            window.location.origin,
                          ).searchParams.get('solicitacao');
                          if (requestId) openRequest(requestId);
                        }}
                      >
                        <strong>{item.title}</strong>
                        <p>{item.body}</p>
                        <small>{new Date(item.createdAt).toLocaleString('pt-BR')}</small>
                      </button>
                    </li>
                  ))
                ) : (
                  <li className="notification-empty">
                    <strong>Nenhuma notificação por enquanto</strong>
                    <p>
                      Avisos de fichas atribuídas, mudanças de agenda e respostas do coach
                      aparecerão aqui.
                    </p>
                  </li>
                )}
              </ul>
            </details>
          )}
          <div className="calendar-layout">
            <div className="calendar-card">
              <div className="calendar-toolbar">
                <button type="button" aria-label="Mês anterior" onClick={() => navigateMonth(-1)}>
                  <ChevronLeft />
                </button>
                <strong>
                  {new Date(`${month}-02T12:00:00`).toLocaleDateString('pt-BR', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </strong>
                <button type="button" aria-label="Próximo mês" onClick={() => navigateMonth(1)}>
                  <ChevronRight />
                </button>
              </div>
              <div className="calendar-grid calendar-grid--labels">
                {weekdayNames.map((name) => (
                  <span key={name}>{name}</span>
                ))}
              </div>
              <div className="calendar-grid">
                {cells.map((dateValue, index) => {
                  if (!dateValue) return <span key={`blank-${index}`} />;
                  const info = data.days.find((item) => item.date === dateValue);
                  return (
                    <button
                      type="button"
                      key={dateValue}
                      className={`calendar-day calendar-day--${info?.status || 'neutral'}${selectedDate === dateValue ? ' calendar-day--selected' : ''}`}
                      onClick={() => setSelectedDate(dateValue)}
                      aria-label={`${dateValue}${info ? `, ${info.completed} de ${info.planned} treinos concluídos` : ', sem treino'}`}
                    >
                      <span>{Number(dateValue.slice(-2))}</span>
                      {info && (
                        <small>
                          {info.completed}/{info.planned}
                        </small>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="calendar-legend">
                <span className="legend-completed">Concluído</span>
                <span className="legend-missed">Não realizado</span>
                <span className="legend-planned">Planejado</span>
              </div>
            </div>
            <aside className="day-card">
              <p className="eyebrow">
                {new Date(`${selectedDate}T12:00:00`)
                  .toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
                  .toUpperCase()}
              </p>
              <h3>
                {day?.events.length ? `${day.completed} de ${day.planned} realizados` : 'Dia livre'}
              </h3>
              {!day?.events.length && <p className="muted">Nenhum treino previsto ou realizado.</p>}
              {day?.events.map((item) => (
                <article className="calendar-event" key={item.id}>
                  <div>
                    <strong>{item.name}</strong>
                    <span>
                      {item.source === 'coach' ? `Coach ${item.coachName}` : 'Ficha pessoal'} ·{' '}
                      {item.status === 'completed'
                        ? 'Concluído'
                        : item.status === 'missed'
                          ? 'Não realizado'
                          : item.status === 'rescheduled'
                            ? 'Reagendado'
                            : item.status === 'cancelled'
                              ? 'Cancelado'
                              : 'Planejado'}
                    </span>
                  </div>
                  {data.subject.isSelf &&
                    selectedDate === data.subject.today &&
                    ['planned', 'missed'].includes(item.status) && (
                      <button
                        type="button"
                        className="primary-button"
                        disabled={busy}
                        onClick={() => void startWorkout(item)}
                      >
                        Iniciar
                      </button>
                    )}
                  {data.subject.isSelf &&
                    item.source === 'coach' &&
                    ['planned', 'missed'].includes(item.status) && (
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => setRequesting(item)}
                      >
                        Solicitar outra data
                      </button>
                    )}
                </article>
              ))}
            </aside>
          </div>
          <section className="schedule-settings">
            <div>
              <p className="eyebrow">PROGRAMAÇÃO SEMANAL</p>
              <h3>{data.subject.isSelf ? 'Defina seus dias' : `Agenda de ${data.subject.name}`}</h3>
            </div>
            {data.schedules
              .filter((item) => item.canManage)
              .map((source) => (
                <form
                  key={`${source.id}:${source.weekdays.join('-')}`}
                  className="schedule-row"
                  onSubmit={(event) => void saveSchedule(event)}
                >
                  <input type="hidden" name="sourceId" value={source.id} />
                  <div className="schedule-row__identity">
                    <small>
                      {source.source === 'coach'
                        ? `Ficha atribuída por ${source.coachName}`
                        : 'Ficha pessoal'}
                    </small>
                    <strong>{source.name}</strong>
                  </div>
                  <div className="weekday-picker">
                    {weekdayNames.map((name, index) => (
                      <label
                        key={name}
                        title={
                          data.schedules.some(
                            (item) => item.id !== source.id && item.weekdays.includes(index + 1),
                          )
                            ? 'Dia já usado por outra ficha'
                            : undefined
                        }
                      >
                        <input
                          type="checkbox"
                          name="weekday"
                          value={index + 1}
                          defaultChecked={source.weekdays.includes(index + 1)}
                          disabled={data.schedules.some(
                            (item) => item.id !== source.id && item.weekdays.includes(index + 1),
                          )}
                        />
                        <span>{name}</span>
                      </label>
                    ))}
                  </div>
                  <div className="start-date">
                    <span>A partir de</span>
                    <LocalizedDateField
                      name="startsOn"
                      defaultValue={data.subject.today}
                      min={data.subject.today}
                    />
                  </div>
                  <button className="secondary-button" disabled={busy}>
                    Salvar dias
                  </button>
                </form>
              ))}
            {data.subject.isSelf &&
              data.schedules
                .filter((item) => item.source === 'coach')
                .map((source) => (
                  <details className="schedule-request" key={`request-${source.id}`}>
                    <summary>Solicitar mudança recorrente em “{source.name}”</summary>
                    <form onSubmit={(event) => void sendRequest(event, source.id)}>
                      <div className="weekday-picker">
                        {weekdayNames.map((name, index) => (
                          <label key={name}>
                            <input type="checkbox" name="weekday" value={index + 1} />
                            <span>{name}</span>
                          </label>
                        ))}
                      </div>
                      <textarea
                        name="message"
                        maxLength={500}
                        placeholder="Explique brevemente o motivo"
                      />
                      <button className="secondary-button" disabled={busy}>
                        Enviar solicitação
                      </button>
                    </form>
                  </details>
                ))}
          </section>
          {!!data.requests.length && (
            <section className="request-list">
              <p className="eyebrow">SOLICITAÇÕES</p>
              <h3>Mudanças de agenda</h3>
              {data.requests.map((request) => (
                <article key={request.id} onClick={() => openRequest(request.id)}>
                  <div>
                    <strong>{request.workoutName}</strong>
                    <p>
                      {request.studentName} ·{' '}
                      {request.kind === 'recurring'
                        ? `Dias ${request.proposedWeekdays?.map((value) => weekdayNames[value - 1]).join(', ')}`
                        : `Mover para ${request.proposedDate ? new Date(`${request.proposedDate}T12:00:00`).toLocaleDateString('pt-BR') : ''}`}
                    </p>
                    {request.message && <small>{request.message}</small>}
                  </div>
                  <span className={`request-status request-status--${request.status}`}>
                    {request.status === 'pending'
                      ? 'Pendente'
                      : request.status === 'approved'
                        ? 'Aprovada'
                        : 'Recusada'}
                  </span>
                  {request.canRespond && request.status === 'pending' && (
                    <div className="request-response">
                      <textarea
                        aria-label="Observação para o aluno"
                        maxLength={500}
                        placeholder="Observação opcional"
                        value={responses[request.id] ?? ''}
                        onChange={(event) =>
                          setResponses((current) => ({
                            ...current,
                            [request.id]: event.target.value,
                          }))
                        }
                      />
                      <div className="request-actions">
                        <button
                          type="button"
                          aria-label="Aprovar"
                          onClick={() =>
                            void mutate(
                              {
                                action: 'respond-request',
                                id: request.id,
                                decision: 'approved',
                                response: responses[request.id] ?? '',
                              },
                              'Solicitação aprovada.',
                            )
                          }
                        >
                          <Check />
                        </button>
                        <button
                          type="button"
                          aria-label="Recusar"
                          onClick={() =>
                            void mutate(
                              {
                                action: 'respond-request',
                                id: request.id,
                                decision: 'rejected',
                                response: responses[request.id] ?? '',
                              },
                              'Solicitação recusada.',
                            )
                          }
                        >
                          <X />
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </section>
          )}
          {requesting && selectedSource && (
            <dialog open className="request-dialog">
              <form
                method="dialog"
                onSubmit={(event) => void sendRequest(event, selectedSource.id, requesting)}
              >
                <button
                  type="button"
                  className="dialog-close"
                  aria-label="Fechar"
                  onClick={() => setRequesting(null)}
                >
                  <X />
                </button>
                <CalendarDays aria-hidden="true" />
                <h3>Solicitar outra data</h3>
                <p>
                  {requesting.name} · atualmente em{' '}
                  {new Date(`${requesting.date}T12:00:00`).toLocaleDateString('pt-BR')}
                </p>
                <div className="request-date">
                  <span>Nova data</span>
                  <LocalizedDateField
                    name="proposedDate"
                    defaultValue={data.subject.today}
                    min={data.subject.today}
                  />
                </div>
                <label>
                  Mensagem
                  <textarea name="message" maxLength={500} />
                </label>
                <button className="primary-button" disabled={busy}>
                  Enviar ao coach
                </button>
              </form>
            </dialog>
          )}
          {selectedRequestId && selectedRequest && (
            <dialog open className="request-dialog request-detail-dialog">
              <div className="request-detail">
                <button
                  type="button"
                  className="dialog-close"
                  aria-label="Fechar"
                  onClick={closeRequest}
                >
                  <X />
                </button>
                <p className="eyebrow">SOLICITAÇÃO DE MUDANÇA</p>
                <h3>{selectedRequest.workoutName}</h3>
                <p className="request-detail__people">
                  <strong>{selectedRequest.studentName}</strong> solicitou ao coach{' '}
                  {selectedRequest.coachName}
                </p>
                <div className="request-comparison">
                  <section>
                    <small>AGENDA ATUAL</small>
                    <strong>
                      {selectedRequest.kind === 'recurring'
                        ? selectedRequest.currentWeekdays
                            ?.map((value) => weekdayNames[value - 1])
                            .join(', ') || 'Sem dias definidos'
                        : selectedRequest.currentDate
                          ? new Date(`${selectedRequest.currentDate}T12:00:00`).toLocaleDateString(
                              'pt-BR',
                            )
                          : 'Data indisponível'}
                    </strong>
                  </section>
                  <section>
                    <small>SOLICITAÇÃO DO ALUNO</small>
                    <strong>
                      {selectedRequest.kind === 'recurring'
                        ? selectedRequest.proposedWeekdays
                            ?.map((value) => weekdayNames[value - 1])
                            .join(', ')
                        : selectedRequest.proposedDate
                          ? new Date(`${selectedRequest.proposedDate}T12:00:00`).toLocaleDateString(
                              'pt-BR',
                            )
                          : '—'}
                    </strong>
                  </section>
                </div>
                {selectedRequest.message && <blockquote>{selectedRequest.message}</blockquote>}
                <small className="request-detail__date">
                  Enviada em {new Date(selectedRequest.createdAt).toLocaleString('pt-BR')}
                </small>
                {selectedRequest.status === 'pending' && selectedRequest.canRespond ? (
                  <div className="request-detail__decision">
                    <textarea
                      aria-label="Observação para o aluno"
                      maxLength={500}
                      placeholder="Observação opcional"
                      value={responses[selectedRequest.id] ?? ''}
                      onChange={(event) =>
                        setResponses((current) => ({
                          ...current,
                          [selectedRequest.id]: event.target.value,
                        }))
                      }
                    />
                    <div>
                      <button
                        type="button"
                        className="primary-button"
                        disabled={busy}
                        onClick={() =>
                          void mutate(
                            {
                              action: 'respond-request',
                              id: selectedRequest.id,
                              decision: 'approved',
                              response: responses[selectedRequest.id] ?? '',
                            },
                            'Solicitação aprovada.',
                          )
                        }
                      >
                        Aprovar mudança
                      </button>
                      <button
                        type="button"
                        className="secondary-button"
                        disabled={busy}
                        onClick={() =>
                          void mutate(
                            {
                              action: 'respond-request',
                              id: selectedRequest.id,
                              decision: 'rejected',
                              response: responses[selectedRequest.id] ?? '',
                            },
                            'Solicitação recusada.',
                          )
                        }
                      >
                        Recusar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`request-detail__result request-status--${selectedRequest.status}`}
                  >
                    <strong>
                      {selectedRequest.status === 'approved'
                        ? 'Solicitação aprovada'
                        : selectedRequest.status === 'rejected'
                          ? 'Solicitação recusada'
                          : 'Aguardando resposta do coach'}
                    </strong>
                    {selectedRequest.response && <p>{selectedRequest.response}</p>}
                  </div>
                )}
              </div>
            </dialog>
          )}
          {selectedRequestId && !selectedRequest && (
            <p className="message error" role="alert">
              Esta solicitação não está mais disponível para sua conta.
            </p>
          )}
        </>
      )}
    </section>
  );
}
