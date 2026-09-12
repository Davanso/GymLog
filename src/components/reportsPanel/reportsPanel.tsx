import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock3, Dumbbell, Layers3, Target } from 'lucide-react';
import type { ReportPeriod, ReportsDashboard, ReportSummary } from '../../../shared/reports';
import { readReportsCache, reportsApi } from '../../services/reportsApi';
import { LoadingState } from '../loadingState/loadingState';
import './reportsPanel.css';

function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function shift(anchor: string, period: ReportPeriod, amount: number) {
  const [year, month, day] = anchor.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (period === 'week') date.setDate(date.getDate() + amount * 7);
  else {
    date.setDate(1);
    date.setMonth(date.getMonth() + amount);
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function delta(current: number, previous: number, suffix = '') {
  const value = current - previous;
  if (!value) return 'igual ao período anterior';
  return `${value > 0 ? '+' : ''}${value}${suffix} vs. período anterior`;
}
function Metric({
  icon,
  label,
  value,
  note,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <article className="report-metric">
      <span className="report-metric__icon">{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        <span>{note}</span>
      </div>
    </article>
  );
}
function summaryCards(summary: ReportSummary, previous: ReportSummary) {
  return [
    {
      icon: <Target />,
      label: 'Aderência',
      value: summary.adherence === null ? '—' : `${summary.adherence}%`,
      note:
        summary.adherence === null
          ? 'Sem treinos planejados'
          : `${summary.completedPlanned} de ${summary.planned} · ${previous.adherence === null ? 'sem comparação' : delta(summary.adherence, previous.adherence, ' p.p.')}`,
    },
    {
      icon: <Dumbbell />,
      label: 'Treinos realizados',
      value: String(summary.completedSessions),
      note: `${summary.plannedSessions} planejados · ${summary.spontaneousSessions} avulsos · ${delta(summary.completedSessions, previous.completedSessions)}`,
    },
    {
      icon: <Clock3 />,
      label: 'Tempo de treino',
      value: `${summary.durationMinutes} min`,
      note: delta(summary.durationMinutes, previous.durationMinutes, ' min'),
    },
    {
      icon: <Layers3 />,
      label: 'Séries concluídas',
      value: String(summary.completedSets),
      note: `${summary.skippedSets} puladas · ${delta(summary.completedSets, previous.completedSets)}`,
    },
  ];
}

export function ReportsPanel() {
  const initial = today();
  const [period, setPeriod] = useState<ReportPeriod>('week');
  const [anchor, setAnchor] = useState(initial);
  const [subjectId, setSubjectId] = useState('');
  const [exerciseId, setExerciseId] = useState('');
  const options = useMemo(
    () => ({
      period,
      anchor,
      subjectId: subjectId || undefined,
      exerciseId: exerciseId || undefined,
    }),
    [period, anchor, subjectId, exerciseId],
  );
  const [data, setData] = useState<ReportsDashboard | null>(() => readReportsCache(options));
  const [error, setError] = useState('');
  const [loadingKind, setLoadingKind] = useState<'report' | 'evolution' | null>(null);
  useEffect(() => {
    let active = true;
    reportsApi({ ...options, refresh: true })
      .then((value) => {
        if (active) {
          setData(value);
          setError('');
          setLoadingKind(null);
        }
      })
      .catch((cause) => {
        if (active) {
          setError(
            cause instanceof Error ? cause.message : 'Não foi possível carregar os relatórios.',
          );
          setLoadingKind(null);
        }
      });
    return () => {
      active = false;
    };
  }, [options]);
  const selectedExercise = data?.exercises.find((item) => item.id === exerciseId);
  const firstEvolution = data?.evolution[0];
  const lastEvolution = data?.evolution.at(-1);
  const comparableEvolution =
    selectedExercise?.trackingMode === 'reps' &&
    firstEvolution &&
    lastEvolution &&
    firstEvolution !== lastEvolution &&
    firstEvolution.loadConvention === lastEvolution.loadConvention;
  return (
    <section className="reports-panel">
      <header className="reports-heading">
        <div>
          <p className="eyebrow">CONSISTÊNCIA & EVOLUÇÃO</p>
          <h2>Relatórios</h2>
          <p className="muted">Seu treino em perspectiva, sem julgamentos.</p>
        </div>
        {!!data?.students.length && (
          <label>
            Visualizando
            <select
              value={subjectId}
              onChange={(event) => {
                setLoadingKind('report');
                setSubjectId(event.target.value);
                setExerciseId('');
              }}
              disabled={loadingKind === 'report'}
            >
              <option value="">Meu relatório</option>
              {data.students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>
      <div className="report-controls">
        <div className="period-switch" role="group" aria-label="Período do relatório">
          <button
            className={period === 'week' ? 'active' : ''}
            disabled={loadingKind === 'report'}
            onClick={() => {
              if (period === 'week') return;
              setLoadingKind('report');
              setExerciseId('');
              setPeriod('week');
            }}
          >
            Semana
          </button>
          <button
            className={period === 'month' ? 'active' : ''}
            disabled={loadingKind === 'report'}
            onClick={() => {
              if (period === 'month') return;
              setLoadingKind('report');
              setExerciseId('');
              setPeriod('month');
            }}
          >
            Mês
          </button>
        </div>
        <div className="period-navigation">
          <button
            aria-label="Período anterior"
            disabled={loadingKind === 'report'}
            onClick={() => {
              setLoadingKind('report');
              setExerciseId('');
              setAnchor(shift(anchor, period, -1));
            }}
          >
            <ChevronLeft />
          </button>
          <div className="period-label">
            <strong>
              {data
                ? `${new Date(`${data.startsOn}T12:00:00`).toLocaleDateString('pt-BR')} — ${new Date(`${data.endsOn}T12:00:00`).toLocaleDateString('pt-BR')}`
                : 'Carregando período…'}
            </strong>
            {loadingKind === 'report' && (
              <span className="period-loading">
                <LoadingState label="Atualizando período…" compact delayMs={120} />
              </span>
            )}
          </div>
          <button
            aria-label="Próximo período"
            disabled={loadingKind === 'report'}
            onClick={() => {
              setLoadingKind('report');
              setExerciseId('');
              setAnchor(shift(anchor, period, 1));
            }}
          >
            <ChevronRight />
          </button>
          <button
            className="today-button"
            disabled={loadingKind === 'report' || anchor === initial}
            onClick={() => {
              setLoadingKind('report');
              setExerciseId('');
              setAnchor(initial);
            }}
          >
            Hoje
          </button>
        </div>
      </div>
      {error && (
        <p className="message error" role="alert">
          {error}
        </p>
      )}
      {!data ? (
        <div className="reports-loading">
          <LoadingState label="Calculando seu relatório…" />
        </div>
      ) : (
        <>
          {!data.subject.isSelf && (
            <p className="report-subject">
              Relatório de <strong>{data.subject.name}</strong>
            </p>
          )}
          <section
            className={`report-metrics${loadingKind === 'report' ? ' report-content--updating' : ''}`}
            aria-label="Resumo do período"
            aria-busy={loadingKind === 'report'}
          >
            {summaryCards(data.summary, data.previous).map((metric) => (
              <Metric key={metric.label} {...metric} />
            ))}
          </section>
          <section className="report-story">
            <header>
              <div>
                <p className="eyebrow">RITMO DO PERÍODO</p>
                <h3>Treinos por dia</h3>
              </div>
              <span>
                {data.summary.missed} {data.summary.missed === 1 ? 'falta' : 'faltas'}
              </span>
            </header>
            <div className="report-bars" aria-label="Treinos realizados por dia">
              {data.days.map((day) => (
                <div
                  className="report-bar"
                  key={day.date}
                  title={`${day.date}: ${day.sessions} treinos`}
                >
                  <span className={day.sessions ? 'report-bar__mark--active' : undefined}>
                    {day.sessions > 1 && <b>{day.sessions}</b>}
                  </span>
                  <small>
                    {new Date(`${day.date}T12:00:00`).toLocaleDateString('pt-BR', {
                      weekday: 'short',
                      day: period === 'month' ? '2-digit' : undefined,
                    })}
                  </small>
                </div>
              ))}
            </div>
          </section>
          <section className="report-evolution">
            <header>
              <div>
                <p className="eyebrow">EVOLUÇÃO</p>
                <h3>Por exercício</h3>
              </div>
              <select
                aria-label="Escolha um exercício"
                value={exerciseId}
                disabled={loadingKind === 'evolution' || loadingKind === 'report'}
                onChange={(event) => {
                  setLoadingKind(event.target.value ? 'evolution' : null);
                  setExerciseId(event.target.value);
                }}
              >
                <option value="">Escolha um exercício</option>
                {data.exercises.map((exercise) => (
                  <option key={exercise.id} value={exercise.id}>
                    {exercise.name}
                  </option>
                ))}
              </select>
            </header>
            {loadingKind === 'evolution' ? (
              <div className="evolution-loading">
                <LoadingState label="Carregando evolução…" compact delayMs={120} />
              </div>
            ) : !exerciseId ? (
              <p className="muted">Escolha um exercício para carregar sua evolução.</p>
            ) : !data.evolution.length ? (
              <p className="muted">Nenhuma série concluída neste período.</p>
            ) : (
              <>
                {comparableEvolution && (
                  <div className="evolution-summary" aria-label="Progressão no período">
                    <span>
                      Carga máxima
                      <strong>
                        {(lastEvolution.bestLoad ?? 0) - (firstEvolution.bestLoad ?? 0) > 0
                          ? '+'
                          : ''}
                        {(lastEvolution.bestLoad ?? 0) - (firstEvolution.bestLoad ?? 0)} kg
                      </strong>
                    </span>
                    <span>
                      Repetições na carga máxima
                      <strong>
                        {(lastEvolution.bestReps ?? 0) - (firstEvolution.bestReps ?? 0) > 0
                          ? '+'
                          : ''}
                        {(lastEvolution.bestReps ?? 0) - (firstEvolution.bestReps ?? 0)}
                      </strong>
                    </span>
                  </div>
                )}
                <div className="evolution-points">
                  {data.evolution.map((point, index) => (
                    <article key={`${point.date}-${index}`}>
                      <small>
                        {new Date(`${point.date}T12:00:00`).toLocaleDateString('pt-BR')}
                      </small>
                      <strong>
                        {selectedExercise?.trackingMode === 'duration'
                          ? `${point.bestDuration ?? 0}s`
                          : `${point.bestLoad ?? 0} kg`}
                      </strong>
                      <span>
                        {selectedExercise?.trackingMode === 'duration'
                          ? point.sessionName
                          : `${point.bestReps ?? 0} ${point.bestReps === 1 ? 'repetição' : 'repetições'} com essa carga`}
                      </span>
                    </article>
                  ))}
                </div>
              </>
            )}
          </section>
          {!!data.misses.length && (
            <section className="report-misses">
              <p className="eyebrow">NÃO REALIZADOS</p>
              <h3>Faltas no período</h3>
              {data.misses.map((miss) => (
                <p key={miss.id}>
                  <span>{new Date(`${miss.date}T12:00:00`).toLocaleDateString('pt-BR')}</span>
                  <strong>{miss.name}</strong>
                </p>
              ))}
            </section>
          )}
        </>
      )}
    </section>
  );
}
