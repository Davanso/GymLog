CREATE UNIQUE INDEX workout_schedules_one_active_per_day
ON public.workout_schedules(user_id,weekday)
WHERE status='active';
