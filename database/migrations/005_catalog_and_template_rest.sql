-- External catalogue identity, one rest interval per template and duplicate protection.
ALTER TABLE public.exercises ADD COLUMN provider text;
ALTER TABLE public.exercises ADD COLUMN external_id text;
CREATE UNIQUE INDEX exercises_provider_external ON public.exercises(provider,external_id)
  WHERE provider IS NOT NULL AND external_id IS NOT NULL;

ALTER TABLE public.workout_templates ADD COLUMN rest_seconds integer NOT NULL DEFAULT 60
  CHECK (rest_seconds BETWEEN 0 AND 3600);
UPDATE public.workout_templates t SET rest_seconds = coalesce((
  SELECT min(s.rest_seconds) FROM public.template_exercises te
  JOIN public.template_sets s ON s.template_exercise_id=te.id WHERE te.template_id=t.id
),60);
ALTER TABLE public.template_exercises ADD CONSTRAINT template_exercise_once UNIQUE(template_id,exercise_id);
