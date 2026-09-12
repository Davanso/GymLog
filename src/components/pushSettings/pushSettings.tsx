import { useEffect, useState } from 'react';
import { BellRing, Send } from 'lucide-react';
import {
  pushCategories,
  type PushCategory,
  type PushSettings as Settings,
} from '../../../shared/push';
import { applicationServerKey, pushApi, withPushTimeout } from '../../services/pushApi';
import { LoadingState } from '../loadingState/loadingState';
import './pushSettings.css';

const labels: Record<PushCategory, string> = {
  new_assignment: 'Nova ficha atribuída',
  schedule_changed: 'Mudanças na agenda',
  change_request_received: 'Solicitações recebidas',
  change_request_answered: 'Respostas às solicitações',
};

function deviceName() {
  const mobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
  return `${mobile ? 'Celular' : 'Computador'} · ${navigator.platform || 'Navegador'}`;
}

export function PushSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [currentEndpoint, setCurrentEndpoint] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const supported = 'serviceWorker' in navigator && 'PushManager' in window;
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia('(display-mode: standalone)').matches;

  async function registration() {
    const existing = await navigator.serviceWorker.getRegistration('/');
    if (!existing) await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    return withPushTimeout(
      navigator.serviceWorker.ready,
      'O service worker não ficou pronto. Recarregue a página e tente novamente.',
    );
  }

  useEffect(() => {
    let active = true;
    Promise.all([
      pushApi(),
      supported
        ? registration()
            .then((serviceWorker) => serviceWorker.pushManager.getSubscription())
            .then((subscription) => subscription?.endpoint || '')
        : Promise.resolve(''),
    ])
      .then(([nextSettings, endpoint]) => {
        if (!active) return;
        setSettings(nextSettings);
        setCurrentEndpoint(endpoint);
      })
      .catch((cause) => {
        if (active)
          setError(cause instanceof Error ? cause.message : 'Falha ao abrir preferências.');
      });
    return () => {
      active = false;
    };
  }, [supported]);

  async function run(operation: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await operation();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível concluir a ação.');
    } finally {
      setBusy(false);
    }
  }

  async function enable() {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('Permissão de notificação não concedida.');
    const serviceWorker = await registration();
    const existing = await serviceWorker.pushManager.getSubscription();
    let subscription = existing;
    try {
      subscription ||= await withPushTimeout(
        serviceWorker.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey(settings!.publicKey),
        }),
        'O serviço push não respondeu. Confira as permissões do navegador e tente novamente.',
      );
    } catch (cause) {
      if (cause instanceof DOMException && /push service|registration failed/i.test(cause.message))
        throw new Error(
          'O serviço push deste navegador recusou o registro. Abra o GymLog no Chrome ou Edge e tente novamente.',
          { cause },
        );
      throw cause;
    }
    const json = subscription.toJSON();
    const next = await pushApi({
      action: 'subscribe',
      endpoint: subscription.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
      deviceName: deviceName(),
    });
    setSettings(next);
    setCurrentEndpoint(subscription.endpoint);
    setMessage('Notificações ativadas neste dispositivo.');
  }

  async function disable() {
    const serviceWorker = await registration();
    const subscription = await serviceWorker.pushManager.getSubscription();
    if (subscription) {
      await pushApi({ action: 'unsubscribe', endpoint: subscription.endpoint });
      await subscription.unsubscribe();
    }
    setCurrentEndpoint('');
    setSettings(await pushApi());
    setMessage('Notificações desativadas neste dispositivo.');
  }

  async function toggle(category: PushCategory, checked: boolean) {
    const preferences = { ...settings!.preferences, [category]: checked };
    setSettings({ ...settings!, preferences });
    try {
      setSettings(await pushApi({ action: 'preferences', preferences }));
    } catch (cause) {
      setSettings({ ...settings!, preferences: settings!.preferences });
      throw cause;
    }
  }

  if (!settings && !error) return <LoadingState label="Carregando preferências de notificação…" />;

  return (
    <section className="push-settings">
      <header>
        <BellRing aria-hidden="true" />
        <div>
          <h3>Notificações no dispositivo</h3>
          <p>Receba avisos mesmo quando o GymLog não estiver aberto.</p>
        </div>
      </header>
      {isIos && !standalone ? (
        <p className="push-settings__notice">
          No iPhone ou iPad, adicione o GymLog à Tela de Início e abra o app pelo novo ícone para
          ativar as notificações.
        </p>
      ) : !supported ? (
        <p className="push-settings__notice">Este navegador não oferece notificações push.</p>
      ) : !settings?.configured ? (
        <p className="push-settings__notice">{settings?.configurationMessage}</p>
      ) : (
        <>
          <div className="push-settings__actions">
            <button
              className={currentEndpoint ? 'secondary-action' : 'primary-button'}
              type="button"
              disabled={busy}
              onClick={() => void run(currentEndpoint ? disable : enable)}
            >
              {currentEndpoint ? 'Desativar neste dispositivo' : 'Ativar neste dispositivo'}
            </button>
            {currentEndpoint && (
              <button
                className="secondary-action"
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await pushApi({ action: 'test' });
                    setMessage('Notificação de teste enviada.');
                  })
                }
              >
                <Send aria-hidden="true" /> Testar
              </button>
            )}
          </div>
          <fieldset disabled={busy || !currentEndpoint}>
            <legend>Quero receber</legend>
            {pushCategories.map((category) => (
              <label key={category}>
                <input
                  type="checkbox"
                  checked={settings.preferences[category]}
                  onChange={(event) => void run(() => toggle(category, event.target.checked))}
                />
                <span>{labels[category]}</span>
              </label>
            ))}
          </fieldset>
        </>
      )}
      {busy && (
        <div className="push-settings__loading">
          <LoadingState label="Salvando…" />
        </div>
      )}
      {message && (
        <p className="message success" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="message error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
