import type { PoolClient } from '@neondatabase/serverless';
import webpush from 'web-push';
import { pushCategories, type PushCategory, type PushPreferences } from '../shared/push.js';
import { HttpError } from './http.js';
import { object, text } from './workoutInput.js';

function configuration() {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim() || '';
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim() || '';
  const subject = process.env.VAPID_SUBJECT?.trim() || '';
  if (!publicKey || !privateKey || !subject)
    return {
      publicKey,
      privateKey,
      subject,
      configured: false,
      message: 'Configure as três variáveis VAPID no servidor.',
    };
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    return { publicKey, privateKey, subject, configured: true, message: '' };
  } catch {
    return {
      publicKey,
      privateKey,
      subject,
      configured: false,
      message: 'A configuração VAPID é inválida. O assunto deve começar com mailto: ou https://.',
    };
  }
}

function endpoint(value: unknown) {
  const result = text(value, 2048);
  let url: URL;
  try {
    url = new URL(result);
  } catch {
    throw new HttpError(400, 'Inscrição push inválida.');
  }
  if (url.protocol !== 'https:') throw new HttpError(400, 'Inscrição push inválida.');
  return result;
}

function defaults(): PushPreferences {
  return Object.fromEntries(pushCategories.map((category) => [category, true])) as PushPreferences;
}

export function pushStore(db: PoolClient, userId: string) {
  async function settings() {
    const config = configuration();
    const [subscriptions, preferences] = await Promise.all([
      db.query(
        `SELECT endpoint,device_name "deviceName",updated_at "updatedAt" FROM push_subscriptions
         WHERE user_id=$1 AND enabled ORDER BY updated_at DESC`,
        [userId],
      ),
      db.query(
        'SELECT category,push_enabled "pushEnabled" FROM notification_preferences WHERE user_id=$1',
        [userId],
      ),
    ]);
    const values = defaults();
    for (const row of preferences.rows) values[row.category as PushCategory] = row.pushEnabled;
    return {
      configured: config.configured,
      configurationMessage: config.message,
      publicKey: config.configured ? config.publicKey : '',
      subscriptions: subscriptions.rows,
      preferences: values,
    };
  }

  async function execute(raw: unknown) {
    const input = object(raw);
    if (input.action === 'subscribe') {
      const config = configuration();
      if (!config.configured) throw new HttpError(503, config.message);
      await db.query(
        `INSERT INTO push_subscriptions(user_id,endpoint,p256dh,auth,device_name)
         VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id,endpoint) DO UPDATE SET
         p256dh=excluded.p256dh,auth=excluded.auth,device_name=excluded.device_name,enabled=true,last_error=NULL,updated_at=now()`,
        [
          userId,
          endpoint(input.endpoint),
          text(input.p256dh, 512),
          text(input.auth, 512),
          text(input.deviceName || 'Este dispositivo', 100),
        ],
      );
      return settings();
    }
    if (input.action === 'unsubscribe') {
      await db.query('DELETE FROM push_subscriptions WHERE user_id=$1 AND endpoint=$2', [
        userId,
        endpoint(input.endpoint),
      ]);
      return settings();
    }
    if (input.action === 'preferences') {
      const values = object(input.preferences);
      for (const category of pushCategories)
        await db.query(
          `INSERT INTO notification_preferences(user_id,category,push_enabled) VALUES($1,$2,$3)
           ON CONFLICT(user_id,category) DO UPDATE SET push_enabled=excluded.push_enabled,updated_at=now()`,
          [userId, category, values[category] !== false],
        );
      return settings();
    }
    if (input.action === 'test') {
      const config = configuration();
      if (!config.configured) throw new HttpError(503, config.message);
      const subscriptions = await db.query(
        'SELECT id,endpoint,p256dh,auth FROM push_subscriptions WHERE user_id=$1 AND enabled',
        [userId],
      );
      if (!subscriptions.rows.length)
        throw new HttpError(409, 'Ative as notificações neste dispositivo primeiro.');
      const payload = JSON.stringify({
        title: 'GymLog está pronto',
        body: 'As notificações deste dispositivo estão funcionando.',
        link: '/app?secao=calendario',
      });
      let delivered = 0;
      for (const subscription of subscriptions.rows) {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: { p256dh: subscription.p256dh, auth: subscription.auth },
            },
            payload,
          );
          delivered += 1;
          await db.query(
            'UPDATE push_subscriptions SET last_success_at=now(),last_error=NULL,updated_at=now() WHERE id=$1',
            [subscription.id],
          );
        } catch (cause) {
          const status = (cause as { statusCode?: number }).statusCode;
          await db.query(
            `UPDATE push_subscriptions SET enabled=CASE WHEN $2 IN (404,410) THEN false ELSE enabled END,
             last_error=$3,updated_at=now() WHERE id=$1`,
            [subscription.id, status || 0, `Falha HTTP ${status || 'desconhecida'}`],
          );
        }
      }
      if (!delivered) throw new HttpError(502, 'Não foi possível entregar a notificação de teste.');
      return { ok: true, delivered };
    }
    throw new HttpError(400, 'Ação de notificação inválida.');
  }
  return { execute, settings };
}
