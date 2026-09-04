-- GymLog domain schema. neon_auth is managed externally and is not modified.
CREATE DOMAIN public.gymlog_name AS text CHECK (length(btrim(VALUE)) BETWEEN 1 AND 120);
CREATE DOMAIN public.gymlog_notes AS text CHECK (length(VALUE) <= 2000);
CREATE DOMAIN public.gymlog_load AS numeric(8,3)
  CHECK (VALUE >= 0 AND VALUE < 'Infinity'::numeric AND VALUE <> 'NaN'::numeric);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  display_name public.gymlog_name NOT NULL,
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_auth_fk FOREIGN KEY (id) REFERENCES neon_auth."user"(id)
    ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE
);

CREATE TABLE public.muscle_groups (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name public.gymlog_name NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.equipment (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name public.gymlog_name NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.exercises (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name public.gymlog_name NOT NULL, description public.gymlog_notes,
  instructions text[] NOT NULL DEFAULT '{}',
  equipment_id uuid NOT NULL REFERENCES public.equipment(id) ON DELETE RESTRICT,
  tracking_mode text NOT NULL CHECK (tracking_mode IN ('reps','duration')),
  load_mode text NOT NULL CHECK (load_mode IN ('external','bodyweight','assisted')),
  load_convention text NOT NULL,
  CHECK ((load_mode = 'external' AND load_convention IN ('total','per_hand','machine'))
    OR (load_mode = 'bodyweight' AND load_convention = 'added')
    OR (load_mode = 'assisted' AND load_convention = 'assistance')),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.exercise_muscles (
  exercise_id uuid NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  muscle_group_id uuid NOT NULL REFERENCES public.muscle_groups(id) ON DELETE RESTRICT,
  role text NOT NULL CHECK (role IN ('primary','secondary')),
  PRIMARY KEY (exercise_id,muscle_group_id)
);
CREATE TABLE public.exercise_media (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  exercise_id uuid NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('gif','image','video')),
  url text NOT NULL CHECK (url ~ '^https://[^[:space:]]+$'),
  alt_text public.gymlog_notes NOT NULL CHECK (length(btrim(alt_text)) > 0),
  position integer NOT NULL CHECK (position > 0),
  provider text, external_id text, source_url text, license text, attribution text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (exercise_id,position) DEFERRABLE INITIALLY IMMEDIATE
);

CREATE TABLE public.workout_templates (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  name public.gymlog_name NOT NULL, notes public.gymlog_notes,
  position integer NOT NULL DEFAULT 1 CHECK (position > 0),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0), archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id,user_id)
);
CREATE TABLE public.template_exercises (
  id uuid PRIMARY KEY DEFAULT uuidv7(), user_id uuid NOT NULL,
  template_id uuid NOT NULL,
  exercise_id uuid NOT NULL REFERENCES public.exercises(id) ON DELETE RESTRICT,
  position integer NOT NULL CHECK (position > 0), notes public.gymlog_notes,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (template_id,user_id) REFERENCES public.workout_templates(id,user_id) ON DELETE CASCADE,
  UNIQUE (id,user_id), UNIQUE (template_id,position) DEFERRABLE INITIALLY IMMEDIATE
);
CREATE TABLE public.template_sets (
  id uuid PRIMARY KEY DEFAULT uuidv7(), user_id uuid NOT NULL, template_exercise_id uuid NOT NULL,
  position integer NOT NULL CHECK (position > 0),
  set_type text NOT NULL DEFAULT 'working' CHECK (set_type IN ('warmup','working')),
  target_reps_min integer, target_reps_max integer,
  target_duration_seconds integer CHECK (target_duration_seconds > 0),
  target_load_kg public.gymlog_load, rest_seconds integer CHECK (rest_seconds >= 0),
  CHECK ((target_reps_min IS NULL AND target_reps_max IS NULL)
    OR (target_reps_min IS NOT NULL AND target_reps_max IS NOT NULL
      AND target_reps_min > 0 AND target_reps_max >= target_reps_min)),
  CHECK (target_duration_seconds IS NULL OR target_reps_min IS NULL),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (template_exercise_id,user_id) REFERENCES public.template_exercises(id,user_id) ON DELETE CASCADE,
  UNIQUE (template_exercise_id,position) DEFERRABLE INITIALLY IMMEDIATE
);

CREATE TABLE public.workout_sessions (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  template_id uuid,
  name public.gymlog_name NOT NULL,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','cancelled')),
  started_at timestamptz NOT NULL DEFAULT now(), ended_at timestamptz,
  notes public.gymlog_notes, version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  CHECK (ended_at IS NULL OR ended_at >= started_at),
  CHECK ((status = 'in_progress' AND ended_at IS NULL)
    OR (status <> 'in_progress' AND ended_at IS NOT NULL)),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id,user_id),
  FOREIGN KEY (template_id,user_id) REFERENCES public.workout_templates(id,user_id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX workout_sessions_one_active ON public.workout_sessions(user_id) WHERE status = 'in_progress';

CREATE TABLE public.session_exercises (
  id uuid PRIMARY KEY DEFAULT uuidv7(), user_id uuid NOT NULL, session_id uuid NOT NULL,
  exercise_id uuid NOT NULL REFERENCES public.exercises(id) ON DELETE RESTRICT,
  position integer NOT NULL CHECK (position > 0), notes public.gymlog_notes,
  exercise_name_snapshot public.gymlog_name NOT NULL,
  tracking_mode_snapshot text NOT NULL CHECK (tracking_mode_snapshot IN ('reps','duration')),
  load_mode_snapshot text NOT NULL CHECK (load_mode_snapshot IN ('external','bodyweight','assisted')),
  load_convention_snapshot text NOT NULL,
  CHECK ((load_mode_snapshot = 'external' AND load_convention_snapshot IN ('total','per_hand','machine'))
    OR (load_mode_snapshot = 'bodyweight' AND load_convention_snapshot = 'added')
    OR (load_mode_snapshot = 'assisted' AND load_convention_snapshot = 'assistance')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (session_id,user_id) REFERENCES public.workout_sessions(id,user_id) ON DELETE CASCADE,
  UNIQUE (id,user_id), UNIQUE (session_id,position) DEFERRABLE INITIALLY IMMEDIATE
);
CREATE TABLE public.session_sets (
  id uuid PRIMARY KEY DEFAULT uuidv7(), user_id uuid NOT NULL, session_exercise_id uuid NOT NULL,
  position integer NOT NULL CHECK (position > 0),
  set_type text NOT NULL DEFAULT 'working' CHECK (set_type IN ('warmup','working')),
  target_reps_min integer, target_reps_max integer,
  target_duration_seconds integer CHECK (target_duration_seconds > 0),
  target_load_kg public.gymlog_load, rest_seconds integer CHECK (rest_seconds >= 0),
  actual_reps integer CHECK (actual_reps > 0),
  actual_duration_seconds integer CHECK (actual_duration_seconds > 0),
  actual_load_kg public.gymlog_load,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','skipped')),
  completed_at timestamptz, notes public.gymlog_notes,
  CHECK ((target_reps_min IS NULL AND target_reps_max IS NULL)
    OR (target_reps_min IS NOT NULL AND target_reps_max IS NOT NULL
      AND target_reps_min > 0 AND target_reps_max >= target_reps_min)),
  CHECK (target_duration_seconds IS NULL OR target_reps_min IS NULL),
  CHECK (actual_reps IS NULL OR actual_duration_seconds IS NULL),
  CHECK ((status = 'completed' AND completed_at IS NOT NULL AND actual_load_kg IS NOT NULL
      AND (actual_reps IS NOT NULL OR actual_duration_seconds IS NOT NULL))
    OR (status <> 'completed' AND completed_at IS NULL)),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (session_exercise_id,user_id) REFERENCES public.session_exercises(id,user_id) ON DELETE CASCADE,
  UNIQUE (session_exercise_id,position) DEFERRABLE INITIALLY IMMEDIATE
);

CREATE INDEX workout_templates_user_order ON public.workout_templates(user_id,archived_at,position);
CREATE INDEX workout_sessions_history ON public.workout_sessions(user_id,started_at DESC,id DESC);
CREATE INDEX workout_sessions_template ON public.workout_sessions(template_id,user_id);
CREATE INDEX template_exercises_catalog ON public.template_exercises(exercise_id);
CREATE INDEX session_exercises_history ON public.session_exercises(user_id,exercise_id,session_id);
CREATE INDEX session_exercises_catalog ON public.session_exercises(exercise_id);
CREATE INDEX exercise_muscles_group ON public.exercise_muscles(muscle_group_id,exercise_id);
CREATE INDEX exercises_equipment ON public.exercises(equipment_id);

CREATE FUNCTION public.gymlog_touch_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN NEW.updated_at := clock_timestamp(); RETURN NEW; END;
$$;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['profiles','muscle_groups','equipment','exercises','exercise_media',
    'workout_templates','template_exercises','template_sets','workout_sessions','session_exercises','session_sets']
  LOOP
    EXECUTE format('CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.gymlog_touch_updated_at()', t);
  END LOOP;
END $$;

CREATE FUNCTION public.gymlog_validate_timezone() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = NEW.timezone) THEN
    RAISE EXCEPTION 'Invalid timezone' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER validate_timezone BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.gymlog_validate_timezone();
