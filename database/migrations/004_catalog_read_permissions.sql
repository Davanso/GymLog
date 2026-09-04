-- Snapshot reads use MVCC and must not require UPDATE privileges on the catalogue.
CREATE OR REPLACE FUNCTION public.gymlog_exercise_reference() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE e public.exercises%ROWTYPE;
BEGIN
  SELECT * INTO e FROM public.exercises WHERE id = NEW.exercise_id;
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
