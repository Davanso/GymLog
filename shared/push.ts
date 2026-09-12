export const pushCategories = [
  'new_assignment',
  'schedule_changed',
  'change_request_received',
  'change_request_answered',
] as const;

export type PushCategory = (typeof pushCategories)[number];
export type PushPreferences = Record<PushCategory, boolean>;

export type PushSettings = {
  configured: boolean;
  configurationMessage: string;
  publicKey: string;
  subscriptions: { endpoint: string; deviceName: string; updatedAt: string }[];
  preferences: PushPreferences;
};
