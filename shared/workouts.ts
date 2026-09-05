export type Exercise = {
  id: string;
  name: string;
  equipment: string;
  muscle_groups: string[];
  primary_muscle_groups: string[];
  secondary_muscle_groups: string[];
  tracking_mode: 'reps' | 'duration';
  load_mode: 'external' | 'bodyweight' | 'assisted';
  load_convention: string;
  external_id?: string | null;
  image_url?: string | null;
  video_url?: string | null;
};
export type PlanItem = {
  exerciseId: string;
  sets: number;
  reps: number | null;
  repsMax: number | null;
  seconds: number | null;
  load: number;
  notes: string;
};
export type TemplateDraft = {
  id: string;
  name: string;
  notes: string;
  restSeconds: number;
  items: PlanItem[];
};
export type Template = TemplateDraft & { version: number };
export type SessionSet = {
  id: string;
  position: number;
  target_reps_min: number | null;
  target_reps_max: number | null;
  target_duration_seconds: number | null;
  target_load_kg: number | null;
  rest_seconds: number | null;
  actual_reps: number | null;
  actual_duration_seconds: number | null;
  actual_load_kg: number | null;
  status: 'pending' | 'completed' | 'skipped';
};
export type SessionExercise = {
  id: string;
  exercise_name_snapshot: string;
  tracking_mode_snapshot: 'reps' | 'duration';
  load_convention_snapshot: string;
  notes: string;
  external_id?: string | null;
  image_url?: string | null;
  video_url?: string | null;
  sets: SessionSet[];
};
export type Session = {
  id: string;
  name: string;
  version: number;
  status: 'in_progress' | 'completed' | 'cancelled';
  started_at: string;
  ended_at: string | null;
  exercises: SessionExercise[];
};
export type WorkoutDashboard = {
  templates: Template[];
  exercises: Exercise[];
  active: Session | null;
  recent: Pick<Session, 'id' | 'name' | 'started_at' | 'ended_at' | 'status'>[];
};
