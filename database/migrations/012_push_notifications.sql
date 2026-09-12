CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT uuidv7(), user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint text NOT NULL, p256dh text NOT NULL, auth text NOT NULL, device_name text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT true, last_success_at timestamptz, last_error text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,endpoint)
);
CREATE INDEX push_subscriptions_user_enabled ON public.push_subscriptions(user_id,enabled);

CREATE TABLE public.notification_preferences (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('new_assignment','schedule_changed','change_request_received','change_request_answered')),
  push_enabled boolean NOT NULL DEFAULT true, updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,category)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.push_subscriptions,public.notification_preferences TO gymlog_app;
CREATE POLICY push_subscription_owner ON public.push_subscriptions FOR ALL TO gymlog_app
  USING (user_id=public.gymlog_user_id()) WITH CHECK (user_id=public.gymlog_user_id());
CREATE POLICY notification_preference_owner ON public.notification_preferences FOR ALL TO gymlog_app
  USING (user_id=public.gymlog_user_id()) WITH CHECK (user_id=public.gymlog_user_id());
