CREATE TABLE public.workout_schedules (
  id uuid PRIMARY KEY DEFAULT uuidv7(), user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.workout_templates(id) ON DELETE RESTRICT,
  assignment_recipient_id uuid REFERENCES public.workout_assignment_recipients(id) ON DELETE RESTRICT,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 1 AND 7), starts_on date NOT NULL, ends_on date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','ended')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((template_id IS NOT NULL)::int + (assignment_recipient_id IS NOT NULL)::int = 1),
  CHECK (ends_on IS NULL OR ends_on >= starts_on)
);
CREATE UNIQUE INDEX workout_schedules_active_template_day ON public.workout_schedules(user_id,template_id,weekday) WHERE status='active' AND template_id IS NOT NULL;
CREATE UNIQUE INDEX workout_schedules_active_assignment_day ON public.workout_schedules(user_id,assignment_recipient_id,weekday) WHERE status='active' AND assignment_recipient_id IS NOT NULL;
CREATE INDEX workout_schedules_user_period ON public.workout_schedules(user_id,starts_on,ends_on,weekday);

CREATE TABLE public.scheduled_workouts (
  id uuid PRIMARY KEY DEFAULT uuidv7(), user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  schedule_id uuid NOT NULL REFERENCES public.workout_schedules(id) ON DELETE RESTRICT,
  scheduled_date date NOT NULL, template_id uuid REFERENCES public.workout_templates(id) ON DELETE RESTRICT,
  assignment_version_id uuid REFERENCES public.workout_assignment_versions(id) ON DELETE RESTRICT,
  session_id uuid, status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','completed','missed','cancelled','rescheduled')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(schedule_id,scheduled_date), UNIQUE(session_id),
  CHECK ((template_id IS NOT NULL)::int + (assignment_version_id IS NOT NULL)::int = 1)
);
CREATE UNIQUE INDEX scheduled_workouts_identity ON public.scheduled_workouts(id,user_id);
ALTER TABLE public.workout_sessions ADD COLUMN scheduled_workout_id uuid;
ALTER TABLE public.workout_sessions ADD CONSTRAINT workout_sessions_scheduled_workout_fk FOREIGN KEY (scheduled_workout_id,user_id) REFERENCES public.scheduled_workouts(id,user_id) ON DELETE RESTRICT;
ALTER TABLE public.scheduled_workouts ADD CONSTRAINT scheduled_workouts_session_fk FOREIGN KEY (session_id,user_id) REFERENCES public.workout_sessions(id,user_id) ON DELETE RESTRICT;
CREATE INDEX scheduled_workouts_user_date ON public.scheduled_workouts(user_id,scheduled_date);

CREATE TABLE public.schedule_change_requests (
  id uuid PRIMARY KEY DEFAULT uuidv7(), student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  coach_id uuid NOT NULL REFERENCES public.coach_profiles(profile_id) ON DELETE RESTRICT,
  assignment_recipient_id uuid NOT NULL REFERENCES public.workout_assignment_recipients(id) ON DELETE RESTRICT,
  scheduled_workout_id uuid REFERENCES public.scheduled_workouts(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('recurring','one_off')),
  proposed_weekdays smallint[], proposed_date date, message text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  response text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), responded_at timestamptz,
  CHECK ((kind='recurring' AND proposed_weekdays IS NOT NULL AND scheduled_workout_id IS NULL AND proposed_date IS NULL) OR
         (kind='one_off' AND proposed_weekdays IS NULL AND scheduled_workout_id IS NOT NULL AND proposed_date IS NOT NULL))
);
CREATE INDEX schedule_change_requests_coach_status ON public.schedule_change_requests(coach_id,status,created_at DESC);
CREATE INDEX schedule_change_requests_student ON public.schedule_change_requests(student_id,created_at DESC);
CREATE UNIQUE INDEX schedule_change_requests_one_pending_recurring ON public.schedule_change_requests(assignment_recipient_id) WHERE status='pending' AND kind='recurring';
CREATE UNIQUE INDEX schedule_change_requests_one_pending_occurrence ON public.schedule_change_requests(scheduled_workout_id) WHERE status='pending' AND kind='one_off';

CREATE TABLE public.app_notifications (
  id uuid PRIMARY KEY DEFAULT uuidv7(), recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL, kind text NOT NULL,
  title text NOT NULL, body text NOT NULL DEFAULT '', link text NOT NULL DEFAULT '/app',
  read_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX app_notifications_recipient ON public.app_notifications(recipient_id,read_at,created_at DESC);

ALTER TABLE public.workout_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_notifications ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE ON public.workout_schedules,public.scheduled_workouts,public.schedule_change_requests,public.app_notifications TO gymlog_app;

CREATE POLICY schedule_owner_read ON public.workout_schedules FOR SELECT TO gymlog_app USING (user_id=public.gymlog_user_id() OR EXISTS (
  SELECT 1 FROM public.coach_student_relationships r WHERE r.coach_id=public.gymlog_user_id() AND r.student_id=workout_schedules.user_id AND r.status='active' AND r.can_view_history));
CREATE POLICY schedule_creator_write ON public.workout_schedules FOR ALL TO gymlog_app USING (created_by=public.gymlog_user_id()) WITH CHECK (
  created_by=public.gymlog_user_id() AND ((user_id=public.gymlog_user_id() AND template_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.workout_templates t WHERE t.id=workout_schedules.template_id AND t.user_id=public.gymlog_user_id())) OR
  (assignment_recipient_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.workout_assignment_recipients ar JOIN public.workout_assignments a ON a.id=ar.assignment_id
    JOIN public.coach_student_relationships rel ON rel.id=ar.relationship_id
    WHERE ar.id=workout_schedules.assignment_recipient_id AND ar.student_id=workout_schedules.user_id AND a.coach_id=public.gymlog_user_id() AND rel.status='active'))));
CREATE POLICY occurrence_member_read ON public.scheduled_workouts FOR SELECT TO gymlog_app USING (user_id=public.gymlog_user_id() OR EXISTS (
  SELECT 1 FROM public.coach_student_relationships r WHERE r.coach_id=public.gymlog_user_id() AND r.student_id=scheduled_workouts.user_id AND r.status='active' AND r.can_view_history));
CREATE POLICY occurrence_owner_insert ON public.scheduled_workouts FOR INSERT TO gymlog_app WITH CHECK (EXISTS (
  SELECT 1 FROM public.workout_schedules s WHERE s.id=schedule_id AND s.user_id=scheduled_workouts.user_id AND
    (s.user_id=public.gymlog_user_id() OR s.created_by=public.gymlog_user_id() OR EXISTS (
      SELECT 1 FROM public.coach_student_relationships r WHERE r.coach_id=public.gymlog_user_id() AND r.student_id=s.user_id AND r.status='active' AND r.can_view_history))));
CREATE POLICY occurrence_member_update ON public.scheduled_workouts FOR UPDATE TO gymlog_app USING (user_id=public.gymlog_user_id() OR EXISTS (
  SELECT 1 FROM public.workout_schedules s WHERE s.id=schedule_id AND s.created_by=public.gymlog_user_id()) OR EXISTS (
  SELECT 1 FROM public.coach_student_relationships r WHERE r.coach_id=public.gymlog_user_id() AND r.student_id=scheduled_workouts.user_id AND r.status='active' AND r.can_view_history));
CREATE POLICY calendar_coach_template_read ON public.workout_templates FOR SELECT TO gymlog_app USING (EXISTS (
  SELECT 1 FROM public.coach_student_relationships r WHERE r.coach_id=public.gymlog_user_id() AND r.student_id=workout_templates.user_id AND r.status='active' AND r.can_view_history));
CREATE POLICY request_members ON public.schedule_change_requests FOR SELECT TO gymlog_app USING (student_id=public.gymlog_user_id() OR coach_id=public.gymlog_user_id());
CREATE POLICY request_student_insert ON public.schedule_change_requests FOR INSERT TO gymlog_app WITH CHECK (
  student_id=public.gymlog_user_id() AND EXISTS (
    SELECT 1 FROM public.workout_assignment_recipients ar JOIN public.workout_assignments a ON a.id=ar.assignment_id
    JOIN public.coach_student_relationships rel ON rel.id=ar.relationship_id
    WHERE ar.id=schedule_change_requests.assignment_recipient_id AND ar.student_id=public.gymlog_user_id() AND a.coach_id=schedule_change_requests.coach_id AND rel.status='active'));
CREATE POLICY request_coach_update ON public.schedule_change_requests FOR UPDATE TO gymlog_app USING (coach_id=public.gymlog_user_id()) WITH CHECK (coach_id=public.gymlog_user_id());
CREATE POLICY notification_recipient_read ON public.app_notifications FOR SELECT TO gymlog_app USING (recipient_id=public.gymlog_user_id());
CREATE POLICY notification_actor_insert ON public.app_notifications FOR INSERT TO gymlog_app WITH CHECK (
  actor_id=public.gymlog_user_id() AND (recipient_id=public.gymlog_user_id() OR EXISTS (
    SELECT 1 FROM public.coach_student_relationships r WHERE r.status='active' AND
      ((r.coach_id=public.gymlog_user_id() AND r.student_id=recipient_id) OR (r.student_id=public.gymlog_user_id() AND r.coach_id=recipient_id)))));
CREATE POLICY notification_recipient_update ON public.app_notifications FOR UPDATE TO gymlog_app USING (recipient_id=public.gymlog_user_id()) WITH CHECK (recipient_id=public.gymlog_user_id());

CREATE TRIGGER immutable_session_schedule BEFORE UPDATE ON public.workout_sessions FOR EACH ROW EXECUTE FUNCTION public.gymlog_immutable_fields('scheduled_workout_id');
