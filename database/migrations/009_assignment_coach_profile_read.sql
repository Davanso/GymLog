CREATE FUNCTION public.gymlog_can_read_assignment_coach(profile uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workout_assignments a
    JOIN public.workout_assignment_recipients r ON r.assignment_id=a.id
    WHERE a.coach_id=profile AND r.student_id=public.gymlog_user_id() AND r.status<>'withdrawn'
  )
$$;
REVOKE ALL ON FUNCTION public.gymlog_can_read_assignment_coach(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gymlog_can_read_assignment_coach(uuid) TO gymlog_app;
CREATE POLICY assignment_coach_profile_read ON public.profiles FOR SELECT TO gymlog_app
  USING (public.gymlog_can_read_assignment_coach(id));
