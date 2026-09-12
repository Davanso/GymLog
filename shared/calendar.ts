export type CalendarEvent = {
  id: string;
  date: string;
  name: string;
  status: 'planned' | 'completed' | 'missed' | 'cancelled' | 'rescheduled';
  source: 'personal' | 'coach';
  sourceId: string;
  version?: number;
  coachName?: string;
  sessionId?: string | null;
};
export type CalendarDay = {
  date: string;
  status: 'neutral' | 'planned' | 'completed' | 'missed';
  planned: number;
  completed: number;
  events: CalendarEvent[];
};
export type ScheduleOption = {
  id: string;
  name: string;
  source: 'personal' | 'coach';
  coachName?: string;
  weekdays: number[];
  canManage: boolean;
};
export type ScheduleChangeRequest = {
  id: string;
  studentName: string;
  workoutName: string;
  coachName: string;
  kind: 'recurring' | 'one_off';
  currentWeekdays: number[] | null;
  proposedWeekdays: number[] | null;
  currentDate: string | null;
  proposedDate: string | null;
  message: string;
  status: 'pending' | 'approved' | 'rejected';
  response: string;
  createdAt: string;
  canRespond: boolean;
};
export type AppNotification = {
  id: string;
  kind: string;
  title: string;
  body: string;
  link: string;
  readAt: string | null;
  createdAt: string;
};
export type CalendarDashboard = {
  month: string;
  timezone: string;
  subject: { id: string; name: string; isSelf: boolean; today: string };
  days: CalendarDay[];
  schedules: ScheduleOption[];
  students: { id: string; name: string }[];
  requests: ScheduleChangeRequest[];
  notifications: AppNotification[];
  unreadNotifications: number;
};
