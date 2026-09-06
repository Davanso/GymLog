DROP POLICY coach_session_read ON public.workout_sessions;
CREATE POLICY coach_session_read ON public.workout_sessions FOR SELECT TO gymlog_app USING (EXISTS (
  SELECT 1 FROM public.coach_student_relationships r JOIN public.coach_profiles c ON c.profile_id=r.coach_id
  WHERE r.coach_id=public.gymlog_user_id() AND r.student_id=workout_sessions.user_id AND r.status='active'
    AND r.can_view_history AND c.disabled_at IS NULL));
DROP POLICY coach_session_exercise_read ON public.session_exercises;
CREATE POLICY coach_session_exercise_read ON public.session_exercises FOR SELECT TO gymlog_app USING (EXISTS (
  SELECT 1 FROM public.coach_student_relationships r JOIN public.coach_profiles c ON c.profile_id=r.coach_id
  WHERE r.coach_id=public.gymlog_user_id() AND r.student_id=session_exercises.user_id AND r.status='active'
    AND r.can_view_history AND c.disabled_at IS NULL));
DROP POLICY coach_session_set_read ON public.session_sets;
CREATE POLICY coach_session_set_read ON public.session_sets FOR SELECT TO gymlog_app USING (EXISTS (
  SELECT 1 FROM public.coach_student_relationships r JOIN public.coach_profiles c ON c.profile_id=r.coach_id
  WHERE r.coach_id=public.gymlog_user_id() AND r.student_id=session_sets.user_id AND r.status='active'
    AND r.can_view_history AND c.disabled_at IS NULL));
