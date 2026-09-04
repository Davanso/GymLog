-- A non-login runtime role. The trusted backend must SET LOCAL ROLE and user context
-- in the SAME transaction, only after authenticating the request.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'gymlog_app') THEN
    CREATE ROLE gymlog_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  ELSIF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'gymlog_app'
    AND (rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolcanlogin)) THEN
    RAISE EXCEPTION 'Existing gymlog_app role has unsafe privileges';
  END IF;
  EXECUTE format('GRANT gymlog_app TO %I', current_user);
END $$;
GRANT USAGE ON SCHEMA public TO gymlog_app;
GRANT USAGE ON TYPE public.gymlog_name, public.gymlog_notes, public.gymlog_load TO gymlog_app;

CREATE FUNCTION public.gymlog_user_id() RETURNS uuid
LANGUAGE sql STABLE SET search_path = pg_catalog AS $$
  SELECT nullif(current_setting('gymlog.user_id', true), '')::uuid
$$;

DO $$ DECLARE t text; owner_column text; BEGIN
  FOREACH t IN ARRAY ARRAY['profiles','workout_templates','template_exercises','template_sets',
    'workout_sessions','session_exercises','session_sets'] LOOP
    owner_column := CASE WHEN t = 'profiles' THEN 'id' ELSE 'user_id' END;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO gymlog_app', t);
    EXECUTE format('CREATE POLICY own_rows ON public.%I TO gymlog_app USING (%I = public.gymlog_user_id()) WITH CHECK (%I = public.gymlog_user_id())', t, owner_column, owner_column);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['muscle_groups','equipment','exercises','exercise_muscles','exercise_media'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC', t);
    EXECUTE format('GRANT SELECT ON public.%I TO gymlog_app', t);
    EXECUTE format('CREATE POLICY authenticated_read ON public.%I FOR SELECT TO gymlog_app USING (public.gymlog_user_id() IS NOT NULL)', t);
  END LOOP;
END $$;
REVOKE ALL ON public.gymlog_migrations FROM PUBLIC, gymlog_app;

CREATE FUNCTION public.gymlog_immutable_fields() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE k text;
BEGIN
  FOREACH k IN ARRAY TG_ARGV LOOP
    IF to_jsonb(OLD)->k IS DISTINCT FROM to_jsonb(NEW)->k THEN
      RAISE EXCEPTION 'Field % cannot be reassigned', k USING ERRCODE = '23514';
    END IF;
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER immutable_identity BEFORE UPDATE ON public.profiles FOR EACH ROW
  EXECUTE FUNCTION public.gymlog_immutable_fields('id');
CREATE TRIGGER immutable_identity BEFORE UPDATE ON public.workout_templates FOR EACH ROW
  EXECUTE FUNCTION public.gymlog_immutable_fields('id','user_id');
CREATE TRIGGER immutable_identity BEFORE UPDATE ON public.workout_sessions FOR EACH ROW
  EXECUTE FUNCTION public.gymlog_immutable_fields('id','user_id','template_id');
CREATE TRIGGER immutable_identity BEFORE UPDATE ON public.template_exercises FOR EACH ROW
  EXECUTE FUNCTION public.gymlog_immutable_fields('id','user_id','template_id','exercise_id');
CREATE TRIGGER immutable_identity BEFORE UPDATE ON public.template_sets FOR EACH ROW
  EXECUTE FUNCTION public.gymlog_immutable_fields('id','user_id','template_exercise_id');
CREATE TRIGGER immutable_identity BEFORE UPDATE ON public.session_exercises FOR EACH ROW
  EXECUTE FUNCTION public.gymlog_immutable_fields('id','user_id','session_id','exercise_id',
    'exercise_name_snapshot','tracking_mode_snapshot','load_mode_snapshot','load_convention_snapshot');
CREATE TRIGGER immutable_identity BEFORE UPDATE ON public.session_sets FOR EACH ROW
  EXECUTE FUNCTION public.gymlog_immutable_fields('id','user_id','session_exercise_id');

CREATE FUNCTION public.gymlog_exercise_reference() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE e public.exercises%ROWTYPE;
BEGIN
  SELECT * INTO e FROM public.exercises WHERE id = NEW.exercise_id FOR SHARE;
  IF NOT FOUND OR e.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'Exercise unavailable' USING ERRCODE = '23514';
  END IF;
  IF TG_TABLE_NAME = 'session_exercises' THEN
    NEW.exercise_name_snapshot := e.name;
    NEW.tracking_mode_snapshot := e.tracking_mode;
    NEW.load_mode_snapshot := e.load_mode;
    NEW.load_convention_snapshot := e.load_convention;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER exercise_reference BEFORE INSERT ON public.template_exercises FOR EACH ROW
  EXECUTE FUNCTION public.gymlog_exercise_reference();
CREATE TRIGGER exercise_reference BEFORE INSERT ON public.session_exercises FOR EACH ROW
  EXECUTE FUNCTION public.gymlog_exercise_reference();

-- Catalogue measurements are stable identities; create a variant to change them.
CREATE TRIGGER immutable_measurements BEFORE UPDATE ON public.exercises FOR EACH ROW
  EXECUTE FUNCTION public.gymlog_immutable_fields('id','tracking_mode','load_mode','load_convention');

CREATE FUNCTION public.gymlog_validate_set_mode() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE mode text;
BEGIN
  IF TG_TABLE_NAME = 'template_sets' THEN
    SELECT e.tracking_mode INTO mode FROM public.template_exercises te
      JOIN public.exercises e ON e.id = te.exercise_id WHERE te.id = NEW.template_exercise_id;
  ELSE
    SELECT tracking_mode_snapshot INTO mode FROM public.session_exercises WHERE id = NEW.session_exercise_id;
    IF (mode = 'reps' AND NEW.actual_duration_seconds IS NOT NULL)
      OR (mode = 'duration' AND NEW.actual_reps IS NOT NULL) THEN
      RAISE EXCEPTION 'Actual metrics do not match exercise mode' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF (mode = 'reps' AND NEW.target_duration_seconds IS NOT NULL)
    OR (mode = 'duration' AND NEW.target_reps_min IS NOT NULL) THEN
    RAISE EXCEPTION 'Target metrics do not match exercise mode' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER set_mode BEFORE INSERT OR UPDATE ON public.template_sets FOR EACH ROW
  EXECUTE FUNCTION public.gymlog_validate_set_mode();
CREATE TRIGGER set_mode BEFORE INSERT OR UPDATE ON public.session_sets FOR EACH ROW
  EXECUTE FUNCTION public.gymlog_validate_set_mode();

-- Serialize changes to a session, including edits to its child rows.
CREATE FUNCTION public.gymlog_lock_session() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE sid uuid; r jsonb;
BEGIN
  r := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  IF TG_TABLE_NAME = 'session_exercises' THEN sid := (r->>'session_id')::uuid;
  ELSE SELECT session_id INTO sid FROM public.session_exercises WHERE id = (r->>'session_exercise_id')::uuid;
  END IF;
  PERFORM 1 FROM public.workout_sessions WHERE id = sid FOR UPDATE;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE TRIGGER lock_session BEFORE INSERT OR UPDATE OR DELETE ON public.session_exercises
  FOR EACH ROW EXECUTE FUNCTION public.gymlog_lock_session();
CREATE TRIGGER lock_session BEFORE INSERT OR UPDATE OR DELETE ON public.session_sets
  FOR EACH ROW EXECUTE FUNCTION public.gymlog_lock_session();

CREATE FUNCTION public.gymlog_validate_completed_session() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE sid uuid; r jsonb;
BEGIN
  r := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  IF TG_TABLE_NAME = 'workout_sessions' THEN sid := (r->>'id')::uuid;
  ELSIF TG_TABLE_NAME = 'session_exercises' THEN sid := (r->>'session_id')::uuid;
  ELSE SELECT session_id INTO sid FROM public.session_exercises WHERE id = (r->>'session_exercise_id')::uuid;
  END IF;
  IF EXISTS (SELECT 1 FROM public.workout_sessions WHERE id = sid AND status = 'completed') THEN
    IF NOT EXISTS (SELECT 1 FROM public.session_sets s JOIN public.session_exercises e
      ON e.id = s.session_exercise_id WHERE e.session_id = sid AND s.status = 'completed')
    OR EXISTS (SELECT 1 FROM public.session_sets s JOIN public.session_exercises e
      ON e.id = s.session_exercise_id WHERE e.session_id = sid AND s.status = 'pending') THEN
      RAISE EXCEPTION 'Completed session requires completed sets and no pending sets' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NULL;
END $$;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['workout_sessions','session_exercises','session_sets'] LOOP
    EXECUTE format('CREATE CONSTRAINT TRIGGER completed_session AFTER INSERT OR UPDATE OR DELETE ON public.%I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.gymlog_validate_completed_session()',t);
  END LOOP;
END $$;

CREATE FUNCTION public.gymlog_require_primary_muscle() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE eid uuid; r jsonb;
BEGIN
  r := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  eid := (r->>CASE WHEN TG_TABLE_NAME = 'exercises' THEN 'id' ELSE 'exercise_id' END)::uuid;
  IF EXISTS (SELECT 1 FROM public.exercises WHERE id = eid AND archived_at IS NULL)
    AND NOT EXISTS (SELECT 1 FROM public.exercise_muscles WHERE exercise_id = eid AND role = 'primary') THEN
    RAISE EXCEPTION 'Active exercise requires a primary muscle' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER immutable_identity BEFORE UPDATE ON public.exercise_muscles FOR EACH ROW
  EXECUTE FUNCTION public.gymlog_immutable_fields('exercise_id','muscle_group_id');
CREATE CONSTRAINT TRIGGER primary_muscle AFTER INSERT OR UPDATE ON public.exercises
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.gymlog_require_primary_muscle();
CREATE CONSTRAINT TRIGGER primary_muscle AFTER INSERT OR UPDATE OR DELETE ON public.exercise_muscles
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.gymlog_require_primary_muscle();
