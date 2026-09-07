import type { Session, Template } from './workouts.js';

export type CoachConnection = {
  relationshipId: string;
  profileId: string;
  name: string;
  acceptedAt: string;
};
export type CoachInvite = {
  id: string;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  expiresAt: string;
  createdAt: string;
};
export type CoachDashboard = {
  enabled: boolean;
  students: CoachConnection[];
  coaches: CoachConnection[];
  invites: CoachInvite[];
  templates: Pick<Template, 'id' | 'name' | 'version'>[];
};
export type StudentAssignment = {
  id: string;
  title: string;
  templateName: string;
  status: 'assigned' | 'started' | 'completed' | 'withdrawn';
  assignedAt: string;
  instructions: string;
};
export type StudentHistory = {
  student: { id: string; name: string };
  sessions: Session[];
  assignments: StudentAssignment[];
};
