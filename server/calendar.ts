import type { PoolClient } from '@neondatabase/serverless';
import type {
  AppNotification,
  CalendarDashboard,
  CalendarDay,
  CalendarEvent,
  ScheduleChangeRequest,
  ScheduleOption,
} from '../shared/calendar.js';
import { HttpError } from './http.js';
import { object, text, uuid } from './workoutInput.js';

const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
export function calendarMonth(value: unknown) {
  const result = String(value ?? '');
  if (!monthPattern.test(result)) throw new HttpError(400, 'Mês inválido.');
  return result;
}
export function calendarDate(value: unknown) {
  const result = String(value ?? '');
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(result);
  if (!match) throw new HttpError(400, 'Data inválida.');
  const [, year, monthValue, day] = match;
  const parsed = new Date(Date.UTC(Number(year), Number(monthValue) - 1, Number(day)));
  if (
    parsed.getUTCFullYear() !== Number(year) ||
    parsed.getUTCMonth() !== Number(monthValue) - 1 ||
    parsed.getUTCDate() !== Number(day)
  )
    throw new HttpError(400, 'Data inválida.');
  return result;
}
export function calendarWeekdays(value: unknown) {
  if (!Array.isArray(value)) throw new HttpError(400, 'Selecione os dias da semana.');
  const result = [...new Set(value.map(Number))].sort();
  if (result.some((day) => !Number.isInteger(day) || day < 1 || day > 7))
    throw new HttpError(400, 'Dias da semana inválidos.');
  return result;
}

export async function ensureCalendarOccurrences(
  db: PoolClient,
  subjectId: string,
  targetMonth: string,
) {
  const start = `${calendarMonth(targetMonth)}-01`;
  await db.query(
    `INSERT INTO scheduled_workouts(user_id,schedule_id,scheduled_date,template_id,assignment_version_id)
     SELECT s.user_id,s.id,d::date,s.template_id,a.assignment_version_id
     FROM workout_schedules s
     CROSS JOIN generate_series($2::date,($2::date + interval '1 month - 1 day')::date,interval '1 day') d
     LEFT JOIN workout_assignment_recipients r ON r.id=s.assignment_recipient_id
     LEFT JOIN workout_assignments a ON a.id=r.assignment_id
     WHERE s.user_id=$1 AND s.starts_on<=d::date AND coalesce(s.ends_on,'infinity'::date)>=d::date
       AND extract(isodow FROM d)::int=s.weekday
     ON CONFLICT(schedule_id,scheduled_date) DO NOTHING`,
    [subjectId, start],
  );
  await db.query(
    `UPDATE scheduled_workouts o SET status='missed',updated_at=now()
     FROM profiles p WHERE o.user_id=$1 AND p.id=o.user_id AND o.status='planned'
       AND o.scheduled_date < (now() AT TIME ZONE p.timezone)::date`,
    [subjectId],
  );
}

export function calendarStore(db: PoolClient, userId: string) {
  async function profile(id: string) {
    const result = await db.query(
      `SELECT id,display_name,timezone,(now() AT TIME ZONE timezone)::date::text today FROM profiles WHERE id=$1`,
      [id],
    );
    if (!result.rows[0]) throw new HttpError(404, 'Perfil não encontrado.');
    return result.rows[0];
  }
  async function assertSubject(subjectId: string) {
    if (subjectId === userId) return profile(userId);
    const access = await db.query(
      `SELECT p.id,p.display_name,p.timezone,(now() AT TIME ZONE p.timezone)::date::text today FROM coach_student_relationships r
       JOIN coach_profiles c ON c.profile_id=r.coach_id JOIN profiles p ON p.id=r.student_id
       WHERE r.coach_id=$1 AND r.student_id=$2 AND r.status='active' AND r.can_view_history AND c.disabled_at IS NULL`,
      [userId, subjectId],
    );
    if (!access.rows[0]) throw new HttpError(403, 'Você não pode acessar este calendário.');
    return access.rows[0];
  }
  async function notify(
    recipientId: string,
    kind: string,
    title: string,
    body: string,
    link = '/app?secao=calendario',
  ) {
    await db.query(
      `INSERT INTO app_notifications(recipient_id,actor_id,kind,title,body,link) VALUES($1,$2,$3,$4,$5,$6)`,
      [recipientId, userId, kind, title, body, link],
    );
  }
  async function schedules(subjectId: string): Promise<ScheduleOption[]> {
    const rows = await db.query(
      `SELECT x.id,x.name,x.source,x.coach_name "coachName",x.can_manage "canManage",
        coalesce(array_agg(s.weekday ORDER BY s.weekday) FILTER (WHERE s.status='active'),'{}') weekdays
       FROM (
         SELECT t.id,t.name,'personal' source,NULL::text coach_name,(t.user_id=$2) can_manage
         FROM workout_templates t WHERE t.user_id=$1 AND t.archived_at IS NULL
         UNION ALL
         SELECT r.id,v.name,'coach',p.display_name,(a.coach_id=$2)
         FROM workout_assignment_recipients r JOIN workout_assignments a ON a.id=r.assignment_id
         JOIN workout_assignment_versions v ON v.id=a.assignment_version_id JOIN profiles p ON p.id=a.coach_id
         WHERE r.student_id=$1 AND r.status<>'withdrawn'
       ) x LEFT JOIN workout_schedules s ON s.user_id=$1 AND s.status='active'
         AND ((x.source='personal' AND s.template_id=x.id) OR (x.source='coach' AND s.assignment_recipient_id=x.id))
       GROUP BY x.id,x.name,x.source,x.coach_name,x.can_manage ORDER BY x.source,x.name`,
      [subjectId, userId],
    );
    return rows.rows as ScheduleOption[];
  }
  async function dashboard(targetMonth: string, subjectId = userId): Promise<CalendarDashboard> {
    targetMonth = calendarMonth(targetMonth);
    const subject = await assertSubject(subjectId);
    await ensureCalendarOccurrences(db, subjectId, targetMonth);
    const result = await db.query(
      `SELECT * FROM (
         SELECT o.id,o.scheduled_date::text date,coalesce(t.name,v.name) name,o.status,
           CASE WHEN o.template_id IS NULL THEN 'coach' ELSE 'personal' END source,
           coalesce(o.template_id,s.assignment_recipient_id) "sourceId",t.version,
           p.display_name "coachName",o.session_id "sessionId"
         FROM scheduled_workouts o JOIN workout_schedules s ON s.id=o.schedule_id
         LEFT JOIN workout_templates t ON t.id=o.template_id
         LEFT JOIN workout_assignment_versions v ON v.id=o.assignment_version_id
         LEFT JOIN workout_assignment_recipients r ON r.id=s.assignment_recipient_id
         LEFT JOIN workout_assignments a ON a.id=r.assignment_id LEFT JOIN profiles p ON p.id=a.coach_id
         WHERE o.user_id=$1 AND o.scheduled_date >= $2::date AND o.scheduled_date < $2::date+interval '1 month'
         UNION ALL
         SELECT w.id,(w.started_at AT TIME ZONE owner.timezone)::date::text,w.name,
           CASE WHEN w.status='in_progress' THEN 'planned' ELSE w.status END,
           CASE WHEN w.assignment_recipient_id IS NULL THEN 'personal' ELSE 'coach' END,
           coalesce(w.template_id,w.assignment_recipient_id,w.id),t.version,coach.display_name,w.id
         FROM workout_sessions w JOIN profiles owner ON owner.id=w.user_id
         LEFT JOIN workout_templates t ON t.id=w.template_id
         LEFT JOIN workout_assignment_recipients r ON r.id=w.assignment_recipient_id
         LEFT JOIN workout_assignments a ON a.id=r.assignment_id LEFT JOIN profiles coach ON coach.id=a.coach_id
         WHERE w.user_id=$1 AND w.scheduled_workout_id IS NULL
           AND (w.started_at AT TIME ZONE owner.timezone)::date >= $2::date
           AND (w.started_at AT TIME ZONE owner.timezone)::date < $2::date+interval '1 month'
       ) events ORDER BY date,name`,
      [subjectId, `${targetMonth}-01`],
    );
    const grouped = new Map<string, CalendarEvent[]>();
    for (const event of result.rows as CalendarEvent[])
      grouped.set(event.date, [...(grouped.get(event.date) ?? []), event]);
    const days: CalendarDay[] = [...grouped].map(([dayDate, events]) => {
      const planned = events.filter(
        (event) => event.status !== 'cancelled' && event.status !== 'rescheduled',
      ).length;
      const completed = events.filter((event) => event.status === 'completed').length;
      const missed = events.some((event) => event.status === 'missed');
      return {
        date: dayDate,
        status:
          completed && completed === planned
            ? 'completed'
            : missed
              ? 'missed'
              : planned
                ? 'planned'
                : 'neutral',
        planned,
        completed,
        events,
      };
    });
    const students = await db.query(
      `SELECT p.id,p.display_name name FROM coach_student_relationships r JOIN profiles p ON p.id=r.student_id
       JOIN coach_profiles c ON c.profile_id=r.coach_id WHERE r.coach_id=$1 AND r.status='active' AND r.can_view_history AND c.disabled_at IS NULL ORDER BY p.display_name`,
      [userId],
    );
    const requests = await db.query(
      `SELECT q.id,p.display_name "studentName",coach.display_name "coachName",v.name "workoutName",q.kind,
        CASE WHEN q.kind='recurring' THEN ARRAY(SELECT s.weekday FROM workout_schedules s
          WHERE s.assignment_recipient_id=q.assignment_recipient_id AND s.status='active' ORDER BY s.weekday) END "currentWeekdays",
        q.proposed_weekdays "proposedWeekdays",original.scheduled_date::text "currentDate",
        q.proposed_date::text "proposedDate",q.message,q.status,q.response,q.created_at "createdAt",
         (q.coach_id=$2) "canRespond"
        FROM schedule_change_requests q JOIN profiles p ON p.id=q.student_id
        JOIN profiles coach ON coach.id=q.coach_id
        JOIN workout_assignment_recipients r ON r.id=q.assignment_recipient_id
        JOIN workout_assignments a ON a.id=r.assignment_id JOIN workout_assignment_versions v ON v.id=a.assignment_version_id
        LEFT JOIN scheduled_workouts original ON original.id=q.scheduled_workout_id
        WHERE ($1=$2 AND (q.student_id=$2 OR q.coach_id=$2))
           OR ($1<>$2 AND q.student_id=$1 AND q.coach_id=$2)
        ORDER BY (q.status='pending') DESC,q.created_at DESC`,
      [subjectId, userId],
    );
    const notificationRows =
      subjectId === userId
        ? await db.query(
            `SELECT id,kind,title,body,link,read_at "readAt",created_at "createdAt" FROM app_notifications WHERE recipient_id=$1 ORDER BY created_at DESC LIMIT 30`,
            [userId],
          )
        : { rows: [] };
    return {
      month: targetMonth,
      timezone: subject.timezone,
      subject: {
        id: subject.id,
        name: subject.display_name,
        isSelf: subject.id === userId,
        today: subject.today,
      },
      days,
      schedules: await schedules(subjectId),
      students: students.rows,
      requests: requests.rows as ScheduleChangeRequest[],
      notifications: notificationRows.rows as AppNotification[],
      unreadNotifications: notificationRows.rows.filter((item) => !item.readAt).length,
    };
  }
  async function replaceSchedule(input: Record<string, unknown>) {
    const subjectId = input.subjectId ? uuid(input.subjectId) : userId;
    await assertSubject(subjectId);
    const sourceId = uuid(input.sourceId);
    const source = input.source === 'coach' ? 'coach' : 'personal';
    const selected = calendarWeekdays(input.weekdays);
    const startsOn = calendarDate(input.startsOn);
    if (source === 'personal') {
      if (subjectId !== userId)
        throw new HttpError(403, 'O coach não altera fichas pessoais do aluno.');
      const owned = await db.query(
        'SELECT id FROM workout_templates WHERE id=$1 AND user_id=$2 AND archived_at IS NULL',
        [sourceId, userId],
      );
      if (!owned.rows[0]) throw new HttpError(404, 'Ficha não encontrada.');
    } else {
      const assigned = await db.query(
        `SELECT a.coach_id FROM workout_assignment_recipients r JOIN workout_assignments a ON a.id=r.assignment_id
         JOIN coach_student_relationships rel ON rel.id=r.relationship_id
         WHERE r.id=$1 AND r.student_id=$2 AND a.coach_id=$3 AND rel.status='active'`,
        [sourceId, subjectId, userId],
      );
      if (!assigned.rows[0]) throw new HttpError(403, 'Você não controla esta ficha recebida.');
    }
    await db.query(
      `UPDATE workout_schedules SET status='ended',ends_on=GREATEST(starts_on,$4::date-1),updated_at=now()
       WHERE user_id=$1 AND created_by=$2 AND status='active' AND (($3='personal' AND template_id=$5) OR ($3='coach' AND assignment_recipient_id=$5))`,
      [subjectId, userId, source, startsOn, sourceId],
    );
    await db.query(
      `UPDATE scheduled_workouts SET status='cancelled',updated_at=now() WHERE user_id=$1 AND scheduled_date >= $2 AND status IN ('planned','missed')
       AND schedule_id IN (SELECT id FROM workout_schedules WHERE user_id=$1 AND created_by=$3 AND status='ended' AND (($4='personal' AND template_id=$5) OR ($4='coach' AND assignment_recipient_id=$5)))`,
      [subjectId, startsOn, userId, source, sourceId],
    );
    for (const day of selected)
      await db.query(
        `INSERT INTO workout_schedules(user_id,template_id,assignment_recipient_id,created_by,weekday,starts_on)
         VALUES($1,CASE WHEN $2='personal' THEN $3::uuid ELSE NULL END,CASE WHEN $2='coach' THEN $3::uuid ELSE NULL END,$4,$5,$6)`,
        [subjectId, source, sourceId, userId, day, startsOn],
      );
    if (subjectId !== userId)
      await notify(
        subjectId,
        'schedule_changed',
        'Sua agenda foi atualizada',
        'Seu coach definiu novos dias para uma ficha.',
      );
    return { ok: true };
  }
  async function requestChange(input: Record<string, unknown>) {
    const recipientId = uuid(input.recipientId);
    const kind = input.kind === 'one_off' ? 'one_off' : 'recurring';
    const assigned = await db.query(
      `SELECT a.coach_id FROM workout_assignment_recipients r JOIN workout_assignments a ON a.id=r.assignment_id
       JOIN coach_student_relationships rel ON rel.id=r.relationship_id
       WHERE r.id=$1 AND r.student_id=$2 AND r.status<>'withdrawn' AND rel.status='active'`,
      [recipientId, userId],
    );
    if (!assigned.rows[0]) throw new HttpError(403, 'Esta ficha não aceita solicitações.');
    let values: [number[] | null, string | null, string | null];
    if (kind === 'recurring') {
      values = [calendarWeekdays(input.weekdays), null, null];
    } else {
      const scheduledWorkoutId = uuid(input.scheduledWorkoutId);
      const proposedDate = calendarDate(input.proposedDate);
      const occurrence = await db.query(
        `SELECT o.id,(now() AT TIME ZONE p.timezone)::date::text today
         FROM scheduled_workouts o JOIN workout_schedules s ON s.id=o.schedule_id
         JOIN profiles p ON p.id=o.user_id
         WHERE o.id=$1 AND o.user_id=$2 AND s.assignment_recipient_id=$3 AND o.status IN ('planned','missed')`,
        [scheduledWorkoutId, userId, recipientId],
      );
      if (!occurrence.rows[0]) throw new HttpError(404, 'Compromisso não encontrado.');
      if (proposedDate < occurrence.rows[0].today)
        throw new HttpError(400, 'Escolha hoje ou uma data futura.');
      values = [null, scheduledWorkoutId, proposedDate];
    }
    const created = await db.query(
      `INSERT INTO schedule_change_requests(student_id,coach_id,assignment_recipient_id,kind,proposed_weekdays,scheduled_workout_id,proposed_date,message)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [
        userId,
        assigned.rows[0].coach_id,
        recipientId,
        kind,
        values[0],
        values[1],
        values[2],
        text(input.message ?? '', 500),
      ],
    );
    await notify(
      assigned.rows[0].coach_id,
      'schedule_request',
      'Nova solicitação de agenda',
      kind === 'one_off'
        ? 'Um aluno solicitou uma nova data para o treino.'
        : 'Um aluno solicitou uma mudança nos dias de treino.',
      `/app?secao=calendario&solicitacao=${created.rows[0].id}`,
    );
    return { ok: true };
  }
  async function respond(input: Record<string, unknown>) {
    const id = uuid(input.id);
    const decision =
      input.decision === 'approved'
        ? 'approved'
        : input.decision === 'rejected'
          ? 'rejected'
          : null;
    if (!decision) throw new HttpError(400, 'Decisão inválida.');
    const locked = await db.query(
      "SELECT * FROM schedule_change_requests WHERE id=$1 AND coach_id=$2 AND status='pending' FOR UPDATE",
      [id, userId],
    );
    const request = locked.rows[0];
    if (!request) throw new HttpError(404, 'Solicitação pendente não encontrada.');
    if (decision === 'approved' && request.kind === 'recurring') {
      const localToday = await db.query(
        `SELECT (now() AT TIME ZONE timezone)::date::text today FROM profiles WHERE id=$1`,
        [request.student_id],
      );
      await replaceSchedule({
        subjectId: request.student_id,
        sourceId: request.assignment_recipient_id,
        source: 'coach',
        weekdays: request.proposed_weekdays,
        startsOn: localToday.rows[0].today,
      });
    }
    if (decision === 'approved' && request.kind === 'one_off') {
      const occurrence = await db.query(
        `SELECT o.*,(now() AT TIME ZONE p.timezone)::date::text today
         FROM scheduled_workouts o JOIN profiles p ON p.id=o.user_id
         WHERE o.id=$1 AND o.user_id=$2 AND o.status IN ('planned','missed') FOR UPDATE OF o`,
        [request.scheduled_workout_id, request.student_id],
      );
      if (!occurrence.rows[0])
        throw new HttpError(409, 'O compromisso original não está mais disponível.');
      if (request.proposed_date < occurrence.rows[0].today)
        throw new HttpError(409, 'A nova data já passou. Peça outra sugestão ao aluno.');
      await db.query(
        "UPDATE scheduled_workouts SET status='rescheduled',updated_at=now() WHERE id=$1",
        [request.scheduled_workout_id],
      );
      await db.query(
        `INSERT INTO scheduled_workouts(user_id,schedule_id,scheduled_date,template_id,assignment_version_id) VALUES($1,$2,$3,$4,$5)`,
        [
          request.student_id,
          occurrence.rows[0].schedule_id,
          request.proposed_date,
          occurrence.rows[0].template_id,
          occurrence.rows[0].assignment_version_id,
        ],
      );
    }
    const response = text(input.response ?? '', 500);
    await db.query(
      'UPDATE schedule_change_requests SET status=$3,response=$4,responded_at=now() WHERE id=$1 AND coach_id=$2',
      [id, userId, decision, response],
    );
    await notify(
      request.student_id,
      `schedule_request_${decision}`,
      decision === 'approved' ? 'Mudança de agenda aprovada' : 'Mudança de agenda recusada',
      response,
      `/app?secao=calendario&solicitacao=${request.id}`,
    );
    return { ok: true };
  }
  async function execute(raw: unknown) {
    const input = object(raw);
    if (input.action === 'save-schedule') return replaceSchedule(input);
    if (input.action === 'request-change') return requestChange(input);
    if (input.action === 'respond-request') return respond(input);
    if (input.action === 'read-notification') {
      const id = uuid(input.id);
      await db.query(
        'UPDATE app_notifications SET read_at=coalesce(read_at,now()) WHERE id=$1 AND recipient_id=$2',
        [id, userId],
      );
      return { ok: true };
    }
    if (input.action === 'read-notifications' || input.action === 'read-all-notifications') {
      await db.query(
        'UPDATE app_notifications SET read_at=coalesce(read_at,now()) WHERE recipient_id=$1',
        [userId],
      );
      return { ok: true };
    }
    throw new HttpError(400, 'Operação de calendário inválida.');
  }
  return { dashboard, execute };
}
