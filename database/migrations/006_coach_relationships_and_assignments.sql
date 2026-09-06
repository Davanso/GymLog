CREATE TABLE public.coach_profiles (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  enabled_at timestamptz NOT NULL DEFAULT now(), disabled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (disabled_at IS NULL OR disabled_at >= enabled_at)
);
CREATE TABLE public.coach_student_invites (
  id uuid PRIMARY KEY DEFAULT uuidv7(), coach_id uuid NOT NULL REFERENCES public.coach_profiles(profile_id) ON DELETE RESTRICT,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','revoked','expired')),
  expires_at timestamptz NOT NULL, accepted_at timestamptz, revoked_at timestamptz, accepted_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at),
  CHECK ((status='accepted' AND accepted_at IS NOT NULL AND accepted_by IS NOT NULL AND revoked_at IS NULL)
    OR (status='revoked' AND revoked_at IS NOT NULL AND accepted_at IS NULL AND accepted_by IS NULL)
    OR (status IN ('pending','expired') AND accepted_at IS NULL AND accepted_by IS NULL AND revoked_at IS NULL))
);
CREATE TABLE public.coach_student_relationships (
  id uuid PRIMARY KEY DEFAULT uuidv7(), coach_id uuid NOT NULL REFERENCES public.coach_profiles(profile_id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  invite_id uuid NOT NULL UNIQUE REFERENCES public.coach_student_invites(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','ended')),
  can_view_history boolean NOT NULL DEFAULT true,
  accepted_at timestamptz NOT NULL DEFAULT now(), ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (coach_id <> student_id),
  CHECK ((status='active' AND ended_at IS NULL) OR (status='ended' AND ended_at IS NOT NULL))
);
CREATE UNIQUE INDEX coach_student_relationship_active_pair ON public.coach_student_relationships(coach_id,student_id) WHERE status='active';
CREATE INDEX coach_student_relationship_student ON public.coach_student_relationships(student_id,status);

CREATE TABLE public.workout_assignment_versions (
  id uuid PRIMARY KEY DEFAULT uuidv7(), coach_id uuid NOT NULL REFERENCES public.coach_profiles(profile_id) ON DELETE RESTRICT,
  source_template_id uuid NOT NULL, source_template_version integer NOT NULL CHECK (source_template_version > 0),
  revision integer NOT NULL CHECK (revision > 0), name public.gymlog_name NOT NULL, notes public.gymlog_notes,
  rest_seconds integer NOT NULL DEFAULT 60 CHECK (rest_seconds BETWEEN 0 AND 3600), created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (source_template_id,coach_id) REFERENCES public.workout_templates(id,user_id) ON DELETE RESTRICT,
  UNIQUE (source_template_id,revision), UNIQUE (id,coach_id)
);
CREATE TABLE public.workout_assignment_exercises (
  id uuid PRIMARY KEY DEFAULT uuidv7(), assignment_version_id uuid NOT NULL REFERENCES public.workout_assignment_versions(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES public.exercises(id) ON DELETE RESTRICT, position integer NOT NULL CHECK (position > 0),
  notes public.gymlog_notes, exercise_name_snapshot public.gymlog_name NOT NULL,
  tracking_mode_snapshot text NOT NULL CHECK (tracking_mode_snapshot IN ('reps','duration')),
  load_mode_snapshot text NOT NULL CHECK (load_mode_snapshot IN ('external','bodyweight','assisted')),
  load_convention_snapshot text NOT NULL,
  UNIQUE (assignment_version_id,position), UNIQUE (assignment_version_id,exercise_id)
);
CREATE TABLE public.workout_assignment_sets (
  id uuid PRIMARY KEY DEFAULT uuidv7(), assignment_exercise_id uuid NOT NULL REFERENCES public.workout_assignment_exercises(id) ON DELETE CASCADE,
  position integer NOT NULL CHECK (position > 0), set_type text NOT NULL DEFAULT 'working' CHECK (set_type IN ('warmup','working')),
  target_reps_min integer, target_reps_max integer, target_duration_seconds integer CHECK (target_duration_seconds > 0),
  target_load_kg public.gymlog_load, rest_seconds integer CHECK (rest_seconds >= 0),
  CHECK ((target_reps_min IS NULL AND target_reps_max IS NULL)
    OR (target_reps_min IS NOT NULL AND target_reps_max IS NOT NULL AND target_reps_min > 0 AND target_reps_max >= target_reps_min)),
  CHECK (target_duration_seconds IS NULL OR target_reps_min IS NULL), UNIQUE (assignment_exercise_id,position)
);
CREATE TABLE public.workout_assignments (
  id uuid PRIMARY KEY DEFAULT uuidv7(), coach_id uuid NOT NULL REFERENCES public.coach_profiles(profile_id) ON DELETE RESTRICT,
  assignment_version_id uuid NOT NULL, title public.gymlog_name NOT NULL, instructions public.gymlog_notes,
  created_at timestamptz NOT NULL DEFAULT now(), archived_at timestamptz,
  FOREIGN KEY (assignment_version_id,coach_id) REFERENCES public.workout_assignment_versions(id,coach_id) ON DELETE RESTRICT,
  UNIQUE (id,coach_id)
);
CREATE TABLE public.workout_assignment_recipients (
  id uuid PRIMARY KEY DEFAULT uuidv7(), assignment_id uuid NOT NULL, relationship_id uuid NOT NULL REFERENCES public.coach_student_relationships(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT, instructions public.gymlog_notes,
  status text NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned','started','completed','withdrawn')),
  assigned_at timestamptz NOT NULL DEFAULT now(), withdrawn_at timestamptz,
  FOREIGN KEY (assignment_id) REFERENCES public.workout_assignments(id) ON DELETE RESTRICT,
  UNIQUE (assignment_id,student_id), UNIQUE (id,student_id),
  CHECK ((status='withdrawn' AND withdrawn_at IS NOT NULL) OR (status<>'withdrawn' AND withdrawn_at IS NULL))
);
ALTER TABLE public.workout_sessions ADD COLUMN assignment_recipient_id uuid;
ALTER TABLE public.workout_sessions ADD COLUMN assignment_version_id uuid REFERENCES public.workout_assignment_versions(id) ON DELETE RESTRICT;
ALTER TABLE public.workout_sessions ADD FOREIGN KEY (assignment_recipient_id,user_id) REFERENCES public.workout_assignment_recipients(id,student_id) ON DELETE RESTRICT;
CREATE INDEX workout_assignment_recipients_student ON public.workout_assignment_recipients(student_id,status,assigned_at DESC);
CREATE INDEX workout_assignment_versions_source ON public.workout_assignment_versions(source_template_id,source_template_version);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['coach_profiles','coach_student_invites','coach_student_relationships','workout_assignment_versions','workout_assignment_exercises','workout_assignment_sets','workout_assignments','workout_assignment_recipients'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC',t);
  END LOOP;
END $$;
GRANT SELECT,INSERT,UPDATE ON public.coach_profiles,public.coach_student_invites,public.coach_student_relationships TO gymlog_app;
GRANT SELECT,INSERT ON public.workout_assignment_versions,public.workout_assignment_exercises,public.workout_assignment_sets,public.workout_assignments TO gymlog_app;
GRANT SELECT,INSERT,UPDATE ON public.workout_assignment_recipients TO gymlog_app;

CREATE FUNCTION public.gymlog_can_read_assignment_version(version_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT EXISTS (SELECT 1 FROM public.workout_assignments a JOIN public.workout_assignment_recipients r ON r.assignment_id=a.id
    WHERE a.assignment_version_id=version_id AND r.student_id=public.gymlog_user_id() AND r.status<>'withdrawn')
$$;
CREATE FUNCTION public.gymlog_can_read_assignment(assignment uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT EXISTS (SELECT 1 FROM public.workout_assignment_recipients r WHERE r.assignment_id=assignment AND r.student_id=public.gymlog_user_id() AND r.status<>'withdrawn')
$$;
CREATE FUNCTION public.gymlog_is_assignment_coach(assignment uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT EXISTS (SELECT 1 FROM public.workout_assignments a WHERE a.id=assignment AND a.coach_id=public.gymlog_user_id())
$$;
REVOKE ALL ON FUNCTION public.gymlog_can_read_assignment_version(uuid),public.gymlog_can_read_assignment(uuid),public.gymlog_is_assignment_coach(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gymlog_can_read_assignment_version(uuid),public.gymlog_can_read_assignment(uuid),public.gymlog_is_assignment_coach(uuid) TO gymlog_app;

CREATE POLICY own_coach_profile ON public.coach_profiles TO gymlog_app USING (profile_id=public.gymlog_user_id()) WITH CHECK (profile_id=public.gymlog_user_id());
CREATE POLICY own_coach_invites ON public.coach_student_invites TO gymlog_app USING (coach_id=public.gymlog_user_id()) WITH CHECK (coach_id=public.gymlog_user_id());
CREATE POLICY relationship_members ON public.coach_student_relationships FOR SELECT TO gymlog_app USING (coach_id=public.gymlog_user_id() OR student_id=public.gymlog_user_id());
CREATE POLICY relationship_members_update ON public.coach_student_relationships FOR UPDATE TO gymlog_app USING (coach_id=public.gymlog_user_id() OR student_id=public.gymlog_user_id()) WITH CHECK (coach_id=public.gymlog_user_id() OR student_id=public.gymlog_user_id());
CREATE POLICY coach_assignment_versions ON public.workout_assignment_versions TO gymlog_app USING (coach_id=public.gymlog_user_id()) WITH CHECK (coach_id=public.gymlog_user_id());
CREATE POLICY student_assignment_versions ON public.workout_assignment_versions FOR SELECT TO gymlog_app USING (public.gymlog_can_read_assignment_version(id));
CREATE POLICY coach_assignment_exercises ON public.workout_assignment_exercises TO gymlog_app USING (EXISTS (SELECT 1 FROM public.workout_assignment_versions v WHERE v.id=assignment_version_id AND v.coach_id=public.gymlog_user_id())) WITH CHECK (EXISTS (SELECT 1 FROM public.workout_assignment_versions v WHERE v.id=assignment_version_id AND v.coach_id=public.gymlog_user_id()));
CREATE POLICY student_assignment_exercises ON public.workout_assignment_exercises FOR SELECT TO gymlog_app USING (public.gymlog_can_read_assignment_version(assignment_version_id));
CREATE POLICY coach_assignment_sets ON public.workout_assignment_sets TO gymlog_app USING (EXISTS (SELECT 1 FROM public.workout_assignment_exercises e JOIN public.workout_assignment_versions v ON v.id=e.assignment_version_id WHERE e.id=assignment_exercise_id AND v.coach_id=public.gymlog_user_id())) WITH CHECK (EXISTS (SELECT 1 FROM public.workout_assignment_exercises e JOIN public.workout_assignment_versions v ON v.id=e.assignment_version_id WHERE e.id=assignment_exercise_id AND v.coach_id=public.gymlog_user_id()));
CREATE POLICY student_assignment_sets ON public.workout_assignment_sets FOR SELECT TO gymlog_app USING (EXISTS (SELECT 1 FROM public.workout_assignment_exercises e WHERE e.id=assignment_exercise_id AND public.gymlog_can_read_assignment_version(e.assignment_version_id)));
CREATE POLICY coach_assignments ON public.workout_assignments TO gymlog_app USING (coach_id=public.gymlog_user_id()) WITH CHECK (coach_id=public.gymlog_user_id());
CREATE POLICY student_assignments ON public.workout_assignments FOR SELECT TO gymlog_app USING (public.gymlog_can_read_assignment(id));
CREATE POLICY assignment_recipient_members ON public.workout_assignment_recipients FOR SELECT TO gymlog_app USING (student_id=public.gymlog_user_id() OR public.gymlog_is_assignment_coach(assignment_id));
CREATE POLICY coach_insert_recipients ON public.workout_assignment_recipients FOR INSERT TO gymlog_app WITH CHECK (EXISTS (
  SELECT 1 FROM public.workout_assignments a JOIN public.coach_student_relationships r ON r.id=relationship_id
  WHERE a.id=assignment_id AND a.coach_id=public.gymlog_user_id() AND r.coach_id=a.coach_id AND r.student_id=student_id AND r.status='active'));
CREATE POLICY recipient_members_update ON public.workout_assignment_recipients FOR UPDATE TO gymlog_app USING (student_id=public.gymlog_user_id() OR public.gymlog_is_assignment_coach(assignment_id));

CREATE POLICY relationship_profile_read ON public.profiles FOR SELECT TO gymlog_app USING (EXISTS (
  SELECT 1 FROM public.coach_student_relationships r WHERE r.status='active' AND ((r.coach_id=public.gymlog_user_id() AND r.student_id=profiles.id) OR (r.student_id=public.gymlog_user_id() AND r.coach_id=profiles.id))));
CREATE POLICY coach_session_read ON public.workout_sessions FOR SELECT TO gymlog_app USING (EXISTS (
  SELECT 1 FROM public.coach_student_relationships r WHERE r.coach_id=public.gymlog_user_id() AND r.student_id=workout_sessions.user_id AND r.status='active' AND r.can_view_history));
CREATE POLICY coach_session_exercise_read ON public.session_exercises FOR SELECT TO gymlog_app USING (EXISTS (
  SELECT 1 FROM public.coach_student_relationships r WHERE r.coach_id=public.gymlog_user_id() AND r.student_id=session_exercises.user_id AND r.status='active' AND r.can_view_history));
CREATE POLICY coach_session_set_read ON public.session_sets FOR SELECT TO gymlog_app USING (EXISTS (
  SELECT 1 FROM public.coach_student_relationships r WHERE r.coach_id=public.gymlog_user_id() AND r.student_id=session_sets.user_id AND r.status='active' AND r.can_view_history));

CREATE FUNCTION public.gymlog_accept_coach_invite(hash text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE student uuid := public.gymlog_user_id(); invitation public.coach_student_invites%ROWTYPE; relationship_id uuid;
BEGIN
  IF student IS NULL THEN RAISE EXCEPTION 'Missing user context' USING ERRCODE='42501'; END IF;
  SELECT i.* INTO invitation FROM public.coach_student_invites i JOIN public.coach_profiles c ON c.profile_id=i.coach_id
    WHERE i.token_hash=hash AND i.status='pending' AND i.expires_at>now() AND c.disabled_at IS NULL FOR UPDATE OF i;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invite unavailable' USING ERRCODE='P0002'; END IF;
  IF invitation.coach_id=student THEN RAISE EXCEPTION 'Coach cannot invite self' USING ERRCODE='23514'; END IF;
  PERFORM 1 FROM public.profiles WHERE id=student FOR UPDATE;
  IF (SELECT count(*) FROM public.coach_student_relationships WHERE student_id=student AND status='active') >= 3 THEN
    RAISE EXCEPTION 'Student coach limit reached' USING ERRCODE='23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public.coach_student_relationships WHERE coach_id=invitation.coach_id AND student_id=student AND status='active') THEN
    RAISE EXCEPTION 'Relationship already active' USING ERRCODE='23505';
  END IF;
  INSERT INTO public.coach_student_relationships(coach_id,student_id,invite_id) VALUES(invitation.coach_id,student,invitation.id) RETURNING id INTO relationship_id;
  UPDATE public.coach_student_invites SET status='accepted',accepted_at=now(),accepted_by=student,updated_at=now() WHERE id=invitation.id;
  RETURN relationship_id;
END $$;
REVOKE ALL ON FUNCTION public.gymlog_accept_coach_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gymlog_accept_coach_invite(text) TO gymlog_app;

CREATE TRIGGER immutable_assignment_version BEFORE UPDATE ON public.workout_assignment_versions FOR EACH ROW EXECUTE FUNCTION public.gymlog_immutable_fields('id','coach_id','source_template_id','source_template_version','revision','name','notes','rest_seconds');
CREATE TRIGGER immutable_assignment_exercise BEFORE UPDATE ON public.workout_assignment_exercises FOR EACH ROW EXECUTE FUNCTION public.gymlog_immutable_fields('id','assignment_version_id','exercise_id','position','notes','exercise_name_snapshot','tracking_mode_snapshot','load_mode_snapshot','load_convention_snapshot');
CREATE TRIGGER immutable_assignment_set BEFORE UPDATE ON public.workout_assignment_sets FOR EACH ROW EXECUTE FUNCTION public.gymlog_immutable_fields('id','assignment_exercise_id','position','set_type','target_reps_min','target_reps_max','target_duration_seconds','target_load_kg','rest_seconds');
CREATE TRIGGER immutable_session_assignment BEFORE UPDATE ON public.workout_sessions FOR EACH ROW EXECUTE FUNCTION public.gymlog_immutable_fields('assignment_recipient_id','assignment_version_id');

CREATE OR REPLACE FUNCTION public.gymlog_exercise_reference() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE e public.exercises%ROWTYPE;
BEGIN
  SELECT * INTO e FROM public.exercises WHERE id = NEW.exercise_id FOR SHARE;
  IF NOT FOUND OR e.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'Exercise unavailable' USING ERRCODE = '23514';
  END IF;
  IF TG_TABLE_NAME = 'session_exercises' THEN
    NEW.exercise_name_snapshot := coalesce(NEW.exercise_name_snapshot,e.name);
    NEW.tracking_mode_snapshot := coalesce(NEW.tracking_mode_snapshot,e.tracking_mode);
    NEW.load_mode_snapshot := coalesce(NEW.load_mode_snapshot,e.load_mode);
    NEW.load_convention_snapshot := coalesce(NEW.load_convention_snapshot,e.load_convention);
  END IF;
  RETURN NEW;
END $$;
