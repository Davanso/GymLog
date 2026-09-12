export type ReportPeriod = 'week' | 'month';

export type ReportSummary = {
  adherence: number | null;
  planned: number;
  completedPlanned: number;
  missed: number;
  completedSessions: number;
  plannedSessions: number;
  spontaneousSessions: number;
  durationMinutes: number;
  averageDurationMinutes: number;
  completedSets: number;
  skippedSets: number;
};

export type ReportDay = {
  date: string;
  planned: number;
  completed: number;
  sessions: number;
  durationMinutes: number;
  completedSets: number;
};

export type ReportExerciseOption = {
  id: string;
  name: string;
  trackingMode: 'reps' | 'duration';
};

export type ReportEvolutionPoint = {
  date: string;
  sessionName: string;
  bestLoad: number | null;
  bestReps: number | null;
  bestDuration: number | null;
  loadConvention: string;
};

export type ReportsDashboard = {
  period: ReportPeriod;
  anchor: string;
  startsOn: string;
  endsOn: string;
  timezone: string;
  isCurrent: boolean;
  subject: { id: string; name: string; isSelf: boolean; today: string };
  summary: ReportSummary;
  previous: ReportSummary;
  days: ReportDay[];
  misses: { id: string; date: string; name: string }[];
  exercises: ReportExerciseOption[];
  evolution: ReportEvolutionPoint[];
  selectedExerciseId: string | null;
  students: { id: string; name: string }[];
};
