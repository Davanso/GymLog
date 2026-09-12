import type { PoolClient } from '@neondatabase/serverless';
import type {
  ReportDay,
  ReportEvolutionPoint,
  ReportExerciseOption,
  ReportPeriod,
  ReportsDashboard,
  ReportSummary,
} from '../shared/reports.js';
import { HttpError } from './http.js';
import { calendarDate, ensureCalendarOccurrences } from './calendar.js';
import { uuid } from './workoutInput.js';

export function reportPeriod(value: unknown): ReportPeriod {
  if (value === 'week' || value === 'month') return value;
  throw new HttpError(400, 'Período de relatório inválido.');
}

type ProfileRow = { id: string; display_name: string; timezone: string; today: string };

const emptySummary = (): ReportSummary => ({
  adherence: null,
  planned: 0,
  completedPlanned: 0,
  missed: 0,
  completedSessions: 0,
  plannedSessions: 0,
  spontaneousSessions: 0,
  durationMinutes: 0,
  averageDurationMinutes: 0,
  completedSets: 0,
  skippedSets: 0,
});

export function reportsStore(db: PoolClient, userId: string) {
  async function subjectProfile(subjectId: string): Promise<ProfileRow> {
    const result = await db.query(
      subjectId === userId
        ? `SELECT id,display_name,timezone,(now() AT TIME ZONE timezone)::date::text today
           FROM profiles WHERE id=$1`
        : `SELECT p.id,p.display_name,p.timezone,(now() AT TIME ZONE p.timezone)::date::text today
           FROM coach_student_relationships r
           JOIN coach_profiles c ON c.profile_id=r.coach_id
           JOIN profiles p ON p.id=r.student_id
           WHERE r.coach_id=$2 AND r.student_id=$1 AND r.status='active'
             AND r.can_view_history AND c.disabled_at IS NULL`,
      subjectId === userId ? [subjectId] : [subjectId, userId],
    );
    if (!result.rows[0])
      throw new HttpError(
        subjectId === userId ? 404 : 403,
        'Você não pode acessar este relatório.',
      );
    return result.rows[0] as ProfileRow;
  }

  async function resolveRange(period: ReportPeriod, anchor: string) {
    const result = await db.query(
      `SELECT CASE WHEN $1='week' THEN date_trunc('week',$2::date)::date ELSE date_trunc('month',$2::date)::date END::text "startsOn",
        CASE WHEN $1='week' THEN (date_trunc('week',$2::date)+interval '6 days')::date ELSE (date_trunc('month',$2::date)+interval '1 month - 1 day')::date END::text "endsOn",
        CASE WHEN $1='week' THEN (date_trunc('week',$2::date)-interval '7 days')::date ELSE (date_trunc('month',$2::date)-interval '1 month')::date END::text "previousStartsOn",
        CASE WHEN $1='week' THEN (date_trunc('week',$2::date)-interval '1 day')::date ELSE (date_trunc('month',$2::date)-interval '1 day')::date END::text "previousEndsOn"`,
      [period, anchor],
    );
    return result.rows[0] as {
      startsOn: string;
      endsOn: string;
      previousStartsOn: string;
      previousEndsOn: string;
    };
  }

  async function summary(subjectId: string, startsOn: string, endsOn: string, today: string) {
    const result = await db.query(
      `WITH occurrences AS (
         SELECT count(*) FILTER (WHERE status IN ('completed','missed') AND scheduled_date<=LEAST($4::date,$3::date))::int planned,
           count(*) FILTER (WHERE status='completed' AND scheduled_date<=LEAST($4::date,$3::date))::int completed_planned,
           count(*) FILTER (WHERE status='missed' AND scheduled_date<=LEAST($4::date,$3::date))::int missed
         FROM scheduled_workouts WHERE user_id=$1 AND scheduled_date BETWEEN $2::date AND $3::date
       ), sessions AS (
         SELECT count(*)::int completed_sessions,
           count(*) FILTER (WHERE scheduled_workout_id IS NOT NULL)::int planned_sessions,
           count(*) FILTER (WHERE scheduled_workout_id IS NULL)::int spontaneous_sessions,
           coalesce(round(sum(extract(epoch FROM (ended_at-started_at)))/60),0)::int duration_minutes
         FROM workout_sessions w JOIN profiles p ON p.id=w.user_id
         WHERE w.user_id=$1 AND w.status='completed'
           AND (w.started_at AT TIME ZONE p.timezone)::date BETWEEN $2::date AND LEAST($4::date,$3::date)
       ), sets AS (
         SELECT count(*) FILTER (WHERE ss.status='completed')::int completed_sets,
           count(*) FILTER (WHERE ss.status='skipped')::int skipped_sets
         FROM workout_sessions w JOIN profiles p ON p.id=w.user_id
         JOIN session_exercises se ON se.session_id=w.id JOIN session_sets ss ON ss.session_exercise_id=se.id
         WHERE w.user_id=$1 AND w.status='completed'
           AND (w.started_at AT TIME ZONE p.timezone)::date BETWEEN $2::date AND LEAST($4::date,$3::date)
       ) SELECT * FROM occurrences CROSS JOIN sessions CROSS JOIN sets`,
      [subjectId, startsOn, endsOn, today],
    );
    const row = result.rows[0];
    const planned = Number(row.planned || 0);
    const completedSessions = Number(row.completed_sessions || 0);
    const durationMinutes = Number(row.duration_minutes || 0);
    return {
      ...emptySummary(),
      adherence: planned ? Math.round((Number(row.completed_planned || 0) / planned) * 100) : null,
      planned,
      completedPlanned: Number(row.completed_planned || 0),
      missed: Number(row.missed || 0),
      completedSessions,
      plannedSessions: Number(row.planned_sessions || 0),
      spontaneousSessions: Number(row.spontaneous_sessions || 0),
      durationMinutes,
      averageDurationMinutes: completedSessions
        ? Math.round(durationMinutes / completedSessions)
        : 0,
      completedSets: Number(row.completed_sets || 0),
      skippedSets: Number(row.skipped_sets || 0),
    } satisfies ReportSummary;
  }

  async function dashboard(
    periodValue: unknown,
    anchorValue: unknown,
    subjectId = userId,
    exerciseValue?: unknown,
  ): Promise<ReportsDashboard> {
    const period = reportPeriod(periodValue);
    const anchor = calendarDate(anchorValue);
    if (subjectId !== userId) uuid(subjectId);
    const exerciseId = exerciseValue ? uuid(exerciseValue) : null;
    const subject = await subjectProfile(subjectId);
    const range = await resolveRange(period, anchor);
    const months = new Set([
      range.startsOn.slice(0, 7),
      range.endsOn.slice(0, 7),
      range.previousStartsOn.slice(0, 7),
      range.previousEndsOn.slice(0, 7),
    ]);
    for (const month of months) await ensureCalendarOccurrences(db, subjectId, month);
    const [current, previous, daily, missed, exerciseRows, students] = await Promise.all([
      summary(subjectId, range.startsOn, range.endsOn, subject.today),
      summary(subjectId, range.previousStartsOn, range.previousEndsOn, range.previousEndsOn),
      db.query(
        `WITH dates AS (SELECT generate_series($2::date,$3::date,interval '1 day')::date AS activity_date),
         o AS (SELECT scheduled_date AS activity_date,count(*) FILTER (WHERE status IN ('completed','missed'))::int planned,
           count(*) FILTER (WHERE status='completed')::int completed FROM scheduled_workouts
           WHERE user_id=$1 AND scheduled_date BETWEEN $2::date AND $3::date GROUP BY scheduled_date),
         s AS (SELECT (w.started_at AT TIME ZONE p.timezone)::date AS activity_date,count(*)::int sessions,
           coalesce(round(sum(extract(epoch FROM (w.ended_at-w.started_at)))/60),0)::int duration_minutes
           FROM workout_sessions w JOIN profiles p ON p.id=w.user_id
           WHERE w.user_id=$1 AND w.status='completed' AND (w.started_at AT TIME ZONE p.timezone)::date BETWEEN $2::date AND $3::date
           GROUP BY activity_date),
         sets AS (SELECT (w.started_at AT TIME ZONE p.timezone)::date AS activity_date,
           count(ss.id) FILTER (WHERE ss.status='completed')::int completed_sets
           FROM workout_sessions w JOIN profiles p ON p.id=w.user_id
           JOIN session_exercises se ON se.session_id=w.id JOIN session_sets ss ON ss.session_exercise_id=se.id
           WHERE w.user_id=$1 AND w.status='completed' AND (w.started_at AT TIME ZONE p.timezone)::date BETWEEN $2::date AND $3::date
           GROUP BY activity_date)
         SELECT d.activity_date::text date,coalesce(o.planned,0)::int planned,coalesce(o.completed,0)::int completed,
           coalesce(s.sessions,0)::int sessions,coalesce(s.duration_minutes,0)::int "durationMinutes",coalesce(sets.completed_sets,0)::int "completedSets"
         FROM dates d LEFT JOIN o ON o.activity_date=d.activity_date LEFT JOIN s ON s.activity_date=d.activity_date
           LEFT JOIN sets ON sets.activity_date=d.activity_date ORDER BY d.activity_date`,
        [subjectId, range.startsOn, range.endsOn],
      ),
      db.query(
        `SELECT o.id,o.scheduled_date::text date,coalesce(t.name,v.name) name
         FROM scheduled_workouts o LEFT JOIN workout_templates t ON t.id=o.template_id
         LEFT JOIN workout_assignment_versions v ON v.id=o.assignment_version_id
         WHERE o.user_id=$1 AND o.status='missed' AND o.scheduled_date BETWEEN $2::date AND $3::date
         ORDER BY o.scheduled_date DESC`,
        [subjectId, range.startsOn, range.endsOn],
      ),
      db.query(
        `SELECT se.exercise_id id,max(se.exercise_name_snapshot) name,max(se.tracking_mode_snapshot) "trackingMode"
         FROM workout_sessions w JOIN profiles p ON p.id=w.user_id JOIN session_exercises se ON se.session_id=w.id
         WHERE w.user_id=$1 AND w.status='completed' AND (w.started_at AT TIME ZONE p.timezone)::date BETWEEN $2::date AND $3::date
         GROUP BY se.exercise_id ORDER BY name`,
        [subjectId, range.startsOn, range.endsOn],
      ),
      db.query(
        `SELECT p.id,p.display_name name FROM coach_student_relationships r JOIN profiles p ON p.id=r.student_id
         JOIN coach_profiles c ON c.profile_id=r.coach_id WHERE r.coach_id=$1 AND r.status='active'
         AND r.can_view_history AND c.disabled_at IS NULL ORDER BY p.display_name`,
        [userId],
      ),
    ]);
    let evolution: ReportEvolutionPoint[] = [];
    if (exerciseId) {
      const evolutionRows = await db.query(
        `WITH set_rows AS (
           SELECT w.id session_id,w.name session_name,w.started_at,
             (w.started_at AT TIME ZONE p.timezone)::date::text date,
             ss.actual_load_kg::float8 actual_load,ss.actual_reps,
             ss.actual_duration_seconds,se.load_convention_snapshot,
             max(ss.actual_load_kg) OVER (PARTITION BY w.id,se.load_convention_snapshot)::float8 best_load
           FROM workout_sessions w JOIN profiles p ON p.id=w.user_id
           JOIN session_exercises se ON se.session_id=w.id JOIN session_sets ss ON ss.session_exercise_id=se.id
           WHERE w.user_id=$1 AND w.status='completed' AND se.exercise_id=$4 AND ss.status='completed'
             AND (w.started_at AT TIME ZONE p.timezone)::date BETWEEN $2::date AND $3::date
         )
         SELECT date,session_name "sessionName",best_load "bestLoad",
           max(actual_reps) FILTER (WHERE actual_load=best_load)::int "bestReps",
           max(actual_duration_seconds)::int "bestDuration",load_convention_snapshot "loadConvention"
         FROM set_rows GROUP BY session_id,session_name,started_at,date,best_load,load_convention_snapshot
         ORDER BY started_at`,
        [subjectId, range.startsOn, range.endsOn, exerciseId],
      );
      evolution = evolutionRows.rows as ReportEvolutionPoint[];
    }
    return {
      period,
      anchor,
      ...range,
      timezone: subject.timezone,
      isCurrent: subject.today >= range.startsOn && subject.today <= range.endsOn,
      subject: {
        id: subject.id,
        name: subject.display_name,
        isSelf: subject.id === userId,
        today: subject.today,
      },
      summary: current,
      previous,
      days: daily.rows as ReportDay[],
      misses: missed.rows as ReportsDashboard['misses'],
      exercises: exerciseRows.rows as ReportExerciseOption[],
      evolution,
      selectedExerciseId: exerciseId,
      students: students.rows,
    };
  }
  return { dashboard };
}
